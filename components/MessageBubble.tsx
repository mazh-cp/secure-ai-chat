'use client'

import { Message } from '@/types/chat'
import { format } from 'date-fns'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const scanResult = message.scanResult

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'glass-button text-white'
              : 'glass text-white/90'
          } ${
            scanResult?.flagged ? 'border-2 border-red-400/50 ring-2 ring-red-400/30' : ''
          } transition-all hover:scale-[1.02]`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
          
          {/* Scan Result Indicator */}
          {scanResult && scanResult.scanned && (
            <div className={`mt-2 pt-2 border-t ${
              isUser ? 'border-white/20' : 'border-white/10'
            }`}>
              {scanResult.flagged ? (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-red-300">🚫</span>
                    <span className="text-xs font-semibold text-red-300">
                      Threat Detected
                    </span>
                  </div>
                  {scanResult.message && (
                    <p className="text-xs text-red-200/80 mt-1">{scanResult.message}</p>
                  )}
                  {scanResult.categories && Object.keys(scanResult.categories).length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-red-200">Detected Categories:</p>
                      <ul className="text-xs text-red-100/80 space-y-0.5">
                        {Object.entries(scanResult.categories)
                          .filter(([, flagged]) => flagged)
                          .map(([category]) => (
                            <li key={category} className="flex items-center space-x-1">
                              <span>•</span>
                              <span className="capitalize">{category.replace(/_/g, ' ')}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {scanResult.scores && Object.keys(scanResult.scores).length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-red-200/80">
                        Threat Score: {Math.max(...Object.values(scanResult.scores)).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-brand-berry">✓</span>
                  <span className="text-xs text-brand-berry/80">
                    Scanned - Safe
                  </span>
                </div>
              )}
            </div>
          )}
          
          <p className={`text-xs mt-2 ${
            isUser ? 'text-white/70' : 'text-white/60'
          }`}>
            {format(message.timestamp, 'h:mm a')}
          </p>
        </div>
      </div>
    </div>
  )
}
