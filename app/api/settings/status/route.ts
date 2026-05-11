import { NextResponse } from 'next/server'
import { getApiKeys, lakeraGuardApiKeyEnvVarUsed } from '@/lib/api-keys-storage'
import { isTeApiKeyConfiguredSync } from '@/lib/checkpoint-te'
import { config } from '@/lib/config'
import { resolveLakeraGuardEndpoint } from '@/lib/lakera-guard-endpoint'

/**
 * GET - Check server-side API key configuration status
 * Returns which API keys are configured via environment variables or secure storage
 * This helps show correct status even when localStorage is empty (new browser/device)
 */
export async function GET() {
  try {
    const keys = await getApiKeys(true)
    // Check Check Point TE API key (can be in env var or secure storage)
    const checkpointTeConfigured =
      !!process.env.CHECKPOINT_TE_API_KEY?.trim() || isTeApiKeyConfiguredSync()

    const status = {
      openAiKey: {
        configured: !!keys.openAiKey,
        source: process.env.OPENAI_API_KEY ? 'environment' : keys.openAiKey ? 'secure-storage' : 'none',
      },
      anthropicApiKey: {
        configured: !!keys.anthropicApiKey,
        source: process.env.ANTHROPIC_API_KEY
          ? 'environment'
          : keys.anthropicApiKey
            ? 'secure-storage'
            : 'none',
      },
      azureOpenAiKey: {
        configured: !!keys.azureOpenAiKey,
        source: process.env.AZURE_OPENAI_API_KEY
          ? 'environment'
          : keys.azureOpenAiKey
            ? 'secure-storage'
            : 'none',
      },
      geminiApiKey: {
        configured: !!keys.geminiApiKey,
        source:
          process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
            ? 'environment'
            : keys.geminiApiKey
              ? 'secure-storage'
              : 'none',
      },
      lakeraAiKey: {
        configured: !!keys.lakeraAiKey,
        source: lakeraGuardApiKeyEnvVarUsed()
          ? 'environment'
          : keys.lakeraAiKey
            ? 'secure-storage'
            : 'none',
      },
      lakeraProjectId: {
        configured: !!keys.lakeraProjectId,
        source: process.env.LAKERA_PROJECT_ID
          ? 'environment'
          : keys.lakeraProjectId
            ? 'secure-storage'
            : 'none',
      },
      lakeraEndpoint: {
        configured: !!keys.lakeraEndpoint,
        source: process.env.LAKERA_ENDPOINT
          ? 'environment'
          : keys.lakeraEndpoint
            ? 'secure-storage'
            : 'none',
        value: resolveLakeraGuardEndpoint(keys.lakeraEndpoint ?? process.env.LAKERA_ENDPOINT),
      },
      checkpointTeApiKey: {
        configured: checkpointTeConfigured,
        source: process.env.CHECKPOINT_TE_API_KEY
          ? 'environment'
          : checkpointTeConfigured
            ? 'secure-storage'
            : 'not-configured',
      },
    }

    return NextResponse.json({
      status,
      lakeraEnforcement: {
        enforceStrict: config.lakeraEnforceStrict,
        requireProjectId: config.lakeraRequireProjectId,
        enforceInputOutputScan: config.lakeraEnforceInputOutputScan,
        failClosedOnAuthError: config.lakeraFailClosedOnAuthError,
      },
      // Helper flags to check if key is configured from any source
      hasOpenAiKey: !!keys.openAiKey,
      hasAnthropicApiKey: !!keys.anthropicApiKey,
      hasGeminiApiKey: !!keys.geminiApiKey,
      hasAzureOpenAiKey: !!keys.azureOpenAiKey,
      hasLakeraAiKey: !!keys.lakeraAiKey,
      hasLakeraProjectId: !!keys.lakeraProjectId,
      hasCheckpointTeApiKey: status.checkpointTeApiKey.configured,
      // Don't expose actual keys, just configuration status
    })
  } catch (error) {
    console.error('Error checking API key status:', error)
    return NextResponse.json(
      {
        status: {},
        error: 'Failed to check API key status',
      },
      { status: 500 }
    )
  }
}
