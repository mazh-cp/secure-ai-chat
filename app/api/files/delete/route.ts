import { NextRequest, NextResponse } from 'next/server'
import { deleteFile } from '@/lib/persistent-storage'

/**
 * DELETE - Delete a file from the server
 * Query params: fileId
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      )
    }

    const deleted = await deleteFile(fileId)

    if (!deleted) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      fileId,
      message: 'File deleted successfully',
    })
  } catch (error) {
    console.error('Failed to delete file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete file' },
      { status: 500 }
    )
  }
}
