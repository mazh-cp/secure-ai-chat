import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import {
  getApiKeys,
  setApiKeys,
  deleteApiKey,
  deleteAllApiKeys,
  isApiKeyConfigured,
  type StoredApiKeys,
} from '@/lib/api-keys-storage'
import { getSecureStorageDir } from '@/lib/app-paths'
import { verifyPinCode, isPinConfigured } from '@/lib/pin-verification'
import { LAKERA_GUARD_URL_DEFAULT, resolveLakeraGuardEndpoint } from '@/lib/lakera-guard-endpoint'

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
        anthropicApiKey: !!keys.anthropicApiKey,
        geminiApiKey: !!keys.geminiApiKey,
        azureOpenAiKey: !!keys.azureOpenAiKey,
        lakeraAiKey: !!keys.lakeraAiKey,
        lakeraProjectId: !!keys.lakeraProjectId,
        lakeraEndpoint: !!keys.lakeraEndpoint,
      },
      // Indicate source (environment or storage)
      source: {
        openAiKey: process.env.OPENAI_API_KEY ? 'environment' : keys.openAiKey ? 'storage' : 'none',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY
          ? 'environment'
          : keys.anthropicApiKey
            ? 'storage'
            : 'none',
        geminiApiKey:
          process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
            ? 'environment'
            : keys.geminiApiKey
              ? 'storage'
              : 'none',
        azureOpenAiKey: process.env.AZURE_OPENAI_API_KEY
          ? 'environment'
          : keys.azureOpenAiKey
            ? 'storage'
            : 'none',
        lakeraAiKey: process.env.LAKERA_AI_KEY
          ? 'environment'
          : keys.lakeraAiKey
            ? 'storage'
            : 'none',
        lakeraProjectId: process.env.LAKERA_PROJECT_ID
          ? 'environment'
          : keys.lakeraProjectId
            ? 'storage'
            : 'none',
        lakeraEndpoint: process.env.LAKERA_ENDPOINT
          ? 'environment'
          : keys.lakeraEndpoint
            ? 'storage'
            : 'none',
      },
      message: 'API keys configuration status retrieved successfully',
    })
  } catch (error) {
    console.error('Error getting API keys status:', error)
    return NextResponse.json({ error: 'Failed to get API keys status' }, { status: 500 })
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
      return NextResponse.json({ error: 'API keys object is required' }, { status: 400 })
    }

    // Validate and prepare keys to save
    const keysToSave: StoredApiKeys = {}

    const keyFieldPresent = (v: unknown) => typeof v === 'string' && v.trim().length > 0
    // Never log key material or project IDs — journald is often world-readable to admins.
    console.log('Received keys to save (presence only):', {
      openAiKey: keyFieldPresent(keys.openAiKey),
      anthropicApiKey: keyFieldPresent(keys.anthropicApiKey),
      geminiApiKey: keyFieldPresent(keys.geminiApiKey),
      azureOpenAiKey: keyFieldPresent(keys.azureOpenAiKey),
      azureOpenAiEndpoint: keyFieldPresent(keys.azureOpenAiEndpoint),
      azureOpenAiApiVersion: keyFieldPresent(keys.azureOpenAiApiVersion),
      lakeraAiKey: keyFieldPresent(keys.lakeraAiKey),
      lakeraProjectId: keyFieldPresent(keys.lakeraProjectId),
      lakeraEndpoint: keyFieldPresent(keys.lakeraEndpoint),
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
            {
              error:
                'Invalid OpenAI API key format. Key should start with "sk-" and be at least 20 characters',
            },
            { status: 400 }
          )
        }
      } else if (!keys.openAiKey || !keys.openAiKey.trim()) {
        console.log('OpenAI key is empty, will not save')
      }
    }

    if (keys.azureOpenAiKey !== undefined) {
      if (
        keys.azureOpenAiKey &&
        typeof keys.azureOpenAiKey === 'string' &&
        keys.azureOpenAiKey.trim()
      ) {
        const trimmedKey = keys.azureOpenAiKey.trim()
        // Azure OpenAI keys are not guaranteed to use the "sk-" prefix; validate by length and placeholder filtering.
        if (
          !trimmedKey.toLowerCase().includes('your') &&
          !trimmedKey.toLowerCase().includes('placeholder') &&
          trimmedKey.length >= 10
        ) {
          keysToSave.azureOpenAiKey = trimmedKey
          console.log('Azure OpenAI key validated and will be saved')
        } else {
          return NextResponse.json(
            { error: 'Invalid Azure OpenAI API key format' },
            { status: 400 }
          )
        }
      }
    }

    if (keys.azureOpenAiEndpoint !== undefined) {
      if (
        keys.azureOpenAiEndpoint &&
        typeof keys.azureOpenAiEndpoint === 'string' &&
        keys.azureOpenAiEndpoint.trim()
      ) {
        const trimmedEndpoint = keys.azureOpenAiEndpoint.trim()
        if (trimmedEndpoint.startsWith('http://') || trimmedEndpoint.startsWith('https://')) {
          keysToSave.azureOpenAiEndpoint = trimmedEndpoint.replace(/\/+$/, '')
        } else {
          return NextResponse.json(
            { error: 'Invalid Azure OpenAI endpoint format. Must be a valid URL (https://...)' },
            { status: 400 }
          )
        }
      } else if (!keys.azureOpenAiEndpoint) {
        // Allow empty string to reset endpoint (deletion may still require explicit reset via UI)
        // No-op here; storage logic will keep existing if env vars are set.
      }
    }

    if (keys.azureOpenAiApiVersion !== undefined) {
      if (
        keys.azureOpenAiApiVersion &&
        typeof keys.azureOpenAiApiVersion === 'string' &&
        keys.azureOpenAiApiVersion.trim()
      ) {
        const trimmed = keys.azureOpenAiApiVersion.trim()
        if (
          !trimmed.toLowerCase().includes('your') &&
          !trimmed.toLowerCase().includes('placeholder')
        ) {
          keysToSave.azureOpenAiApiVersion = trimmed
        } else {
          return NextResponse.json(
            { error: 'Invalid Azure OpenAI API version format' },
            { status: 400 }
          )
        }
      }
    }

    if (keys.anthropicApiKey !== undefined) {
      if (
        keys.anthropicApiKey &&
        typeof keys.anthropicApiKey === 'string' &&
        keys.anthropicApiKey.trim()
      ) {
        const trimmedKey = keys.anthropicApiKey.trim()
        // Anthropic keys typically start with sk-ant- and are at least 20 chars
        if (trimmedKey.length >= 20) {
          keysToSave.anthropicApiKey = trimmedKey
          console.log('Anthropic API key validated and will be saved')
        } else {
          return NextResponse.json(
            { error: 'Invalid Anthropic API key format. Key should be at least 20 characters.' },
            { status: 400 }
          )
        }
      }
    }

    if (keys.geminiApiKey !== undefined) {
      if (keys.geminiApiKey && typeof keys.geminiApiKey === 'string' && keys.geminiApiKey.trim()) {
        const trimmedKey = keys.geminiApiKey.trim()
        if (
          trimmedKey.length >= 20 &&
          !trimmedKey.toLowerCase().includes('your') &&
          !trimmedKey.toLowerCase().includes('placeholder')
        ) {
          keysToSave.geminiApiKey = trimmedKey
          console.log('Gemini API key validated and will be saved')
        } else {
          return NextResponse.json(
            { error: 'Invalid Gemini API key format. Use a key from Google AI Studio (at least 20 characters).' },
            { status: 400 }
          )
        }
      }
    }

    if (keys.lakeraAiKey !== undefined) {
      if (keys.lakeraAiKey && typeof keys.lakeraAiKey === 'string' && keys.lakeraAiKey.trim()) {
        const trimmedKey = keys.lakeraAiKey.trim()
        if (trimmedKey.length >= 20) {
          keysToSave.lakeraAiKey = trimmedKey
          console.log('Lakera AI key validated and will be saved')
        } else {
          return NextResponse.json({ error: 'Invalid Lakera AI key format' }, { status: 400 })
        }
      }
    }

    if (keys.lakeraProjectId !== undefined) {
      if (
        keys.lakeraProjectId &&
        typeof keys.lakeraProjectId === 'string' &&
        keys.lakeraProjectId.trim()
      ) {
        const trimmedId = keys.lakeraProjectId.trim()
        if (trimmedId.length >= 5) {
          keysToSave.lakeraProjectId = trimmedId
          console.log('Lakera Project ID validated and will be saved')
        } else {
          return NextResponse.json({ error: 'Invalid Lakera Project ID format' }, { status: 400 })
        }
      }
    }

    if (keys.lakeraEndpoint !== undefined) {
      if (
        keys.lakeraEndpoint &&
        typeof keys.lakeraEndpoint === 'string' &&
        keys.lakeraEndpoint.trim()
      ) {
        const trimmedEndpoint = keys.lakeraEndpoint.trim()
        if (trimmedEndpoint.startsWith('http://') || trimmedEndpoint.startsWith('https://')) {
          keysToSave.lakeraEndpoint = resolveLakeraGuardEndpoint(trimmedEndpoint)
        } else {
          return NextResponse.json(
            { error: 'Invalid Lakera endpoint format. Must be a valid URL' },
            { status: 400 }
          )
        }
      } else if (!keys.lakeraEndpoint) {
        // Allow empty string to reset to default
        keysToSave.lakeraEndpoint = LAKERA_GUARD_URL_DEFAULT
      }
    }

    // Get existing keys and merge
    const existingKeys = await getApiKeys()
    console.log('Existing keys before save (merged env+file):', {
      openAiKey: !!existingKeys.openAiKey,
      anthropicApiKey: !!existingKeys.anthropicApiKey,
      geminiApiKey: !!existingKeys.geminiApiKey,
      lakeraAiKey: !!existingKeys.lakeraAiKey,
      lakeraProjectId: !!existingKeys.lakeraProjectId,
      lakeraEndpoint: !!existingKeys.lakeraEndpoint,
    })

    // Save keys (will only save non-env-vars)
    // Merge: new keys override existing, but keep existing if new is not provided
    // BUT: Only merge keys that were explicitly provided in the request
    // We pass keysToSave directly to setApiKeys, which will merge with existing internally
    console.log('Keys to save (validated):', {
      openAiKey: !!keysToSave.openAiKey,
      anthropicApiKey: !!keysToSave.anthropicApiKey,
      geminiApiKey: !!keysToSave.geminiApiKey,
      azureOpenAiKey: !!keysToSave.azureOpenAiKey,
      azureOpenAiEndpoint: !!keysToSave.azureOpenAiEndpoint,
      azureOpenAiApiVersion: !!keysToSave.azureOpenAiApiVersion,
      lakeraAiKey: !!keysToSave.lakeraAiKey,
      lakeraProjectId: !!keysToSave.lakeraProjectId,
      lakeraEndpoint: !!keysToSave.lakeraEndpoint,
    })

    // setApiKeys will merge with existing keys internally
    // We pass only the keys that were validated and should be saved
    await setApiKeys(keysToSave)

    // Force a fresh reload to ensure cache is updated
    // This ensures the next GET request returns the correct status
    const savedKeys = await getApiKeys()
    console.log('Keys saved. Verification:', {
      openAiKey: !!savedKeys.openAiKey,
      anthropicApiKey: !!savedKeys.anthropicApiKey,
      geminiApiKey: !!savedKeys.geminiApiKey,
      azureOpenAiKey: !!savedKeys.azureOpenAiKey,
      lakeraAiKey: !!savedKeys.lakeraAiKey,
      lakeraProjectId: !!savedKeys.lakeraProjectId,
      lakeraEndpoint: !!savedKeys.lakeraEndpoint,
    })

    // Double-check by reading directly from file to ensure persistence
    try {
      const { promises: fs } = await import('fs')
      const path = await import('path')
      const storageDir = getSecureStorageDir()
      const keysFilePath = path.join(storageDir, 'api-keys.enc')

      try {
        const fileExists = await fs
          .access(keysFilePath)
          .then(() => true)
          .catch(() => false)
        if (fileExists) {
          console.log('✅ Keys file exists and is accessible')
        } else {
          console.warn('⚠️ Keys file does not exist after save')
        }
      } catch (checkError) {
        console.warn('Could not verify keys file:', checkError)
      }
    } catch (importError) {
      // Ignore import errors in edge cases
    }

    console.log('API keys configured and saved successfully')

    return NextResponse.json({
      success: true,
      message: 'API keys configured successfully',
      configured: {
        openAiKey: !!(keysToSave.openAiKey || existingKeys.openAiKey || process.env.OPENAI_API_KEY),
        anthropicApiKey: !!(
          keysToSave.anthropicApiKey ||
          existingKeys.anthropicApiKey ||
          process.env.ANTHROPIC_API_KEY
        ),
        geminiApiKey: !!(
          keysToSave.geminiApiKey ||
          existingKeys.geminiApiKey ||
          process.env.GEMINI_API_KEY?.trim() ||
          process.env.GOOGLE_API_KEY?.trim()
        ),
        azureOpenAiKey: !!(
          keysToSave.azureOpenAiKey ||
          existingKeys.azureOpenAiKey ||
          process.env.AZURE_OPENAI_API_KEY
        ),
        azureOpenAiEndpoint: !!(
          keysToSave.azureOpenAiEndpoint ||
          existingKeys.azureOpenAiEndpoint ||
          process.env.AZURE_OPENAI_ENDPOINT
        ),
        lakeraAiKey: !!(
          keysToSave.lakeraAiKey ||
          existingKeys.lakeraAiKey ||
          process.env.LAKERA_AI_KEY
        ),
        lakeraProjectId: !!(
          keysToSave.lakeraProjectId ||
          existingKeys.lakeraProjectId ||
          process.env.LAKERA_PROJECT_ID
        ),
        lakeraEndpoint: !!(
          keysToSave.lakeraEndpoint ||
          existingKeys.lakeraEndpoint ||
          process.env.LAKERA_ENDPOINT
        ),
      },
    })
  } catch (error) {
    console.error('Error setting API keys:', error)
    return NextResponse.json({ error: 'Failed to set API keys' }, { status: 500 })
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
        return NextResponse.json({ error: 'Invalid PIN', requiresPin: true }, { status: 401 })
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
    return NextResponse.json({ error: 'Failed to delete API keys' }, { status: 500 })
  }
}
