'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }
      router.replace(nextPath.startsWith('/') ? nextPath : '/')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold text-theme mb-2">Sign in</h1>
      <p className="text-sm text-theme-muted mb-6">
        This deployment requires a password. Set <code className="text-xs bg-theme-muted/20 px-1 rounded">SECURE_CHAT_LOGIN_PASSWORD</code> on the server.
      </p>
      <form onSubmit={onSubmit} className="space-y-4 glass-card p-6 rounded-2xl border border-palette-border-default/30">
        <div>
          <label className="block text-sm text-theme-muted mb-1">Username (if configured)</label>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-palette-border-default/40 bg-palette-bg-primary/80 px-3 py-2 text-theme"
          />
        </div>
        <div>
          <label className="block text-sm text-theme-muted mb-1">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-palette-border-default/40 bg-palette-bg-primary/80 px-3 py-2 text-theme"
            required
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-berry text-white py-2.5 font-medium disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-theme-muted text-sm">Loading…</div>}>
      <LoginForm />
    </Suspense>
  )
}
