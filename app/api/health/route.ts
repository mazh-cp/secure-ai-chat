import { NextResponse } from 'next/server'
import { initializeCacheCleanup } from '@/lib/cache-cleanup'
import { logEnvValidation } from '@/lib/env-validation'

// Initialize cache cleanup service on first health check (singleton pattern)
let cleanupInitialized = false
let envValidated = false

function ensureCleanupInitialized() {
  if (!cleanupInitialized) {
    initializeCacheCleanup()
    cleanupInitialized = true
  }
}

function ensureEnvValidated() {
  if (!envValidated) {
    logEnvValidation()
    envValidated = true
  }
}

/**
 * General health check endpoint
 * Returns 200 OK if the service is running
 * Used by service managers (Docker, systemd, Kubernetes) for health checks
 * Also initializes the cache cleanup service (24-hour file cleanup)
 */
export async function GET() {
  try {
    // Initialize cache cleanup service on first health check
    ensureCleanupInitialized()
    
    // Validate environment on first health check (non-fatal)
    ensureEnvValidated()

    // Basic health check - service is running
    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'secure-ai-chat',
        cacheCleanup: 'initialized',
      },
      { status: 200 }
    )
  } catch (error) {
    // If we can't even respond, something is seriously wrong
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        service: 'secure-ai-chat',
      },
      { status: 500 }
    )
  }
}
