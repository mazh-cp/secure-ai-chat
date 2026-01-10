/**
 * UniFi-Style Theme Toggle Component
 * 
 * Simple, instant theme switching using the theme utility module.
 * Changes only the html[data-theme] attribute for instant switching.
 */

'use client'

import { useEffect, useState } from 'react'
import { getTheme, setTheme, toggleTheme, type Theme } from '@/lib/theme/setTheme'

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  // Initialize theme from DOM (already set by bootstrap script)
  useEffect(() => {
    setMounted(true)
    
    // Read theme from DOM (set by bootstrap script)
    const currentTheme = getTheme()
    setThemeState(currentTheme)

    // Listen for theme changes (from other components or system preference)
    const handleThemeChange = (e: CustomEvent<{ theme: Theme }>) => {
      setThemeState(e.detail.theme)
    }
    
    window.addEventListener('themechange', handleThemeChange as EventListener)
    
    return () => {
      window.removeEventListener('themechange', handleThemeChange as EventListener)
    }
  }, [])

  // Handle toggle click
  const handleToggle = () => {
    const newTheme = toggleTheme()
    setThemeState(newTheme)
  }

  // Don't render theme-dependent content until mounted (prevents hydration mismatch)
  if (!mounted) {
    return (
      <button
        type="button"
        className="theme-toggle"
        aria-label="Toggle theme"
        title="Toggle theme"
        disabled
        style={{
          background: 'rgb(var(--surface-1))',
          border: '1px solid rgb(var(--border))',
          color: 'rgb(var(--text-1))',
          padding: '0.5rem 0.75rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem',
          cursor: 'not-allowed',
          opacity: 0.5,
        }}
      >
        <span>...</span>
      </button>
    )
  }

  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      style={{
        background: 'rgb(var(--surface-1))',
        border: '1px solid rgb(var(--border))',
        color: 'rgb(var(--text-1))',
        padding: '0.5rem 0.75rem',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.875rem',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: prefersReducedMotion ? 'none' : 'all 100ms ease',
      }}
      onMouseEnter={(e) => {
        if (!prefersReducedMotion) {
          e.currentTarget.style.background = 'rgb(var(--hover))'
          e.currentTarget.style.borderColor = 'rgba(var(--accent), 0.3)'
        }
      }}
      onMouseLeave={(e) => {
        if (!prefersReducedMotion) {
          e.currentTarget.style.background = 'rgb(var(--surface-1))'
          e.currentTarget.style.borderColor = 'rgb(var(--border))'
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid rgba(var(--focus), var(--focus-opacity))`
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none'
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '1rem',
          height: '1rem',
          fontSize: '1rem',
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {theme === 'dark' ? '🌙' : '☀️'}
      </span>
      <span
        style={{
          fontWeight: 500,
        }}
      >
        {theme === 'dark' ? 'Dark' : 'Light'}
      </span>
    </button>
  )
}