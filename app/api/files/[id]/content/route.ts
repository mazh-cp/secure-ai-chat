export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getById } from '@/lib/registry/files-registry'
import { readOwnerFile } from '@/lib/persistent-storage'
import { requireSecureChatSession } from '@/lib/app-login'

/**
 * GET /api/files/:id/content - Return file content from server storage (./data/uploads/<ownerId>/<fileId>).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authBlock = requireSecureChatSession(request)
    if (authBlock) return authBlock

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'File id is required' }, { status: 400 })
    }
    const file = getById(id)
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const owner = file.owner_id ?? ''
    const content = await readOwnerFile(owner, id)
    if (content === null) {
      return NextResponse.json({ error: 'File content not found' }, { status: 404 })
    }
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Failed to get file content:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get file content' },
      { status: 500 }
    )
  }
}
