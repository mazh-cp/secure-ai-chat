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
        // Earthy Brown Palette - https://colordrop.io/palette/75145
        'wheat': '#f3e5ab',
        'harvest-gold': '#e0c57c',
        'whiskey': '#d1a35c',
        'copper': '#b87c3c',
        'paarl': '#a05c2c',
        'tobacco-brown': '#6f4c3e',
        'congo-brown': '#5a3e3c',
        'thunder': '#3b2d2f',
        // Brand colors for components - Default to light mode, overridden by CSS in dark mode
        'brand-berry': 'rgb(184, 124, 60)', // #b87c3c (light) / #BA55D3 (dark via CSS override)
        'berry-light': 'rgb(224, 197, 124)', // #e0c57c (light) / #DDA0DD (dark via CSS override)
        'berry-dark': 'rgb(160, 92, 44)', // #a05c2c (light) / #9370DB (dark via CSS override)
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
