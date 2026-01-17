import { NextRequest, NextResponse } from 'next/server'
import { setTeApiKey, getTeApiKey, reloadTeApiKey } from '@/lib/checkpoint-te'
import { verifyPinCode, isPinConfigured } from '@/lib/pin-verification'

/**
 * GET - Check if Check Point TE API key is configured
 * Returns status without exposing the key
 * Forces fresh check by reloading from storage (not using cached value)
 */
export async function GET() {
  try {
    // Force fresh check by getting key directly (this will reload if not cached)
    // This ensures we get the actual state from storage, not a stale cache
    const key = await getTeApiKey()
    const configured = !!key
    
    return NextResponse.json({
      configured,
      message: configured ? 'Check Point TE API key is configured' : 'Check Point TE API key is not configured',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error checking TE API key status:', error)
    return NextResponse.json(
      { error: 'Failed to check API key status' },
      { status: 500 }
    )
  }
}

/**
 * POST - Set or update Check Point TE API key
 * Body: { apiKey: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json(
        { error: 'API key is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Validate API key format
    // Remove any existing prefix if user accidentally included it
    let trimmedKey = apiKey.trim()
    
    // Remove TE_API_KEY_ prefix if user included it (we'll add it when making requests)
    if (trimmedKey.startsWith('TE_API_KEY_')) {
      trimmedKey = trimmedKey.substring('TE_API_KEY_'.length).trim()
    }
    
    // Basic validation - Check Point TE keys are typically alphanumeric
    if (trimmedKey.length < 10) {
      return NextResponse.json(
        { error: 'Invalid API key format. Key appears too short. Please verify your Check Point TE API key.' },
        { status: 400 }
      )
    }
    
    // Additional validation: Check Point TE keys should not contain spaces (except at start/end which we trim)
    if (trimmedKey.includes(' ')) {
      return NextResponse.json(
        { error: 'Invalid API key format. Key should not contain spaces. Please verify your Check Point TE API key.' },
        { status: 400 }
      )
    }

    // Store the key (persists to encrypted file)
    try {
      await setTeApiKey(trimmedKey)
      
      // Force reload to ensure cache is updated
      await reloadTeApiKey()
      
      // Verify the key was actually saved by checking if file exists
      const { promises: fs } = await import('fs')
      const path = await import('path')
      const keyFilePath = path.join(process.cwd(), '.secure-storage', 'checkpoint-te-key.enc')
      
      try {
        const stats = await fs.stat(keyFilePath)
        if (stats.size === 0) {
          throw new Error('Key file is empty after save')
        }
        console.log(`Check Point TE API key verified: file exists (${stats.size} bytes)`)
      } catch (verifyError) {
        console.error('Key file verification failed after save:', verifyError)
        throw new Error(`Key was saved but verification failed: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`)
      }

      console.log('Check Point TE API key configured and saved successfully')

      return NextResponse.json({
        success: true,
        message: 'Check Point TE API key configured successfully',
        configured: true,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
    } catch (saveError) {
      const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error'
      console.error('Error saving Check Point TE API key:', saveError)
      
      // Provide detailed error to client for debugging
      return NextResponse.json(
        { 
          error: `Failed to save Check Point TE API key: ${errorMessage}`,
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in POST /api/te/config:', error)
    return NextResponse.json(
      { error: 'Failed to set API key' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove Check Point TE API key
 * Requires PIN verification if PIN is configured
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check if PIN is configured
    const pinConfigured = await isPinConfigured()
    
    if (pinConfigured) {
      // Require PIN verification
      const body = await request.json().catch(() => ({}))
      const { pin } = body

      if (!pin || typeof pin !== 'string') {
        return NextResponse.json(
          { 
            error: 'PIN verification required to remove API key',
            requiresPin: true,
          },
          { status: 401 }
        )
      }

      // Verify PIN
      const isValid = await verifyPinCode(pin)
      if (!isValid) {
        return NextResponse.json(
          { 
            error: 'PIN is incorrect',
            requiresPin: true,
          },
          { status: 401 }
        )
      }
    }

    // PIN verified (or not configured), proceed with removal
    await setTeApiKey(null)
    
    // Force reload to ensure cache is cleared and fresh state for subsequent GET requests
    await reloadTeApiKey()
    
    console.log('Check Point TE API key removed')

    return NextResponse.json({
      success: true,
      message: 'Check Point TE API key removed successfully',
      configured: false,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error removing TE API key:', error)
    return NextResponse.json(
      { error: 'Failed to remove API key' },
      { status: 500 }
    )
  }
}
