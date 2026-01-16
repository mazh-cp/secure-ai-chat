import { NextResponse } from 'next/server'
import { clearAllFiles } from '@/lib/persistent-storage'

/**
 * DELETE - Clear all uploaded files and metadata
 * This permanently deletes all files from storage
 */
export async function DELETE() {
  try {
    const result = await clearAllFiles()
    
    return NextResponse.json({
      success: true,
      message: 'All files cleared successfully',
      deletedFiles: result.deletedFiles,
      deletedMetadata: result.deletedMetadata,
    })
  } catch (error) {
    console.error('Failed to clear all files:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear files' },
      { status: 500 }
    )
  }
}
