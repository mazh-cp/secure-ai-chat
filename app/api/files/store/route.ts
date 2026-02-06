export const runtime = 'nodejs'

import crypto from 'crypto'
import { promises as fs } from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/owner'
import { insertFile } from '@/lib/registry/files-registry'
import { getUploadsDir } from '@/lib/persistent-storage'
import { writeRawAndMeta, writeStatus } from '@/lib/storage-canonical'
import { buildForensicContext, logForensic } from '@/lib/forensic-log'
import { listFiles } from '@/lib/registry/files-registry'

/**
 * POST - Store a file on the server (canonical registry + disk).
 * Body: application/json with fileId, fileName, fileContent, fileType, fileSize, scanStatus?, scanResult?, scanDetails?, checkpointTeDetails?.
 * Writes to DATA_DIR/uploads/<tenant>/<fileId>/raw.bin + meta.json and derived/.../status.json (uploaded). Registry gets pipeline_status = uploaded.
 */
export async function POST(request: NextRequest) {
  try {
    const { ownerId } = await getOwnerId(request)
    if (!ownerId || typeof ownerId !== 'string' || ownerId.length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'OWNER_REQUIRED', message: 'Owner ID is required (cookie or X-Client-ID)', details: null } },
        { status: 400 }
      )
    }

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
    const fileId = body.fileId
    const fileName = body.fileName
    const fileContent = body.fileContent
    const fileType = body.fileType
    const fileSize = body.fileSize
    const scanStatus = body.scanStatus
    const scanResult = body.scanResult
    const scanDetails = body.scanDetails
    const checkpointTeDetails = body.checkpointTeDetails

    if (fileId == null || fileName == null || fileContent === undefined || fileType == null || fileSize == null) {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_FIELDS', message: 'Missing required fields: fileId, fileName, fileContent, fileType, fileSize', details: null } },
        { status: 400 }
      )
    }

    const fileIdStr: string = typeof fileId === 'string' ? fileId : String(fileId)
    const fileNameStr: string = typeof fileName === 'string' ? fileName : String(fileName)
    const fileTypeStr: string = typeof fileType === 'string' ? fileType : String(fileType)
    const fileSizeNum: number = typeof fileSize === 'number' && !Number.isNaN(fileSize) ? fileSize : Number(fileSize)
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
    const createdAt = new Date().toISOString()
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex')

    if (process.env.NODE_ENV === 'development') {
      console.log('[FILES/STORE] ownerId=', ownerId, 'fileId=', fileIdStr)
    }
    console.log('[STORE]', { ownerId, fileId: fileIdStr, uploadsDir, bytes: buf.length })

    try {
      await writeRawAndMeta(ownerId, fileIdStr, buf, {
        fileId: fileIdStr,
        name: fileNameStr,
        size: fileSizeNum,
        type: fileTypeStr,
        tenant: ownerId,
        createdAt,
        sha256,
      })
      await writeStatus(ownerId, fileIdStr, {
        status: 'uploaded',
        updatedAt: createdAt,
        message: 'File stored',
      })
    } catch (writeErr) {
      console.error('Failed to write file to disk:', writeErr)
      const msg = writeErr instanceof Error ? writeErr.message : 'Failed to write file to disk'
      return NextResponse.json(
        { ok: false, error: { code: 'WRITE_FAILED', message: msg, details: null } },
        { status: 500 }
      )
    }

    const writtenBytes = buf.length
    console.log('[STORE] written', { ownerId, fileId: fileIdStr, uploadsDir, bytes: buf.length, writtenBytes })

    const scanStatusStr: string = typeof scanStatus === 'string' ? scanStatus : 'pending'
    const scanResultVal: string | null = scanResult != null && typeof scanResult === 'string' ? scanResult : null
    const scanDetailsVal: Record<string, unknown> | null = scanDetails != null && typeof scanDetails === 'object' && !Array.isArray(scanDetails) ? (scanDetails as Record<string, unknown>) : null
    const checkpointTeDetailsVal: Record<string, unknown> | null = checkpointTeDetails != null && typeof checkpointTeDetails === 'object' && !Array.isArray(checkpointTeDetails) ? (checkpointTeDetails as Record<string, unknown>) : null

    try {
      insertFile({
        id: fileIdStr,
        storage_key: storageKey,
        name: fileNameStr,
        size: fileSizeNum,
        type: fileTypeStr,
        owner_id: ownerId ?? null,
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

    const storagePathPreview = `data/uploads/${ownerId}/${fileIdStr}`
    return NextResponse.json({
      ok: true,
      success: true,
      file: {
        id: fileIdStr,
        name: fileNameStr,
        size: fileSizeNum,
        mime: fileTypeStr,
        sha256,
        storagePath: storagePathPreview,
        createdAt,
      },
      ownerId,
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
