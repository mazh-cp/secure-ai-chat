'use client'

import { useState } from 'react'
import { OWASPRisk } from '@/types/risks'
import { LogEntry } from '@/types/logs'
import { format } from 'date-fns'
import { getCategoryColor } from '@/lib/theme/categoryColors'

interface RiskDetailProps {
  risk: OWASPRisk
  relatedLogs: LogEntry[]
  totalLogs: number
}

function getSeverityBadge(severity: OWASPRisk['severity']) {
  // Use CSS variables with data-theme selectors to avoid hydration issues
  // Background colors adapt via CSS, not JavaScript
  const badges = {
    critical: (
      <span 
        className="px-3 py-1 rounded-full text-base font-semibold severity-critical" 
        style={{ color: "var(--chip-text)" }}
      >
        🔴 Critical
      </span>
    ),
    high: (
      <span 
        className="px-3 py-1 rounded-full text-base font-semibold severity-high" 
        style={{ color: "var(--chip-text)" }}
      >
        🟠 High
      </span>
    ),
    medium: (
      <span 
        className="px-3 py-1 rounded-full text-base font-semibold severity-medium" 
        style={{ color: "var(--chip-text)" }}
      >
        🟡 Medium
      </span>
    ),
    low: (
      <span 
        className="px-3 py-1 rounded-full text-base font-semibold severity-low" 
        style={{ color: "var(--chip-text)" }}
      >
        🔵 Low
      </span>
    ),
  }
  return badges[severity]
}

