export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/owner'
import { getById, markDeleted } from '@/lib/registry/files-registry'
import { deleteOwnerFile } from '@/lib/persistent-storage'
import { deleteFileDir } from '@/lib/storage-canonical'
import { removeDocumentFromRAG } from '@/lib/rag/index'
import { requireSecureChatSession } from '@/lib/app-login'

/**
 * DELETE - Delete one file (only if owned by current owner).
 * Query params: fileId. Removes bytes, SQLite row, and RAG index.
 */
export async function DELETE(request: NextRequest) {
  try {
    const authBlock = requireSecureChatSession(request)
    if (authBlock) return authBlock

    const { ownerId } = await getOwnerId(request)
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      )
    }

    const file = getById(fileId)
    if (!file || file.owner_id !== ownerId) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    const ok = markDeleted(fileId)
    if (!ok) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    const owner = file.owner_id ?? ownerId ?? ''
    await deleteOwnerFile(owner, fileId).catch(() => {})
    await deleteFileDir(owner, fileId).catch(() => {})
    await removeDocumentFromRAG(fileId).catch(() => {})

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
