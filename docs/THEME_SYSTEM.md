# UniFi-Style Theme System

This document explains the UniFi-inspired Day/Night theming system implemented in version 1.0.4.

## Overview

The theme system provides instant theme switching with no lag and no flash on load. It uses a single `data-theme` attribute on the `<html>` element and CSS variables (design tokens) for all colors.

## Architecture

### Theme Control

- **Single source of truth**: `html[data-theme="light"]` or `html[data-theme="dark"]`
- **Instant switching**: Only toggles the attribute; CSS variables handle all visual changes
- **No re-renders**: Components react to theme changes via CSS variables, not React state
- **Persistent**: User preference stored in `localStorage` with system preference fallback

### Bootstrap Script

A tiny inline script runs in `<head>` **BEFORE CSS loads** to prevent theme flash:

1. Reads `localStorage.getItem('theme')`
2. Falls back to `prefers-color-scheme` media query
3. Defaults to `"dark"` if nothing is available
4. Sets `document.documentElement.setAttribute('data-theme', theme)`
5. Sets `document.documentElement.style.colorScheme = theme`

**Location**: `lib/theme/bootstrap.ts` → `components/ThemeBootstrap.tsx` → injected in `app/layout.tsx`

### Theme Utility Module

**Location**: `lib/theme/setTheme.ts`

#### Functions

- **`getInitialTheme()`**: Gets theme from localStorage or system preference
- **`getTheme()`**: Gets current theme from DOM attribute
- **`setTheme(theme: 'light' | 'dark')`**: Sets theme (validates, applies, persists, dispatches event)
- **`toggleTheme()`**: Toggles between light and dark

#### Usage

```typescript
import { setTheme, getTheme, toggleTheme } from '@/lib/theme/setTheme'

// Set specific theme
setTheme('light')

// Get current theme
const current = getTheme()

// Toggle theme
const newTheme = toggleTheme()
```

## Design Tokens

**Location**: `lib/theme/tokens.css`

### UniFi-Style Palette

The design follows UniFi principles:
- **Neutral-first**: Low saturation backgrounds and surfaces
- **Single accent**: Blue (`--accent`) for interactive elements only
- **Subtle shadows**: Rely on spacing and borders for structure
- **No pure black/white**: Near-black surfaces and off-white text

### Light Theme (Day Mode)

```css
--bg: #F5F7FA          /* Light gray background */
--surface-1: #FFFFFF   /* White surface */
--surface-2: #F0F2F5   /* Light gray surface */
--text-1: #1F2933      /* Dark text */
--text-2: #5F6C7B      /* Secondary text */
--border: #E1E5EA      /* Light border */
--accent: #006FFF      /* UniFi blue */
--focus: #006FFF       /* Focus ring */
```

### Dark Theme (Night Mode)

```css
--bg: #0E1116          /* Near-black background */
--surface-1: #151A21   /* Dark gray surface */
--surface-2: #1B2230   /* Lighter dark surface */
--text-1: #E6EAF0      /* Off-white text */
--text-2: #AAB3C2      /* Gray secondary text */
--border: #232B36      /* Dark border */
--accent: #3B82F6      /* Brighter blue */
--focus: #60A5FA       /* Brighter focus ring */
```

### Shared Tokens

```css
--success: 34, 197, 94    /* Green */
--warning: 249, 115, 22   /* Orange */
--danger: 239, 68, 68     /* Red */
--radius: 0.5rem          /* Default border radius */
--shadow-sm, --shadow-md, --shadow-lg, --shadow-xl  /* Subtle shadows */
```

## Adding New Tokens

### 1. Define Token in `tokens.css`

Add the token for both themes:

```css
:root[data-theme="light"] {
  --my-new-token: 255, 255, 255; /* RGB values */
}

:root[data-theme="dark"] {
  --my-new-token: 0, 0, 0;
}
```

**Important**: Use RGB values (without `rgb()`), e.g., `255, 255, 255` instead of `#FFFFFF`. This allows using `rgba()` for opacity.

### 2. Use Token in CSS

```css
.my-component {
  background: rgb(var(--my-new-token));
  /* or with opacity */
  border: 1px solid rgba(var(--my-new-token), 0.5);
}
```

### 3. Use Token in Components

```tsx
<div style={{ backgroundColor: 'rgb(var(--my-new-token))' }}>
  Content
</div>
```

Or use Tailwind classes (if configured in `tailwind.config.js`):

```tsx
<div className="bg-my-new-token">
  Content
</div>
```

## Theming New Components

### Step 1: Use CSS Variables

