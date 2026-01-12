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

    // Validate file size (50 MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 50 MB limit. Current size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB` },
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
