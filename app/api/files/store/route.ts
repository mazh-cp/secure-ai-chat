import { NextRequest, NextResponse } from 'next/server'
import { storeFile } from '@/lib/persistent-storage'

/**
 * POST - Store a file on the server
 * Body: {
 *   fileId: string
 *   fileName: string
 *   fileContent: string
 *   fileType: string
 *   fileSize: number
 *   scanStatus?: string
 *   scanResult?: string
 *   scanDetails?: object
 *   checkpointTeDetails?: object
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // STABILITY: Validate request size before parsing JSON to prevent memory bloat
    const contentLength = request.headers.get('content-length')
    const MAX_REQUEST_SIZE = 55 * 1024 * 1024 // 55 MB (slightly more than file size limit for overhead)
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

    // Validate required fields
    if (!fileId || !fileName || fileContent === undefined || !fileType || fileSize === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: fileId, fileName, fileContent, fileType, fileSize' },
        { status: 400 }
      )
    }

    // STABILITY: Validate file size early (50 MB limit) to prevent memory bloat
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 50 MB limit. Current size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB` },
        { status: 400 }
      )
    }
    
    // STABILITY: Validate fileContent length matches fileSize to prevent oversized content
    if (typeof fileContent === 'string' && fileContent.length > MAX_FILE_SIZE * 1.5) {
      return NextResponse.json(
        { error: `File content size exceeds allowed limit` },
        { status: 400 }
      )
    }
    
    // STABILITY: Validate file type to prevent processing unsupported formats
    const ALLOWED_TYPES = ['text/plain', 'application/pdf', 'text/markdown', 'application/json', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.json', '.csv', '.docx']
    const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase()
    if (!ALLOWED_TYPES.includes(fileType) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        { error: `File type not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    // Store file
    await storeFile(
      fileId,
      fileName,
      fileContent,
      fileType,
      fileSize,
      {
        scanStatus: scanStatus || 'pending',
        scanResult,
        scanDetails,
        checkpointTeDetails,
      }
    )

    return NextResponse.json({
      success: true,
      fileId,
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
