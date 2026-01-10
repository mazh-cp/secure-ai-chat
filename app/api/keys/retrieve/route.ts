import { NextRequest, NextResponse } from 'next/server'
import { getApiKeys } from '@/lib/api-keys-storage'

/**
 * GET - Retrieve API keys for server-side use
 * This endpoint is for internal server-to-server use only
 * Should not be exposed to clients - keys are retrieved server-side in API routes
 * 
 * Security: This endpoint should only be used by authenticated server-side code
 * In a production environment, consider adding additional authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Get API keys (from environment variables or encrypted storage)
    const keys = await getApiKeys()
    
    // Return keys (only used server-side, never sent to client)
    return NextResponse.json({
      keys: {
        openAiKey: keys.openAiKey || null,
        lakeraAiKey: keys.lakeraAiKey || null,
        lakeraProjectId: keys.lakeraProjectId || null,
        lakeraEndpoint: keys.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
      },
      // Don't expose actual keys in response
      configured: {
        openAiKey: !!keys.openAiKey,
        lakeraAiKey: !!keys.lakeraAiKey,
        lakeraProjectId: !!keys.lakeraProjectId,
        lakeraEndpoint: !!keys.lakeraEndpoint,
      },
    })
  } catch (error) {
    console.error('Error retrieving API keys:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve API keys' },
      { status: 500 }
    )
  }
}