**❌ Don't use hard-coded colors:**
```tsx
<div style={{ backgroundColor: '#006FFF' }}>  {/* BAD */}
```

**✅ Use CSS variables:**
```tsx
<div style={{ backgroundColor: 'rgb(var(--accent))' }}>  {/* GOOD */}
```

### Step 2: Use Semantic Tokens

**✅ Use semantic tokens for common patterns:**
```css
/* Background */
.my-component {
  background: rgb(var(--surface-1));
}

/* Text */
.my-component {
  color: rgb(var(--text-1));
}

/* Border */
.my-component {
  border: 1px solid rgb(var(--border));
}

/* Interactive elements */
.my-button {
  background: rgb(var(--accent));
  color: rgb(var(--text-1));
}

.my-button:hover {
  background: rgb(var(--accent-hover));
}
```

### Step 3: Focus States

**Always include visible focus rings:**

```css
.my-button:focus {
  outline: none;
  box-shadow: 
    0 0 0 3px rgba(var(--focus), var(--focus-opacity));
}
```

### Step 4: Hover/Active States

```css
.my-button:hover {
  background: rgb(var(--hover));
}

.my-button:active {
  background: rgb(var(--active));
}
```

### Step 5: Disabled States

```css
.my-button:disabled {
  background: rgb(var(--disabled-bg));
  color: rgb(var(--disabled-text));
  border-color: rgb(var(--disabled-border));
  cursor: not-allowed;
  opacity: 0.6;
}
```

## Accessibility

### WCAG AA Compliance

All tokens are designed to meet WCAG AA requirements:
- **Normal text**: ≥4.5:1 contrast ratio
- **Large text/UI components**: ≥3:1 contrast ratio

### Focus Rings

Focus rings use `--focus` and `--focus-opacity` tokens and are always visible:
- Light mode: `rgba(0, 111, 255, 0.3)`
- Dark mode: `rgba(96, 165, 250, 0.4)`

### Color and Meaning

Never use color alone to convey meaning. Always include:
- Icons
- Text labels
- Border patterns
- Patterns or shapes

## Theme Toggle Component

**Location**: `components/ThemeToggle.tsx`

The theme toggle component uses the `setTheme()` utility:

```tsx
import { toggleTheme } from '@/lib/theme/setTheme'

const handleToggle = () => {
  toggleTheme()
}
```

The component automatically listens to `themechange` events to update its icon/label.

## Troubleshooting

### Theme Flash on Load

If you see a flash of the wrong theme:

1. Ensure `ThemeBootstrap` is in `<head>` **before any CSS**
2. Check that the bootstrap script runs synchronously
3. Verify `suppressHydrationWarning` is on `<html>` tag

### Theme Not Persisting

1. Check browser console for localStorage errors
2. Verify `localStorage.setItem('theme', theme)` is being called
3. Check for private browsing mode or quota exceeded

### Colors Not Changing

1. Verify component uses CSS variables, not hard-coded colors
2. Check `tokens.css` is imported in `globals.css`
3. Ensure `data-theme` attribute is set on `<html>`

### Styling Not Applying

1. Verify CSS variable names match tokens.css
2. Check RGB format: `rgb(var(--token))` not `var(--token)`
3. For opacity, use: `rgba(var(--token), 0.5)`

## Best Practices

1. **Always use CSS variables** - Never hard-code colors in components
2. **Use semantic tokens** - Prefer `--text-1` over specific colors
3. **Test both themes** - Ensure components work in light and dark
4. **Respect reduced motion** - Use `prefers-reduced-motion` media query
5. **Maintain contrast** - Verify accessibility in both themes
6. **Focus rings** - Always include visible focus states
7. **Hover states** - Provide visual feedback for interactive elements

## Examples

### Button Component

```tsx
<button
  className="glass-button"
  style={{
    background: 'rgb(var(--surface-1))',
    border: '1px solid rgb(var(--border))',
    color: 'rgb(var(--text-1))',
  }}
  onFocus={(e) => {
    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(var(--focus), var(--focus-opacity))`
  }}
>
  Click me
</button>
```

### Input Component

```tsx
<input
  className="glass-input"
  style={{
    background: 'rgb(var(--input-bg))',
    border: '1px solid rgb(var(--input-border))',
    color: 'rgb(var(--input-text))',
  }}
/>
```

### Primary Button (Accent)

```tsx
<button
  className="btn-primary"
  style={{
    background: 'rgb(var(--accent))',
    border: '1px solid rgb(var(--accent))',
    color: 'white', // or rgb(var(--text-1)) in dark mode
  }}
>
  Submit
</button>
```

---

**Version**: 1.0.4  
**Last Updated**: 2026-01-XX