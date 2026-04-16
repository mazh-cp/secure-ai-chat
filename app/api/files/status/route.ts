export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/owner'
import { getById } from '@/lib/registry/files-registry'
import { readStatus } from '@/lib/storage-canonical'
import { requireSecureChatSession } from '@/lib/app-login'

/**
 * GET /api/files/status?fileId= — Return pipeline status for a file.
 * Success: { ok: true, data: { fileId, status, updatedAt, message?, error? } }
 * Error: { ok: false, error: { code, message, details? } }
 * Status: uploaded | extracting | scanning | indexing | ready | blocked | failed
 */
export async function GET(request: NextRequest) {
  try {
    const authBlock = requireSecureChatSession(request)
    if (authBlock) return authBlock

    const { ownerId } = await getOwnerId(request)
    if (!ownerId || typeof ownerId !== 'string' || ownerId.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'OWNER_REQUIRED',
            message: 'Owner ID is required (cookie or X-Client-ID)',
            details: null,
          },
        },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    if (!fileId || fileId.trim() === '') {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'MISSING_FILE_ID',
            message: 'Query parameter fileId is required',
            details: null,
          },
        },
        { status: 400 }
      )
    }

    const file = getById(fileId.trim())
    if (!file || file.owner_id !== ownerId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found or access denied',
            details: null,
          },
        },
        { status: 404 }
      )
    }

    const statusPayload = await readStatus(ownerId, fileId.trim())
    const status = statusPayload?.status ?? (file.pipeline_status as string) ?? 'uploaded'
    const updatedAt = statusPayload?.updatedAt ?? file.uploadedAt
    const message = statusPayload?.message
    const error = statusPayload?.error

    return NextResponse.json({
      ok: true,
      data: {
        fileId: file.id,
        status,
        updatedAt,
        ...(message != null && { message }),
        ...(error != null && { error }),
      },
    })
  } catch (err) {
    console.error('Failed to get file status:', err)
    const msg = err instanceof Error ? err.message : 'Failed to get file status'
    return NextResponse.json(
      { ok: false, error: { code: 'STATUS_FAILED', message: msg, details: null } },
      { status: 500 }
    )
  }
}
