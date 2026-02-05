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
        { error: `Request size exceeds ${MAX_REQUEST_SIZE / (1024 * 1024)} MB limit` },
        { status: 413 }
      )
    }

    const body = await request.json()
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
        { error: 'Missing required fields: fileId, fileName, fileContent, fileType, fileSize' },
        { status: 400 }
      )
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 50 MB limit. Current size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB` },
        { status: 400 }
      )
    }

    if (typeof fileContent === 'string' && fileContent.length > MAX_FILE_SIZE * 1.5) {
      return NextResponse.json(
        { error: 'File content size exceeds allowed limit' },
        { status: 400 }
      )
    }

    const ALLOWED_TYPES = ['text/plain', 'application/pdf', 'text/markdown', 'application/json', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.json', '.csv', '.docx']
    const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase()
    if (!ALLOWED_TYPES.includes(fileType) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        { error: `File type not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    const storageKey = `${ownerId}/${fileId}`
    const content = typeof fileContent === 'string' ? fileContent : String(fileContent)
    const buf = Buffer.from(content, 'utf-8')
    const uploadsDir = getUploadsDir()

    console.log('[STORE]', { ownerId, fileId, uploadsDir, bytes: buf.length })

    try {
      await writeOwnerFile(ownerId, fileId, content)
    } catch (writeErr) {
      console.error('Failed to write file to disk:', writeErr)
      return NextResponse.json(
        { error: writeErr instanceof Error ? writeErr.message : 'Failed to write file to disk' },
        { status: 500 }
      )
    }

    let writtenBytes: number
    try {
      const absolutePath = getOwnerFilePath(ownerId, fileId)
      const stat = await fs.stat(absolutePath)
      writtenBytes = stat.size
      console.log('[STORE] written', { ownerId, fileId, uploadsDir, bytes: buf.length, writtenBytes, absolutePath })
    } catch (statErr) {
      console.error('Failed to verify file on disk after write:', statErr)
      return NextResponse.json(
        { error: statErr instanceof Error ? statErr.message : 'Failed to verify file on disk' },
        { status: 500 }
      )
    }

    try {
      insertFile({
        id: fileId,
        storage_key: storageKey,
        name: fileName,
        size: fileSize,
        type: fileType,
        owner_id: ownerId,
        session_id: null,
        scan_status: scanStatus || 'pending',
        scan_result: scanResult ?? null,
        scan_details: scanDetails ?? null,
        checkpoint_te_details: checkpointTeDetails ?? null,
      })
    } catch (insertErr) {
      console.error('Failed to insert file into registry:', insertErr)
      return NextResponse.json(
        { error: insertErr instanceof Error ? insertErr.message : 'Failed to register file' },
        { status: 500 }
      )
    }

    const files = listFiles({ owner_id: ownerId })
    const ctx = buildForensicContext(request, ownerId, files.length, files.map((f) => f.id))
    logForensic('files/store', ctx)

    const storagePathPreview = `data/uploads/${ownerId ?? ''}/${fileId}`
    return NextResponse.json({
      success: true,
      ownerId: ownerId ?? undefined,
      fileId,
      storagePathPreview,
      message: 'File stored successfully',
    })
  } catch (error) {
    console.error('Failed to store file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to store file' },
      { status: 500 }
    )
  }
}
