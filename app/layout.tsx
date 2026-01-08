import type { Metadata } from 'next'
import './globals.css'
import Layout from '@/components/Layout'
import { ThemeProvider } from '@/contexts/ThemeContext'

export const metadata: Metadata = {
  title: 'Secure AI Chat - Powered by Lakera AI',
  description: 'A secure AI chat application with end-to-end encryption and privacy features',
  viewport: 'width=device-width, initial-scale=1',
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <ThemeProvider>
          <Layout>
            {children}
          </Layout>
        </ThemeProvider>
      </body>
    </html>
  )
}
