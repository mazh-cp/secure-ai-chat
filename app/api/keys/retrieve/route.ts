import { NextRequest, NextResponse } from 'next/server'
import { getApiKeys } from '@/lib/api-keys-storage'

/**
 * GET - Retrieve API keys status for client-side checks
 * This endpoint returns whether keys are configured without exposing actual key values
 * 
 * Security: This endpoint only returns status (configured/not configured), never actual keys
 * In a production environment, consider adding additional authentication
 */
export const dynamic = 'force-dynamic' // Always fetch fresh data, no caching
export const revalidate = 0 // Disable caching

export async function GET(request: NextRequest) {
  try {
    // Force fresh load of keys (bypass cache)
    // Reload keys to ensure we have the latest status
    const keys = await getApiKeys()
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔑 /api/keys/retrieve - Keys status:', {
        hasOpenAiKey: !!keys.openAiKey,
        hasLakeraKey: !!keys.lakeraAiKey,
        hasProjectId: !!keys.lakeraProjectId,
        endpoint: keys.lakeraEndpoint,
      })
    }
    
    // Return keys status (don't expose actual keys for security)
    // For client-side checks, we return a placeholder 'configured' value if key exists
    const response = {
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
    }
    
    // Prevent caching of this response
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error retrieving API keys:', error)
    return NextResponse.json(
      { 
        error: 'Failed to retrieve API keys',
        configured: {
          openAiKey: false,
          lakeraAiKey: false,
          lakeraProjectId: false,
          lakeraEndpoint: false,
        },
        keys: {
          openAiKey: null,
          lakeraAiKey: null,
          lakeraProjectId: null,
          lakeraEndpoint: 'https://api.lakera.ai/v2/guard',
        },
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  }
}
