import type { Metadata, Viewport } from 'next'
import './globals.css'
import Layout from '@/components/Layout'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'Secure AI Chat - Powered by Lakera AI',
  description: 'A secure AI chat application with end-to-end encryption and privacy features',
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Apply theme before React hydration to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'light' || theme === 'dark') {
                    document.documentElement.classList.add(theme);
                    document.documentElement.classList.remove(theme === 'light' ? 'dark' : 'light');
                  } else {
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var defaultTheme = prefersDark ? 'dark' : 'light';
                    document.documentElement.classList.add(defaultTheme);
                    document.documentElement.classList.remove(defaultTheme === 'light' ? 'dark' : 'light');
                  }
                } catch (e) {
                  // Fallback to dark if localStorage access fails
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="h-full antialiased">
        <ErrorBoundary>
          <ThemeProvider>
            <Layout>
              {children}
            </Layout>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
