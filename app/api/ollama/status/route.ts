import { NextRequest, NextResponse } from 'next/server'

import { requireSecureChatSession } from '@/lib/app-login'
import { getUserIP } from '@/lib/logging'
import { checkRateLimit } from '@/lib/rate-limiter'
import { getApiKeys } from '@/lib/api-keys-storage'
import { getOllamaStatus, OllamaManageError } from '@/lib/ollama-manage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authBlock = requireSecureChatSession(request)
  if (authBlock) return authBlock

  const clientIP = getUserIP(request)
  const rateCheck = checkRateLimit(clientIP, 'ollama-manage')
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many Ollama management requests. Please wait before retrying.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfter ?? 60) },
      }
    )
  }

  try {
    const keys = await getApiKeys()
    const status = await getOllamaStatus(keys.localBaseUrl)
    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof OllamaManageError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check Ollama status' },
      { status: 500 }
    )
  }
}
