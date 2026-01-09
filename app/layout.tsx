import type { Metadata, Viewport } from 'next'
import './globals.css'
import Layout from '@/components/Layout'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import ThemeInit from '@/components/ThemeInit'
import ThemeScript from '@/components/ThemeScript'

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
        <ThemeScript />
      </head>
      <body className="h-full antialiased">
        <ThemeInit />
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
