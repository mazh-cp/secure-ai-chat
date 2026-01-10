import { NextResponse } from 'next/server'
import { isTeApiKeyConfiguredSync } from '@/lib/checkpoint-te'

/**
 * GET - Check server-side API key configuration status
 * Returns which API keys are configured via environment variables or secure storage
 * This helps show correct status even when localStorage is empty (new browser/device)
 */
export async function GET() {
  try {
    // Check Check Point TE API key (can be in env var or secure storage)
    const checkpointTeConfigured = 
      !!process.env.CHECKPOINT_TE_API_KEY?.trim() || 
      isTeApiKeyConfiguredSync()

    const status = {
      openAiKey: {
        configured: !!process.env.OPENAI_API_KEY?.trim(),
        source: process.env.OPENAI_API_KEY ? 'environment' : 'localStorage',
      },
      lakeraAiKey: {
        configured: !!process.env.LAKERA_AI_KEY?.trim(),
        source: process.env.LAKERA_AI_KEY ? 'environment' : 'localStorage',
      },
      lakeraProjectId: {
        configured: !!process.env.LAKERA_PROJECT_ID?.trim(),
        source: process.env.LAKERA_PROJECT_ID ? 'environment' : 'localStorage',
      },
      lakeraEndpoint: {
        configured: !!process.env.LAKERA_ENDPOINT?.trim(),
        source: process.env.LAKERA_ENDPOINT ? 'environment' : 'localStorage',
        value: process.env.LAKERA_ENDPOINT || 'https://api.lakera.ai/v2/guard',
      },
      checkpointTeApiKey: {
        configured: checkpointTeConfigured,
        source: process.env.CHECKPOINT_TE_API_KEY ? 'environment' : checkpointTeConfigured ? 'secure-storage' : 'not-configured',
      },
    }

    return NextResponse.json({
      status,
      // Helper flags to check if key is configured from any source
      hasOpenAiKey: status.openAiKey.configured,
      hasLakeraAiKey: status.lakeraAiKey.configured,
      hasLakeraProjectId: status.lakeraProjectId.configured,
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
