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
    
    // Return keys status (don't expose actual keys for security)
    // For client-side checks, we return a placeholder 'configured' value if key exists
    return NextResponse.json({
      keys: {
        // Return placeholder 'configured' instead of null to indicate key is set
        openAiKey: keys.openAiKey ? 'configured' : null,
        lakeraAiKey: keys.lakeraAiKey ? 'configured' : null,
        lakeraProjectId: keys.lakeraProjectId ? 'configured' : null,
        lakeraEndpoint: keys.lakeraEndpoint || 'https://api.lakera.ai/v2/guard',
      },
      // Also return configured status for easier checking
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
