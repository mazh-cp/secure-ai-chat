import { NextResponse } from 'next/server'
import {
  getTeApiKeySync,
  getTeEndpointDiagnostics,
  getTeUploadCandidateBases,
  isTeHashLookupOnlyMode,
  getTeSubmitStrategy,
} from '@/lib/checkpoint-te'

/**
 * GET — Safe TE connectivity hints (no key material).
 * Use when debugging 403: confirms resolved TE base URL and suggested outbound IP for allowlists.
 */
export async function GET() {
  const endpoints = getTeEndpointDiagnostics()
  const configured = Boolean(getTeApiKeySync())

  let suggestedOutboundIp: string | null = null
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch('https://api64.ipify.org?format=json', {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(t)
    if (res.ok) {
      const data = (await res.json()) as { ip?: string }
      if (data.ip && typeof data.ip === 'string') {
        suggestedOutboundIp = data.ip
      }
    }
  } catch {
    // ignore — corporate firewall / offline
  }

  const uploadCandidates = getTeUploadCandidateBases().map((b) => `${b}/upload`)

  return NextResponse.json(
    {
      apiKeyConfigured: configured,
      teSubmitStrategy: getTeSubmitStrategy(),
      hashLookupOnly: isTeHashLookupOnlyMode(),
      ...endpoints,
      uploadCandidates,
      suggestedOutboundIp,
      note:
        'Upload tries each uploadCandidates host in order when CHECKPOINT_TECLOUD_BASE_URL is unset. Allowlist suggestedOutboundIp if every host returns 403.',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
