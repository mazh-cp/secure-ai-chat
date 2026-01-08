'use client'

import { UploadedFile } from '@/types/files'

interface FileListProps {
  files: UploadedFile[]
  onRemove: (fileId: string) => void
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
        <span className="px-2 py-1 text-xs rounded-full glass text-theme-muted">
          Pending Scan
        </span>
      )
    case 'scanning':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass-button text-blue-300 animate-pulse">
          Scanning...
        </span>
      )
    case 'safe':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass-card text-green-300 border-green-400/30">
          ✓ Safe
        </span>
      )
    case 'flagged':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass-card text-red-300 border-red-400/50">
          ⚠️ Flagged
        </span>
      )
    case 'error':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass-card text-yellow-300 border-yellow-400/30">
          ⚠️ Error
        </span>
      )
    case 'not_scanned':
      return (
        <span className="px-2 py-1 text-xs rounded-full glass text-theme-subtle border-brand-berry/20">
          Not Scanned
        </span>
      )
    default:
      return null
  }
}

export default function FileList({ files, onRemove, onScan, isScanning, lakeraScanEnabled = true }: FileListProps) {
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
              >
                Remove
              </button>
            </div>
          </div>

          {/* Scan Details (if flagged) */}
          {file.scanStatus === 'flagged' && file.scanDetails && (
            <div className="mt-3 p-3 glass-card rounded-xl border-red-400/30">
              <p className="text-red-300 text-sm font-medium">Security Issues Detected:</p>
              {file.scanDetails.categories && (
                <ul className="mt-1 text-red-300 text-xs space-y-1">
                  {Object.entries(file.scanDetails.categories)
                    .filter(([, value]) => value)
                    .map(([key]) => (
                      <li key={key}>• {key.replace(/_/g, ' ')}</li>
                    ))}
                </ul>
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
