/**
 * Optional app-wide login (single shared password for small deployments).
 * Set SECURE_CHAT_LOGIN_PASSWORD to enable. Optionally SECURE_CHAT_LOGIN_USERNAME.
 * Use SECURE_CHAT_AUTH_SECRET for HMAC signing (defaults to password — change in production).
 */

import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const SECURE_CHAT_SESSION_COOKIE = 'secure_chat_session'
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7

export function isSecureChatLoginConfigured(): boolean {
  const p = process.env.SECURE_CHAT_LOGIN_PASSWORD
  return typeof p === 'string' && p.length > 0
}

function authSecret(): string {
  return (
    process.env.SECURE_CHAT_AUTH_SECRET ||
    process.env.SECURE_CHAT_LOGIN_PASSWORD ||
    'change-me-in-production'
  )
}

export function createSessionToken(): string {
  const exp = Date.now() + SESSION_MAX_AGE_SEC * 1000
  const body = Buffer.from(JSON.stringify({ exp }), 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', authSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !token.includes('.')) return false
  const i = token.lastIndexOf('.')
  const body = token.slice(0, i)
  const sig = token.slice(i + 1)
  if (!body || !sig) return false
  const expected = crypto.createHmac('sha256', authSecret()).update(body).digest('base64url')
  const a = Buffer.from(sig, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  try {
    if (!crypto.timingSafeEqual(a, b)) return false
  } catch {
    return false
  }
  try {
    const j = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { exp?: number }
    return typeof j.exp === 'number' && Date.now() < j.exp
  } catch {
    return false
  }
}

function ctEqualStrings(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length, 1)
  const bufA = Buffer.alloc(max, 0)
  const bufB = Buffer.alloc(max, 0)
  Buffer.from(a, 'utf8').copy(bufA)
  Buffer.from(b, 'utf8').copy(bufB)
  return a.length === b.length && crypto.timingSafeEqual(bufA, bufB)
}

export function verifyLoginPassword(password: string): boolean {
  const expected = process.env.SECURE_CHAT_LOGIN_PASSWORD
  if (!expected) return false
  return ctEqualStrings(password, expected)
}

export function verifyLoginUsername(username: string): boolean {
  const expected = process.env.SECURE_CHAT_LOGIN_USERNAME
  if (!expected) return true
  return ctEqualStrings(username, expected)
}

/** When login is configured and session invalid, return 401 NextResponse; else null. */
export function requireSecureChatSession(request: NextRequest): NextResponse | null {
  if (!isSecureChatLoginConfigured()) return null
  const token = request.cookies.get(SECURE_CHAT_SESSION_COOKIE)?.value
  if (verifySessionToken(token)) return null
  return NextResponse.json(
    { error: 'Authentication required', requiresLogin: true },
    { status: 401 }
  )
}

export function setSessionCookieOnResponse(
  res: NextResponse,
  token: string,
  request?: NextRequest
): void {
  const host = request?.headers.get('host') ?? ''
  const isLocalhost = /^localhost(:\d+)?$/i.test(host.trim())
  const secure = process.env.NODE_ENV === 'production' && !isLocalhost
  res.cookies.set(SECURE_CHAT_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SECURE_CHAT_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
