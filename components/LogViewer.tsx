'use client'

import { LogEntry } from '@/types/logs'
import { format } from 'date-fns'
import { getCategoryColor } from '@/lib/theme/categoryColors'

interface LogViewerProps {
  logs: LogEntry[]
}

function getActionBadge(action: LogEntry['action']) {
  const badges: Record<string, JSX.Element> = {
    request: <span className="px-2 py-1 text-xs rounded-full glass text-brand-berry border-brand-berry/30" style={{ color: "var(--chip-text)" }}>Request</span>,
    allowed: <span className="px-2 py-1 text-xs rounded-full glass text-brand-berry border-brand-berry/30" style={{ color: "var(--chip-text)" }}>✓ Allowed</span>,
    blocked: <span className="px-2 py-1 text-xs rounded-full glass text-red-300 border-red-400/50" style={{ color: "var(--chip-text)" }}>🚫 Blocked</span>,
    scanned: <span className="px-2 py-1 text-xs rounded-full glass text-brand-berry border-brand-berry/30" style={{ color: "var(--chip-text)" }}>Scanned</span>,
    error: <span className="px-2 py-1 text-xs rounded-full glass text-yellow-300 border-yellow-400/30" style={{ color: "var(--chip-text)" }}>Error</span>,
    api_failure: <span className="px-2 py-1 text-xs rounded-full glass text-red-300 border-red-400/50" style={{ color: "var(--chip-text)" }}>API Failure</span>,
    api_success: <span className="px-2 py-1 text-xs rounded-full glass text-green-300 border-green-400/30" style={{ color: "var(--chip-text)" }}>API Success</span>,
    configuration: <span className="px-2 py-1 text-xs rounded-full glass text-blue-300 border-blue-400/30" style={{ color: "var(--chip-text)" }}>Configuration</span>,
  }
  return badges[action] || badges.request
}

function getTypeIcon(type: LogEntry['type']) {
  const icons = {
    chat: '💬',
    file_scan: '📁',
    error: '⚠️',
    system: '⚙️',
  }
  return icons[type] || '📝'
}

