/**
 * Delete a file: mark deleted in registry, remove from storage (./data/uploads/<ownerId>/<fileId>), remove from RAG.
 */

import { deleteOwnerFile } from '@/lib/persistent-storage'
import { getById, markDeleted } from '@/lib/registry/files-registry'
import { removeDocumentFromRAG } from '@/lib/rag/index'

export async function deleteFileById(fileId: string): Promise<boolean> {
  const file = getById(fileId)
  if (!file) return false
  const ok = markDeleted(fileId)
  if (!ok) return false
  const owner = file.owner_id ?? ''
  await deleteOwnerFile(owner, fileId).catch(() => {})
  await removeDocumentFromRAG(fileId).catch(() => {})
  return true
}
