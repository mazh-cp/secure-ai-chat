'use client'

import { useState, useEffect } from 'react'

interface Model {
  id: string
  name: string
  created: number
  owned_by: string
}

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (modelId: string) => void
  apiKey: string | null
}

export default function ModelSelector({ selectedModel, onModelChange, apiKey }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available models when API key is available
  useEffect(() => {
    if (!apiKey) {
      setModels([])
      setError(null)
      return
    }

    const fetchModels = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/models')
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to fetch models')
        }

        const data = await response.json()
        setModels(data.models || [])
        
        // If no model is selected and models are available, select the first one (usually the newest)
        if (!selectedModel && data.models && data.models.length > 0) {
          onModelChange(data.models[0].id)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load models'
        setError(errorMessage)
        console.error('Failed to fetch models:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchModels()
  }, [apiKey, selectedModel, onModelChange])

  if (!apiKey) {
    return (
      <div className="text-xs text-theme-subtle">
        Configure API key to select model
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="text-xs text-theme-subtle">
        Loading models...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-xs text-red-400">
        ⚠️ {error}
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="text-xs text-theme-subtle">
        No models available
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="model-select" className="text-sm font-medium text-theme-muted whitespace-nowrap">
        Model:
      </label>
      <select
        id="model-select"
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="glass-input text-theme px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 transition-all cursor-pointer"
        style={{
          background: "rgb(var(--surface-1))",
          borderColor: "rgb(var(--border))",
          color: "rgb(var(--text-1))",
          borderWidth: '2px',
          borderStyle: 'solid',
          minWidth: '180px',
        }}
      >
        {models.map((model) => (
          <option key={model.id} value={model.id} style={{ background: "rgb(var(--surface-1))", color: "rgb(var(--text-1))" }}>
            {model.name}
          </option>
        ))}
      </select>
    </div>
  )
}