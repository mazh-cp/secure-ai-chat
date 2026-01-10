'use client'

import { useState, useEffect } from 'react'
import SecurityIndicator from '@/components/SecurityIndicator'
import FileUploader from '@/components/FileUploader'
import FileList from '@/components/FileList'
import { UploadedFile } from '@/types/files'
import { addLog } from '@/lib/logging'
import { getAssociatedRisksFromLakeraDecision } from '@/types/risks'
import { CheckPointTEResponse } from '@/types/checkpoint-te'

export default function FilesPage() {
  const [isSecure, setIsSecure] = useState(true)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [lakeraScanEnabled, setLakeraScanEnabled] = useState(true)
  const [ragScanEnabled, setRagScanEnabled] = useState(true)
  const [checkpointTeSandboxEnabled, setCheckpointTeSandboxEnabled] = useState(false)
  const [checkpointTeConfigured, setCheckpointTeConfigured] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSecure(window.location.protocol === 'https:' || window.location.hostname === 'localhost')
      
      // Load files from localStorage
      const stored = localStorage.getItem('uploadedFiles')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setFiles(parsed)
        } catch (e) {
          console.error('Failed to load files:', e)
        }
      }

      // Load Lakera scan toggle state from localStorage
      const scanToggle = localStorage.getItem('lakeraFileScanEnabled')
      if (scanToggle !== null) {
        setLakeraScanEnabled(JSON.parse(scanToggle))
      }

      // Load RAG scan toggle state from localStorage
      const ragToggle = localStorage.getItem('lakeraRagScanEnabled')
      if (ragToggle !== null) {
        setRagScanEnabled(JSON.parse(ragToggle))
      } else {
        // Default to true if not set
        setRagScanEnabled(true)
      }

      // Load Check Point TE sandboxing toggle state from localStorage
      const teSandboxToggle = localStorage.getItem('checkpointTeSandboxEnabled')
      if (teSandboxToggle !== null) {
        setCheckpointTeSandboxEnabled(JSON.parse(teSandboxToggle))
      }

      // Check if Check Point TE API key is configured
      // Use setTimeout to avoid blocking page load if endpoint is slow
      setTimeout(() => {
        checkCheckpointTeStatus().catch(err => {
          // Silently handle - don't break page load
          console.error('Check Point TE status check failed:', err)
        })
      }, 500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check Check Point TE API key configuration status
  const checkCheckpointTeStatus = async () => {
    try {
      const response = await fetch('/api/te/config')
      if (response.ok) {
        const data = await response.json()
        setCheckpointTeConfigured(data.configured || false)
        // If API key not configured but toggle is enabled, disable it
        if (!data.configured && checkpointTeSandboxEnabled) {
          setCheckpointTeSandboxEnabled(false)
        }
      } else {
        // If endpoint returns error, assume not configured
        setCheckpointTeConfigured(false)
        if (checkpointTeSandboxEnabled) {
          setCheckpointTeSandboxEnabled(false)
        }
      }
    } catch (error) {
      // Silently handle errors - service may not be ready yet
      // Don't break the UI if status check fails
      console.error('Failed to check Check Point TE status:', error)
      setCheckpointTeConfigured(false)
      if (checkpointTeSandboxEnabled) {
        setCheckpointTeSandboxEnabled(false)
      }
    }
  }

  // Save toggle states to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lakeraFileScanEnabled', JSON.stringify(lakeraScanEnabled))
    }
  }, [lakeraScanEnabled])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lakeraRagScanEnabled', JSON.stringify(ragScanEnabled))
    }
  }, [ragScanEnabled])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('checkpointTeSandboxEnabled', JSON.stringify(checkpointTeSandboxEnabled))
    }
  }, [checkpointTeSandboxEnabled])

  // Check TE status when toggle is enabled
  useEffect(() => {
    if (checkpointTeSandboxEnabled && !checkpointTeConfigured) {
      checkCheckpointTeStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpointTeSandboxEnabled, checkpointTeConfigured])

  // Save files to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && files.length >= 0) {
      localStorage.setItem('uploadedFiles', JSON.stringify(files))
    }
  }, [files])

  const handleFileUpload = async (newFile: UploadedFile) => {
    // Add file with pending status first
    setFiles(prev => [...prev, newFile])

    // If Check Point TE sandboxing is enabled, process it first
    if (checkpointTeSandboxEnabled && checkpointTeConfigured) {
      setTimeout(() => {
        handleCheckpointTeSandbox(newFile.id)
      }, 300)
      return // Don't proceed with other scans until TE completes
    }

    // If RAG scan is disabled, mark file as not scanned
    if (!ragScanEnabled || !lakeraScanEnabled) {
      setFiles(prev => prev.map(f => 
        f.id === newFile.id ? { ...f, scanStatus: 'not_scanned' as const } : f
      ))
      return
    }
    
    // If RAG scan is enabled, auto-scan for RAG
    // Use setTimeout to ensure state is updated before scanning
    setTimeout(() => {
      handleFileScan(newFile.id)
    }, 300)
  }

  const handleFileRemove = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  // Handle Check Point TE sandboxing
  const handleCheckpointTeSandbox = async (fileId: string) => {
    // Get file from current state - need to wait for state update
    const currentFiles = files.length > 0 ? files : JSON.parse(localStorage.getItem('uploadedFiles') || '[]')
    let file = currentFiles.find((f: UploadedFile) => f.id === fileId)
    
    // If still not found, wait a bit and try again
    if (!file) {
      await new Promise(resolve => setTimeout(resolve, 100))
      const updatedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]')
      file = updatedFiles.find((f: UploadedFile) => f.id === fileId)
    }
    
    if (!file) {
      console.error('File not found for Check Point TE sandboxing:', fileId)
      return
    }

    // Update file status to scanning
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, scanStatus: 'scanning' as const, scanResult: undefined } : f
    ))

    try {
      setIsScanning(true)

      // Step 1: Upload file to Check Point TE
      const formData = new FormData()
      
      // Convert file content to Blob for upload
      // FileUploader stores text files as plain text and binary files as base64
      let fileBlob: Blob
      try {
        if (file.content.startsWith('data:')) {
          // If it's a data URL, convert to blob
          const response = await fetch(file.content)
          fileBlob = await response.blob()
        } else {
          // Check if content is base64 (binary files) or plain text
          // Binary files from FileUploader are base64 encoded
          // Text files are stored as-is
          const isBase64 = /^[A-Za-z0-9+/=]+$/.test(file.content) && file.content.length > 0
          
          if (isBase64 && file.content.length > 100) {
            // Likely base64 encoded binary file
            // Handle base64 strings that might not have padding
            let base64Content = file.content
            // Remove data URL prefix if present
            if (base64Content.includes(',')) {
              base64Content = base64Content.split(',')[1]
            }
            // Add padding if needed
            while (base64Content.length % 4) {
              base64Content += '='
            }
            
            try {
              const byteCharacters = atob(base64Content)
              const byteNumbers = new Array(byteCharacters.length)
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
              }
              const byteArray = new Uint8Array(byteNumbers)
              fileBlob = new Blob([byteArray], { type: file.type || 'application/octet-stream' })
            } catch {
              // If base64 decode fails, treat as text
              fileBlob = new Blob([file.content], { type: file.type || 'text/plain' })
            }
          } else {
            // Plain text file
            fileBlob = new Blob([file.content], { type: file.type || 'text/plain' })
          }
        }
      } catch (error) {
        throw new Error(`Failed to convert file content for upload: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      formData.append('file', fileBlob, file.name)
      formData.append('request', JSON.stringify({
        features: ['te'],
        te: {
          reports: ['pdf', 'xml'],
          images: ['pdf', 'json'],
        },
      }))

      const uploadResponse = await fetch('/api/te/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        let errorMessage = 'Failed to upload file to Check Point TE'
        try {
          const errorData = await uploadResponse.json()
          errorMessage = errorData.error || errorData.message || errorMessage
          if (errorData.details) {
            console.error('Check Point TE upload error details:', errorData.details)
          }
        } catch (parseError) {
          // If response is not JSON, try to read as text
          try {
            const errorText = await uploadResponse.text()
            errorMessage = `Upload failed (${uploadResponse.status}): ${errorText.substring(0, 200)}`
          } catch {
            errorMessage = `Upload failed with status ${uploadResponse.status} ${uploadResponse.statusText}`
          }
        }
        throw new Error(errorMessage)
      }

      let uploadData
      try {
        uploadData = await uploadResponse.json()
      } catch (parseError) {
        throw new Error('Invalid response format from Check Point TE upload API')
      }

      if (!uploadData.success || !uploadData.data) {
        throw new Error(uploadData.error || 'Upload succeeded but no data returned')
      }

      const { sha256, sha1, md5, teImageId, teRevision } = uploadData.data

      if (!sha256 && !sha1 && !md5) {
        throw new Error('No hash returned from Check Point TE upload')
      }

      // Step 2: Poll for results
      const maxAttempts = 30 // 30 attempts = 60 seconds total (30 * 2s)
      const pollInterval = 2000 // 2 seconds between attempts
      const pollTimeout = maxAttempts * pollInterval // 60 seconds total timeout
      const pollStartTime = Date.now()
      let attempts = 0
      let verdict: 'safe' | 'malicious' | 'pending' | 'unknown' = 'pending'
      let teResult: CheckPointTEResponse | null = null

      while (attempts < maxAttempts && verdict === 'pending') {
        // Check if polling timeout exceeded
        if (Date.now() - pollStartTime > pollTimeout) {
          console.warn('Check Point TE polling timeout exceeded', {
            attempts,
            duration: Date.now() - pollStartTime,
            timeout: pollTimeout,
          })
          verdict = 'unknown'
          break
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        attempts++

        const queryBody: {
          sha256?: string
          sha1?: string
          md5?: string
          features: string[]
          te?: {
            image?: {
              id?: string
              revision?: number
            }
          }
        } = {
          features: ['te'],
        }

        if (sha256) queryBody.sha256 = sha256
        else if (sha1) queryBody.sha1 = sha1
        else if (md5) queryBody.md5 = md5

        if (teImageId && teRevision) {
          queryBody.te = {
            image: {
              id: teImageId,
              revision: teRevision,
            },
          }
        }

        const queryResponse = await fetch('/api/te/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(queryBody),
        })

        if (!queryResponse.ok) {
          // If query fails, wait and retry
          if (attempts < maxAttempts) continue
          throw new Error('Failed to query Check Point TE results')
        }

        const queryData = await queryResponse.json()
        // Extract verdict from the CheckPointTEResponse structure
        verdict = queryData.verdict as 'safe' | 'malicious' | 'pending' | 'unknown'
        // Store the full response including logFields
        teResult = queryData

        // If verdict is found (not pending), break
        if (verdict !== 'pending' && verdict !== 'unknown') {
          break
        }
      }

      // Step 3: Update file status based on verdict
      // Extract TE log fields from query response
      const teLogFields = teResult?.logFields || {}
      const teStatus = teResult?.status || 'unknown'
      const teVerdict = teResult?.verdict || verdict
      
      // Build detailed scan result message with TE findings
      let scanResultMessage = ''
      let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
      
      if (verdict === 'pending' || verdict === 'unknown') {
        // Timeout or unknown - treat as safe but log
        scanResultMessage = 'Check Point TE analysis completed but verdict is unclear. File allowed.'
        
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            scanStatus: 'safe' as const,
            scanResult: scanResultMessage,
            scanDetails: { categories: {}, score: 0 },
            checkpointTeDetails: {
              logFields: teLogFields,
              verdict: teVerdict,
              status: teStatus,
            },
          } : f
        ))
        
        addLog({
          type: 'file_scan',
          action: 'scanned',
          source: 'file_upload',
          requestDetails: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          },
          checkpointTeDecision: {
            scanned: true,
            flagged: false,
            verdict: teVerdict,
            status: teStatus,
            logFields: teLogFields,
            message: scanResultMessage,
          },
          success: true,
        })
      } else if (verdict === 'malicious') {
        // Block malicious file - build detailed message with findings
        const severity = teLogFields.severity || 'High'
        const protectionName = teLogFields.protection_name || 'Unknown protection'
        const attackName = teLogFields.attack || 'Malicious content'
        const attackInfo = teLogFields.attack_info || ''
        const confidence = teLogFields.confidence_level || teLogFields.confidence
        const determinedBy = teLogFields.te_verdict_determined_by || ''
        
        // Determine threat level from severity
        if (severity === 'Critical') threatLevel = 'critical'
        else if (severity === 'High') threatLevel = 'high'
        else if (severity === 'Medium') threatLevel = 'medium'
        else threatLevel = 'low'
        
        // Build detailed result message
        scanResultMessage = `File blocked by Check Point Threat Emulation`
        const details: string[] = []
        if (attackName) details.push(`Attack: ${attackName}`)
        if (attackInfo) details.push(`Details: ${attackInfo}`)
        if (protectionName) details.push(`Protection: ${protectionName}`)
        if (severity) details.push(`Severity: ${severity}`)
        if (confidence) details.push(`Confidence: ${confidence}`)
        if (determinedBy) details.push(`Analyzed by: ${determinedBy}`)
        if (details.length > 0) {
          scanResultMessage += `\n${details.join('\n')}`
        }
        
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            scanStatus: 'flagged' as const,
            scanResult: scanResultMessage,
            scanDetails: { 
              categories: { malicious: true, checkpoint_te: true }, 
              score: teLogFields.file_risk ? teLogFields.file_risk / 10 : 1.0 
            },
            checkpointTeDetails: {
              logFields: teLogFields,
              verdict: teVerdict,
              status: teStatus,
            },
          } : f
        ))
        
        addLog({
          type: 'file_scan',
          action: 'blocked',
          source: 'file_upload',
          requestDetails: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            threatLevel: threatLevel,
          },
          checkpointTeDecision: {
            scanned: true,
            flagged: true,
            verdict: teVerdict,
            status: teStatus,
            logFields: teLogFields,
            message: scanResultMessage,
          },
          success: false,
        })

        alert(`File blocked: Check Point Threat Emulation detected malicious content.\n\n${details.join('\n')}`)
        return // Don't proceed with other scans
      } else {
        // Safe - proceed with normal flow
        const severity = teLogFields.severity || 'Low'
        const confidence = teLogFields.confidence_level || teLogFields.confidence || 'Medium'
        const analyzedOn = teLogFields.analyzed_on || 'Check Point Threat Emulation Cloud'
        
        scanResultMessage = `File passed Check Point TE sandboxing`
        const details: string[] = []
        if (analyzedOn) details.push(`Analyzed on: ${analyzedOn}`)
        if (severity) details.push(`Severity: ${severity}`)
        if (confidence) details.push(`Confidence: ${confidence}`)
        if (teLogFields.protection_type) details.push(`Protection type: ${teLogFields.protection_type}`)
        if (details.length > 0) {
          scanResultMessage += `\n${details.join('\n')}`
        }
        
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            scanStatus: 'safe' as const,
            scanResult: scanResultMessage,
            scanDetails: { 
              categories: { safe: true, checkpoint_te: true }, 
              score: 0 
            },
            checkpointTeDetails: {
              logFields: teLogFields,
              verdict: teVerdict,
              status: teStatus,
            },
          } : f
        ))
        
        addLog({
          type: 'file_scan',
          action: 'scanned',
          source: 'file_upload',
          requestDetails: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          },
          checkpointTeDecision: {
            scanned: true,
            flagged: false,
            verdict: teVerdict,
            status: teStatus,
            logFields: teLogFields,
            message: scanResultMessage,
          },
          success: true,
        })

        // If RAG scan is enabled, continue with RAG scanning
        if (ragScanEnabled && lakeraScanEnabled) {
          setTimeout(() => {
            handleFileScan(fileId)
          }, 300)
        }
      }
    } catch (error) {
      let message = 'Check Point TE sandboxing failed'
      
      if (error instanceof Error) {
        message = error.message
        
        // Add helpful suggestions based on error type
        if (message.includes('401') || message.includes('Invalid') || message.includes('API key')) {
          message += ' - Please check your Check Point TE API key in Settings.'
        } else if (message.includes('403') || message.includes('denied')) {
          message += ' - Please check your API key permissions in Settings.'
        } else if (message.includes('404') || message.includes('not found')) {
          message += ' - Check Point TE endpoint may be incorrect. Check your API configuration.'
        } else if (message.includes('429') || message.includes('rate limit')) {
          message += ' - Rate limit exceeded. Please wait a moment and try again.'
        } else if (message.includes('network') || message.includes('connect') || message.includes('fetch')) {
          message += ' - Check your internet connection and firewall settings.'
        } else if (message.includes('timeout')) {
          message += ' - Request timed out. The file may be too large or the service may be slow.'
        }
      }
      
      console.error('Check Point TE sandboxing error:', error)
      
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          scanStatus: 'error' as const, 
          scanResult: message,
        } : f
      ))
      
      addLog({
        type: 'error',
        action: 'error',
        source: 'file_upload',
        requestDetails: {
          fileName: file?.name || 'unknown',
          fileType: file?.type || 'unknown',
          fileSize: file?.size || 0,
        },
        error: message,
        success: false,
      })
    } finally {
      setIsScanning(false)
    }
  }

  const handleFileScan = async (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return

    // Check if Lakera scanning is enabled
    if (!lakeraScanEnabled) {
      alert('Lakera scanning is disabled. Please enable it using the toggle above.')
      return
    }

    setIsScanning(true)
    
    // Update file status to scanning
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, scanStatus: 'scanning' as const, scanResult: undefined } : f
    ))

    try {
      // Check if Lakera API key is configured (server-side)
      // The API route will use server-side keys if available
      // We just need to verify it's configured
      const keysResponse = await fetch('/api/keys').catch(() => null)
      let lakeraConfigured = false
      
      if (keysResponse?.ok) {
        const keysData = await keysResponse.json()
        lakeraConfigured = keysData.configured?.lakeraAiKey || false
      } else {
        // Fallback: check localStorage for backward compatibility
        const apiKeys = localStorage.getItem('apiKeys')
        const keys = apiKeys ? JSON.parse(apiKeys) : {}
        lakeraConfigured = !!keys.lakeraAiKey
      }

      if (!lakeraConfigured) {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, scanStatus: 'error' as const, scanResult: 'Lakera API key not configured. Please add it in Settings.' } : f
        ))
        setIsScanning(false)
        return
      }

      // Get keys for endpoint validation
      let endpoint = 'https://api.lakera.ai/v2/guard'
      
      // Try to get endpoint from server-side or localStorage
      if (keysResponse?.ok) {
        const keysData = await keysResponse.json()
        endpoint = keysData.configured?.lakeraEndpoint || keysData.source?.lakeraEndpoint === 'storage' ? 
          (await fetch('/api/keys/retrieve').then(r => r.json()).then(d => d.keys?.lakeraEndpoint || endpoint).catch(() => endpoint)) :
          endpoint
      } else {
        // Fallback: check localStorage
        const apiKeys = localStorage.getItem('apiKeys')
        const localKeys = apiKeys ? JSON.parse(apiKeys) : {}
        endpoint = localKeys.lakeraEndpoint || endpoint
      }
      
      // Validate endpoint
      if (!endpoint || !endpoint.startsWith('http')) {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, scanStatus: 'error' as const, scanResult: 'Invalid Lakera endpoint. Please check Settings.' } : f
        ))
        setIsScanning(false)
        return
      }

      // The API route will use server-side keys if available
      // We don't need to send keys from client (server-side keys take priority)
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileContent: file.content,
          fileName: file.name,
          // Send empty object - API route will use server-side keys automatically
          apiKeys: {},
        }),
      })

      let data: { 
        flagged: boolean
        message?: string
        error?: string
        details?: { categories?: Record<string, boolean>; score?: number; threatLevel?: string }
        logData?: unknown
      }
      
      // Try to parse as JSON first
      const contentType = response.headers.get('content-type')
      const isJson = contentType && contentType.includes('application/json')
      
      if (isJson) {
        try {
          data = await response.json()
        } catch (parseError) {
          throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
        }
      } else {
        // If not JSON, read as text
        const text = await response.text()
        throw new Error(`Unexpected response format: ${text.substring(0, 200)}`)
      }

      if (!response.ok) {
        // More detailed error message with details if available
        let errorMsg = data?.error || `Scan failed with status ${response.status}`
        
        // Add details if available
        if (data?.details) {
          if (typeof data.details === 'string') {
            errorMsg += ` - ${data.details}`
          } else if (typeof data.details === 'object') {
            try {
              const detailsStr = JSON.stringify(data.details).substring(0, 200)
              errorMsg += ` - ${detailsStr}`
            } catch {
              errorMsg += ' - Error details available but could not be displayed'
            }
          }
        }
        
        throw new Error(errorMsg)
      }

      // Log the scan result
      if (data.logData) {
        const associatedRisks = getAssociatedRisksFromLakeraDecision(
          data.details?.categories,
          data.flagged ? 'blocked' : 'scanned',
          'file_scan'
        )
        const logData = data.logData as Omit<import('@/types/logs').LogEntry, 'id' | 'timestamp'>
        addLog({
          ...logData,
          associatedRisks,
        })
      } else {
        const associatedRisks = getAssociatedRisksFromLakeraDecision(
          data.details?.categories,
          data.flagged ? 'blocked' : 'scanned',
          'file_scan'
        )
        addLog({
          type: 'file_scan',
          action: data.flagged ? 'blocked' : 'scanned',
          source: 'file_upload',
          requestDetails: {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          },
          lakeraDecision: {
            scanned: true,
            flagged: data.flagged,
            categories: data.details?.categories,
            scores: data.details?.score ? { threat: data.details.score } : undefined,
            message: data.message,
          },
          success: true,
          associatedRisks,
        })
      }

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          scanStatus: data.flagged ? 'flagged' as const : 'safe' as const,
          scanResult: data.message || (data.flagged ? 'Security threats detected' : 'File is safe'),
          scanDetails: data.details
        } : f
      ))
    } catch (error) {
      let message = 'Scan failed. Please check your API configuration.'
      
      if (error instanceof Error) {
        message = error.message
        
        // Add helpful suggestions based on error type
        if (error.message.includes('401') || error.message.includes('Invalid') || error.message.includes('API key')) {
          message += ' - Please check your Lakera API key in Settings.'
        } else if (error.message.includes('403') || error.message.includes('denied')) {
          message += ' - Please check your API key and project ID in Settings.'
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          message += ' - Please check your Lakera endpoint URL in Settings.'
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
          message += ' - Please wait a moment and try again.'
        } else if (error.message.includes('network') || error.message.includes('connect')) {
          message += ' - Check your internet connection and API endpoint.'
        }
      }
      
      // Log error
      addLog({
        type: 'error',
        action: 'error',
        source: 'file_upload',
        requestDetails: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        },
        error: message,
        success: false,
        associatedRisks: ['llm03'], // Supply Chain risk for errors
      })

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, scanStatus: 'error' as const, scanResult: message } : f
      ))
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="bento-grid">
      {/* Header Card */}
      <div className="bento-card bento-span-4 glass-card p-6 liquid-shimmer border-2" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-theme drop-shadow-lg">File Upload & RAG</h1>
            <p className="mt-2 text-sm text-theme-muted">
              Upload documents for RAG (Retrieval-Augmented Generation). Files are scanned by Lakera AI for security.
            </p>
          </div>
          <div className="mt-4">
            <SecurityIndicator isSecure={isSecure} />
          </div>
        </div>
      </div>

      {/* Upload Section Card */}
      <div className="bento-card bento-span-2 glass-card p-6 border-2" style={{ borderColor: "rgb(var(--border))" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-theme">Upload Files</h2>
        </div>
        
        {/* Toggle Options - More Visible */}
        <div className="mb-6 space-y-4">
          <div className="glass-card rounded-xl p-4 border-brand-berry/30">
            <h3 className="text-sm font-semibold text-theme mb-3">Scanning Options</h3>
            
            {/* Lakera Scan Toggle */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-theme">Lakera Scan</span>
                  {/* Status Dot */}
                  <div 
                    className={`h-2 w-2 rounded-full transition-all ${
                      lakeraScanEnabled ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    title={lakeraScanEnabled ? 'Enabled' : 'Disabled'}
                    style={{
                      boxShadow: lakeraScanEnabled 
                        ? '0 0 8px rgba(34, 197, 94, 0.6)' 
                        : '0 0 8px rgba(239, 68, 68, 0.6)'
                    }}
                  />
                </div>
                <span className="text-xs text-theme-subtle mt-1">Enable manual file scanning</span>
              </div>
              <div className="flex items-center space-x-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lakeraScanEnabled}
                    onChange={(e) => {
                      setLakeraScanEnabled(e.target.checked)
                      if (!e.target.checked) {
                        setRagScanEnabled(false) // Disable RAG scan if Lakera is disabled
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-berry/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/30 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-berry/50"></div>
                  <span className={`ml-3 text-sm font-medium ${lakeraScanEnabled ? 'text-brand-berry' : 'text-white/60'}`}>
                    {lakeraScanEnabled ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>
            </div>

            {/* RAG Scan Toggle */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-theme">RAG Auto-Scan</span>
                  {/* Status Dot */}
                  <div 
                    className={`h-2 w-2 rounded-full transition-all ${
                      ragScanEnabled && lakeraScanEnabled ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    title={ragScanEnabled && lakeraScanEnabled ? 'Enabled' : 'Disabled'}
                    style={{
                      boxShadow: ragScanEnabled && lakeraScanEnabled
                        ? '0 0 8px rgba(34, 197, 94, 0.6)' 
                        : '0 0 8px rgba(239, 68, 68, 0.6)'
                    }}
                  />
                </div>
                <span className="text-xs text-theme-subtle mt-1">Automatically scan files on upload</span>
              </div>
              <div className="flex items-center space-x-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ragScanEnabled && lakeraScanEnabled}
                    onChange={(e) => setRagScanEnabled(e.target.checked)}
                    disabled={!lakeraScanEnabled}
                    className="sr-only peer"
                  />
                  <div className={`w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-berry/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/30 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-berry/50 ${!lakeraScanEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  <span className={`ml-3 text-sm font-medium ${ragScanEnabled && lakeraScanEnabled ? 'text-brand-berry' : 'text-white/60'}`}>
                    {ragScanEnabled && lakeraScanEnabled ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>
            </div>

            {/* Check Point TE Sandboxing Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-theme">File Sandboxing (Check Point TE)</span>
                  {/* Status Dot */}
                  <div 
                    className={`h-2 w-2 rounded-full transition-all ${
                      checkpointTeSandboxEnabled && checkpointTeConfigured ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    title={checkpointTeSandboxEnabled && checkpointTeConfigured ? 'Enabled' : 'Disabled'}
                    style={{
                      boxShadow: checkpointTeSandboxEnabled && checkpointTeConfigured
                        ? '0 0 8px rgba(34, 197, 94, 0.6)' 
                        : '0 0 8px rgba(239, 68, 68, 0.6)'
                    }}
                  />
                </div>
                <span className="text-xs text-theme-subtle mt-1">
                  {checkpointTeConfigured 
                    ? 'Sandbox files with Check Point Threat Emulation' 
                    : '⚠️ API key not configured in Settings'}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkpointTeSandboxEnabled && checkpointTeConfigured}
                    onChange={(e) => {
                      if (!checkpointTeConfigured) {
                        alert('Check Point TE API key is not configured. Please configure it in Settings first.')
                        return
                      }
                      setCheckpointTeSandboxEnabled(e.target.checked)
                    }}
                    disabled={!checkpointTeConfigured}
                    className="sr-only peer"
                  />
                  <div className={`w-14 h-7 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-berry/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white/30 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-berry/50 ${!checkpointTeConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  <span className={`ml-3 text-sm font-medium ${checkpointTeSandboxEnabled && checkpointTeConfigured ? 'text-brand-berry' : 'text-white/60'}`}>
                    {checkpointTeSandboxEnabled && checkpointTeConfigured ? 'ON' : 'OFF'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <FileUploader onFileUpload={handleFileUpload} lakeraScanEnabled={lakeraScanEnabled} ragScanEnabled={ragScanEnabled} />
      </div>

      {/* Files List Section Card */}
      <div className="bento-card bento-span-2 bento-row-span-2 glass-card p-6 overflow-hidden flex flex-col border-2" style={{ borderColor: "rgb(var(--border))" }}>
        <h2 className="text-lg font-semibold text-theme mb-4">
          Uploaded Files ({files.length})
        </h2>
        <FileList 
          files={files} 
          onRemove={handleFileRemove}
          onScan={handleFileScan}
          isScanning={isScanning}
          lakeraScanEnabled={lakeraScanEnabled}
        />
      </div>

      {/* Info Section Card */}
      <div className="bento-card bento-span-2 glass-card p-4 border-2" style={{ borderColor: "rgb(var(--border))" }}>
        <h3 className="text-brand-berry font-medium mb-2">📁 Supported Features</h3>
        <ul className="text-sm text-theme-muted space-y-1">
          <li>• Maximum file size: 50 MB</li>
          <li>• Supported formats: PDF, TXT, MD, JSON, CSV, DOCX</li>
          <li>• Lakera AI security scanning for uploaded content</li>
          <li>• Files stored locally in your browser</li>
        </ul>
      </div>
    </div>
  )
}
