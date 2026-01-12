'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ReleaseNote {
  version: string
  date: string
  type: 'major' | 'minor' | 'patch' | 'hotfix'
  changes: {
    added?: string[]
    fixed?: string[]
    improved?: string[]
    security?: string[]
  }
}

const releaseNotes: ReleaseNote[] = [
  {
    version: '1.0.6',
    date: '2026-01-12',
    type: 'minor',
    changes: {
      added: [
        'RAG (Retrieval Augmented Generation) - Chat can now access and answer questions about uploaded files',
        'Release Notes section in Settings page',
        'Automated security verification script (`npm run verify-security`)',
        'Enhanced file scanning for large files (500+ individuals)',
        'Periodic status checking for Checkpoint TE configuration',
      ],
      fixed: [
        'Fixed "Failed to execute json" error when scanning large files',
        'Fixed navigation issue - sidebar always visible on desktop',
        'Fixed Checkpoint TE key status not updating after save',
        'Fixed webpack chunk errors (Cannot find module errors)',
        'Fixed form-data stream handling in Checkpoint TE upload',
        'Fixed response body stream consumption issues',
      ],
      improved: [
        'Improved key deletion with proper server-side cache invalidation',
        'Enhanced error handling for file scanning',
        'Better status synchronization between Settings and Files pages',
        'Improved mobile navigation with auto-close sidebar',
        'Enhanced system prompt to allow data queries from files',
      ],
      security: [
        'Verified all API keys are excluded from git (.secure-storage/ in .gitignore)',
        'Confirmed keys persist across restarts and upgrades',
        'Added security verification script for key safety checks',
      ],
    },
  },
  {
    version: '1.0.5',
    date: '2026-01-09',
    type: 'patch',
    changes: {
      fixed: [
        'Fixed Checkpoint TE API key storage and retrieval',
        'Fixed server-side key persistence',
      ],
      improved: [
        'Improved key management UI',
      ],
    },
  },
  {
    version: '1.0.4',
    date: '2026-01-08',
    type: 'minor',
    changes: {
      added: [
        'Checkpoint TE (Threat Emulation) integration',
        'File sandboxing with Check Point TE',
        'Server-side API key storage with encryption',
      ],
      improved: [
        'Enhanced file scanning capabilities',
      ],
    },
  },
]

export default function ReleaseNotesPage() {
  const [appVersion, setAppVersion] = useState<string>('1.0.6')

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const response = await fetch('/api/version')
        if (response.ok) {
          const data = await response.json()
          setAppVersion(data.version || '1.0.6')
        }
      } catch (error) {
        console.error('Failed to load version:', error)
      }
    }
    loadVersion()
  }, [])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'major':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/50'
      case 'minor':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50'
      case 'patch':
        return 'bg-green-500/20 text-green-300 border-green-500/50'
      case 'hotfix':
        return 'bg-red-500/20 text-red-300 border-red-500/50'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/50'
    }
  }

  return (
    <div className="bento-grid">
      {/* Header */}
      <div 
        className="bento-card bento-span-4 glass-card p-6 border-2"
        style={{
          background: "rgb(var(--surface-1))",
          borderColor: "rgb(var(--border))",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-theme drop-shadow-lg">Release Notes</h1>
            <p className="mt-2 text-sm text-theme-muted">
              Version history and changelog for Secure AI Chat
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-theme-muted">Current Version</div>
            <div className="text-2xl font-bold text-theme">{appVersion}</div>
          </div>
        </div>
      </div>

      {/* Release Notes List */}
      <div 
        className="bento-card bento-span-4 glass-card p-6 border-2 overflow-y-auto"
        style={{
          background: "rgb(var(--surface-1))",
          borderColor: "rgb(var(--border))",
          boxShadow: "var(--shadow-md)",
          maxHeight: "calc(100vh - 200px)",
        }}
      >
        <div className="space-y-6">
          {releaseNotes.map((release, index) => (
            <div
              key={release.version}
              className="glass-card p-6 rounded-xl border-2"
              style={{
                background: "rgb(var(--surface-2))",
                borderColor: "rgb(var(--border))",
              }}
            >
              {/* Version Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-palette-border-default/20">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-theme">v{release.version}</h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(release.type)}`}>
                    {release.type.toUpperCase()}
                  </span>
                  {index === 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/50">
                      LATEST
                    </span>
                  )}
                </div>
                <div className="text-sm text-theme-muted">{release.date}</div>
              </div>

              {/* Changes */}
              <div className="space-y-4">
                {release.changes.added && release.changes.added.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-green-300 mb-2 flex items-center gap-2">
                      <span>✨</span> Added
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-theme-muted ml-4">
                      {release.changes.added.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {release.changes.fixed && release.changes.fixed.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-blue-300 mb-2 flex items-center gap-2">
                      <span>🐛</span> Fixed
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-theme-muted ml-4">
                      {release.changes.fixed.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {release.changes.improved && release.changes.improved.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                      <span>⚡</span> Improved
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-theme-muted ml-4">
                      {release.changes.improved.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {release.changes.security && release.changes.security.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-red-300 mb-2 flex items-center gap-2">
                      <span>🔐</span> Security
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-theme-muted ml-4">
                      {release.changes.security.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Back to Settings Link */}
      <div 
        className="bento-card bento-span-4 glass-card p-4 border-2"
        style={{
          background: "rgb(var(--surface-1))",
          borderColor: "rgb(var(--border))",
        }}
      >
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-theme hover:text-brand-berry transition-colors"
        >
          <span>←</span>
          <span>Back to Settings</span>
        </Link>
      </div>
    </div>
  )
}
