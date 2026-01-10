/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'], // Use data-theme attribute (not class)
  theme: {
    extend: {
      colors: {
        // UniFi-Style Color Palette - Uses CSS variables that change with theme
        'palette': {
          'bg': 'rgb(var(--bg))',
          'surface-1': 'rgb(var(--surface-1))',
          'surface-2': 'rgb(var(--surface-2))',
          'accent': 'rgb(var(--accent))', // UniFi blue
          'text-1': 'rgb(var(--text-1))',
          'text-2': 'rgb(var(--text-2))',
          'border': 'rgb(var(--border))',
        },
        // Legacy compatibility - mapped to UniFi tokens
        'brand-berry': 'rgb(var(--accent))', // Maps to UniFi accent
        'berry-light': 'rgb(var(--accent))',
        'berry-dark': 'rgb(var(--accent-hover))',
        // Legacy mappings for backwards compatibility
        'bg-primary': 'rgb(var(--bg-primary))',
        'bg-secondary': 'rgb(var(--bg-secondary))',
        'bg-tertiary': 'rgb(var(--bg-tertiary))',
        'accent-primary': 'rgb(var(--accent-primary))',
        'text-primary': 'rgb(var(--text-primary))',
        'text-secondary': 'rgb(var(--text-secondary))',
        'border-default': 'rgb(var(--border))',
        // Success/Secure notice colors - use CSS variables
        'success-bg': 'rgba(var(--success), 0.1)',
        'success-border': 'rgba(var(--success), 0.3)',
        'success-text': 'rgb(var(--success))',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
