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

  useEffect(() => {
    if (pathname === '/login') {
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/status', { credentials: 'include', cache: 'no-store' })
        const data = (await res.json()) as { required?: boolean; authenticated?: boolean }
        if (cancelled) return
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
  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-theme-muted text-sm">
        Checking session…
      </div>
    )
  }
  return <>{children}</>
}
