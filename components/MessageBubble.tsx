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
              ? 'glass-button text-theme'
              : 'glass text-theme'
          } ${
            scanResult?.flagged ? 'border-2 border-red-400/50 ring-2 ring-red-400/30' : ''
          } transition-all hover:scale-[1.02]`}
        >
          <p className="text-base whitespace-pre-wrap break-words">
            {message.content}
          </p>
          
          {/* Scan Result Indicator */}
          {scanResult && scanResult.scanned && (
            <div className={`mt-2 pt-2 border-t ${
              isUser ? 'border-palette-border-default/20' : 'border-palette-border-default/10'
            }`}>
              {scanResult.flagged ? (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-red-300">🚫</span>
                    <span className="text-sm font-semibold text-red-300">
                      Threat Detected
                    </span>
                  </div>
                  {scanResult.message && (
                    <p className="text-sm text-red-200/80 mt-1">{scanResult.message}</p>
                  )}
                  {scanResult.categories && Object.keys(scanResult.categories).length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-red-200">Detected Categories:</p>
                      <ul className="text-sm text-red-100/80 space-y-0.5">
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
                      <p className="text-sm text-red-200/80">
                        Threat Score: {Math.max(...Object.values(scanResult.scores)).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {/* Payload Data - Detected Threats with Locations */}
                  {scanResult.payload && scanResult.payload.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-red-200">Detected Threats:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {scanResult.payload.map((item, idx) => (
                          <div key={idx} className="text-sm text-red-100/80 bg-red-900/20 p-1.5 rounded">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium">{item.detector_type}</span>
                              <span className="text-red-200/60">Position: {item.start}-{item.end}</span>
                            </div>
                            <div className="mt-0.5 text-red-100/70 italic">
                              &quot;{item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text}&quot;
                            </div>
                            {item.labels && item.labels.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {item.labels.map((label, labelIdx) => (
                                  <span key={labelIdx} className="px-1 py-0.5 bg-red-800/30 rounded text-sm">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-brand-berry">✓</span>
                  <span className="text-sm text-brand-berry/80">
                    Scanned - Safe
                  </span>
                </div>
              )}
            </div>
          )}
          
          <p className={`text-sm mt-2 ${
            isUser ? 'text-theme-muted' : 'text-theme-subtle'
          }`}>
            {format(message.timestamp, 'h:mm a')}
          </p>
        </div>
      </div>
    </div>
  )
}
