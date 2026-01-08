'use client'

interface SecurityIndicatorProps {
  isSecure: boolean
}

export default function SecurityIndicator({ isSecure }: SecurityIndicatorProps) {
  return (
    <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full glass border-brand-berry/30">
      <div className={`w-2 h-2 rounded-full ${isSecure ? 'bg-brand-berry pulse-glow' : 'bg-red-300'}`}></div>
      <span className="text-sm text-brand-berry font-medium">
        {isSecure ? 'Connection Secure' : 'Connection Insecure'}
      </span>
    </div>
  )
}
