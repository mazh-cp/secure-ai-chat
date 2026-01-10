/**
 * Theme Bootstrap Script
 * 
 * This script MUST run inline in <head> BEFORE CSS loads to prevent theme flash.
 * It sets the data-theme attribute immediately based on:
 * 1. localStorage preference (if exists)
 * 2. System preference (prefers-color-scheme)
 * 3. Default to "dark"
 * 
 * This runs synchronously during HTML parsing, before any CSS is applied.
 */

export const bootstrapScript = `
(function() {
  'use strict';
  
  // Get stored theme preference
  var stored = null;
  try {
    stored = localStorage.getItem('theme');
  } catch (e) {
    // localStorage unavailable (private browsing, etc.)
  }
  
  // Determine theme: stored > system > default
  var theme = 'dark'; // default
  if (stored === 'light' || stored === 'dark') {
    theme = stored;
  } else {
    // Check system preference
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        theme = 'light';
      }
    } catch (e) {
      // matchMedia unavailable
    }
  }
  
  // Apply theme IMMEDIATELY to prevent flash
  var html = document.documentElement;
  html.setAttribute('data-theme', theme);
  html.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  
  // Listen for system preference changes (only if no manual preference is set)
  if (!stored && window.matchMedia) {
    try {
      var mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      var systemTheme = mediaQuery.matches ? 'light' : 'dark';
      
      // Listen for system preference changes
      var handleSystemThemeChange = function(e) {
        var currentStored = null;
        try {
          currentStored = localStorage.getItem('theme');
        } catch (e) {
          // localStorage unavailable
        }
        
        // Only auto-update if user hasn't manually set a preference
        if (!currentStored) {
          var newSystemTheme = e.matches ? 'light' : 'dark';
          html.setAttribute('data-theme', newSystemTheme);
          html.style.colorScheme = newSystemTheme === 'dark' ? 'dark' : 'light';
          
          try {
            localStorage.setItem('theme', newSystemTheme);
          } catch (e) {
            // localStorage unavailable
          }
          
          // Dispatch theme change event
          try {
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: newSystemTheme } }));
            }
          } catch (e) {
            // Event dispatch failed
          }
        }
      };
      
      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemThemeChange);
      } else {
        // Legacy browsers
        mediaQuery.addListener(handleSystemThemeChange);
      }
    } catch (e) {
      // System preference detection unavailable
    }
  }
})();
`.trim();