import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get OpenAI API key from request headers or environment
    // We'll get it from the request body in a POST, but for GET we check env
    const openAiKey = process.env.OPENAI_API_KEY || request.headers.get('x-openai-key')

    if (!openAiKey) {
      return NextResponse.json(
        { ok: false, error: 'OpenAI API key not configured' },
        { status: 400 }
      )
    }

    // Create a minimal test request with 5 second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return NextResponse.json({ ok: true })
      } else {
        // Don't leak full error details
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || 'Invalid API key or request failed'
        
        // Sanitize error message
        const sanitizedError = errorMessage.includes('Invalid API key') 
          ? 'Invalid API key' 
          : 'OpenAI API error'

        return NextResponse.json(
          { ok: false, error: sanitizedError },
          { status: response.status }
        )
      }
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId)
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { ok: false, error: 'Request timeout' },
          { status: 408 }
        )
      }

      // Sanitize any other errors
      return NextResponse.json(
        { ok: false, error: 'Connection failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    // Catch-all for any unexpected errors
    return NextResponse.json(
      { ok: false, error: 'Health check failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const openAiKey = body.openAiKey || process.env.OPENAI_API_KEY

    if (!openAiKey) {
      return NextResponse.json(
        { ok: false, error: 'OpenAI API key not provided' },
        { status: 400 }
      )
    }

    // Create a minimal test request with 5 second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return NextResponse.json({ ok: true })
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error?.message || 'Invalid API key or request failed'
        
        // Sanitize error message
        const sanitizedError = errorMessage.includes('Invalid API key') 
          ? 'Invalid API key' 
          : 'OpenAI API error'

        return NextResponse.json(
          { ok: false, error: sanitizedError },
          { status: response.status }
        )
      }
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId)
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { ok: false, error: 'Request timeout' },
          { status: 408 }
        )
      }

      return NextResponse.json(
        { ok: false, error: 'Connection failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Health check failed' },
      { status: 500 }
    )
  }
}
