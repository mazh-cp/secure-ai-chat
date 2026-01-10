import { NextRequest, NextResponse } from 'next/server'
import { 
  getApiKeys, 
  setApiKeys, 
  deleteApiKey, 
  deleteAllApiKeys,
  isApiKeyConfigured,
  type StoredApiKeys 
} from '@/lib/api-keys-storage'
import { verifyPinCode, isPinConfigured } from '@/lib/pin-verification'

/**
 * GET - Get API keys configuration status
 * Returns which keys are configured (without exposing actual keys)
 */
export async function GET() {
  try {
    const keys = await getApiKeys()
    
    return NextResponse.json({
      configured: {
        openAiKey: !!keys.openAiKey,
        lakeraAiKey: !!keys.lakeraAiKey,
        lakeraProjectId: !!keys.lakeraProjectId,
        lakeraEndpoint: !!keys.lakeraEndpoint,
      },
      // Indicate source (environment or storage)
      source: {
        openAiKey: process.env.OPENAI_API_KEY ? 'environment' : (keys.openAiKey ? 'storage' : 'none'),
        lakeraAiKey: process.env.LAKERA_AI_KEY ? 'environment' : (keys.lakeraAiKey ? 'storage' : 'none'),
        lakeraProjectId: process.env.LAKERA_PROJECT_ID ? 'environment' : (keys.lakeraProjectId ? 'storage' : 'none'),
        lakeraEndpoint: process.env.LAKERA_ENDPOINT ? 'environment' : (keys.lakeraEndpoint ? 'storage' : 'none'),
      },
      message: 'API keys configuration status retrieved successfully',
    })
  } catch (error) {
    console.error('Error getting API keys status:', error)
    return NextResponse.json(
      { error: 'Failed to get API keys status' },
      { status: 500 }
    )
  }
}

/**
 * POST - Set or update API keys
 * Body: { keys: StoredApiKeys }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keys } = body

    if (!keys || typeof keys !== 'object') {
      return NextResponse.json(
        { error: 'API keys object is required' },
        { status: 400 }
      )
    }

    // Validate keys
    const keysToSave: StoredApiKeys = {}
    
    if (keys.openAiKey !== undefined) {
      if (keys.openAiKey && typeof keys.openAiKey === 'string' && keys.openAiKey.trim()) {
        keysToSave.openAiKey = keys.openAiKey.trim()
      }
    }
    
    if (keys.lakeraAiKey !== undefined) {
      if (keys.lakeraAiKey && typeof keys.lakeraAiKey === 'string' && keys.lakeraAiKey.trim()) {
        keysToSave.lakeraAiKey = keys.lakeraAiKey.trim()
      }
    }
    
    if (keys.lakeraProjectId !== undefined) {
      if (keys.lakeraProjectId && typeof keys.lakeraProjectId === 'string' && keys.lakeraProjectId.trim()) {
        keysToSave.lakeraProjectId = keys.lakeraProjectId.trim()
      }
    }
    
    if (keys.lakeraEndpoint !== undefined) {
      if (keys.lakeraEndpoint && typeof keys.lakeraEndpoint === 'string' && keys.lakeraEndpoint.trim()) {
        keysToSave.lakeraEndpoint = keys.lakeraEndpoint.trim()
      } else if (!keys.lakeraEndpoint) {
        // Allow empty string to reset to default
        keysToSave.lakeraEndpoint = 'https://api.lakera.ai/v2/guard'
      }
    }

    // Save keys (will only save non-env-vars)
    const existingKeys = await getApiKeys()
    await setApiKeys({ ...existingKeys, ...keysToSave })

    console.log('API keys configured and saved successfully')

    return NextResponse.json({
      success: true,
      message: 'API keys configured successfully',
      configured: {
        openAiKey: !!(keysToSave.openAiKey || existingKeys.openAiKey || process.env.OPENAI_API_KEY),
        lakeraAiKey: !!(keysToSave.lakeraAiKey || existingKeys.lakeraAiKey || process.env.LAKERA_AI_KEY),
        lakeraProjectId: !!(keysToSave.lakeraProjectId || existingKeys.lakeraProjectId || process.env.LAKERA_PROJECT_ID),
        lakeraEndpoint: !!(keysToSave.lakeraEndpoint || existingKeys.lakeraEndpoint || process.env.LAKERA_ENDPOINT),
      },
    })
  } catch (error) {
    console.error('Error setting API keys:', error)
    return NextResponse.json(
      { error: 'Failed to set API keys' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove API key(s)
 * Query params: ?key=openAiKey or ?all=true
 * Requires PIN verification if PIN is configured
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keyName = searchParams.get('key') as keyof StoredApiKeys | null
    const deleteAll = searchParams.get('all') === 'true'

    // Check if PIN is configured
    const pinConfigured = await isPinConfigured()
    
    if (pinConfigured) {
      // Get PIN from request body
      const body = await request.json().catch(() => ({}))
      const { pin } = body

      if (!pin || typeof pin !== 'string') {
        return NextResponse.json(
          { error: 'PIN verification required', requiresPin: true },
          { status: 401 }
        )
      }

      // Verify PIN
      const isValid = await verifyPinCode(pin)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid PIN', requiresPin: true },
          { status: 401 }
        )
      }
    }

    if (deleteAll) {
      await deleteAllApiKeys()
      return NextResponse.json({
        success: true,
        message: 'All API keys removed successfully',
      })
    } else if (keyName) {
      await deleteApiKey(keyName)
      return NextResponse.json({
        success: true,
        message: `API key '${keyName}' removed successfully`,
      })
    } else {
      return NextResponse.json(
        { error: 'Either key parameter or all=true is required' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error deleting API keys:', error)
    return NextResponse.json(
      { error: 'Failed to delete API keys' },
      { status: 500 }
    )
  }
}
