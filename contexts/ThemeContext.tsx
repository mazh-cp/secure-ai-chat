'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { setTheme as setThemeFunction, getTheme, toggleTheme as toggleThemeFunction } from '@/lib/theme/setTheme'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize theme from DOM (already set by bootstrap script)
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return getTheme()
    }
    return 'dark'
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true)
      const currentTheme = getTheme()
      setThemeState(currentTheme)
    })

    const handleThemeChange = (e: CustomEvent<{ theme: Theme }>) => {
      setThemeState(e.detail.theme)
    }

    window.addEventListener('themechange', handleThemeChange as EventListener)

    return () => {
      window.removeEventListener('themechange', handleThemeChange as EventListener)
    }
  }, [])

  // Set theme using production-ready function
  const setTheme = (newTheme: Theme) => {
    setThemeFunction(newTheme)
    setThemeState(newTheme)
  }

  // Toggle theme using production-ready function
  const toggleTheme = () => {
    const newTheme = toggleThemeFunction()
    setThemeState(newTheme)
  }

  // Prevent flash of unstyled content
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

