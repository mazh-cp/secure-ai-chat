import { NextRequest, NextResponse } from 'next/server'
import { getTeApiKeySync, createTeAuthHeader, TE_API_BASE_URL } from '@/lib/checkpoint-te'
import FormDataNode from 'form-data'
import { systemLog } from '@/lib/system-logging'

/**
 * POST - Upload file to Check Point Threat Emulation for sandboxing
 * Multipart form data with:
 * - file: the file to upload
 * - request: JSON string with features and te configuration
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const uploadUrl = `${TE_API_BASE_URL}/upload`
  
  try {
    let apiKey = getTeApiKeySync()
    
    if (!apiKey) {
      await systemLog.error('checkpoint_te', 'API key not configured', {
        endpoint: '/api/te/upload',
        method: 'POST',
        statusCode: 400,
      }, { requestId })
      
      return NextResponse.json(
        { error: 'Check Point TE API key is not configured. Please configure it in Settings.' },
        { status: 400 }
      )
    }
    
    // Ensure API key is trimmed (remove any leading/trailing whitespace)
    apiKey = apiKey.trim()
    
    if (!apiKey || apiKey.length === 0) {
      await systemLog.error('checkpoint_te', 'API key is empty', {
        endpoint: '/api/te/upload',
        method: 'POST',
        statusCode: 400,
      }, { requestId })
      
      return NextResponse.json(
        { error: 'Check Point TE API key is empty. Please configure a valid API key in Settings.' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const requestJson = formData.get('request') as string | null

    if (!file) {
      await systemLog.error('checkpoint_te', 'No file provided in upload request', {
        endpoint: '/api/te/upload',
        method: 'POST',
        statusCode: 400,
      }, { requestId })
      
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    // Validate file size (50 MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
    if (file.size > MAX_FILE_SIZE) {
      await systemLog.error('checkpoint_te', 'File size exceeds limit', {
        endpoint: '/api/te/upload',
        method: 'POST',
        statusCode: 400,
        error: `File size ${file.size} exceeds limit ${MAX_FILE_SIZE}`,
      }, { requestId, fileName: file.name, fileSize: file.size, maxFileSize: MAX_FILE_SIZE })
      
      return NextResponse.json(
        { 
          error: `File size exceeds 50 MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          fileSize: file.size,
          maxFileSize: MAX_FILE_SIZE,
        },
        { status: 400 }
      )
    }

    // Parse request JSON or create default
    let requestConfig: {
      features: string[]
      te: {
        reports?: string[]
        images?: string[]
      }
    }

    if (requestJson) {
      try {
        requestConfig = JSON.parse(requestJson)
      } catch {
        return NextResponse.json(
          { error: 'Invalid request JSON format' },
          { status: 400 }
        )
      }
    } else {
      // Default configuration
      requestConfig = {
        features: ['te'],
        te: {
          reports: ['pdf', 'xml'],
          images: ['pdf', 'json'],
        },
      }
    }

    // Ensure features includes 'te'
    if (!requestConfig.features.includes('te')) {
      requestConfig.features.push('te')
    }

    // Convert File to Buffer for multipart form data
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Create multipart form data for Check Point TE API
    // Try native FormData first (Node.js 18+), fallback to form-data package if needed
    const authHeader = createTeAuthHeader(apiKey)
    
    console.log('Uploading file to Check Point TE:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      url: uploadUrl,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.substring(0, Math.min(10, apiKey.length)) + (apiKey.length > 10 ? '...' : ''),
      authHeaderPrefix: authHeader.substring(0, Math.min(30, authHeader.length)) + (authHeader.length > 30 ? '...' : ''),
      requestConfig: JSON.stringify(requestConfig),
    })

    // Use form-data package for better compatibility with external APIs
    // Native FormData in Node.js might not serialize correctly for external fetch calls
    const teFormData = new FormDataNode()
    
    // Append file as buffer with filename
    teFormData.append('file', fileBuffer, {
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
    })
    
    // Append request as JSON string
    teFormData.append('request', JSON.stringify(requestConfig), {
      contentType: 'application/json',
    })

    // Get headers from form-data (includes Content-Type with boundary)
    const formHeaders = teFormData.getHeaders()
    const headers: Record<string, string> = {
      'Authorization': authHeader,
      ...(formHeaders as Record<string, string>),
    }

    console.log('Sending request to Check Point TE:', {
      url: uploadUrl,
      method: 'POST',
      headers: {
        'Authorization': authHeader.substring(0, 30) + '...',
        'Content-Type': formHeaders['content-type'],
      },
      hasFile: !!fileBuffer,
      fileSize: fileBuffer.length,
      requestConfig: JSON.stringify(requestConfig),
    })

    // form-data package creates a stream that needs special handling with fetch
    // Convert the form-data stream to a buffer using proper stream handling
    // Type assertion: form-data implements a Readable-like stream interface
    const formDataStream = teFormData as unknown as {
      on(event: 'data', listener: (chunk: Buffer | string) => void): void
      on(event: 'end', listener: () => void): void
      on(event: 'error', listener: (error: Error) => void): void
      resume(): void
      readableEnded?: boolean
      readableFlowing?: boolean | null
    }
    
    // Collect chunks from the stream using event-based approach
    const chunks: Buffer[] = []
    const formDataBuffer = await new Promise<Buffer>((resolve, reject) => {
      // Set up event listeners
      formDataStream.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'binary'))
      })
      
      formDataStream.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      
      formDataStream.on('error', (error: Error) => {
        reject(error)
      })
      
      // Handle case where stream might already be ended
      if ((formDataStream as { readableEnded?: boolean }).readableEnded) {
        resolve(Buffer.concat(chunks))
        return
      }
      
      // If stream is paused, resume it
      if ((formDataStream as { readableFlowing?: boolean | null }).readableFlowing === false) {
        formDataStream.resume()
      }
    })

    console.log('FormData buffer size:', formDataBuffer.length, 'bytes', { requestId })

    // Convert Buffer to Uint8Array for fetch body (Node.js fetch compatibility)
    const bodyData = new Uint8Array(formDataBuffer)

    // Set timeout for the fetch request (30 seconds)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    let response: Response
    try {
      response = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: bodyData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      
      // Handle timeout or abort
      if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('aborted'))) {
        await systemLog.error('checkpoint_te', 'Upload request timeout (30s)', {
          endpoint: uploadUrl,
          method: 'POST',
          statusCode: 504,
          error: 'Request timeout after 30 seconds',
          duration: Date.now() - startTime,
        }, { requestId, fileName: file.name })
        
        return NextResponse.json(
          { 
            error: 'Request timeout: Check Point TE API did not respond within 30 seconds. The file may be too large or the service may be unavailable.',
            type: 'timeout_error',
          },
          { status: 504 }
        )
      }
      
      // Re-throw other fetch errors to be handled by outer catch
      throw fetchError
    }

    const requestDuration = Date.now() - startTime
    console.log('Check Point TE upload response status:', response.status, response.statusText)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      let errorMessage = `Check Point TE upload failed: ${response.status} ${response.statusText}`
      let errorDetails: unknown = null
      const responseHeaders = Object.fromEntries(response.headers.entries())

      console.error('Check Point TE upload failed:', {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })

      try {
        const contentType = response.headers.get('content-type')
        console.log('Error response content-type:', contentType)
        
        if (contentType && contentType.includes('application/json')) {
          errorDetails = await response.json()
          console.error('Check Point TE error response:', errorDetails)
          const msg = (errorDetails as { message?: string; error?: string })?.message || 
                     (errorDetails as { message?: string; error?: string })?.error ||
                     (errorDetails as { error_description?: string })?.error_description
          if (msg) errorMessage = typeof msg === 'string' ? msg : errorMessage
        } else {
          const text = await response.text()
          console.error('Check Point TE error response (text):', text.substring(0, 500))
          errorDetails = text
          errorMessage += ` - ${text.substring(0, 200)}`
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
        try {
          const text = await response.text()
          errorDetails = text
          errorMessage += ` - ${text.substring(0, 200)}`
        } catch {
          // If we can't read the response at all, use default message
        }
      }

      // Log detailed error to system logs
      await systemLog.error('checkpoint_te', `Upload failed: ${errorMessage}`, {
        endpoint: uploadUrl,
        method: 'POST',
        statusCode: response.status,
        error: errorMessage,
        responseBody: typeof errorDetails === 'string' ? errorDetails.substring(0, 1000) : JSON.stringify(errorDetails).substring(0, 1000),
        requestHeaders: {
          'Authorization': authHeader.substring(0, 30) + '...',
          'Content-Type': formHeaders['content-type'] || 'not set',
        },
        duration: requestDuration,
      }, {
        requestId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        requestConfig: JSON.stringify(requestConfig),
      })

      // Handle specific error codes
      if (response.status === 401) {
        return NextResponse.json(
          { 
            error: 'Invalid Check Point TE API key. Please verify your API key in Settings. The API key may be incorrect or expired.',
            details: errorDetails,
            troubleshooting: 'Please verify that: 1) Your API key is correct, 2) The key has not expired, 3) The key format is correct (should not include the TE_API_KEY_ prefix when entering in Settings).',
          },
          { status: 401 }
        )
      }

      if (response.status === 403) {
        return NextResponse.json(
          { 
            error: 'Check Point TE API access denied. This could be due to: 1) API key does not have file upload permissions, 2) Your server IP address is not allowed to access the API, 3) API key restrictions or policy limits.',
            details: errorDetails,
            troubleshooting: 'Please check: 1) API key permissions in Check Point management console, 2) IP address restrictions (may need to allow your server IP in SmartConsole > Management API > Advanced Settings), 3) API subscription/plan limits.',
          },
          { status: 403 }
        )
      }

      // Handle 400 Bad Request specifically
      if (response.status === 400) {
        return NextResponse.json(
          { 
            error: `Check Point TE upload failed: Bad Request (400). This usually means the request format is incorrect. ${errorMessage}`,
            details: errorDetails,
            troubleshooting: 'Common causes: 1) Invalid file format or unsupported file type, 2) File size exceeds limits, 3) Malformed request JSON, 4) Missing required fields. Check the error details above for specific information.',
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorDetails,
        },
        { status: response.status }
      )
    }

    // Validate response before parsing
    let data: {
      data?: {
        sha256?: string
        sha1?: string
        md5?: string
        te?: {
          images?: Array<{
            id?: string
            revision?: number
          }>
        }
      }
    }

    try {
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Unexpected content type: ${contentType || 'unknown'}`)
      }
      
      data = await response.json()
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format: expected object')
      }
      
      // Validate that at least one hash or TE image ID is present for query
      if (!data.data) {
        throw new Error('Invalid response: missing data field')
      }
      
      const hasHash = !!(data.data.sha256 || data.data.sha1 || data.data.md5)
      const hasTeImage = !!(data.data.te?.images?.[0]?.id)
      
      if (!hasHash && !hasTeImage) {
        throw new Error('Invalid response: missing required fields (hash or TE image ID)')
      }
    } catch (parseError) {
      const errorMsg = parseError instanceof Error ? parseError.message : 'Failed to parse response'
      await systemLog.error('checkpoint_te', `Invalid response format: ${errorMsg}`, {
        endpoint: uploadUrl,
        method: 'POST',
        statusCode: response.status,
        error: errorMsg,
        duration: Date.now() - startTime,
      }, { requestId, fileName: file.name })
      
      return NextResponse.json(
        { 
          error: 'Invalid response from Check Point TE API. Please try again or check system logs.',
          type: 'response_validation_error',
        },
        { status: 502 }
      )
    }

    const successDuration = Date.now() - startTime
    
    console.log('File uploaded to Check Point TE successfully:', {
      sha256: data.data?.sha256,
      teImageId: data.data?.te?.images?.[0]?.id,
      teRevision: data.data?.te?.images?.[0]?.revision,
    })

    // Log successful upload
    await systemLog.info('checkpoint_te', 'File uploaded successfully', {
      endpoint: uploadUrl,
      method: 'POST',
      statusCode: response.status,
      duration: successDuration,
    }, {
      requestId,
      fileName: file.name,
      fileSize: file.size,
      sha256: data.data?.sha256,
      teImageId: data.data?.te?.images?.[0]?.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        sha256: data.data?.sha256,
        sha1: data.data?.sha1,
        md5: data.data?.md5,
        teImageId: data.data?.te?.images?.[0]?.id,
        teRevision: data.data?.te?.images?.[0]?.revision,
      },
    })
  } catch (error) {
    const errorDuration = Date.now() - startTime
    console.error('Check Point TE upload error:', error)
    
    let errorMessage = 'An error occurred during file upload to Check Point TE'
    let statusCode = 500
    let stackTrace: string | undefined

    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage = 'Network error: Could not connect to Check Point TE API. Check your internet connection and firewall settings.'
        statusCode = 503
      }
      stackTrace = error.stack
    } else if (error instanceof Error) {
      errorMessage = error.message
      stackTrace = error.stack
    }

    // Log error to system logs
    await systemLog.error('checkpoint_te', `Upload exception: ${errorMessage}`, {
      endpoint: uploadUrl || 'unknown',
      method: 'POST',
      statusCode,
      error: errorMessage,
      stackTrace,
      duration: errorDuration,
    }, {
      requestId,
      errorType: error instanceof TypeError ? 'TypeError' : error?.constructor?.name || 'Unknown',
    })

    return NextResponse.json(
      { 
        error: errorMessage,
        type: error instanceof TypeError ? 'network_error' : 'unknown_error',
      },
      { status: statusCode }
    )
  }
}
