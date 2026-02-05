import { NextResponse } from 'next/server'
import { logEnvValidation } from '@/lib/env-validation'

// No automatic file cleanup: files are deleted only when user explicitly clicks Delete/Clear
let envValidated = false

function ensureEnvValidated() {
  if (!envValidated) {
    logEnvValidation()
    envValidated = true
  }
}

/**
 * General health check endpoint
 * Returns 200 OK if the service is running
 */
export async function GET() {
  try {
    ensureEnvValidated()

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'secure-ai-chat',
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
