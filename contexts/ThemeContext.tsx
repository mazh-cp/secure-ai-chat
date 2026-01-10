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
    setMounted(true)
    
    // Read current theme from DOM (set by bootstrap script)
    const currentTheme = getTheme()
    if (currentTheme !== theme) {
      setThemeState(currentTheme)
    }

    // Listen for theme changes (from other components or system preference)
    const handleThemeChange = (e: CustomEvent<{ theme: Theme }>) => {
      setThemeState(e.detail.theme)
    }
    
    window.addEventListener('themechange', handleThemeChange as EventListener)
    
    return () => {
      window.removeEventListener('themechange', handleThemeChange as EventListener)
    }
  }, [theme])

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

