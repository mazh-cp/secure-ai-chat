'use client'

import { format } from 'date-fns'
import type { SystemLogEntry } from '@/lib/system-logging'

export interface SystemLogViewerProps {
  logs: SystemLogEntry[]
}

function getLevelBadge(level: SystemLogEntry['level']) {
  const badges = {
    info: <span className="px-2 py-1 text-xs rounded-full glass text-blue-300 border-blue-400/30">INFO</span>,
    warning: <span className="px-2 py-1 text-xs rounded-full glass text-yellow-300 border-yellow-400/30">WARN</span>,
    error: <span className="px-2 py-1 text-xs rounded-full glass text-red-300 border-red-400/50">ERROR</span>,
    debug: <span className="px-2 py-1 text-xs rounded-full glass text-gray-300 border-gray-400/30">DEBUG</span>,
  }
  return badges[level] || badges.info
}

function getServiceIcon(service: string) {
  if (service.includes('checkpoint') || service.includes('te')) {
    return '🛡️'
  }
  if (service.includes('lakera')) {
    return '🤖'
  }
  if (service.includes('openai')) {
    return '🧠'
  }
  return '⚙️'
}

export default function SystemLogViewer({ logs }: SystemLogViewerProps) {
  if (logs.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="text-theme-subtle text-4xl mb-4">⚙️</div>
        <p className="text-theme-muted">No system logs yet</p>
        <p className="text-theme-subtle text-sm mt-1">System-level events and API failures will appear here</p>
      </div>
    )
  }

  return (
    <div className="max-h-[700px] overflow-y-auto p-6">
      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`p-4 rounded-xl glass-card transition-all hover:scale-[1.01] ${
              log.level === 'error'
                ? 'border-red-400/30'
                : log.level === 'warning'
                ? 'border-yellow-400/30'
                : 'border-blue-400/20'
            }`}
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getServiceIcon(log.service)}</span>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap">
                    <h3 className="text-theme font-medium capitalize">
                      {log.service.replace(/_/g, ' ')}
                    </h3>
                    {getLevelBadge(log.level)}
                  </div>
                  <p className="text-xs text-theme-subtle mt-1">
                    {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                  </p>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="mb-3">
              <p className="text-sm text-theme-muted">{log.message}</p>
            </div>

            {/* Details */}
            {log.details && (
              <div className="mt-3 p-3 glass-card rounded-xl border-blue-400/30">
                <p className="text-xs text-blue-300 font-medium mb-2">Details:</p>
                <div className="space-y-1 text-xs text-theme-muted">
                  {log.details.endpoint && (
                    <div><span className="font-medium">Endpoint:</span> <code className="text-blue-300">{log.details.endpoint}</code></div>
                  )}
                  {log.details.method && (
                    <div><span className="font-medium">Method:</span> {log.details.method}</div>
                  )}
                  {log.details.statusCode && (
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      <span className={log.details.statusCode >= 400 ? 'text-red-300' : 'text-green-300'}>
                        {log.details.statusCode}
                      </span>
                    </div>
                  )}
                  {log.details.duration !== undefined && (
                    <div><span className="font-medium">Duration:</span> {log.details.duration}ms</div>
                  )}
                  {(() => {
                    if (!log.details.error) return null
                    const errorStr = typeof log.details.error === 'string' 
                      ? log.details.error 
                      : String(log.details.error)
                    return (
                      <div className="mt-2 p-2 glass rounded border-red-400/30">
                        <span className="font-medium text-red-300">Error:</span>
                        <p className="text-red-300 mt-1 break-words">{errorStr}</p>
                      </div>
                    )
                  })()}
                  {(() => {
                    if (!log.details.responseBody) return null
                    const bodyStr = typeof log.details.responseBody === 'string' 
                      ? log.details.responseBody.substring(0, 1000)
                      : JSON.stringify(log.details.responseBody, null, 2).substring(0, 1000)
                    return (
                      <details className="mt-2">
                        <summary className="text-xs text-theme-subtle cursor-pointer hover:text-theme">Response Body</summary>
                        <pre className="mt-1 p-2 glass rounded text-xs overflow-auto max-h-40 text-theme-muted font-mono">
                          {bodyStr}
                        </pre>
                      </details>
                    )
                  })()}
                  {log.details.stackTrace && (
                    <details className="mt-2">
                      <summary className="text-xs text-theme-subtle cursor-pointer hover:text-theme">Stack Trace</summary>
                      <pre className="mt-1 p-2 glass rounded text-xs overflow-auto max-h-40 text-red-300 font-mono">
                        {log.details.stackTrace.substring(0, 1000)}
                      </pre>
                    </details>
                  )}
                  {log.details.requestHeaders && Object.keys(log.details.requestHeaders).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-theme-subtle cursor-pointer hover:text-theme">Request Headers</summary>
                      <pre className="mt-1 p-2 glass rounded text-xs overflow-auto max-h-40 text-theme-muted font-mono">
                        {JSON.stringify(log.details.requestHeaders, null, 2).substring(0, 500)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-theme-subtle cursor-pointer hover:text-theme">Metadata</summary>
                <pre className="mt-1 p-2 glass rounded text-xs overflow-auto max-h-40 text-theme-muted font-mono">
                  {JSON.stringify(log.metadata, null, 2).substring(0, 500)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
