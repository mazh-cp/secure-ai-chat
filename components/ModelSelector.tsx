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
  const [warning, setWarning] = useState<string | null>(null)

  // Fetch available models dynamically
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true)
      setError(null)
      setWarning(null)

      try {
        // Fetch models from the API
        // The /api/models endpoint gets the API key from server-side storage
        const response = await fetch('/api/models')
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          const errorMsg = data.error || 'Failed to fetch models'
          
          // If API key is not configured, show a helpful message
          if (errorMsg.includes('API key') || response.status === 400) {
            setError('OpenAI API key not configured. Please configure it in Settings.')
          } else {
            throw new Error(errorMsg)
          }
          return
        }

        const data = await response.json()
        const fetchedModels = data.models || []
        
        setModels(fetchedModels)
        
        // If models are available and no model is selected, or current model is not in the list
        if (fetchedModels.length > 0) {
          const modelExists = fetchedModels.some((m: Model) => m.id === selectedModel)
          if (!selectedModel || !modelExists) {
            // Select the first available model
            onModelChange(fetchedModels[0].id)
          }
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
  }, [selectedModel, onModelChange])

  // Note: We no longer check apiKey prop since the API endpoint gets it from server-side storage

  if (isLoading) {
    return (
      <div className="text-sm text-theme-subtle">
        Loading models...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-400">
        ⚠️ {error}
      </div>
    )
  }

  if (models.length === 0 && !warning) {
    return (
      <div className="text-sm text-theme-subtle">
        No models available
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor="model-select" className="text-base font-medium text-theme-muted whitespace-nowrap">
          Model:
        </label>
        {models.length > 0 ? (
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="glass-input text-theme px-3 py-2 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 transition-all cursor-pointer"
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
              <option 
                key={model.id} 
                value={model.id} 
                style={{ background: "rgb(var(--surface-1))", color: "rgb(var(--text-1))" }}
              >
                {model.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="model-select"
            type="text"
            value={selectedModel || ''}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="Enter model name"
            className="glass-input text-theme px-3 py-2 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 transition-all"
            style={{
              background: "rgb(var(--surface-1))",
              borderColor: "rgb(var(--border))",
              color: "rgb(var(--text-1))",
              borderWidth: '2px',
              borderStyle: 'solid',
              minWidth: '180px',
            }}
          />
        )}
      </div>
    </div>
  )
}