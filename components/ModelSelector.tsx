'use client'

import { useState, useEffect } from 'react'

import { DEFAULT_AZURE_DEPLOYMENT_ID } from '@/lib/azure-openai'

export type ChatProvider = 'openai' | 'anthropic' | 'azure'

interface Model {
  id: string
  name: string
  created?: number
  owned_by?: string
}

interface ModelSelectorProps {
  provider: ChatProvider
  onProviderChange: (provider: ChatProvider) => void
  selectedModel: string
  onModelChange: (modelId: string) => void
  apiKey: string | null
}

export default function ModelSelector({ provider, onProviderChange, selectedModel, onModelChange, apiKey }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  // Fetch available models for the selected provider
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true)
      setError(null)
      setWarning(null)

      try {
        const response = await fetch(`/api/models?provider=${provider}`, { credentials: 'include', cache: 'no-store' })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          const errorMsg = data.error || 'Failed to fetch models'
          if (errorMsg.includes('API key') || response.status === 400) {
            setError(provider === 'anthropic'
              ? 'Anthropic API key not configured. Please configure it in Settings.'
              : provider === 'azure'
                ? 'Azure OpenAI API key/endpoint not configured. Please configure it in Settings.'
                : 'OpenAI API key not configured. Please configure it in Settings.')
          } else {
            throw new Error(errorMsg)
          }
          return
        }

        const data = await response.json() as {
          models?: Model[]
          azureDeploymentListFailed?: boolean
          message?: string
        }
        const fetchedModels = data.models || []
        setModels(fetchedModels)

        if (provider === 'azure' && data.azureDeploymentListFailed && data.message) {
          setWarning(data.message)
        }

        if (fetchedModels.length > 0) {
          const modelExists = fetchedModels.some((m: Model) => m.id === selectedModel)
          if (!selectedModel || !modelExists) {
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
  }, [provider, selectedModel, onModelChange])

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

  const selectStyle = {
    background: 'rgb(var(--surface-1))',
    borderColor: 'rgb(var(--border))',
    color: 'rgb(var(--text-1))',
    borderWidth: '2px',
    borderStyle: 'solid' as const,
    minWidth: '140px',
  }

  return (
    <div className="flex flex-col gap-2">
      {warning && (
        <div className="text-sm text-amber-400/90 max-w-[42rem]" role="status">
          {warning}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="provider-select" className="text-base font-medium text-theme-muted whitespace-nowrap">
          Provider:
        </label>
        <select
          id="provider-select"
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as ChatProvider)}
          className="glass-input text-theme px-3 py-2 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer"
          style={selectStyle}
        >
          <option value="openai" style={selectStyle}>OpenAI</option>
          <option value="azure" style={selectStyle}>Azure OpenAI</option>
          <option value="anthropic" style={selectStyle}>Anthropic</option>
        </select>
        <label htmlFor="model-select" className="text-base font-medium text-theme-muted whitespace-nowrap">
          Model:
        </label>
        {models.length > 0 ? (
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="glass-input text-theme px-3 py-2 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 transition-all cursor-pointer"
            style={{ ...selectStyle, minWidth: '200px' }}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id} style={selectStyle}>
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
            placeholder={
              provider === 'azure'
                ? `Deployment id (e.g. ${DEFAULT_AZURE_DEPLOYMENT_ID})`
                : 'Enter model name'
            }
            className="glass-input text-theme px-3 py-2 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 transition-all"
            style={{ ...selectStyle, minWidth: '200px' }}
          />
        )}
      </div>
    </div>
  )
}