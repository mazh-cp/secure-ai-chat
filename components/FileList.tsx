'use client'

import { UploadedFile } from '@/types/files'

interface FileListProps {
  files: UploadedFile[]
  onRemove: (fileId: string) => void
  onClearAll?: () => void
  onScan: (fileId: string) => void
  isScanning: boolean
  lakeraScanEnabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getFileIcon(type: string): string {
  if (type.includes('pdf')) return '📄'
  if (type.includes('json')) return '📋'
  if (type.includes('csv')) return '📊'
  if (type.includes('word') || type.includes('docx')) return '📝'
  if (type.includes('markdown') || type.includes('md')) return '📑'
  return '📃'
}

function getScanStatusBadge(status: UploadedFile['scanStatus']) {
  switch (status) {
    case 'pending':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass text-theme-muted" style={{ color: "var(--chip-text)" }}>
          Pending Scan
        </span>
      )
    case 'scanning':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass-button text-blue-300 animate-pulse" style={{ color: "var(--chip-text)" }}>
          Scanning...
        </span>
      )
    case 'safe':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass-card text-green-300 border-green-400/30" style={{ color: "var(--chip-text)" }}>
          ✓ Safe
        </span>
      )
    case 'flagged':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass-card text-red-300 border-red-400/50" style={{ color: "var(--chip-text)" }}>
          ⚠️ Flagged
        </span>
      )
    case 'error':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass-card text-yellow-300 border-yellow-400/30" style={{ color: "var(--chip-text)" }}>
          ⚠️ Error
        </span>
      )
    case 'not_scanned':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass text-theme-subtle border-brand-berry/20" style={{ color: "var(--chip-text)" }}>
          Not Scanned
        </span>
      )
    default:
      return null
  }
}

