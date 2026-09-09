import { createWriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable, Transform } from 'node:stream'
import { NextRequest, NextResponse } from 'next/server'

import { requireSecureChatSession } from '@/lib/app-login'
import { getUserIP } from '@/lib/logging'
import { checkRateLimit } from '@/lib/rate-limiter'
import { getApiKeys } from '@/lib/api-keys-storage'
import {
  assertSafeOllamaModelName,
  cleanupImportStaging,
  ensureOllamaImportsDir,
  getOllamaImportMaxBytes,
  importGgufViaOllamaCreate,
  isOllamaManageEnabled,
  OllamaManageError,
  stagingDirNameForModel,
} from '@/lib/ollama-manage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Large GGUF uploads + create can take a long time. */
export const maxDuration = 1800

export async function POST(request: NextRequest) {
  const authBlock = requireSecureChatSession(request)
  if (authBlock) return authBlock

  if (!isOllamaManageEnabled()) {
    return NextResponse.json(
      { error: 'Ollama model management is disabled (OLLAMA_MANAGE_ENABLED=0).' },
      { status: 403 }
    )
  }

  const clientIP = getUserIP(request)
  const rateCheck = checkRateLimit(clientIP, 'ollama-import')
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many Ollama import requests. Please wait before retrying.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfter ?? 60) },
      }
    )
  }

  let stagingDir = ''
  try {
    const form = await request.formData()
    const nameField = form.get('name')
    const fileField = form.get('file')

    const nameRaw = typeof nameField === 'string' ? nameField : ''
    const safeName = assertSafeOllamaModelName(nameRaw)

    if (!fileField || typeof fileField === 'string') {
      return NextResponse.json(
        { error: 'A .gguf file is required (field name: file).' },
        { status: 400 }
      )
    }

    const file = fileField as File
    const originalName = (file.name || '').toLowerCase()
    if (!originalName.endsWith('.gguf')) {
      return NextResponse.json(
        { error: 'Only .gguf model files can be imported.' },
        { status: 400 }
      )
    }

    const maxBytes = getOllamaImportMaxBytes()
    if (typeof file.size === 'number' && file.size > maxBytes) {
      return NextResponse.json(
        {
          error: `File exceeds OLLAMA_IMPORT_MAX_BYTES (${maxBytes} bytes). Use ollama pull for large library models.`,
        },
        { status: 413 }
      )
    }

    const importsRoot = await ensureOllamaImportsDir()
    stagingDir = path.join(importsRoot, `${stagingDirNameForModel(safeName)}-${Date.now()}`)
    await fs.mkdir(stagingDir, { recursive: true })
    const ggufPath = path.join(stagingDir, 'model.gguf')

    const webStream = file.stream()
    const nodeReadable = Readable.fromWeb(
      webStream as import('node:stream/web').ReadableStream<Uint8Array>
    )

    let written = 0
    const limiter = new Transform({
      transform(chunk, _enc, cb) {
        written += chunk.length
        if (written > maxBytes) {
          cb(
            new OllamaManageError(
              `File exceeds OLLAMA_IMPORT_MAX_BYTES (${maxBytes} bytes).`,
              413
            )
          )
          return
        }
        cb(null, chunk)
      },
    })

    await pipeline(nodeReadable, limiter, createWriteStream(ggufPath))

    const keys = await getApiKeys()
    const result = await importGgufViaOllamaCreate({
      name: safeName,
      ggufPath,
      localBaseUrl: keys.localBaseUrl,
    })

    await cleanupImportStaging(stagingDir)
    stagingDir = ''

    return NextResponse.json({
      ok: true,
      name: result.name,
      message: `Model "${result.name}" imported into Ollama.`,
    })
  } catch (error) {
    if (stagingDir) {
      await cleanupImportStaging(stagingDir)
    }
    if (error instanceof OllamaManageError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import model' },
      { status: 500 }
    )
  }
}
