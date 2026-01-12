import { NextRequest, NextResponse } from 'next/server'
import { triggerCleanup, getCleanupStatus, initializeCacheCleanup } from '@/lib/cache-cleanup'
import { getStorageStats } from '@/lib/persistent-storage'

// Initialize cleanup service on first access (singleton pattern)
let cleanupInitialized = false

function ensureCleanupInitialized() {
  if (!cleanupInitialized) {
    initializeCacheCleanup()
    cleanupInitialized = true
  }
}

/**
 * GET /api/health/cache
 * Get cache cleanup service status and storage statistics
 */
export async function GET() {
  // Ensure cleanup service is initialized
  ensureCleanupInitialized()
  try {
    const cleanupStatus = getCleanupStatus()
    const storageStats = await getStorageStats()

    return NextResponse.json({
      status: 'ok',
      cacheCleanup: {
        isRunning: cleanupStatus.isRunning,
        intervalHours: cleanupStatus.intervalHours,
        lastCleanupTime: cleanupStatus.lastCleanupTime?.toISOString() || null,
        nextCleanupTime: cleanupStatus.nextCleanupTime?.toISOString() || null,
      },
      storage: {
        fileCount: storageStats.fileCount,
        totalSizeMB: Number((storageStats.totalSize / 1024 / 1024).toFixed(2)),
        oldestFile: storageStats.oldestFile || null,
        newestFile: storageStats.newestFile || null,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Health check cache status failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/health/cache
 * Manually trigger cache cleanup
 */
export async function POST(request: NextRequest) {
  // Ensure cleanup service is initialized
  ensureCleanupInitialized()
  
  try {
    const body = await request.json().catch(() => ({}))
    const { action } = body

    if (action === 'cleanup') {
      const result = await triggerCleanup()
      const storageStats = await getStorageStats()

      return NextResponse.json({
        status: 'ok',
        message: 'Cache cleanup completed',
        cleanup: {
          deletedFiles: result.deletedFiles,
          deletedMetadata: result.deletedMetadata,
          lastCleanupTime: result.lastCleanupTime?.toISOString() || null,
        },
        storage: {
          fileCount: storageStats.fileCount,
          totalSizeMB: Number((storageStats.totalSize / 1024 / 1024).toFixed(2)),
        },
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use { "action": "cleanup" }' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Manual cache cleanup failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
