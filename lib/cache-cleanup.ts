/**
 * Cache cleanup service
 * Automatically clears uploaded files every 24 hours
 */

import { clearAllFiles, getStorageStats } from './persistent-storage'

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
let cleanupInterval: NodeJS.Timeout | null = null
let lastCleanupTime: Date | null = null

/**
 * Initialize the cache cleanup service
 * This should be called once when the server starts
 */
export function initializeCacheCleanup(): void {
  // Prevent multiple initializations
  if (cleanupInterval) {
    console.log('Cache cleanup service already initialized')
    return
  }

  console.log('Initializing cache cleanup service (24-hour interval)')

  // Run cleanup immediately on startup (optional - comment out if you want to wait 24h)
  // performCleanup().catch(err => console.error('Initial cleanup failed:', err))

  // Schedule periodic cleanup every 24 hours
  cleanupInterval = setInterval(() => {
    performCleanup().catch(err => {
      console.error('Scheduled cache cleanup failed:', err)
    })
  }, CLEANUP_INTERVAL_MS)

  console.log(`Cache cleanup scheduled to run every ${CLEANUP_INTERVAL_MS / (60 * 60 * 1000)} hours`)
}

/**
 * Stop the cache cleanup service
 */
export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    console.log('Cache cleanup service stopped')
  }
}

/**
 * Perform the actual cleanup operation
 */
async function performCleanup(): Promise<{ deletedFiles: number; deletedMetadata: boolean }> {
  const startTime = Date.now()
  console.log('Starting cache cleanup...')

  try {
    // Get stats before cleanup
    const statsBefore = await getStorageStats()
    console.log(`Before cleanup: ${statsBefore.fileCount} files, ${(statsBefore.totalSize / 1024 / 1024).toFixed(2)} MB`)

    // Perform cleanup
    const result = await clearAllFiles()

    // Get stats after cleanup
    const statsAfter = await getStorageStats()
    const duration = Date.now() - startTime

    lastCleanupTime = new Date()

    console.log(`Cache cleanup completed in ${duration}ms:`)
    console.log(`  - Deleted ${result.deletedFiles} files`)
    console.log(`  - Metadata cleared: ${result.deletedMetadata}`)
    console.log(`  - After cleanup: ${statsAfter.fileCount} files, ${(statsAfter.totalSize / 1024 / 1024).toFixed(2)} MB`)

    return result
  } catch (error) {
    console.error('Cache cleanup failed:', error)
    throw error
  }
}

/**
 * Manually trigger cleanup (for health check endpoint)
 */
export async function triggerCleanup(): Promise<{ deletedFiles: number; deletedMetadata: boolean; lastCleanupTime: Date | null }> {
  const result = await performCleanup()
  return {
    ...result,
    lastCleanupTime,
  }
}

/**
 * Get cleanup service status
 */
export function getCleanupStatus(): {
  isRunning: boolean
  intervalHours: number
  lastCleanupTime: Date | null
  nextCleanupTime: Date | null
} {
  const intervalHours = CLEANUP_INTERVAL_MS / (60 * 60 * 1000)
  let nextCleanupTime: Date | null = null

  if (lastCleanupTime && cleanupInterval) {
    nextCleanupTime = new Date(lastCleanupTime.getTime() + CLEANUP_INTERVAL_MS)
  }

  return {
    isRunning: cleanupInterval !== null,
    intervalHours,
    lastCleanupTime,
    nextCleanupTime,
  }
}
