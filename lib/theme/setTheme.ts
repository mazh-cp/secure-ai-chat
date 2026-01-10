/**
 * UniFi-Style Theme Utility Module
 * 
 * Single source of truth for theme switching. Changes the entire site instantly
 * by only toggling html[data-theme]. Synchronous and lightweight.
 * 
 * All theme changes go through this module to ensure consistency.
 */

export type Theme = 'light' | 'dark'

/**
 * Get initial theme from localStorage or system preference
 * 
 * Priority:
 * 1. localStorage 'theme' key
 * 2. System preference (prefers-color-scheme)
 * 3. Default to 'dark'
 * 
 * @returns 'light' or 'dark'
 */
export function getInitialTheme(): Theme {
  // Check localStorage first
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') {
      return stored as Theme
    }
  } catch (error) {
    // localStorage unavailable (private browsing, quota exceeded, etc.)
  }
  
  // Fallback to system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
      return prefersLight ? 'light' : 'dark'
    } catch (error) {
      // matchMedia unavailable
    }
  }
  
  // Default to dark
  return 'dark'
}

/**
 * Get current theme from DOM (set by bootstrap script or setTheme)
 * 
 * @returns 'light' or 'dark'
 */
export function getTheme(): Theme {
  // Check DOM first (most reliable)
  const dataTheme = document.documentElement.getAttribute('data-theme')
  if (dataTheme === 'light' || dataTheme === 'dark') {
    return dataTheme as Theme
  }
  
  // Fallback to getInitialTheme
  return getInitialTheme()
}

/**
 * Set theme (validates, applies data-theme, sets colorScheme, persists, dispatches event)
 * 
 * This is the single source of truth for theme changes. All theme switching
 * should go through this function.
 * 
 * @param theme - 'light' or 'dark' (defaults to 'light' for invalid input)
 * @returns void
 */
export function setTheme(theme: string): void {
  // 1. Validate input: accept only "light" or "dark"; default to "light" for anything else
  const validTheme: Theme = theme === 'light' || theme === 'dark' ? theme : 'light'
  
  const html = document.documentElement
  
  // 2. Disable animations during toggle to prevent perceived delay
  const rootStyles = getComputedStyle(html)
  const originalTransition = rootStyles.getPropertyValue('--theme-transition-ms')
  const hasTransition = originalTransition !== ''
  
  if (hasTransition) {
    html.style.setProperty('--theme-transition-ms', '0ms')
  }
  
  // 3. Apply the theme immediately (single attribute change - instant)
  html.setAttribute('data-theme', validTheme)
  
  // 4. Update browser UI hint (for built-in controls like scrollbars)
  html.style.colorScheme = validTheme === 'dark' ? 'dark' : 'light'
  
  // 5. Persist preference safely (never break theme switching)
  try {
    localStorage.setItem('theme', validTheme)
  } catch (error) {
    // localStorage unavailable (private browsing, quota exceeded, etc.)
    // Don't throw - theme switching should always work
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to persist theme preference:', error)
    }
  }
  
  // 6. Dispatch custom event so components can react without re-rendering the whole app
  try {
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: validTheme } }))
  } catch (error) {
    // Event dispatch failed - non-critical, continue anyway
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to dispatch themechange event:', error)
    }
  }
  
  // 7. Restore original transition after a brief delay (allows browser to apply theme)
  // Use requestAnimationFrame to ensure theme is applied before restoring animation
  if (hasTransition) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        html.style.setProperty('--theme-transition-ms', originalTransition)
      })
    })
  }
}

/**
 * Toggle between light and dark themes
 * 
 * @returns The new theme ('light' or 'dark')
 */
export function toggleTheme(): Theme {
  const currentTheme = getTheme()
  const newTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark'
  setTheme(newTheme)
  return newTheme
}