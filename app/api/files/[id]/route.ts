export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { deleteFileById } from '@/lib/files/delete-file'
import { requireSecureChatSession } from '@/lib/app-login'

/**
 * DELETE /api/files/:id - Mark file deleted_at, remove from storage, remove RAG chunks/embeddings.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authBlock = requireSecureChatSession(request)
    if (authBlock) return authBlock

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'File id is required' }, { status: 400 })
    }
    const deleted = await deleteFileById(id)
    if (!deleted) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      fileId: id,
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
