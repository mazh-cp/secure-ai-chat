import { NextResponse } from 'next/server'

/**
 * General health check endpoint
 * Returns 200 OK if the service is running
 * Used by service managers (Docker, systemd, Kubernetes) for health checks
 */
export async function GET() {
  try {
    // Basic health check - service is running
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
