export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/owner'
import { listFiles } from '@/lib/registry/files-registry'
import { readOwnerFile } from '@/lib/persistent-storage'
import { buildForensicContext, logForensic } from '@/lib/forensic-log'
import type { UploadedFile } from '@/types/files'
import { requireSecureChatSession } from '@/lib/app-login'

/**
 * GET - List files for the current owner (canonical registry).
 * Reads only from registry for this owner_id; file content from disk (./data/uploads/<ownerId>/<fileId>).
 */
export async function GET(request: NextRequest) {
  try {
    const authBlock = requireSecureChatSession(request)
    if (authBlock) return authBlock

    const { ownerId } = await getOwnerId(request)
    if (process.env.NODE_ENV === 'development') {
      console.log('[FILES/LIST] ownerId=', ownerId)
    }
    const files = listFiles({ owner_id: ownerId })
    const owner = ownerId ?? ''

    const list: UploadedFile[] = await Promise.all(
      files.map(async meta => {
        const content = await readOwnerFile(owner, meta.id)
        return {
          id: meta.id,
          name: meta.name,
          size: meta.size,
          type: meta.type,
          content: content ?? '',
          uploadedAt: new Date(meta.uploadedAt),
          scanStatus: meta.scanStatus,
          scanResult: meta.scanResult,
          scanDetails: meta.scanDetails as UploadedFile['scanDetails'],
          checkpointTeDetails: meta.checkpointTeDetails as UploadedFile['checkpointTeDetails'],
        }
      })
    )

    const ctx = buildForensicContext(
      request,
      ownerId,
      list.length,
      list.map(f => f.id)
    )
    logForensic('files/list', ctx)

    return NextResponse.json({
      success: true,
      ownerId: ownerId ?? undefined,
      files: list,
      count: list.length,
    })
  } catch (error) {
    console.error('Failed to list files:', error)
    const msg = error instanceof Error ? error.message : 'Failed to list files'
    return NextResponse.json(
      { ok: false, error: { code: 'LIST_FAILED', message: msg, details: null } },
      { status: 500 }
    )
  }
}
