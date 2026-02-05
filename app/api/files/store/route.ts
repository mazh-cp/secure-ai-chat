export const runtime = 'nodejs'

import { promises as fs } from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/owner'
import { insertFile } from '@/lib/registry/files-registry'
import { writeOwnerFile, getUploadsDir, getOwnerFilePath } from '@/lib/persistent-storage'
import { buildForensicContext, logForensic } from '@/lib/forensic-log'
import { listFiles } from '@/lib/registry/files-registry'

/**
 * POST - Store a file on the server (canonical registry + disk).
 * Body: application/json with fileId, fileName, fileContent, fileType, fileSize, scanStatus?, scanResult?, scanDetails?, checkpointTeDetails?.
 * Writes bytes to ./data/uploads/<ownerId>/<fileId>; metadata in SQLite only (JSON-only store).
 */
export async function POST(request: NextRequest) {
  try {
    const { ownerId } = await getOwnerId(request)

    const contentLength = request.headers.get('content-length')
    const MAX_REQUEST_SIZE = 55 * 1024 * 1024 // 55 MB
    if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { ok: false, error: { code: 'REQUEST_TOO_LARGE', message: `Request size exceeds ${MAX_REQUEST_SIZE / (1024 * 1024)} MB limit`, details: null } },
        { status: 413 }
      )
    }

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch (parseErr) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON', details: null } },
        { status: 400 }
      )
    }
    const {
      fileId,
      fileName,
      fileContent,
      fileType,
      fileSize,
      scanStatus,
      scanResult,
      scanDetails,
      checkpointTeDetails,
    } = body

    if (!fileId || !fileName || fileContent === undefined || !fileType || fileSize === undefined) {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_FIELDS', message: 'Missing required fields: fileId, fileName, fileContent, fileType, fileSize', details: null } },
        { status: 400 }
      )
    }

    const fileIdStr = typeof fileId === 'string' ? fileId : String(fileId)
    const fileNameStr = typeof fileName === 'string' ? fileName : String(fileName)
    const fileTypeStr = typeof fileType === 'string' ? fileType : String(fileType)
    const fileSizeNum = typeof fileSize === 'number' && !Number.isNaN(fileSize) ? fileSize : Number(fileSize)
    if (Number.isNaN(fileSizeNum) || fileSizeNum < 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_FIELDS', message: 'fileSize must be a non-negative number', details: null } },
        { status: 400 }
      )
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
    if (fileSizeNum > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: { code: 'FILE_TOO_LARGE', message: `File size exceeds 50 MB limit. Current size: ${(fileSizeNum / (1024 * 1024)).toFixed(2)} MB`, details: null } },
        { status: 400 }
      )
    }

    if (typeof fileContent === 'string' && fileContent.length > MAX_FILE_SIZE * 1.5) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONTENT_TOO_LARGE', message: 'File content size exceeds allowed limit', details: null } },
        { status: 400 }
      )
    }

    const ALLOWED_TYPES = ['text/plain', 'application/pdf', 'text/markdown', 'application/json', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.json', '.csv', '.docx']
    const fileExtension = '.' + fileNameStr.split('.').pop()?.toLowerCase()
    if (!ALLOWED_TYPES.includes(fileTypeStr) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FILE_TYPE_NOT_SUPPORTED', message: `File type not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`, details: null } },
        { status: 400 }
      )
    }

    const storageKey = `${ownerId}/${fileIdStr}`
    const content = typeof fileContent === 'string' ? fileContent : String(fileContent)
    const buf = Buffer.from(content, 'utf-8')
    const uploadsDir = getUploadsDir()

    console.log('[STORE]', { ownerId, fileId: fileIdStr, uploadsDir, bytes: buf.length })

    try {
      await writeOwnerFile(ownerId, fileIdStr, content)
    } catch (writeErr) {
      console.error('Failed to write file to disk:', writeErr)
      const msg = writeErr instanceof Error ? writeErr.message : 'Failed to write file to disk'
      return NextResponse.json(
        { ok: false, error: { code: 'WRITE_FAILED', message: msg, details: null } },
        { status: 500 }
      )
    }

    let writtenBytes: number
    try {
      const absolutePath = getOwnerFilePath(ownerId, fileIdStr)
      const stat = await fs.stat(absolutePath)
      writtenBytes = stat.size
      console.log('[STORE] written', { ownerId, fileId: fileIdStr, uploadsDir, bytes: buf.length, writtenBytes, absolutePath })
    } catch (statErr) {
      console.error('Failed to verify file on disk after write:', statErr)
      const msg = statErr instanceof Error ? statErr.message : 'Failed to verify file on disk'
      return NextResponse.json(
        { ok: false, error: { code: 'VERIFY_FAILED', message: msg, details: null } },
        { status: 500 }
      )
    }

    const scanStatusStr = typeof scanStatus === 'string' ? scanStatus : 'pending'
    const scanResultVal = scanResult != null && typeof scanResult === 'string' ? scanResult : null
    const scanDetailsVal = scanDetails != null && typeof scanDetails === 'object' ? scanDetails : null
    const checkpointTeDetailsVal = checkpointTeDetails != null && typeof checkpointTeDetails === 'object' ? checkpointTeDetails : null

    try {
      insertFile({
        id: fileIdStr,
        storage_key: storageKey,
        name: fileNameStr,
        size: fileSizeNum,
        type: fileTypeStr,
        owner_id: ownerId,
        session_id: null,
        scan_status: scanStatusStr,
        scan_result: scanResultVal,
        scan_details: scanDetailsVal,
        checkpoint_te_details: checkpointTeDetailsVal,
      })
    } catch (insertErr) {
      console.error('Failed to insert file into registry:', insertErr)
      const msg = insertErr instanceof Error ? insertErr.message : 'Failed to register file'
      return NextResponse.json(
        { ok: false, error: { code: 'REGISTRY_FAILED', message: msg, details: null } },
        { status: 500 }
      )
    }

    const files = listFiles({ owner_id: ownerId })
    const ctx = buildForensicContext(request, ownerId, files.length, files.map((f) => f.id))
    logForensic('files/store', ctx)

    const storagePathPreview = `data/uploads/${ownerId ?? ''}/${fileIdStr}`
    return NextResponse.json({
      ok: true,
      success: true,
      file: { id: fileIdStr, name: fileNameStr, size: fileSizeNum, mime: fileTypeStr, storagePath: storagePathPreview, createdAt: new Date().toISOString(), ownerId: ownerId ?? undefined },
      ownerId: ownerId ?? undefined,
      fileId: fileIdStr,
      storagePathPreview,
      message: 'File stored successfully',
    })
  } catch (error) {
    console.error('Failed to store file:', error)
    const msg = error instanceof Error ? error.message : 'Failed to store file'
    return NextResponse.json(
      { ok: false, error: { code: 'STORE_FAILED', message: msg, details: null } },
      { status: 500 }
    )
  }
}
