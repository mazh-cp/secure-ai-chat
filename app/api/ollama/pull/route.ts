import { NextRequest, NextResponse } from 'next/server'

import { requireSecureChatSession } from '@/lib/app-login'
import { getUserIP } from '@/lib/logging'
import { checkRateLimit } from '@/lib/rate-limiter'
import { getApiKeys } from '@/lib/api-keys-storage'
import {
  assertSafeOllamaModelName,
  OllamaManageError,
  pullOllamaModel,
} from '@/lib/ollama-manage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Pulls can take a long time for large models. */
export const maxDuration = 1800

export async function POST(request: NextRequest) {
  const authBlock = requireSecureChatSession(request)
  if (authBlock) return authBlock

  const clientIP = getUserIP(request)
  const rateCheck = checkRateLimit(clientIP, 'ollama-pull')
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many Ollama pull requests. Please wait before retrying.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfter ?? 60) },
      }
    )
  }

  let name = ''
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: string }
    name = typeof body.name === 'string' ? body.name : ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    assertSafeOllamaModelName(name)
  } catch (error) {
    if (error instanceof OllamaManageError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Invalid model name' }, { status: 400 })
  }

  try {
    const keys = await getApiKeys()
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const progress of pullOllamaModel(name, keys.localBaseUrl)) {
            controller.enqueue(encoder.encode(`${JSON.stringify(progress)}\n`))
          }
          controller.enqueue(
            encoder.encode(`${JSON.stringify({ status: 'success', done: true })}\n`)
          )
          controller.close()
        } catch (error) {
          const message =
            error instanceof OllamaManageError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Pull failed'
          const status = error instanceof OllamaManageError ? error.status : 500
          controller.enqueue(
            encoder.encode(`${JSON.stringify({ error: message, status, done: true })}\n`)
          )
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof OllamaManageError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to pull model' },
      { status: 500 }
    )
  }
}
