export const runtime = 'nodejs'

import { promises as fs } from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/owner'
import { listFiles } from '@/lib/registry/files-registry'
import {
  getDataDir,
  getUploadsDir,
  uploadsDirExists,
  listOwnerFilesOnDisk,
  getOwnerFilePath,
} from '@/lib/persistent-storage'
import { cookies } from 'next/headers'

/**
 * GET /api/debug/storage
 * Returns persistence diagnostics: cwd, paths, ownerId, safe headers, files on disk, registry count.
 * NEVER exposes secrets.
 */
export async function GET(request: NextRequest) {
  try {
    const cwd = process.cwd()
    const dataDir = getDataDir()
    const uploadsDir = getUploadsDir()
    const uploadsDirExistsFlag = await uploadsDirExists()

    const cookieStore = await cookies()
    const ownerIdCookie = cookieStore.get('owner_id')?.value ?? null
    const xClientId = request.headers.get('x-client-id') ?? null
    const cookieHeader = request.headers.get('cookie')
    const cookiePresent = cookieHeader != null && cookieHeader.length > 0

    const { ownerId } = await getOwnerId(request)

    const filesOnDisk = await listOwnerFilesOnDisk(ownerId ?? '')
    const registryFiles = listFiles({ owner_id: ownerId })
    const registryCount = registryFiles.length
    const firstFileIds = registryFiles.slice(0, 10).map(f => f.id)

    let recentWriteCheck: { fileId: string; exists: boolean; size?: number } | null = null
    let diskCheckError: string | null = null
    if (registryFiles.length > 0 && ownerId) {
      const mostRecent = registryFiles.sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )[0]
      try {
        const p = getOwnerFilePath(ownerId, mostRecent.id)
        const stat = await fs.stat(p)
        recentWriteCheck = { fileId: mostRecent.id, exists: true, size: stat.size }
      } catch (err) {
        diskCheckError = err instanceof Error ? err.message : String(err)
        recentWriteCheck = { fileId: mostRecent.id, exists: false }
      }
    }

    const body = {
      ok: true,
      cwd,
      dataDir,
      uploadsDir,
      uploadsDirExists: uploadsDirExistsFlag,
      ownerId: ownerId ?? null,
      requestHeaders: {
        'x-client-id': xClientId != null ? '(present)' : null,
        cookiePresent,
      },
      cookieOwnerIdValue: ownerIdCookie,
      filesOnDiskForOwner: filesOnDisk,
      registryCount,
      registryFirstFileIds: firstFileIds,
      recentWriteCheck,
      ...(diskCheckError != null && { diskCheckError }),
    }

    return NextResponse.json(body)
  } catch (error) {
    console.error('Debug storage error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
