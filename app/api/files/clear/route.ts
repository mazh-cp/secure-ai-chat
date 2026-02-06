export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/owner'
import { listFiles, markDeleted } from '@/lib/registry/files-registry'
import { clearOwnerFiles } from '@/lib/persistent-storage'
import { clearDerivedForTenant } from '@/lib/storage-canonical'
import { removeDocumentFromRAG } from '@/lib/rag/index'

/**
 * POST or DELETE - Clear all uploaded files for the current owner only.
 * Removes bytes, SQLite rows, and RAG index for owner. Does not touch other owners.
 */
async function handleClear(ownerId: string | null): Promise<NextResponse> {
  const owner = ownerId ?? ''
  const files = listFiles({ owner_id: owner })
  let deletedCount = 0
  for (const file of files) {
    await removeDocumentFromRAG(file.id).catch(() => {})
    const ok = markDeleted(file.id)
    if (ok) deletedCount++
  }
  const bytesDeleted = await clearOwnerFiles(owner)
  await clearDerivedForTenant(owner).catch(() => {})
  return NextResponse.json({
    success: true,
    message: 'All your files cleared successfully',
    deletedFiles: deletedCount,
    bytesDeleted,
  })
}

export async function POST(request: NextRequest) {
  try {
    const { ownerId } = await getOwnerId(request)
    return handleClear(ownerId)
  } catch (error) {
    console.error('Failed to clear files:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear files' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { ownerId } = await getOwnerId(request)
    return handleClear(ownerId)
  } catch (error) {
    console.error('Failed to clear files:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear files' },
      { status: 500 }
    )
  }
}
