'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

interface LayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Chat', href: '/', icon: '💬' },
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Risk Map', href: '/risk-map', icon: '🛡️' },
  { name: 'Files', href: '/files', icon: '📁' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
]

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()
  const [logoData, setLogoData] = useState<string | null>(null)
  const [openAIStatus, setOpenAIStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')

  // Load logo from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadLogo = () => {
        const storedSettings = localStorage.getItem('appSettings')
        if (storedSettings) {
          try {
            const parsed = JSON.parse(storedSettings)
            if (parsed.logoData) {
              setLogoData(parsed.logoData)
            } else {
              setLogoData(null)
            }
          } catch (error) {
            console.error('Failed to load logo settings:', error)
            setLogoData(null)
          }
        } else {
          setLogoData(null)
        }
      }

      loadLogo()
      window.addEventListener('settingsUpdated', loadLogo)
      return () => window.removeEventListener('settingsUpdated', loadLogo)
    }
  }, [])

  // Poll OpenAI health status
  useEffect(() => {
    const checkOpenAIHealth = async () => {
      try {
        // Get API key from localStorage
        const stored = localStorage.getItem('apiKeys')
        if (!stored) {
          setOpenAIStatus('disconnected')
          return
        }

        const apiKeys = JSON.parse(stored)
        if (!apiKeys?.openAiKey) {
          setOpenAIStatus('disconnected')
          return
        }

        const response = await fetch('/api/health/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ openAiKey: apiKeys.openAiKey }),
        })
        const data = await response.json()
        setOpenAIStatus(data.ok ? 'connected' : 'disconnected')
      } catch (error) {
        setOpenAIStatus('disconnected')
      }
    }

    // Check immediately
    checkOpenAIHealth()

    // Poll every 45 seconds
    const interval = setInterval(checkOpenAIHealth, 45000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen relative">
      {/* Animated background overlay - Earthy Brown */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-copper/20 via-harvest-gold/20 to-thunder/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 right-1/2 w-full h-full bg-gradient-to-tl from-copper/20 via-harvest-gold/20 to-thunder/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64`}
      >
        <div className="h-full glass-dark rounded-r-3xl border-r-2 p-6 flex flex-col" style={{ borderColor: "rgb(var(--border))" }}>
          {/* Header Section */}
          <div className="flex h-16 items-center justify-between border-b border-palette-border-default/20 pb-4 mb-6">
            {logoData ? (
              <div className="flex items-center flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoData}
                  alt="Site Logo"
                  className="h-10 w-auto max-w-[200px] object-contain"
                  onError={() => setLogoData(null)}
                />
              </div>
            ) : (
              <div className="flex-1"></div>
            )}
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-theme-muted hover:text-theme lg:hidden transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href))
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium
                    transition-all duration-300 relative overflow-hidden
                    ${isActive
                      ? 'glass-card text-theme shadow-lg scale-105'
                      : 'text-theme-muted hover:text-theme hover:glass-button'
                    }
                  `}
                >
                  {isActive && (
                    <div className="absolute inset-0 liquid-shimmer"></div>
                  )}
                  <span className="text-lg relative z-10">{item.icon}</span>
                  <span className="relative z-10">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-palette-border-default/20 pt-4 mt-6">
            <div className="text-xs text-theme-subtle">
              <p className="font-semibold text-theme-muted">Secure AI Chat</p>
              <p className="mt-1">Powered by Lakera AI</p>
              <p className="mt-1 text-theme-subtle/80">App version 1.0.5</p>
              <p className="mt-1 text-theme-subtle/70">© 2026 All rights reserved</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-palette-bg-primary/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : ''}`}>
        {/* Top bar */}
        <header 
          className="sticky top-0 z-20 glass-dark border-b"
          style={{
            background: "rgb(var(--header))",
            borderColor: "rgb(var(--border))",
          }}
        >
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-theme-muted hover:text-theme lg:hidden transition-colors"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            <div className="flex-1"></div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:block glass-button px-4 py-2 rounded-full">
                <div className="flex items-center space-x-2 text-sm text-theme-muted" title={openAIStatus === 'connected' ? 'OpenAI: Connected' : openAIStatus === 'disconnected' ? 'OpenAI: Disconnected' : 'OpenAI: Checking...'}>
                  <div className={`h-2 w-2 rounded-full pulse-glow ${
                    openAIStatus === 'connected' ? 'bg-green-400' : 
                    openAIStatus === 'disconnected' ? 'bg-red-400' : 
                    'bg-brand-berry'
                  }`}></div>
                  <span>Secure Connection</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content - No padding, Bento Grid handles it */}
        <main className="relative z-10 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  )
}
