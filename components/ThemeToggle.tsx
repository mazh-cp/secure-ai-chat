'use client'

import { useTheme } from '@/contexts/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-theme mb-2">Theme Settings</h3>
          <p className="text-sm text-theme-muted">
            Switch between dark and light mode to customize your experience
          </p>
        </div>
        <div className="ml-6">
          <button
            onClick={toggleTheme}
            className="relative inline-flex h-14 w-28 items-center rounded-full glass-button transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span
              className={`inline-block h-12 w-12 transform rounded-full glass transition-transform duration-300 ${
                theme === 'dark' ? 'translate-x-14' : 'translate-x-1'
              }`}
            >
              <span className="flex h-full w-full items-center justify-center text-xl">
                {theme === 'dark' ? '🌙' : '☀️'}
              </span>
            </span>
          </button>
        </div>
      </div>
      <div className="mt-4 flex items-center space-x-2 text-sm text-theme-subtle">
        <span className="flex items-center space-x-1">
          <span>☀️</span>
          <span>Light Mode</span>
        </span>
        <span className="text-theme-subtle">•</span>
        <span className="flex items-center space-x-1">
          <span>🌙</span>
          <span>Dark Mode</span>
        </span>
        <span className="ml-auto text-theme-subtle">
          Current: <span className="font-medium text-theme-muted capitalize">{theme}</span>
        </span>
      </div>
    </div>
  )
}