export default function RiskDetail({ risk, relatedLogs, totalLogs }: RiskDetailProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  const toggleLog = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId)
  }

  return (
    <div className="space-y-6">
      {/* Risk Header */}
      <div className="border-b border-palette-border-default/20 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-3xl font-bold text-theme">
                {risk.code}
              </span>
              {getSeverityBadge(risk.severity)}
            </div>
            <h2 className="text-3xl font-bold text-theme mb-2">
              {risk.name}
            </h2>
            <p className="text-base text-theme-muted">
              Category: {risk.category}
            </p>
          </div>
        </div>
        
        {/* Description */}
        <div className="glass-card rounded-lg p-4 mt-4">
          <p className="text-base text-theme leading-relaxed">
            {risk.description}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-3 bg-brand-berry/10 dark:bg-brand-berry/20 rounded-lg border border-brand-berry/30 dark:border-brand-berry/40">
            <div className="text-3xl font-bold text-brand-berry dark:text-brand-berry">
              {relatedLogs.length}
            </div>
            <div className="text-base text-brand-berry/80 dark:text-brand-berry mt-1">
              Related Events
            </div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {relatedLogs.filter(l => l.lakeraDecision?.flagged).length}
            </div>
            <div className="text-base text-green-700 dark:text-green-300 mt-1">
              Flagged
            </div>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {((relatedLogs.length / Math.max(totalLogs, 1)) * 100).toFixed(1)}%
            </div>
            <div className="text-base text-orange-700 dark:text-orange-300 mt-1">
              of Total
            </div>
          </div>
        </div>
      </div>

      {/* Related Session Activity */}
      <div>
        <h3 className="text-3xl font-semibold text-theme mb-4">
          Related Session Activity ({relatedLogs.length})
        </h3>
        
        {relatedLogs.length === 0 ? (
          <div className="text-center py-8 glass-card rounded-lg border border-palette-border-default/20">
            <p className="text-theme-muted">
              No activity associated with this risk yet
            </p>
            <p className="text-base text-theme-subtle mt-1">
              Activity will appear here when detected in your session
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {relatedLogs.map((log) => {
              const isExpanded = expandedLog === log.id
              
              return (
                <div
                  key={log.id}
                    className={`
                    rounded-lg border p-4 cursor-pointer transition-all
                    ${log.lakeraDecision?.flagged 
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                      : 'glass-card border-palette-border-default/20'
                    }
                    ${isExpanded ? 'ring-2 ring-palette-accent-primary' : 'hover:border-palette-border-default/40'}
                  `}
                  onClick={() => toggleLog(log.id)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <span className="text-3xl">
                        {log.type === 'chat' ? '💬' : log.type === 'file_scan' ? '📁' : '⚠️'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-base font-semibold text-theme capitalize">
                            {log.type.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-base ${
                            log.action === 'blocked' 
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : log.action === 'allowed'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'glass-card text-theme-muted'
                          }`}
                          style={{ color: "var(--chip-text)" }}
                          >
                            {log.action}
                          </span>
                        </div>
                        <p className="text-base text-theme-muted">
                          {format(log.timestamp, 'MMM dd, yyyy HH:mm:ss')}
                        </p>
                        {log.userIP && (
                          <p className="text-base text-theme-muted mt-1">
                            IP: {log.userIP}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-base text-theme-subtle">
                      {isExpanded ? '▼' : '▶'}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-palette-border-default/20 space-y-4">
                      {/* Request Details */}
                      {log.requestDetails && (
                        <div>
                          <h4 className="text-base font-semibold text-theme mb-2">
                            Request Details:
                          </h4>
                          {log.requestDetails.message && (
                            <div className="glass-card rounded p-3">
                              <p className="text-base text-theme-muted break-words">
                                <strong>Message:</strong> {log.requestDetails.message.substring(0, 300)}
                                {log.requestDetails.message.length > 300 && '...'}
                              </p>
                            </div>
                          )}
                          {log.requestDetails.fileName && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div>
                                <span className="text-base text-theme-muted">
                                  <strong>File:</strong> {log.requestDetails.fileName}
                                </span>
                              </div>
                              {log.requestDetails.fileType && (
                                <div>
                                  <span className="text-base text-theme-muted">
                                    <strong>Type:</strong> {log.requestDetails.fileType}
                                  </span>
                                </div>
                              )}
                              {log.requestDetails.fileSize && (
                                <div>
                                  <span className="text-base text-theme-muted">
                                    <strong>Size:</strong> {(log.requestDetails.fileSize / 1024).toFixed(2)} KB
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Lakera Decision */}
                      {log.lakeraDecision && log.lakeraDecision.scanned && (
                        <div className={`
                          rounded-lg p-3 border
                          ${log.lakeraDecision.flagged
                            ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
                            : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
                          }
                        `}>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-3xl">🛡️</span>
                            <span className="text-base font-semibold text-theme">
                              Lakera AI Decision
                            </span>
                            {log.lakeraDecision.flagged ? (
                              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-base font-semibold" style={{ color: "var(--chip-text)" }}>
                                Flagged
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-green-600 text-white text-base font-semibold" style={{ color: "var(--chip-text)" }}>
                                Safe
                              </span>
                            )}
                          </div>
                          
                          {log.lakeraDecision.message && (
                            <p className="text-base text-theme mb-2">
                              {log.lakeraDecision.message}
                            </p>
                          )}

                          {log.lakeraDecision.categories && Object.keys(log.lakeraDecision.categories).length > 0 && (
                            <div className="mt-2">
                              <p className="text-base font-medium text-theme mb-1">
                                Threat Categories:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(log.lakeraDecision.categories)
                                  .filter(([, flagged]) => flagged)
                                  .map(([category]) => {
                                    const bgColor = getCategoryColor(category)
                                    return (
                                      <span
                                        key={category}
                                        className="px-2 py-0.5 rounded text-base capitalize"
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
                              <p className="text-base text-theme">
                                <strong>Threat Score:</strong>{' '}
                                {Math.max(...Object.values(log.lakeraDecision.scores)).toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Error */}
                      {log.error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                          <p className="text-base font-medium text-red-800 dark:text-red-300 mb-1">
                            Error:
                          </p>
                          <p className="text-base text-red-700 dark:text-red-400">
                            {log.error}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Risk Information Link */}
      <div className="mt-6 p-4 bg-brand-berry/10 dark:bg-brand-berry/20 border border-brand-berry/30 dark:border-brand-berry/40 rounded-lg">
        <p className="text-base text-brand-berry/80 dark:text-brand-berry">
          <strong>Learn More:</strong> For detailed information about {risk.code}, visit the{' '}
          <a
            href={`https://genai.owasp.org/llm-top-10/`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-brand-berry dark:hover:text-brand-berry"
          >
            OWASP GenAI Security Project
          </a>
        </p>
      </div>
    </div>
  )
}

