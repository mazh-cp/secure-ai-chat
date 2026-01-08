'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize theme from existing class on html element (set by inline script) or default to dark
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const htmlClass = document.documentElement.classList.contains('dark') ? 'dark' : 
                       document.documentElement.classList.contains('light') ? 'light' : null
      if (htmlClass) return htmlClass
      
      // Fallback to localStorage
      const savedTheme = localStorage.getItem('theme') as Theme | null
      if (savedTheme) return savedTheme
      
      // Final fallback to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return prefersDark ? 'dark' : 'light'
    }
    return 'dark'
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Read the theme that was already applied by the inline script
    const htmlHasDark = document.documentElement.classList.contains('dark')
    const htmlHasLight = document.documentElement.classList.contains('light')
    const currentHtmlTheme = htmlHasDark ? 'dark' : (htmlHasLight ? 'light' : null)
    
    // Sync React state with the theme class already on the HTML element
    if (currentHtmlTheme && currentHtmlTheme !== theme) {
      setTheme(currentHtmlTheme)
    } else {
      // If no theme class on HTML, check localStorage
      const savedTheme = localStorage.getItem('theme') as Theme | null
      if (savedTheme && savedTheme !== theme) {
        setTheme(savedTheme)
      } else if (!savedTheme && !currentHtmlTheme) {
        // Check system preference if no saved theme and no HTML class
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const systemTheme = prefersDark ? 'dark' : 'light'
        if (systemTheme !== theme) {
          setTheme(systemTheme)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    // Save theme to localStorage
    localStorage.setItem('theme', theme)
    
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
  }, [theme, mounted])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  // Prevent flash of unstyled content
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
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

