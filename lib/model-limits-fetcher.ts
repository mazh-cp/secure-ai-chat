/**
 * Dynamic Model Limits Fetcher
 * 
 * Fetches model token limits from OpenAI API and caches them.
 * Falls back to hardcoded limits if API is unavailable.
 */

interface ModelLimit {
  model: string
  max_tokens: number
  max_input_tokens?: number
  max_output_tokens?: number
}

interface ModelLimitsResponse {
  data: ModelLimit[]
}

// Cache for model limits (refresh every 24 hours)
let modelLimitsCache: Map<string, { limit: number; timestamp: number }> = new Map()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Fetch model limits from OpenAI API
 */
export async function fetchModelLimitsFromAPI(apiKey: string): Promise<Map<string, number>> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch('https://api.openai.com/v1/fine_tuning/model_limits', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.warn('Failed to fetch model limits from OpenAI API:', {
        status: response.status,
        error: errorData.error?.message || 'Unknown error',
      })
      return new Map()
    }

    const data = await response.json()
    const limitsMap = new Map<string, number>()

    // Handle different response formats
    // Format 1: { data: [{ model: string, max_tokens: number, ... }] }
    // Format 2: Direct array [{ model: string, max_tokens: number, ... }]
    // Format 3: Object with model keys { "gpt-4": { max_tokens: number }, ... }
    
    let items: ModelLimit[] = []
    
    if (Array.isArray(data)) {
      // Direct array format
      items = data
    } else if (data.data && Array.isArray(data.data)) {
      // Nested data array format
      items = data.data
    } else if (typeof data === 'object' && data !== null) {
      // Object format with model keys
      items = Object.entries(data).map(([model, value]: [string, unknown]) => {
        if (typeof value === 'object' && value !== null) {
          const val = value as Record<string, unknown>
          return {
            model,
            max_tokens: val.max_tokens as number,
            max_input_tokens: val.max_input_tokens as number | undefined,
            max_output_tokens: val.max_output_tokens as number | undefined,
          }
        }
        return {
          model,
          max_tokens: typeof value === 'number' ? value : 0,
        }
      })
    }

    // Process items and create a map of model -> max_tokens
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      
      // Use max_tokens or max_input_tokens + max_output_tokens
      const limit = item.max_tokens || 
                   (item.max_input_tokens && item.max_output_tokens 
                     ? item.max_input_tokens + item.max_output_tokens 
                     : item.max_input_tokens || item.max_output_tokens || null)
      
      if (limit && limit > 0 && item.model) {
        limitsMap.set(item.model.toLowerCase(), limit)
      }
    }

    console.log('Fetched model limits from OpenAI API:', {
      count: limitsMap.size,
      models: Array.from(limitsMap.keys()),
    })

    return limitsMap
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Model limits API request timeout')
    } else {
      console.warn('Error fetching model limits from OpenAI API:', error)
    }
    return new Map()
  }
}

/**
 * Get model limit with caching
 * Fetches from API if cache is stale or missing
 */
export async function getModelLimit(
  model: string,
  apiKey: string,
  fallbackLimit?: number
): Promise<number> {
  const normalizedModel = model.toLowerCase()
  const now = Date.now()

  // Check cache first
  const cached = modelLimitsCache.get(normalizedModel)
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.limit
  }

  // Fetch from API
  const limitsMap = await fetchModelLimitsFromAPI(apiKey)
  
  // Update cache with fetched limits
  for (const [modelName, limit] of limitsMap.entries()) {
    modelLimitsCache.set(modelName, { limit, timestamp: now })
  }

  // Check if we have the requested model in the fetched limits
  if (limitsMap.has(normalizedModel)) {
    return limitsMap.get(normalizedModel)!
  }

  // Try prefix matching (e.g., gpt-4-turbo-preview matches gpt-4-turbo)
  for (const [cachedModel, limit] of limitsMap.entries()) {
    if (normalizedModel.startsWith(cachedModel) || cachedModel.startsWith(normalizedModel)) {
      modelLimitsCache.set(normalizedModel, { limit, timestamp: now })
      return limit
    }
  }

  // Use fallback if provided
  if (fallbackLimit !== undefined) {
    console.warn(`Model limit not found in API for ${model}, using fallback: ${fallbackLimit}`)
    return fallbackLimit
  }

  // Return default if no fallback
  console.warn(`Model limit not found for ${model}, using default: 8192`)
  return 8192
}

/**
 * Preload model limits for common models (called on startup)
 */
export async function preloadModelLimits(apiKey: string): Promise<void> {
  if (!apiKey) {
    console.warn('No API key provided for preloading model limits')
    return
  }

  try {
    const limitsMap = await fetchModelLimitsFromAPI(apiKey)
    const now = Date.now()

    for (const [model, limit] of limitsMap.entries()) {
      modelLimitsCache.set(model, { limit, timestamp: now })
    }

    console.log('Preloaded model limits:', {
      count: limitsMap.size,
      models: Array.from(limitsMap.keys()),
    })
  } catch (error) {
    console.warn('Failed to preload model limits:', error)
  }
}

/**
 * Clear the cache (useful for testing or forced refresh)
 */
export function clearModelLimitsCache(): void {
  modelLimitsCache.clear()
}

/**
 * Get all cached model limits (for debugging)
 */
export function getCachedModelLimits(): Map<string, { limit: number; timestamp: number }> {
  return new Map(modelLimitsCache)
}
