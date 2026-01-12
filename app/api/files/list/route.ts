import { NextResponse } from 'next/server'
import { listFiles, getFileContent } from '@/lib/persistent-storage'
import { UploadedFile } from '@/types/files'

/**
 * GET - List all stored files with their content
 * Returns files in the format expected by the frontend
 */
export async function GET() {
  try {
    const metadataList = await listFiles()
    
    // Load file contents and convert to UploadedFile format
    const files: UploadedFile[] = await Promise.all(
      metadataList.map(async (meta) => {
        const content = await getFileContent(meta.id)
        return {
          id: meta.id,
          name: meta.name,
          size: meta.size,
          type: meta.type,
          content: content || '',
          uploadedAt: new Date(meta.uploadedAt),
          scanStatus: meta.scanStatus,
          scanResult: meta.scanResult,
          scanDetails: meta.scanDetails,
          checkpointTeDetails: meta.checkpointTeDetails as UploadedFile['checkpointTeDetails'],
        }
      })
    )

    return NextResponse.json({
      success: true,
      files,
      count: files.length,
    })
  } catch (error) {
    console.error('Failed to list files:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list files' },
      { status: 500 }
    )
  }
}
