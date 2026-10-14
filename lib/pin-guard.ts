import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUserIP } from '@/lib/logging'
import { isPinConfigured, pinLockoutRemainingMs, verifyPinCode } from '@/lib/pin-verification'

/**
 * Gate for changing or deleting stored credentials. Returns null when allowed (no PIN configured,
 * or a valid PIN supplied); otherwise a 401 `requiresPin` / 429 lockout response.
 */
export async function requirePinForProtectedChange(
  request: NextRequest,
  pin: unknown,
  action: string
): Promise<NextResponse | null> {
  if (!(await isPinConfigured())) return null

  const clientKey = getUserIP(request)
  const lockedMs = pinLockoutRemainingMs(clientKey)
  if (lockedMs > 0) {
    const retryAfter = Math.ceil(lockedMs / 1000)
    return NextResponse.json(
      {
        error: `Too many incorrect PIN attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  if (typeof pin !== 'string' || !pin.trim()) {
    return NextResponse.json(
      { error: `PIN verification required to ${action}`, requiresPin: true, code: 'PIN_REQUIRED' },
      { status: 401 }
    )
  }

  if (!(await verifyPinCode(pin, clientKey))) {
    return NextResponse.json(
      { error: 'PIN is incorrect', requiresPin: true, code: 'PIN_INCORRECT' },
      { status: 401 }
    )
  }
  return null
}