export default function LogViewer({ logs }: LogViewerProps) {
  if (logs.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="text-theme-subtle text-4xl mb-4">📊</div>
        <p className="text-theme-muted">No logs yet</p>
        <p className="text-theme-subtle text-sm mt-1">Activity logs will appear here as you use the application</p>
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
              log.action === 'blocked' || log.action === 'error'
                ? 'border-red-400/30'
                : log.action === 'allowed'
                ? 'border-green-400/30'
                : 'border-brand-berry/20'
            }`}
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--card-shadow)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-alt)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface)";
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getTypeIcon(log.type)}</span>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap">
                  <h3 className="text-theme font-medium capitalize">
                    {log.type.replace('_', ' ')}
                  </h3>
                    {getActionBadge(log.action)}
                    {log.source && (
                      <span className="text-xs text-theme-subtle">({log.source})</span>
                    )}
                  </div>
                  <p className="text-xs text-theme-subtle mt-1">
                    {format(log.timestamp, 'MMM dd, yyyy HH:mm:ss')}
                  </p>
                </div>
              </div>
              {log.userIP && (
                <div className="text-xs text-theme-muted glass px-2 py-1 rounded-lg" style={{ color: "var(--chip-text)" }}>
                  IP: {log.userIP}
                </div>
              )}
            </div>

            {/* Request Details */}
            {log.requestDetails && (
              <div className="mb-3 p-3 glass-card rounded-xl border-brand-berry/10">
                {(log.requestDetails.message || log.requestDetails.fileName) && (
                  <div className="space-y-2">
                    {log.requestDetails.message && (
                      <div>
                        <span className="text-xs text-theme-subtle font-medium">Message:</span>
                        <p className="text-sm text-theme-muted mt-1 break-words">
                          {log.requestDetails.message.substring(0, 200)}
                          {log.requestDetails.message.length > 200 ? '...' : ''}
                        </p>
                      </div>
                    )}
                    {log.requestDetails.fileName && (
                      <div className="flex items-center space-x-4 flex-wrap">
                        <div>
                          <span className="text-xs text-theme-subtle font-medium">File:</span>
                          <p className="text-sm text-theme-muted">{log.requestDetails.fileName}</p>
                        </div>
                        {log.requestDetails.fileType && (
                          <div>
                            <span className="text-xs text-theme-subtle font-medium">Type:</span>
                            <p className="text-sm text-theme-muted">{log.requestDetails.fileType}</p>
                          </div>
                        )}
                        {log.requestDetails.fileSize && (
                          <div>
                            <span className="text-xs text-theme-subtle font-medium">Size:</span>
                            <p className="text-sm text-theme-muted">
                              {(log.requestDetails.fileSize / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Lakera Decision */}
            {log.lakeraDecision && (
              <div className={`p-3 rounded-xl glass-card ${
                log.lakeraDecision.flagged
                  ? 'border-red-400/30'
                  : 'border-green-400/30'
              }`}>
                <div className="flex items-center space-x-2 mb-2 flex-wrap">
                  <span className="text-lg">🛡️</span>
                  <span className="text-sm font-semibold text-theme">
                    Lakera AI Decision
                  </span>
                  {log.lakeraDecision.flagged ? (
                    <span className="px-2 py-0.5 text-xs rounded-full glass-card text-red-300 border-red-400/50">
                      Flagged
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs rounded-full glass-card text-green-300 border-green-400/30">
                      Safe
                    </span>
                  )}
                </div>
                
                {log.lakeraDecision.message && (
                  <p className="text-xs text-theme-muted mb-2">{log.lakeraDecision.message}</p>
                )}

                {log.lakeraDecision.categories && Object.keys(log.lakeraDecision.categories).length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-theme-subtle mb-1">Categories:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(log.lakeraDecision.categories)
                        .filter(([, flagged]) => flagged)
                        .map(([category]) => {
                          const bgColor = getCategoryColor(category)
                          return (
                            <span
                              key={category}
                              className="px-2 py-1 text-xs rounded-lg capitalize"
                              style={{
                                backgroundColor: bgColor,
                                color: "var(--chip-text)",
                                border: `1px solid ${bgColor}80`,
                              }}
                            >
                              {category.replace(/_/g, ' ')}
                            </span>
                          )
                        })}
                    </div>
                  </div>
                )}

                {log.lakeraDecision.scores && Object.keys(log.lakeraDecision.scores).length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-theme-subtle">
                      Threat Score: {Math.max(...Object.values(log.lakeraDecision.scores)).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* System Details */}
            {log.systemDetails && (
              <div className="mt-3 p-3 glass-card rounded-xl border-blue-400/30">
                <p className="text-xs text-blue-300 font-medium mb-2">System Details:</p>
                <div className="space-y-1 text-xs text-theme-muted">
                  {log.systemDetails.service && (
                    <div><span className="font-medium">Service:</span> {log.systemDetails.service}</div>
                  )}
                  {log.systemDetails.endpoint && (
                    <div><span className="font-medium">Endpoint:</span> {log.systemDetails.endpoint}</div>
                  )}
                  {log.systemDetails.method && (
                    <div><span className="font-medium">Method:</span> {log.systemDetails.method}</div>
                  )}
                  {log.systemDetails.statusCode && (
                    <div><span className="font-medium">Status:</span> <span className={log.systemDetails.statusCode >= 400 ? 'text-red-300' : 'text-green-300'}>{log.systemDetails.statusCode}</span></div>
                  )}
                  {log.systemDetails.duration !== undefined && (
                    <div><span className="font-medium">Duration:</span> {log.systemDetails.duration}ms</div>
                  )}
                  {(() => {
                    if (!('error' in log.systemDetails) || !log.systemDetails.error) return null
                    const errorStr = typeof log.systemDetails.error === 'string' 
                      ? log.systemDetails.error 
                      : String(log.systemDetails.error)
                    return (
                      <div className="mt-2 p-2 glass rounded border-red-400/30">
                        <span className="font-medium text-red-300">Error:</span>
                        <p className="text-red-300 mt-1 break-words">{errorStr}</p>
                      </div>
                    )
                  })()}
                  {log.systemDetails.stackTrace && (
                    <details className="mt-2">
                      <summary className="text-xs text-theme-subtle cursor-pointer hover:text-theme">Stack Trace</summary>
                      <pre className="mt-1 p-2 glass rounded text-xs overflow-auto max-h-40 text-red-300 font-mono">
                        {log.systemDetails.stackTrace.substring(0, 1000)}
                      </pre>
                    </details>
                  )}
                  {log.systemDetails.responseBody && (
                    <details className="mt-2">
                      <summary className="text-xs text-theme-subtle cursor-pointer hover:text-theme">Response Body</summary>
                      <pre className="mt-1 p-2 glass rounded text-xs overflow-auto max-h-40 text-theme-muted font-mono">
                        {typeof log.systemDetails.responseBody === 'string' 
                          ? log.systemDetails.responseBody.substring(0, 1000)
                          : JSON.stringify(log.systemDetails.responseBody, null, 2).substring(0, 1000)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {log.error && (
              <div className="mt-3 p-3 glass-card rounded-xl border-red-400/30">
                <p className="text-xs text-red-300 font-medium mb-1">Error:</p>
                <p className="text-xs text-red-300">{log.error}</p>
              </div>
            )}

            {/* Success/Status */}
            <div className="mt-2 flex items-center">
              <span className={`text-xs ${log.success ? 'text-green-300' : 'text-red-300'}`}>
                {log.success ? '✓ Success' : '✗ Failed'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
