/**
 * Centralized RAG scope: namespace + fileIds used for both embed/index and retrieval.
 * Namespace is owner_id only. File list is by owner_id so chat sees ALL uploaded files
 * (session_id only as optional extra filter when provided).
 */

import { getRagNamespace } from './rag-namespace'
import type { RegistryFile } from '@/lib/registry/files-registry'

export interface RagScopeParams {
  owner_id?: string | null
  session_id?: string | null
}

export interface RagScope {
  namespace: string
  fileIds: string[]
}

/**
 * Get scope (namespace + file IDs). Namespace = getRagNamespace({ owner_id }).
 * listFiles is called with owner_id only so retrieval sees all user files;
 * session_id is optional extra filter (when present, filters to that session too).
 */
export function getRagScope(
  listFiles: (scope?: { owner_id?: string | null; session_id?: string | null }) => RegistryFile[],
  params: RagScopeParams
): RagScope {
  const namespace = getRagNamespace({ userId: params.owner_id ?? undefined })
  const files = listFiles({
    owner_id: params.owner_id ?? undefined,
    session_id: params.session_id ?? undefined,
  })
  const fileIds = files.map(f => f.id)
  return { namespace, fileIds }
}