export default function FileList({ files, onRemove, onClearAll, onScan, isScanning, lakeraScanEnabled = true }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center border-brand-berry/20">
        <div className="text-theme-subtle text-4xl mb-4">📁</div>
        <p className="text-theme-muted">No files uploaded yet</p>
        <p className="text-theme-subtle text-sm mt-1">Upload files to get started with RAG</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Clear All Button */}
      {files.length > 0 && onClearAll && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={onClearAll}
            className="px-4 py-2 text-sm glass-button text-red-400 hover:text-red-300 rounded-xl transition-all border-red-400/30 border-2"
            style={{
              backgroundColor: "var(--destructive-bg, transparent)",
            }}
          >
            Clear All Files ({files.length})
          </button>
        </div>
      )}
      {files.map((file) => (
        <div
          key={file.id}
          className="glass-card rounded-xl p-4 hover:scale-[1.02] transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1 min-w-0">
              {/* File Icon */}
              <div className="text-2xl flex-shrink-0">
                {getFileIcon(file.type)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-theme font-medium truncate" title={file.name}>
                  {file.name}
                </h3>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-theme-muted text-sm">
                    {formatFileSize(file.size)}
                  </span>
                  <span className="text-theme-subtle">•</span>
                  <span className="text-theme-muted text-sm">
                    {formatDate(file.uploadedAt)}
                  </span>
                </div>

                {/* Scan Status */}
                <div className="mt-2 flex items-center space-x-2">
                  {getScanStatusBadge(file.scanStatus)}
                  {file.scanResult && file.scanStatus !== 'safe' && (
                    <span className="text-xs text-theme-subtle truncate" title={file.scanResult}>
                      {file.scanResult}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
              {/* Scan Button */}
              {(file.scanStatus === 'pending' || file.scanStatus === 'error' || file.scanStatus === 'not_scanned') && (
                <button
                  onClick={() => onScan(file.id)}
                  disabled={isScanning || !lakeraScanEnabled}
                  className="px-3 py-1 text-sm glass-button text-theme rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!lakeraScanEnabled ? 'Enable Lakera scanning to scan files' : ''}
                >
                  {isScanning ? 'Scanning...' : 'Scan'}
                </button>
              )}
              {!lakeraScanEnabled && (file.scanStatus === 'pending' || file.scanStatus === 'error' || file.scanStatus === 'not_scanned') && (
                <span className="text-xs text-yellow-400 ml-2">
                  (Scanning disabled)
                </span>
              )}

              {/* Remove Button */}
              <button
                onClick={() => onRemove(file.id)}
                className="px-3 py-1 text-sm glass-button text-theme-subtle hover:text-red-400 rounded-xl transition-all"
                style={{
                  backgroundColor: "var(--destructive-bg, transparent)",
                }}
              >
                Remove
              </button>
            </div>
          </div>

          {/* Scan Details (if flagged or has TE details) */}
          {(file.scanStatus === 'flagged' || file.checkpointTeDetails) && (
            <div className={`mt-3 p-3 glass-card rounded-xl ${
              file.scanStatus === 'flagged' ? 'border-red-400/30' : 'border-blue-400/30'
            }`}>
              {/* Check Point TE Details */}
              {file.checkpointTeDetails && (
                <div className="space-y-2">
                  <p className={`text-sm font-medium ${
                    file.scanStatus === 'flagged' ? 'text-red-300' : 'text-blue-300'
                  }`}>
                    {file.scanStatus === 'flagged' ? '🛡️ Check Point TE Security Alert:' : '🛡️ Check Point TE Analysis:'}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {/* Verdict and Status */}
                    {file.checkpointTeDetails.logFields.verdict && (
                      <div>
                        <span className="text-theme-subtle">Verdict:</span>{' '}
                        <span className={`font-medium ${
                          file.checkpointTeDetails.logFields.verdict === 'Malicious' ? 'text-red-400' :
                          file.checkpointTeDetails.logFields.verdict === 'Suspicious' ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {file.checkpointTeDetails.logFields.verdict}
                        </span>
                      </div>
                    )}
                    
                    {file.checkpointTeDetails.logFields.status && (
                      <div>
                        <span className="text-theme-subtle">Status:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.status}</span>
                      </div>
                    )}
                    
                    {/* Severity and Confidence */}
                    {file.checkpointTeDetails.logFields.severity && (
                      <div>
                        <span className="text-theme-subtle">Severity:</span>{' '}
                        <span className={`font-medium ${
                          file.checkpointTeDetails.logFields.severity === 'Critical' ? 'text-red-400' :
                          file.checkpointTeDetails.logFields.severity === 'High' ? 'text-orange-400' :
                          file.checkpointTeDetails.logFields.severity === 'Medium' ? 'text-yellow-400' :
                          'text-blue-400'
                        }`}>
                          {file.checkpointTeDetails.logFields.severity}
                        </span>
                      </div>
                    )}
                    
                    {file.checkpointTeDetails.logFields.confidence_level && (
                      <div>
                        <span className="text-theme-subtle">Confidence:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.confidence_level}</span>
                      </div>
                    )}
                    
                    {/* Protection and Attack Info */}
                    {file.checkpointTeDetails.logFields.protection_name && (
                      <div>
                        <span className="text-theme-subtle">Protection:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.protection_name}</span>
                      </div>
                    )}
                    
                    {file.checkpointTeDetails.logFields.protection_type && (
                      <div>
                        <span className="text-theme-subtle">Type:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.protection_type}</span>
                      </div>
                    )}
                    
                    {file.checkpointTeDetails.logFields.attack && (
                      <div className="md:col-span-2">
                        <span className="text-theme-subtle">Attack:</span>{' '}
                        <span className="text-theme font-medium">{file.checkpointTeDetails.logFields.attack}</span>
                      </div>
                    )}
                    
                    {file.checkpointTeDetails.logFields.attack_info && (
                      <div className="md:col-span-2">
                        <span className="text-theme-subtle">Attack Info:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.attack_info}</span>
                      </div>
                    )}
                    
                    {/* Action and Action Details */}
                    {file.checkpointTeDetails.logFields.action && (
                      <div>
                        <span className="text-theme-subtle">Action:</span>{' '}
                        <span className="text-theme font-medium capitalize">{file.checkpointTeDetails.logFields.action}</span>
                      </div>
                    )}
                    
                    {file.checkpointTeDetails.logFields.action_details && (
                      <div className="md:col-span-2">
                        <span className="text-theme-subtle">Action Details:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.action_details}</span>
                      </div>
                    )}
                    
                    {/* Analyzed On and Determined By */}
                    {file.checkpointTeDetails.logFields.analyzed_on && (
                      <div>
                        <span className="text-theme-subtle">Analyzed On:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.analyzed_on}</span>
                      </div>
                    )}
                    
                    {file.checkpointTeDetails.logFields.te_verdict_determined_by && (
                      <div className="md:col-span-2">
                        <span className="text-theme-subtle">Determined By:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.te_verdict_determined_by}</span>
                      </div>
                    )}
                    
                    {/* Risk Scores */}
                    {file.checkpointTeDetails.logFields.file_risk !== undefined && (
                      <div>
                        <span className="text-theme-subtle">File Risk:</span>{' '}
                        <span className={`font-medium ${
                          file.checkpointTeDetails.logFields.file_risk >= 7 ? 'text-red-400' :
                          file.checkpointTeDetails.logFields.file_risk >= 4 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {file.checkpointTeDetails.logFields.file_risk}/10
                        </span>
                      </div>
                    )}
                    
                    {file.checkpointTeDetails.logFields.confidence !== undefined && (
                      <div>
                        <span className="text-theme-subtle">Confidence Score:</span>{' '}
                        <span className="text-theme">{Math.round((file.checkpointTeDetails.logFields.confidence || 0) * 100)}%</span>
                      </div>
                    )}
                    
                    {/* Triggered By and Vendor */}
                    {file.checkpointTeDetails.logFields.triggered_by && (
                      <div>
                        <span className="text-theme-subtle">Triggered By:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.triggered_by}</span>
                      </div>
                    )}
                    
                    {file.checkpointTeDetails.logFields.vendor_list && (
                      <div>
                        <span className="text-theme-subtle">Vendor:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.vendor_list}</span>
                      </div>
                    )}
                    
                    {/* Description and Reason */}
                    {file.checkpointTeDetails.logFields.description && (
                      <div className="md:col-span-2">
                        <span className="text-theme-subtle">Description:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.description}</span>
                      </div>
                    )}
                    
                    {file.checkpointTeDetails.logFields.reason && (
                      <div className="md:col-span-2">
                        <span className="text-theme-subtle">Reason:</span>{' '}
                        <span className="text-theme">{file.checkpointTeDetails.logFields.reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Lakera Guard Scan Details */}
              {file.scanDetails && (
                <>
                  {file.scanDetails.categories && Object.keys(file.scanDetails.categories).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-theme-subtle text-xs font-medium mb-1">Security Categories:</p>
                      <ul className="text-theme-subtle text-xs space-y-1">
                        {Object.entries(file.scanDetails.categories)
                          .filter(([, value]) => value)
                          .map(([key]) => (
                            <li key={key}>• {key.replace(/_/g, ' ')}</li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* Payload Data - Detected Threats with Locations */}
                  {file.scanDetails.payload && file.scanDetails.payload.length > 0 && (
                    <div className="mt-3 p-2 glass-card rounded-lg border-yellow-400/30">
                      <p className="text-xs text-yellow-300 font-medium mb-2">
                        Detected Threats ({file.scanDetails.payload.length}):
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {file.scanDetails.payload.map((item, idx) => (
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
                  {file.scanDetails.breakdown && file.scanDetails.breakdown.length > 0 && (
                    <div className="mt-3 p-2 glass-card rounded-lg border-blue-400/30">
                      <p className="text-xs text-blue-300 font-medium mb-2">
                        Detector Breakdown ({file.scanDetails.breakdown.filter(d => d.detected).length}/{file.scanDetails.breakdown.length} detected):
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {file.scanDetails.breakdown.map((detector, idx) => (
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
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Summary */}
      <div className="text-center text-theme-subtle text-sm pt-2">
        {files.length} file{files.length !== 1 ? 's' : ''} • 
        {' '}{files.filter(f => f.scanStatus === 'safe').length} safe • 
        {' '}{files.filter(f => f.scanStatus === 'flagged').length} flagged • 
        {' '}{files.filter(f => f.scanStatus === 'pending').length} pending scan
      </div>
    </div>
  )
}
