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

                {/* Payload Data - Detected Threats with Locations */}
                {log.lakeraDecision.payload && log.lakeraDecision.payload.length > 0 && (
                  <div className="mt-3 p-2 glass-card rounded-lg border-yellow-400/30">
                    <p className="text-xs text-yellow-300 font-medium mb-2">Detected Threats ({log.lakeraDecision.payload.length}):</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {log.lakeraDecision.payload.map((item, idx) => (
                        <div key={idx} className="text-xs bg-yellow-900/10 p-2 rounded border border-yellow-400/20">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-medium text-yellow-200">{item.detector_type}</span>
                            <span className="text-theme-subtle">Pos: {item.start}-{item.end}</span>
                          </div>
                          <div className="mt-1 text-theme-muted italic text-xs">
                            &quot;{item.text.length > 80 ? item.text.substring(0, 80) + '...' : item.text}&quot;
                          </div>
                          {item.labels && item.labels.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.labels.map((label, labelIdx) => (
                                <span key={labelIdx} className="px-1.5 py-0.5 bg-yellow-800/20 rounded text-xs text-yellow-200">
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

                {/* Breakdown Data - Detector Results */}
                {log.lakeraDecision.breakdown && log.lakeraDecision.breakdown.length > 0 && (
                  <div className="mt-3 p-2 glass-card rounded-lg border-blue-400/30">
                    <p className="text-xs text-blue-300 font-medium mb-2">
                      Detector Breakdown ({log.lakeraDecision.breakdown.filter(d => d.detected).length}/{log.lakeraDecision.breakdown.length} detected):
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {log.lakeraDecision.breakdown.map((detector, idx) => (
                        <div key={idx} className={`text-xs p-1.5 rounded flex items-center justify-between ${
                          detector.detected ? 'bg-red-900/20 border border-red-400/30' : 'bg-green-900/10 border border-green-400/20'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className={detector.detected ? 'text-red-300' : 'text-green-300'}>
                              {detector.detected ? '⚠️' : '✓'}
                            </span>
                            <span className="font-medium text-theme">{detector.detector_type}</span>
                            <span className="text-theme-subtle text-xs">({detector.detector_id})</span>
                          </div>
                          {detector.detected && (
                            <span className="text-xs text-red-300 font-medium">DETECTED</span>
                          )}
                        </div>
                      ))}
                    </div>
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

      {/* API Errors & Key Failures Section */}
      {logs.filter(log => 
        log.action === 'api_failure' || 
        log.action === 'error' || 
        (log.systemDetails?.statusCode && log.systemDetails.statusCode >= 400) ||
        (log.error && (log.error.includes('API key') || log.error.includes('401') || log.error.includes('403')))
      ).length > 0 && (
        <div className="mt-6 p-4 glass-card rounded-xl border-red-400/50">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-semibold text-red-300">API Errors & Key Failures</h2>
            <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-300 border border-red-400/50">
              {logs.filter(log => 
                log.action === 'api_failure' || 
                log.action === 'error' || 
                (log.systemDetails?.statusCode && log.systemDetails.statusCode >= 400) ||
                (log.error && (log.error.includes('API key') || log.error.includes('401') || log.error.includes('403')))
              ).length}
            </span>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {logs
              .filter(log => 
                log.action === 'api_failure' || 
                log.action === 'error' || 
                (log.systemDetails?.statusCode && log.systemDetails.statusCode >= 400) ||
                (log.error && (log.error.includes('API key') || log.error.includes('401') || log.error.includes('403')))
              )
              .map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-lg glass-card border-red-400/30"
                >
                  {/* Error Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">
                        {log.systemDetails?.statusCode === 401 || log.error?.includes('401') ? '🔑' : 
                         log.systemDetails?.statusCode === 403 || log.error?.includes('403') ? '🚫' : 
                         '❌'}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-red-300">
                          {log.systemDetails?.service ? `${log.systemDetails.service.toUpperCase()} API Error` : 'API Error'}
                        </h3>
                        <p className="text-xs text-theme-subtle">
                          {format(log.timestamp, 'MMM dd, yyyy HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                    {log.systemDetails?.statusCode && (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        log.systemDetails.statusCode === 401 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/50' :
                        log.systemDetails.statusCode === 403 ? 'bg-red-500/20 text-red-300 border border-red-400/50' :
                        'bg-red-500/20 text-red-300 border border-red-400/50'
                      }`}>
                        {log.systemDetails.statusCode}
                      </span>
                    )}
                  </div>

                  {/* Full Error Message */}
                  <div className="mt-2 p-3 bg-red-900/20 rounded border border-red-400/30">
                    <p className="text-xs font-medium text-red-200 mb-1">Full Error:</p>
                    <p className="text-xs text-red-100 break-words whitespace-pre-wrap">
                      {log.error || 
                       (log.systemDetails?.responseBody ? 
                         (typeof log.systemDetails.responseBody === 'string' ? log.systemDetails.responseBody : JSON.stringify(log.systemDetails.responseBody, null, 2)) : 
                         'No error message available')}
                    </p>
                  </div>

                  {/* Key Failure Details */}
                  {(log.systemDetails?.statusCode === 401 || log.error?.includes('API key') || log.error?.includes('401')) && (
                    <div className="mt-2 p-2 bg-yellow-900/20 rounded border border-yellow-400/30">
                      <p className="text-xs font-medium text-yellow-200 mb-1">🔑 Key Failure Detected:</p>
                      <ul className="text-xs text-yellow-100 space-y-1 ml-4">
                        <li>• API key may be invalid or expired</li>
                        <li>• Check key format and permissions in Settings</li>
                        <li>• Verify key is active in provider dashboard</li>
                      </ul>
                    </div>
                  )}

                  {/* System Details */}
                  {log.systemDetails && (
                    <details className="mt-2">
                      <summary className="text-xs text-theme-subtle cursor-pointer hover:text-theme">
                        System Details
                      </summary>
                      <div className="mt-2 p-2 glass rounded text-xs space-y-1">
                        {log.systemDetails.endpoint && (
                          <div><span className="font-medium">Endpoint:</span> {log.systemDetails.endpoint}</div>
                        )}
                        {log.systemDetails.method && (
                          <div><span className="font-medium">Method:</span> {log.systemDetails.method}</div>
                        )}
                        {log.systemDetails.requestId && (
                          <div><span className="font-medium">Request ID:</span> {log.systemDetails.requestId}</div>
                        )}
                        {log.systemDetails.duration !== undefined && (
                          <div><span className="font-medium">Duration:</span> {log.systemDetails.duration}ms</div>
                        )}
                        {log.systemDetails.responseBody && (
                          <details className="mt-2">
                            <summary className="text-xs text-theme-subtle cursor-pointer">Response Body</summary>
                            <pre className="mt-1 p-2 glass rounded text-xs overflow-auto max-h-40 text-theme-muted font-mono">
                              {typeof log.systemDetails.responseBody === 'string' 
                                ? log.systemDetails.responseBody.substring(0, 2000)
                                : JSON.stringify(log.systemDetails.responseBody, null, 2).substring(0, 2000)}
                            </pre>
                          </details>
                        )}
                        {log.systemDetails.stackTrace && (
                          <details className="mt-2">
                            <summary className="text-xs text-theme-subtle cursor-pointer">Stack Trace</summary>
                            <pre className="mt-1 p-2 glass rounded text-xs overflow-auto max-h-40 text-red-300 font-mono">
                              {log.systemDetails.stackTrace.substring(0, 2000)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </details>
                  )}

                  {/* Request Details */}
                  {log.requestDetails && (
                    <div className="mt-2 p-2 glass rounded text-xs">
                      <p className="font-medium text-theme-subtle mb-1">Request:</p>
                      {log.requestDetails.fileName && (
                        <div>File: {log.requestDetails.fileName}</div>
                      )}
                      {log.requestDetails.message && (
                        <div>Message: {log.requestDetails.message.substring(0, 100)}...</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
