import { NextRequest, NextResponse } from 'next/server'
import { fetchModelLimitsFromAPI, getCachedModelLimits } from '@/lib/model-limits-fetcher'
import { getApiKeys } from '@/lib/api-keys-storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const serverKeys = await getApiKeys()
    const apiKey = serverKeys.openAiKey || request.headers.get('x-openai-key') || request.nextUrl.searchParams.get('key')

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      )
    }

    // Fetch fresh limits from API
    const limitsMap = await fetchModelLimitsFromAPI(apiKey)
    
    // Convert Map to object for JSON response
    const limits: Record<string, number> = {}
    for (const [model, limit] of limitsMap.entries()) {
      limits[model] = limit
    }

    // Also include cached limits
    const cached = getCachedModelLimits()
    const cachedLimits: Record<string, { limit: number; timestamp: number; ageHours: number }> = {}
    const now = Date.now()
    for (const [model, data] of cached.entries()) {
      const ageMs = now - data.timestamp
      const ageHours = Math.floor(ageMs / (60 * 60 * 1000))
      cachedLimits[model] = {
        limit: data.limit,
        timestamp: data.timestamp,
        ageHours,
      }
    }

    return NextResponse.json({
      success: true,
      limits,
      cached: cachedLimits,
      count: limitsMap.size,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to fetch model limits:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch model limits', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
