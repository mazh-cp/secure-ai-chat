/**
 * Centralized RAG namespace derivation.
 * Used by BOTH embed/index and search/retrieval so writes and reads hit the same scope.
 * Namespace is stable per user (owner_id only); session_id is NOT part of namespace
 * so that chat retrieval sees all uploaded files for the user.
 */

export interface RagNamespaceParams {
  userId?: string | null
  projectId?: string | null
  sessionId?: string | null
}

/**
 * Derive a single namespace string for vector store / retrieval scope.
 * Namespace = owner_id only (rag:default when no owner). Session is not part of namespace
 * so upload and chat use the same scope across sessions.
 * Same function must be used when: writing embeddings (indexFileForRAG), retrieval (buildRagContext).
 */
export function getRagNamespace(params: RagNamespaceParams): string {
  const ownerId = params.userId ?? undefined
  if (ownerId) return `rag:${ownerId}`
  return 'rag:default'
}
