'use client'

import { useCallback, useEffect, useState } from 'react'

interface OllamaListedModel {
  id: string
  size?: number
  modifiedAt?: string
}

interface OllamaStatus {
  ok: boolean
  origin: string
  manageEnabled: boolean
  binaryOk: boolean
  version?: string
  models?: OllamaListedModel[]
  error?: string
}

function formatBytes(n?: number): string {
  if (n == null || !Number.isFinite(n) || n < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

export default function OllamaModelManager() {
  const [status, setStatus] = useState<OllamaStatus | null>(null)
  const [models, setModels] = useState<OllamaListedModel[]>([])
  const [loading, setLoading] = useState(true)
  const [pullName, setPullName] = useState('llama3.2')
  const [importName, setImportName] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [pullProgress, setPullProgress] = useState<string | null>(null)
  const [busy, setBusy] = useState<'pull' | 'import' | 'delete' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const statusRes = await fetch('/api/ollama/status', {
        credentials: 'include',
        cache: 'no-store',
      })
      const statusData = (await statusRes.json().catch(() => ({}))) as OllamaStatus & {
        error?: string
      }
      if (!statusRes.ok && !statusData.origin) {
        setError(statusData.error || 'Failed to check Ollama status')
        setStatus(null)
        setModels([])
        return
      }
      setStatus(statusData)
      if (statusData.ok && Array.isArray(statusData.models)) {
        setModels(statusData.models)
      } else if (statusData.ok) {
        const listRes = await fetch('/api/ollama/models', {
          credentials: 'include',
          cache: 'no-store',
        })
        const listData = (await listRes.json().catch(() => ({}))) as {
          models?: OllamaListedModel[]
          error?: string
        }
        if (listRes.ok) {
          setModels(listData.models || [])
        } else {
          setModels([])
          setError(listData.error || 'Failed to list models')
        }
      } else {
        setModels([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh Ollama status')
      setStatus(null)
      setModels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handlePull = async () => {
    setBusy('pull')
    setError(null)
    setMessage(null)
    setPullProgress('Starting pull…')
    try {
      const res = await fetch('/api/ollama/pull', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pullName.trim() }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || `Pull failed (HTTP ${res.status})`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No progress stream from server')

      const decoder = new TextDecoder()
      let buffer = ''
      let lastError: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let parsed: {
            status?: string
            completed?: number
            total?: number
            error?: string
            done?: boolean
          }
          try {
            parsed = JSON.parse(trimmed)
          } catch {
            continue
          }
          if (parsed.error) {
            lastError = parsed.error
            setPullProgress(parsed.error)
            continue
          }
          if (parsed.total && parsed.completed != null) {
            const pct = Math.min(100, Math.round((parsed.completed / parsed.total) * 100))
            setPullProgress(`${parsed.status || 'downloading'} — ${pct}%`)
          } else if (parsed.status) {
            setPullProgress(parsed.status)
          }
        }
      }

      if (lastError) {
        throw new Error(lastError)
      }
      setMessage(`Pulled "${pullName.trim()}" successfully.`)
      setPullProgress(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed')
      setPullProgress(null)
    } finally {
      setBusy(null)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      setError('Choose a .gguf file to import.')
      return
    }
    if (!importName.trim()) {
      setError('Enter a model name for the import (e.g. my-model).')
      return
    }
    setBusy('import')
    setError(null)
    setMessage(null)
    try {
      const form = new FormData()
      form.set('name', importName.trim())
      form.set('file', importFile)
      const res = await fetch('/api/ollama/import', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        throw new Error(data.error || `Import failed (HTTP ${res.status})`)
      }
      setMessage(data.message || `Imported "${importName.trim()}".`)
      setImportFile(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete Ollama model "${name}"? This cannot be undone.`)) return
    setBusy('delete')
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/ollama/models', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || `Delete failed (HTTP ${res.status})`)
      }
      setMessage(`Deleted "${name}".`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(null)
    }
  }

  const statusLabel = !status
    ? loading
      ? 'Checking…'
      : 'Unknown'
    : !status.manageEnabled
      ? 'Manage disabled'
      : status.ok
        ? `Online${status.version ? ` (v${status.version})` : ''}`
        : 'Offline'

  const statusColor = !status
    ? 'bg-yellow-500'
    : !status.manageEnabled
      ? 'bg-yellow-500'
      : status.ok
        ? 'bg-green-500'
        : 'bg-red-500'

  const manageBlocked = status ? !status.manageEnabled : false

  return (
    <div className="mt-6 rounded-lg border border-theme/20 bg-theme-surface/40 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-theme">Ollama models</h3>
          <p className="text-sm text-theme-subtle mt-1">
            Pull from the{' '}
            <a
              href="https://ollama.com/library"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-theme"
            >
              official Ollama library
            </a>{' '}
            or import a <code className="text-xs">.gguf</code> on this host. Chat →{' '}
            <strong>Local model</strong> lists the same models when the base URL points at this
            Ollama instance (default <code className="text-xs">http://localhost:11434/v1</code>).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || busy !== null}
          className="text-sm px-3 py-1.5 rounded border border-theme/30 hover:bg-theme-surface disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${statusColor}`}
            style={{ boxShadow: '0 0 8px rgba(0,0,0,0.25)' }}
            title={status?.error || statusLabel}
          />
          <span className="text-theme">{statusLabel}</span>
        </span>
        {status?.origin ? (
          <span className="text-theme-subtle">
            Origin: <code className="text-xs">{status.origin}</code>
          </span>
        ) : null}
        {status && !status.binaryOk ? (
          <span className="text-amber-500 text-xs">
            `ollama` CLI not on PATH (needed for .gguf import)
          </span>
        ) : null}
      </div>

      {status?.error && !status.ok ? (
        <p className="text-sm text-red-400" role="alert">
          {status.error}
        </p>
      ) : null}

      {manageBlocked ? (
        <p className="text-sm text-amber-500">
          Management is disabled (<code className="text-xs">OLLAMA_MANAGE_ENABLED=0</code>). Status
          and installed lists still work when Ollama is reachable.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="ollamaPullName" className="block text-sm font-medium text-theme">
            Pull from library
          </label>
          <div className="flex gap-2">
            <input
              id="ollamaPullName"
              type="text"
              value={pullName}
              onChange={e => setPullName(e.target.value)}
              placeholder="llama3.2"
              disabled={busy !== null || manageBlocked}
              className="flex-1 rounded border border-theme/30 bg-theme-surface px-3 py-2 text-sm text-theme"
            />
            <button
              type="button"
              onClick={() => void handlePull()}
              disabled={busy !== null || manageBlocked || !pullName.trim() || !status?.ok}
              className="glass-button px-3 py-2 text-sm rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'pull' ? 'Pulling…' : 'Pull'}
            </button>
          </div>
          {pullProgress ? <p className="text-xs text-theme-subtle">{pullProgress}</p> : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="ollamaImportName" className="block text-sm font-medium text-theme">
            Import .gguf
          </label>
          <input
            id="ollamaImportName"
            type="text"
            value={importName}
            onChange={e => setImportName(e.target.value)}
            placeholder="Model name (e.g. my-model)"
            disabled={busy !== null || manageBlocked}
            className="w-full rounded border border-theme/30 bg-theme-surface px-3 py-2 text-sm text-theme"
          />
          <input
            type="file"
            accept=".gguf,application/octet-stream"
            disabled={busy !== null || manageBlocked}
            onChange={e => setImportFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-theme-subtle file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-theme-surface file:text-theme"
          />
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={
              busy !== null ||
              manageBlocked ||
              !importFile ||
              !importName.trim() ||
              !status?.ok ||
              status?.binaryOk === false
            }
            className="px-3 py-2 text-sm rounded-xl glass-button font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === 'import' ? 'Importing…' : 'Import'}
          </button>
          <p className="text-xs text-theme-subtle">
            Large library models: prefer Pull. Reverse proxies must allow large upload bodies for
            Import.
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-green-500" role="status">
          {message}
        </p>
      ) : null}

      <div>
        <h4 className="text-sm font-medium text-theme mb-2">Installed</h4>
        {loading ? (
          <p className="text-sm text-theme-subtle">Loading…</p>
        ) : models.length === 0 ? (
          <p className="text-sm text-theme-subtle">No models installed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-theme/20 text-theme-subtle">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Size</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map(m => (
                  <tr key={m.id} className="border-b border-theme/10">
                    <td className="py-2 pr-3 text-theme font-mono text-xs">{m.id}</td>
                    <td className="py-2 pr-3 text-theme-subtle">{formatBytes(m.size)}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => void handleDelete(m.id)}
                        disabled={busy !== null || manageBlocked}
                        className="text-xs text-red-400 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
