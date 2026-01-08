'use client'

import { useState, useEffect } from 'react'
import RiskMap from '@/components/RiskMap'
import RiskDetail from '@/components/RiskDetail'
import { OWASPRisk, OWASP_TOP_10_2025 } from '@/types/risks'
import { LogEntry } from '@/types/logs'
import { getLogs } from '@/lib/logging'
import { mapLakeraCategoryToOWASPRisk } from '@/types/risks'

export default function RiskMapPage() {
  const [selectedRisk, setSelectedRisk] = useState<OWASPRisk | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [riskAssociations, setRiskAssociations] = useState<Map<string, LogEntry[]>>(new Map())

  useEffect(() => {
    loadLogs()
    
    // Refresh logs every 2 seconds for real-time updates
    const interval = setInterval(() => {
      loadLogs()
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Map logs to OWASP risks
    const associations = new Map<string, LogEntry[]>()
    
    logs.forEach(log => {
      const addedRisks = new Set<string>()
      
      // First, use pre-associated risks if available
      if (log.associatedRisks && log.associatedRisks.length > 0) {
        log.associatedRisks.forEach(riskId => {
          if (!associations.has(riskId)) {
            associations.set(riskId, [])
          }
          if (!associations.get(riskId)!.some(l => l.id === log.id)) {
            associations.get(riskId)!.push(log)
            addedRisks.add(riskId)
          }
        })
      }
      
      // Map based on Lakera categories
      if (log.lakeraDecision?.categories) {
        Object.keys(log.lakeraDecision.categories).forEach(category => {
          if (log.lakeraDecision!.categories![category]) {
            const riskId = mapLakeraCategoryToOWASPRisk(category)
            if (riskId && !addedRisks.has(riskId)) {
              if (!associations.has(riskId)) {
                associations.set(riskId, [])
              }
              if (!associations.get(riskId)!.some(l => l.id === log.id)) {
                associations.get(riskId)!.push(log)
                addedRisks.add(riskId)
              }
            }
          }
        })
      }
      
      // Map based on action type
      if (log.action === 'blocked' && !addedRisks.has('llm01')) {
        if (!associations.has('llm01')) {
          associations.set('llm01', [])
        }
        if (!associations.get('llm01')!.some(l => l.id === log.id)) {
          associations.get('llm01')!.push(log)
          addedRisks.add('llm01')
        }
      }
      
      // Map file scans to LLM08 (Vector and Embedding Weaknesses)
      if (log.type === 'file_scan' && log.lakeraDecision?.flagged && !addedRisks.has('llm08')) {
        if (!associations.has('llm08')) {
          associations.set('llm08', [])
        }
        if (!associations.get('llm08')!.some(l => l.id === log.id)) {
          associations.get('llm08')!.push(log)
          addedRisks.add('llm08')
        }
      }
      
      // Map errors to LLM03 (Supply Chain)
      if (log.type === 'error' && !addedRisks.has('llm03')) {
        if (!associations.has('llm03')) {
          associations.set('llm03', [])
        }
        if (!associations.get('llm03')!.some(l => l.id === log.id)) {
          associations.get('llm03')!.push(log)
          addedRisks.add('llm03')
        }
      }
      
      // Map output scans to LLM05 (Improper Output Handling) - when output is scanned
      if (log.source === 'chat' && log.lakeraDecision?.scanned && log.action === 'scanned' && !addedRisks.has('llm05')) {
        if (!associations.has('llm05')) {
          associations.set('llm05', [])
        }
        if (!associations.get('llm05')!.some(l => l.id === log.id)) {
          associations.get('llm05')!.push(log)
          addedRisks.add('llm05')
        }
      }
      
      // Map all scanned items to relevant risks
      if (log.lakeraDecision?.scanned) {
        // If it's a chat request and was scanned, could be LLM01
        if (log.type === 'chat' && !addedRisks.has('llm01')) {
          if (!associations.has('llm01')) {
            associations.set('llm01', [])
          }
          if (!associations.get('llm01')!.some(l => l.id === log.id)) {
            associations.get('llm01')!.push(log)
          }
        }
      }
    })
    
    setRiskAssociations(associations)
  }, [logs])

  const loadLogs = () => {
    const allLogs = getLogs()
    setLogs(allLogs)
  }

  const handleRiskSelect = (risk: OWASPRisk) => {
    setSelectedRisk(risk)
  }

  const getRiskLogs = (riskId: string): LogEntry[] => {
    return riskAssociations.get(riskId) || []
  }

  const getRiskCount = (riskId: string): number => {
    return getRiskLogs(riskId).length
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          AI Risk Map
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          OWASP Top 10 for LLMs 2025 - Interactive risk visualization based on your session activity
        </p>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Based on <a href="https://genai.owasp.org/llm-top-10/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">OWASP GenAI Security Project</a>
        </p>
      </div>

      {/* Risk Map Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <RiskMap 
              risks={OWASP_TOP_10_2025}
              onRiskSelect={handleRiskSelect}
              selectedRisk={selectedRisk}
              getRiskCount={getRiskCount}
            />
          </div>
        </div>

        {/* Risk Detail Panel */}
        {selectedRisk && (
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <RiskDetail 
                risk={selectedRisk}
                relatedLogs={getRiskLogs(selectedRisk.id)}
                totalLogs={logs.length}
              />
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {!selectedRisk && (
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Risk Overview
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {OWASP_TOP_10_2025.filter(r => r.severity === 'critical').length}
                  </div>
                  <div className="text-xs text-red-700 dark:text-red-300 mt-1">Critical</div>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {OWASP_TOP_10_2025.filter(r => r.severity === 'high').length}
                  </div>
                  <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">High</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {OWASP_TOP_10_2025.filter(r => r.severity === 'medium').length}
                  </div>
                  <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Medium</div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {OWASP_TOP_10_2025.filter(r => r.severity === 'low').length}
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">Low</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {riskAssociations.size}
                  </div>
                  <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">Active Risks</div>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Click on any risk card above to view detailed information and related session activity.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

