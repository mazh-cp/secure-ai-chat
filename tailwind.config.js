/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // New Color Palette - Uses CSS variables that change with theme
        'palette': {
          'bg-primary': 'rgb(var(--bg-primary))',
          'bg-secondary': 'rgb(var(--bg-secondary))',
          'bg-tertiary': 'rgb(var(--bg-tertiary))',
          'accent-primary': 'rgb(var(--accent-primary))', // Shared in both modes
          'accent-secondary': 'rgb(var(--accent-secondary))', // Shared in both modes
          'text-primary': 'rgb(var(--text-primary))',
          'text-secondary': 'rgb(var(--text-secondary))',
          'border-default': 'rgb(var(--border-default))',
        },
        // Legacy compatibility - mapped to new palette
        'brand-berry': 'rgb(142, 97, 240)', // Maps to accent-primary
        'berry-light': 'rgb(142, 97, 240)', // Maps to accent-primary
        'berry-dark': 'rgb(78, 69, 146)', // Maps to accent-secondary
        // Success/Secure notice colors
        'success-bg': 'rgba(34, 197, 94, 0.1)',
        'success-border': 'rgba(34, 197, 94, 0.3)',
        'success-text': '#4ade80',
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
