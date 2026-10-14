'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * When SECURE_CHAT_LOGIN_PASSWORD is set on the server, redirects unauthenticated users to /login.
 */
export default function AppAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [loginNotConfigured, setLoginNotConfigured] = useState(false)

  useEffect(() => {
    if (pathname === '/login') {
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/status', { credentials: 'include', cache: 'no-store' })
        const data = (await res.json()) as {
          required?: boolean
          authenticated?: boolean
          loginNotConfigured?: boolean
        }
        if (cancelled) return
        if (data.loginNotConfigured) {
          setLoginNotConfigured(true)
          return
        }
        if (data.required && !data.authenticated) {
          router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`)
          return
        }
        setReady(true)
      } catch {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pathname, router])

  if (pathname === '/login') return <>{children}</>
  if (loginNotConfigured) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-xl flex-col items-center justify-center gap-3 px-4 text-center text-theme">
        <p className="text-lg font-semibold">Login is not configured</p>
        <p className="text-sm text-theme-muted">
          This production instance requires a login before the app can be used. An administrator
          must provide <code>SECURE_CHAT_LOGIN_PASSWORD</code> and{' '}
          <code>SECURE_CHAT_AUTH_SECRET</code> to the service environment and restart it.
        </p>
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-theme-muted text-sm">
        Checking session…
      </div>
    )
  }
  return <>{children}</>
}
