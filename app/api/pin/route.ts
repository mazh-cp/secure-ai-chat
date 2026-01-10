import { NextRequest, NextResponse } from 'next/server'
import { setPin, verifyPinCode, isPinConfigured, removePin } from '@/lib/pin-verification'

/**
 * GET - Check if verification PIN is configured
 */
export async function GET() {
  try {
    const configured = await isPinConfigured()
    
    return NextResponse.json({
      configured,
      message: configured ? 'Verification PIN is configured' : 'Verification PIN is not configured',
    })
  } catch (error) {
    console.error('Error checking PIN status:', error)
    return NextResponse.json(
      { error: 'Failed to check PIN status' },
      { status: 500 }
    )
  }
}

/**
 * POST - Set or update verification PIN, or verify PIN
 * Body: { action: 'set' | 'verify', pin?: string, currentPin?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, pin, currentPin } = body

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'Action is required (must be "set" or "verify")' },
        { status: 400 }
      )
    }

    if (action === 'set') {
      // Setting or updating PIN
      if (!pin || typeof pin !== 'string') {
        return NextResponse.json(
          { error: 'PIN is required when setting PIN' },
          { status: 400 }
        )
      }

      // If PIN already exists, require current PIN for update
      const configured = await isPinConfigured()
      if (configured) {
        if (!currentPin || typeof currentPin !== 'string') {
          return NextResponse.json(
            { error: 'Current PIN is required to update existing PIN' },
            { status: 400 }
          )
        }

        // Verify current PIN
        const isValid = await verifyPinCode(currentPin)
        if (!isValid) {
          return NextResponse.json(
            { error: 'Current PIN is incorrect' },
            { status: 401 }
          )
        }
      }

      // Validate PIN format
      const trimmedPin = pin.trim()
      if (!/^\d{4,8}$/.test(trimmedPin)) {
        return NextResponse.json(
          { error: 'PIN must be 4-8 digits' },
          { status: 400 }
        )
      }

      // Set new PIN
      await setPin(trimmedPin)

      return NextResponse.json({
        success: true,
        message: configured ? 'PIN updated successfully' : 'PIN configured successfully',
      })
    } else if (action === 'verify') {
      // Verifying PIN
      if (!pin || typeof pin !== 'string') {
        return NextResponse.json(
          { error: 'PIN is required for verification' },
          { status: 400 }
        )
      }

      const isValid = await verifyPinCode(pin)
      
      if (!isValid) {
        return NextResponse.json(
          { error: 'PIN is incorrect' },
          { status: 401 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'PIN verified successfully',
        verified: true,
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "set" or "verify"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error processing PIN request:', error)
    
    if (error instanceof Error) {
      // Return specific error message for validation errors
      if (error.message.includes('PIN must be')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to process PIN request' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove verification PIN
 * Requires PIN verification to remove
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { pin } = body

    // Check if PIN is configured
    const configured = await isPinConfigured()
    if (!configured) {
      return NextResponse.json(
        { error: 'No PIN is configured' },
        { status: 400 }
      )
    }

    // Require PIN verification to remove
    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'PIN is required to remove verification PIN' },
        { status: 400 }
      )
    }

    // Verify PIN
    const isValid = await verifyPinCode(pin)
    if (!isValid) {
      return NextResponse.json(
        { error: 'PIN is incorrect' },
        { status: 401 }
      )
    }

    // Remove PIN
    await removePin()

    return NextResponse.json({
      success: true,
      message: 'Verification PIN removed successfully',
    })
  } catch (error) {
    console.error('Error removing PIN:', error)
    return NextResponse.json(
      { error: 'Failed to remove PIN' },
      { status: 500 }
    )
  }
}
