'use client'

import { LogEntry } from '@/types/logs'

interface LogStatsProps {
  logs: LogEntry[]
}

export default function LogStats({ logs }: LogStatsProps) {
  const totalLogs = logs.length
  const chatLogs = logs.filter(log => log.type === 'chat').length
  const fileScanLogs = logs.filter(log => log.type === 'file_scan').length
  const errorLogs = logs.filter(log => log.type === 'error' || log.action === 'error').length
  
  const blockedCount = logs.filter(log => log.action === 'blocked').length
  const allowedCount = logs.filter(log => log.action === 'allowed').length
  const scannedCount = logs.filter(log => log.lakeraDecision?.scanned).length
  const flaggedCount = logs.filter(log => log.lakeraDecision?.flagged).length

  const stats = [
    {
      label: 'Total Requests',
      value: totalLogs,
      icon: '📊',
      color: 'bg-brand-berry/30',
    },
    {
      label: 'Chat Requests',
      value: chatLogs,
      icon: '💬',
      color: 'bg-brand-berry/30',
    },
    {
      label: 'File Scans',
      value: fileScanLogs,
      icon: '📁',
      color: 'bg-brand-berry/30',
    },
    {
      label: 'Blocked',
      value: blockedCount,
      icon: '🚫',
      color: 'bg-red-400/30',
    },
    {
      label: 'Allowed',
      value: allowedCount,
      icon: '✓',
      color: 'bg-brand-berry/30',
    },
    {
      label: 'Scanned by Lakera',
      value: scannedCount,
      icon: '🛡️',
      color: 'bg-brand-berry/30',
    },
    {
      label: 'Flagged Threats',
      value: flaggedCount,
      icon: '⚠️',
      color: 'bg-yellow-400/30',
    },
    {
      label: 'Errors',
      value: errorLogs,
      icon: '⚠️',
      color: 'bg-red-400/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="glass-card rounded-xl p-4 hover:scale-105 transition-all float"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{stat.icon}</span>
            <div className={`w-3 h-3 rounded-full ${stat.color} pulse-glow`}></div>
          </div>
          <div className="text-2xl font-bold text-theme mb-1">{stat.value}</div>
          <div className="text-xs text-theme-muted">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
