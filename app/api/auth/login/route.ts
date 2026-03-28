import { NextRequest, NextResponse } from 'next/server'
import {
  createSessionToken,
  isSecureChatLoginConfigured,
  setSessionCookieOnResponse,
  verifyLoginPassword,
  verifyLoginUsername,
} from '@/lib/app-login'

export async function POST(request: NextRequest) {
  if (!isSecureChatLoginConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'App login is not configured (set SECURE_CHAT_LOGIN_PASSWORD).' },
      { status: 400 },
    )
  }

  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null
  const username = typeof body?.username === 'string' ? body.username : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!verifyLoginUsername(username) || !verifyLoginPassword(password)) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
  }

  const token = createSessionToken()
  const res = NextResponse.json({ ok: true })
  setSessionCookieOnResponse(res, token, request)
  return res
}
