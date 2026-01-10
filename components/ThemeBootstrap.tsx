/**
 * Theme Bootstrap Component
 * 
 * Renders the inline theme bootstrap script in <head> BEFORE CSS loads.
 * This prevents theme flash by setting data-theme immediately.
 */

import { bootstrapScript } from '@/lib/theme/bootstrap'

export default function ThemeBootstrap() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: bootstrapScript }}
      suppressHydrationWarning
    />
  )
}
