'use client'

import { OWASPRisk } from '@/types/risks'

interface RiskMapProps {
  risks: OWASPRisk[]
  onRiskSelect: (risk: OWASPRisk) => void
  selectedRisk: OWASPRisk | null
  getRiskCount: (riskId: string) => number
}

function getSeverityColor(severity: OWASPRisk['severity']) {
  const colors = {
    critical: 'bg-red-600 border-red-700 hover:bg-red-700',
    high: 'bg-orange-600 border-orange-700 hover:bg-orange-700',
    medium: 'bg-yellow-600 border-yellow-700 hover:bg-yellow-700',
    low: 'bg-brand-berry border-berry-dark hover:bg-berry-dark',
  }
  return colors[severity]
}

function getSeverityTextColor(severity: OWASPRisk['severity']) {
  const colors = {
    critical: 'text-red-100',
    high: 'text-orange-100',
    medium: 'text-yellow-100',
    low: 'text-white',
  }
  return colors[severity]
}

function getSeverityBadge(severity: OWASPRisk['severity']) {
  const badges = {
    critical: '🔴 Critical',
    high: '🟠 High',
    medium: '🟡 Medium',
    low: '🔵 Low',
  }
  return badges[severity]
}

export default function RiskMap({ risks, onRiskSelect, selectedRisk, getRiskCount }: RiskMapProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        OWASP Top 10 for LLMs 2025
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {risks.map((risk) => {
          const count = getRiskCount(risk.id)
          const isSelected = selectedRisk?.id === risk.id
          
          return (
            <button
              key={risk.id}
              onClick={() => onRiskSelect(risk)}
              className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                ${isSelected 
                  ? 'ring-4 ring-brand-berry ring-offset-2 scale-105 z-10' 
                  : 'hover:scale-105 hover:shadow-lg'
                }
                ${getSeverityColor(risk.severity)}
                ${isSelected ? 'bg-opacity-100' : 'bg-opacity-90'}
              `}
            >
              {/* Risk Code */}
              <div className={`text-xs font-bold ${getSeverityTextColor(risk.severity)} mb-1`}>
                {risk.code}
              </div>
              
              {/* Risk Name */}
              <div className={`text-sm font-semibold ${getSeverityTextColor(risk.severity)} mb-2 line-clamp-2`}>
                {risk.name}
              </div>
              
              {/* Severity Badge */}
              <div className={`text-xs ${getSeverityTextColor(risk.severity)} mb-2`}>
                {getSeverityBadge(risk.severity)}
              </div>
              
              {/* Activity Count */}
              {count > 0 && (
                <div className="absolute top-2 right-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {count}
                </div>
              )}
              
              {/* Click indicator */}
              <div className={`text-xs ${getSeverityTextColor(risk.severity)} opacity-75 mt-2`}>
                {isSelected ? '✓ Selected' : 'Click for details →'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

