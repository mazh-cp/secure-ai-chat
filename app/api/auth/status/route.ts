import { NextRequest, NextResponse } from 'next/server'
import {
  isSecureChatLoginConfigured,
  isSecureChatLoginMissingInProduction,
  verifySessionToken,
  SECURE_CHAT_SESSION_COOKIE,
} from '@/lib/app-login'

export async function GET(request: NextRequest) {
  const required = isSecureChatLoginConfigured()
  const loginNotConfigured = isSecureChatLoginMissingInProduction()
  const token = request.cookies.get(SECURE_CHAT_SESSION_COOKIE)?.value
  const authenticated = required ? verifySessionToken(token) : !loginNotConfigured
  return NextResponse.json({ required, authenticated, loginNotConfigured })
}
