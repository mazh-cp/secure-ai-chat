import { NextRequest, NextResponse } from 'next/server'

/**
 * POST - Validate Azure OpenAI API key and endpoint
 * Body: { apiKey: string, endpoint: string, deploymentName?: string }
 * 
 * This endpoint validates:
 * 1. Endpoint URL format
 * 2. API key format
 * 3. Connection to Azure OpenAI
 * 4. Deployment availability (if deploymentName provided)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { apiKey, endpoint, deploymentName = 'gpt-4o-mini' } = body

    // Validate required fields
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Azure OpenAI API key is required' },
        { status: 400 }
      )
    }

    if (!endpoint || typeof endpoint !== 'string' || !endpoint.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Azure OpenAI endpoint URL is required' },
        { status: 400 }
      )
    }

    // Validate endpoint URL format
    const trimmedEndpoint = endpoint.trim()
    if (!trimmedEndpoint.startsWith('http://') && !trimmedEndpoint.startsWith('https://')) {
      return NextResponse.json(
        { ok: false, error: 'Invalid endpoint URL. Must start with http:// or https://' },
        { status: 400 }
      )
    }

    // Validate API key format (Azure keys are typically 32+ characters)
    const trimmedKey = apiKey.trim()
    if (trimmedKey.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'Invalid API key format. Key appears too short.' },
        { status: 400 }
      )
    }

    // Clean endpoint URL (remove trailing slash)
    const cleanEndpoint = trimmedEndpoint.replace(/\/$/, '')
    
    // Check if this is an APIM gateway endpoint (contains azure-api.net and has a path)
    const isApimGateway = cleanEndpoint.includes('azure-api.net') && cleanEndpoint.split('/').length > 3
    
    // Try to validate by making a test API call to list deployments or test a specific deployment
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      // First, try to list deployments to verify endpoint and key are valid
      // If that fails, try a minimal chat completions call with the specified deployment
      // Using 2025-04-01-preview to match Azure OpenAI SDK standards
      // Support both standard Azure OpenAI and APIM gateway endpoints
      let testEndpoint = `${cleanEndpoint}/openai/deployments?api-version=2025-04-01-preview`
      
      let response = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'api-key': trimmedKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        // Add timeout and error handling
        cache: 'no-store',
      }).catch((fetchErr) => {
        // Handle network errors
        if (fetchErr instanceof TypeError && fetchErr.message.includes('fetch')) {
          throw new Error(`Network error: Unable to reach ${cleanEndpoint}. Please verify the endpoint URL is correct and accessible.`)
        }
        throw fetchErr
      })

      clearTimeout(timeoutId)

      // If listing deployments works, the credentials are valid
      if (response.ok) {
        // If deployment name was provided, verify it exists
        if (deploymentName) {
          const deployments = await response.json().catch(() => ({ data: [] }))
          const deploymentExists = deployments.data?.some((d: any) => 
            d.id === deploymentName || d.name === deploymentName
          )
          
          if (!deploymentExists && deployments.data?.length > 0) {
            return NextResponse.json({
              ok: false,
              error: `Deployment "${deploymentName}" not found. Available deployments: ${deployments.data?.map((d: any) => d.id || d.name).join(', ') || 'none'}`,
              availableDeployments: deployments.data?.map((d: any) => d.id || d.name) || [],
            }, { status: 404 })
          }
        }
        
        return NextResponse.json({ 
          ok: true,
          message: 'Azure OpenAI credentials validated successfully',
          deploymentName: deploymentName || 'not specified',
        })
      }

      // If listing deployments fails, try a minimal chat completions call
      // This will verify the specific deployment exists and is accessible
      // Support both standard Azure OpenAI and APIM gateway endpoints
      if (deploymentName) {
        const chatEndpoint = `${cleanEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2025-04-01-preview`
        
        const chatController = new AbortController()
        const chatTimeoutId = setTimeout(() => chatController.abort(), 10000)
        
        try {
          const chatResponse = await fetch(chatEndpoint, {
            method: 'POST',
            headers: {
              'api-key': trimmedKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [{ role: 'user', content: 'test' }],
              max_tokens: 5,
            }),
            signal: chatController.signal,
          })

          clearTimeout(chatTimeoutId)

          if (chatResponse.ok) {
            return NextResponse.json({ 
              ok: true,
              message: 'Azure OpenAI deployment validated successfully',
              deploymentName,
            })
          }

          // Parse error from chat completions
          const errorData = await chatResponse.json().catch(() => ({}))
          const errorMessage = errorData.error?.message || `HTTP ${chatResponse.status}: ${chatResponse.statusText}`
          const lowerErrorMessage = errorMessage.toLowerCase()

          // Handle specific Azure OpenAI errors
          if (lowerErrorMessage.includes('no suitable backend') || 
              lowerErrorMessage.includes('throttled') || 
              lowerErrorMessage.includes('filtered out')) {
            return NextResponse.json({
              ok: false,
              error: `Deployment "${deploymentName}" is unavailable. Possible causes: 1) Deployment name doesn't match exactly (case-sensitive), 2) Deployment is not in "Succeeded" state, 3) Model capacity exhausted. Please verify in Azure Portal.`,
              deploymentName,
            }, { status: 503 })
          }

          if (chatResponse.status === 404) {
            return NextResponse.json({
              ok: false,
              error: `Deployment "${deploymentName}" not found. Please verify the deployment name matches exactly (case-sensitive) in Azure Portal.`,
              deploymentName,
            }, { status: 404 })
          }

          if (chatResponse.status === 401) {
            return NextResponse.json({
              ok: false,
              error: 'Azure OpenAI authentication failed. Please verify your API key is correct.',
            }, { status: 401 })
          }

          return NextResponse.json({
            ok: false,
            error: `Azure OpenAI error: ${errorMessage}`,
            deploymentName,
          }, { status: chatResponse.status })
        } catch (chatFetchError: unknown) {
          clearTimeout(chatTimeoutId)
          
          if (chatFetchError instanceof Error && chatFetchError.name === 'AbortError') {
            return NextResponse.json(
              { ok: false, error: 'Request timeout while validating deployment' },
              { status: 408 }
            )
          }

          throw chatFetchError
        }
      }

      // If we can't list deployments and no deployment name provided, return generic error
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || 'Failed to connect to Azure OpenAI'

      if (response.status === 401) {
        return NextResponse.json({
          ok: false,
          error: 'Azure OpenAI authentication failed. Please verify your API key is correct.',
        }, { status: 401 })
      }

      return NextResponse.json({
        ok: false,
        error: errorMessage,
      }, { status: response.status })
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId)
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { ok: false, error: 'Request timeout. Please check your endpoint URL and network connection.' },
          { status: 408 }
        )
      }

      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Connection failed'
      
      // Provide more specific error messages
      let userFriendlyError = errorMessage
      if (errorMessage.includes('Network error') || errorMessage.includes('fetch')) {
        userFriendlyError = `Cannot connect to Azure OpenAI endpoint. Please verify: 1) Endpoint URL "${cleanEndpoint}" is correct, 2) Endpoint is accessible from this server, 3) No firewall blocking the connection, 4) Endpoint URL format is correct (should be like https://your-resource.openai.azure.com)`
      } else if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
        userFriendlyError = `Connection timeout. Please verify: 1) Endpoint URL is correct, 2) Network connection is stable, 3) Azure OpenAI service is available`
      } else {
        userFriendlyError = `Failed to connect to Azure OpenAI: ${errorMessage}. Please verify: 1) Endpoint URL is correct, 2) Network allows connections to Azure, 3) API key is valid.`
      }
      
      return NextResponse.json(
        { 
          ok: false, 
          error: userFriendlyError
        },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Validation failed' },
      { status: 500 }
    )
  }
}
