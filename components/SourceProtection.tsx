/**
 * Source Protection Component
 * 
 * Prevents users from viewing source code and accessing developer tools
 * to enhance web page security.
 */

'use client'

import { useEffect } from 'react'

export default function SourceProtection() {
  useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      return false
    }

    // Disable common keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12 (Developer Tools)
      if (e.key === 'F12') {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+Shift+I (Developer Tools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+S (Save Page - could expose source)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+Shift+S (Save Page)
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        return false
      }

      // Disable Ctrl+P (Print - could expose source)
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        return false
      }
    }

    // Disable text selection (prevents copying code)
    const handleSelectStart = (e: Event) => {
      // Allow selection in input fields and textareas
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return true
      }
      e.preventDefault()
      return false
    }

    // Disable drag (prevents saving images/resources)
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault()
      return false
    }

    // Apply all protections
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('selectstart', handleSelectStart)
    document.addEventListener('dragstart', handleDragStart)

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('selectstart', handleSelectStart)
      document.removeEventListener('dragstart', handleDragStart)
    }
  }, [])

  // This component doesn't render anything
  return null
}