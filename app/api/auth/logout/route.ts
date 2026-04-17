import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/app-login'

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res, request)
  return res
}
