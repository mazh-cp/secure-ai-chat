'use client'

import { useState, useEffect } from 'react'
import LogViewer from '@/components/LogViewer'
import SystemLogViewer from '@/components/SystemLogViewer'
import { LogEntry } from '@/types/logs'
import { getLogs, clearLogs } from '@/lib/logging'
import { SystemLogEntry } from '@/lib/system-logging'

export default function DashboardPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([])
  const [filter, setFilter] = useState<'all' | 'chat' | 'file_scan' | 'error' | 'system'>('all')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    loadLogs()
    
    // Refresh logs every 2 seconds for real-time updates
    const interval = setInterval(() => {
      loadLogs()
    }, 2000)

    return () => clearInterval(interval)
  }, [refreshKey])

  const loadLogs = async () => {
    const allLogs = getLogs()
    setLogs(allLogs)
    
    // Load system logs
    try {
      const response = await fetch('/api/logs/system?limit=100')
      if (response.ok) {
        const data = await response.json()
        setSystemLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to load system logs:', error)
    }
  }

  const handleClearLogs = async () => {
    if (filter === 'system') {
      if (confirm('Are you sure you want to clear all system logs? This action cannot be undone.')) {
        try {
          const response = await fetch('/api/logs/system', { method: 'DELETE' })
          if (response.ok) {
            setSystemLogs([])
            setRefreshKey(prev => prev + 1)
          }
        } catch (error) {
          console.error('Failed to clear system logs:', error)
        }
      }
    } else {
    if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      clearLogs()
      setLogs([])
      setRefreshKey(prev => prev + 1)
      }
    }
  }

  const filteredLogs = filter === 'all' 
    ? logs 
    : filter === 'system'
    ? [] // System logs are handled separately
    : logs.filter(log => log.type === filter)

  const totalLogs = logs.length
  const chatLogs = logs.filter(log => log.type === 'chat').length
  const fileScanLogs = logs.filter(log => log.type === 'file_scan').length
  const errorLogs = logs.filter(log => log.type === 'error' || log.action === 'error').length
  const blockedCount = logs.filter(log => log.action === 'blocked').length
  const allowedCount = logs.filter(log => log.action === 'allowed').length
  const scannedCount = logs.filter(log => log.lakeraDecision?.scanned).length
  const flaggedCount = logs.filter(log => log.lakeraDecision?.flagged).length
  
  // System logs stats
  const systemErrorLogs = systemLogs.filter(log => log.level === 'error').length
  const checkpointTeErrors = systemLogs.filter(log => log.service === 'checkpoint_te' && log.level === 'error').length

  return (
    <div className="bento-grid">
      {/* Header Card */}
      <div 
        className="bento-card bento-span-4 glass-card p-6 liquid-shimmer"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-theme drop-shadow-lg">Dashboard</h1>
            <p className="mt-2 text-sm text-theme-muted">
              Monitor all user requests, IP addresses, security decisions, and system-level events
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards - Bento Grid */}
      <div 
        className="bento-card bento-span-1 glass-card p-6 hover:scale-105 transition-transform"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-3xl font-bold text-theme mb-1">{totalLogs}</div>
          <div className="text-xs text-theme-subtle text-center">Total Requests</div>
        </div>
      </div>

      <div 
        className="bento-card bento-span-1 glass-card p-6 hover:scale-105 transition-transform"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-2">💬</div>
          <div className="text-3xl font-bold text-theme mb-1">{chatLogs}</div>
          <div className="text-xs text-theme-subtle text-center">Chat Requests</div>
        </div>
      </div>

      <div 
        className="bento-card bento-span-1 glass-card p-6 hover:scale-105 transition-transform"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-2">📁</div>
          <div className="text-3xl font-bold text-theme mb-1">{fileScanLogs}</div>
          <div className="text-xs text-theme-subtle text-center">File Scans</div>
        </div>
      </div>

      <div 
        className="bento-card bento-span-1 glass-card p-6 hover:scale-105 transition-transform border-red-400/30"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-2">🚫</div>
          <div className="text-3xl font-bold text-red-400 mb-1">{blockedCount}</div>
          <div className="text-xs text-theme-subtle text-center">Blocked</div>
        </div>
      </div>

      <div 
        className="bento-card bento-span-1 glass-card p-6 hover:scale-105 transition-transform border-brand-berry/30"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-2">✓</div>
          <div className="text-3xl font-bold text-brand-berry mb-1">{allowedCount}</div>
          <div className="text-xs text-theme-subtle text-center">Allowed</div>
        </div>
      </div>

      <div 
        className="bento-card bento-span-1 glass-card p-6 hover:scale-105 transition-transform border-brand-berry/30"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-2">🛡️</div>
          <div className="text-3xl font-bold text-brand-berry mb-1">{scannedCount}</div>
          <div className="text-xs text-theme-subtle text-center">Scanned</div>
        </div>
      </div>

      <div 
        className="bento-card bento-span-1 glass-card p-6 hover:scale-105 transition-transform border-yellow-400/30"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-2">⚠️</div>
          <div className="text-3xl font-bold text-yellow-400 mb-1">{flaggedCount}</div>
          <div className="text-xs text-theme-subtle text-center">Flagged</div>
        </div>
      </div>

      <div 
        className="bento-card bento-span-1 glass-card p-6 hover:scale-105 transition-transform border-red-400/30"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-2">⚠️</div>
          <div className="text-3xl font-bold text-red-400 mb-1">{errorLogs}</div>
          <div className="text-xs text-theme-subtle text-center">Application Errors</div>
        </div>
      </div>

      <div 
        className="bento-card bento-span-1 glass-card p-6 hover:scale-105 transition-transform border-blue-400/30"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-2">⚙️</div>
          <div className="text-3xl font-bold text-blue-400 mb-1">{systemErrorLogs}</div>
          <div className="text-xs text-theme-subtle text-center">System Errors</div>
        </div>
      </div>

      <div 
        className="bento-card bento-span-1 glass-card p-6 hover:scale-105 transition-transform border-orange-400/30"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl mb-2">🛡️</div>
          <div className="text-3xl font-bold text-orange-400 mb-1">{checkpointTeErrors}</div>
          <div className="text-xs text-theme-subtle text-center">Check Point TE Errors</div>
        </div>
      </div>

      {/* Filters Card */}
      <div 
        className="bento-card bento-span-4 glass-card p-4"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'all'
                  ? 'glass-button text-theme scale-105'
                  : 'glass text-theme-muted hover:text-brand-berry hover:scale-105 hover:border-brand-berry/30'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('chat')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'chat'
                  ? 'glass-button text-theme scale-105'
                  : 'glass text-theme-muted hover:text-brand-berry hover:scale-105 hover:border-brand-berry/30'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setFilter('file_scan')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'file_scan'
                  ? 'glass-button text-theme scale-105'
                  : 'glass text-theme-muted hover:text-brand-berry hover:scale-105 hover:border-brand-berry/30'
              }`}
            >
              File Scans
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'error'
                  ? 'glass-button text-red-400 scale-105'
                  : 'glass text-theme-muted hover:text-theme hover:scale-105'
              }`}
            >
              Errors
            </button>
            <button
              onClick={() => setFilter('system')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'system'
                  ? 'glass-button text-blue-400 scale-105'
                  : 'glass text-theme-muted hover:text-blue-400 hover:scale-105'
              }`}
            >
              ⚙️ System ({systemLogs.filter(l => l.level === 'error').length} errors)
            </button>
          </div>

          <button
            onClick={handleClearLogs}
            className="px-4 py-2 glass-button text-theme-subtle hover:text-red-400 rounded-xl transition-all text-sm font-medium"
            style={{
              backgroundColor: "var(--destructive-bg, transparent)",
            }}
          >
            Clear All Logs
          </button>
        </div>
      </div>

      {/* Logs Viewer Card - Full Width */}
      <div 
        className="bento-card bento-span-4 bento-row-span-2 glass-card overflow-hidden flex flex-col"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        {filter === 'system' ? (
          <SystemLogViewer logs={systemLogs} />
        ) : (
        <LogViewer logs={filteredLogs} />
        )}
      </div>
    </div>
  )
}
