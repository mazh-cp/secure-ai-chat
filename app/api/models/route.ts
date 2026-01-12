import { NextRequest, NextResponse } from 'next/server'

interface OpenAIModel {
  id: string
  object: string
  created: number
  owned_by: string
}

interface OpenAIModelsResponse {
  object: string
  data: OpenAIModel[]
}

/**
 * GET /api/models
 * Fetches available OpenAI models for the user's API key
 * 
 * Returns list of available chat models (filtered to only chat-compatible models)
 */
export async function GET(request: NextRequest) {
  try {
    // Get API key from server-side storage (priority) or query param (fallback)
    const { getApiKeys } = await import('@/lib/api-keys-storage')
    const serverKeys = await getApiKeys()
    
    const apiKey = serverKeys.openAiKey || request.headers.get('x-openai-key') || request.nextUrl.searchParams.get('key')

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      )
    }

    // Fetch models from OpenAI API
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || 'Failed to fetch models'
        
        // Don't expose sensitive error details
        const sanitizedError = errorMessage.includes('Invalid API key') 
          ? 'Invalid API key' 
          : 'Failed to fetch models'

        return NextResponse.json(
          { error: sanitizedError },
          { status: response.status }
        )
      }

      const data: OpenAIModelsResponse = await response.json()
      
      // Filter to only chat-compatible models (gpt-* models)
      // Sort by name for better UX (newer models first)
      const chatModels = data.data
        .filter(model => model.id.startsWith('gpt-'))
        .sort((a, b) => {
          // Sort by id (newer models like gpt-4o come before gpt-4)
          if (a.id > b.id) return -1
          if (a.id < b.id) return 1
          return 0
        })
        .map(model => ({
          id: model.id,
          name: formatModelName(model.id),
          created: model.created,
          owned_by: model.owned_by,
        }))

      // Add gpt-5 to the list if it's not already there (GPT-5 may not appear in /v1/models endpoint)
      // Check if gpt-5 is already in the list
      const hasGPT5 = chatModels.some(model => model.id === 'gpt-5')
      if (!hasGPT5) {
        // Add gpt-5 at the beginning (newest first)
        chatModels.unshift({
          id: 'gpt-5',
          name: 'GPT-5',
          created: Date.now(), // Use current timestamp as placeholder
          owned_by: 'openai',
        })
      }

      return NextResponse.json({ models: chatModels })
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId)
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 408 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch models' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Models API error:', error)
    return NextResponse.json(
      { error: 'An error occurred while fetching models' },
      { status: 500 }
    )
  }
}

/**
 * Format model ID to a more readable name
 * Examples:
 * - gpt-4o-mini -> GPT-4o Mini
 * - gpt-4o -> GPT-4o
 * - gpt-4-turbo -> GPT-4 Turbo
 */
function formatModelName(modelId: string): string {
  // Special case for gpt-5
  if (modelId === 'gpt-5') {
    return 'GPT-5'
  }
  
  // Remove 'gpt-' prefix and format
  let name = modelId.replace(/^gpt-/, '')
  
  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1)
  
  // Handle special cases
  name = name.replace(/-/g, ' ')
  
  // Capitalize each word
  name = name.replace(/\b\w/g, (char) => char.toUpperCase())
  
  return `GPT-${name}`
}