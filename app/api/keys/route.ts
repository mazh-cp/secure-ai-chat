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

    // Validate and prepare keys to save
    const keysToSave: StoredApiKeys = {}
    
    console.log('Received keys to save:', {
      openAiKey: keys.openAiKey ? `${keys.openAiKey.substring(0, 10)}...` : 'empty',
      lakeraAiKey: keys.lakeraAiKey ? `${keys.lakeraAiKey.substring(0, 10)}...` : 'empty',
      lakeraProjectId: keys.lakeraProjectId || 'empty',
    })
    
    if (keys.openAiKey !== undefined) {
      if (keys.openAiKey && typeof keys.openAiKey === 'string' && keys.openAiKey.trim()) {
        const trimmedKey = keys.openAiKey.trim()
        // Validate OpenAI key format (should start with sk-)
        if (trimmedKey.startsWith('sk-') && trimmedKey.length >= 20) {
          keysToSave.openAiKey = trimmedKey
          console.log('OpenAI key validated and will be saved')
        } else {
          console.error('Invalid OpenAI key format:', {
            startsWithSk: trimmedKey.startsWith('sk-'),
            length: trimmedKey.length,
          })
          return NextResponse.json(
            { error: 'Invalid OpenAI API key format. Key should start with "sk-" and be at least 20 characters' },
            { status: 400 }
          )
        }
      } else if (!keys.openAiKey || !keys.openAiKey.trim()) {
        console.log('OpenAI key is empty, will not save')
      }
    }
    
    if (keys.lakeraAiKey !== undefined) {
      if (keys.lakeraAiKey && typeof keys.lakeraAiKey === 'string' && keys.lakeraAiKey.trim()) {
        const trimmedKey = keys.lakeraAiKey.trim()
        if (trimmedKey.length >= 20) {
          keysToSave.lakeraAiKey = trimmedKey
          console.log('Lakera AI key validated and will be saved')
        } else {
          return NextResponse.json(
            { error: 'Invalid Lakera AI key format' },
            { status: 400 }
          )
        }
      }
    }
    
    if (keys.lakeraProjectId !== undefined) {
      if (keys.lakeraProjectId && typeof keys.lakeraProjectId === 'string' && keys.lakeraProjectId.trim()) {
        const trimmedId = keys.lakeraProjectId.trim()
        if (trimmedId.length >= 5) {
          keysToSave.lakeraProjectId = trimmedId
          console.log('Lakera Project ID validated and will be saved')
        } else {
          return NextResponse.json(
            { error: 'Invalid Lakera Project ID format' },
            { status: 400 }
          )
        }
      }
    }
    
    if (keys.lakeraEndpoint !== undefined) {
      if (keys.lakeraEndpoint && typeof keys.lakeraEndpoint === 'string' && keys.lakeraEndpoint.trim()) {
        const trimmedEndpoint = keys.lakeraEndpoint.trim()
        if (trimmedEndpoint.startsWith('http://') || trimmedEndpoint.startsWith('https://')) {
          keysToSave.lakeraEndpoint = trimmedEndpoint
        } else {
          return NextResponse.json(
            { error: 'Invalid Lakera endpoint format. Must be a valid URL' },
            { status: 400 }
          )
        }
      } else if (!keys.lakeraEndpoint) {
        // Allow empty string to reset to default
        keysToSave.lakeraEndpoint = 'https://api.lakera.ai/v2/guard'
      }
    }

    // Get existing keys and merge
    const existingKeys = await getApiKeys()
    console.log('Existing keys before save:', {
      openAiKey: !!existingKeys.openAiKey,
      lakeraAiKey: !!existingKeys.lakeraAiKey,
      lakeraProjectId: !!existingKeys.lakeraProjectId,
    })
    
    // Save keys (will only save non-env-vars)
    // Merge: new keys override existing, but keep existing if new is not provided
    const mergedKeys: StoredApiKeys = { ...existingKeys }
    if (keysToSave.openAiKey !== undefined) mergedKeys.openAiKey = keysToSave.openAiKey
    if (keysToSave.lakeraAiKey !== undefined) mergedKeys.lakeraAiKey = keysToSave.lakeraAiKey
    if (keysToSave.lakeraProjectId !== undefined) mergedKeys.lakeraProjectId = keysToSave.lakeraProjectId
    if (keysToSave.lakeraEndpoint !== undefined) mergedKeys.lakeraEndpoint = keysToSave.lakeraEndpoint
    
    console.log('Merged keys to save:', {
      openAiKey: !!mergedKeys.openAiKey,
      lakeraAiKey: !!mergedKeys.lakeraAiKey,
      lakeraProjectId: !!mergedKeys.lakeraProjectId,
      lakeraEndpoint: !!mergedKeys.lakeraEndpoint,
    })
    
    await setApiKeys(mergedKeys)
    
    // Verify keys were saved
    const savedKeys = await getApiKeys()
    console.log('Keys saved. Verification:', {
      openAiKey: !!savedKeys.openAiKey,
      lakeraAiKey: !!savedKeys.lakeraAiKey,
      lakeraProjectId: !!savedKeys.lakeraProjectId,
      lakeraEndpoint: !!savedKeys.lakeraEndpoint,
    })

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
