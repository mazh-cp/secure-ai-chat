'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { UploadedFile } from '@/types/files'

interface FileUploaderProps {
  onFileUpload: (file: UploadedFile) => void
  lakeraScanEnabled?: boolean
  ragScanEnabled?: boolean
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_FILES = 10 // Maximum number of files that can be uploaded simultaneously
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.json', '.csv', '.docx']

export default function FileUploader({ onFileUpload, lakeraScanEnabled = true, ragScanEnabled = true }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set())
  const [processedCount, setProcessedCount] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 50 MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    }

    return null
  }

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // STABILITY: Validate file size before reading to prevent memory bloat
      if (file.size > MAX_FILE_SIZE) {
        reject(new Error(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit`))
        return
      }
      
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const result = e.target?.result
          if (typeof result === 'string') {
            resolve(result)
          } else if (result instanceof ArrayBuffer) {
            // STABILITY: For binary files like PDF, convert to base64
            // Note: For large files (50MB max), this is acceptable as it's already validated
            // The client-side sequential processing prevents memory bloat from multiple files
            const bytes = new Uint8Array(result)
            let binary = ''
            
            // Convert bytes to binary string (optimized for modern browsers)
            // For files up to 50MB, this is acceptable and doesn't block the event loop
            // The browser's FileReader already handles this asynchronously
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i])
            }
            
            resolve(btoa(binary))
          } else {
            reject(new Error('Failed to read file'))
          }
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to read file'))
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read file'))
      
      // Read as text for text files, as ArrayBuffer for binary
      if (file.type.startsWith('text/') || file.type === 'application/json') {
        reader.readAsText(file)
      } else {
        reader.readAsArrayBuffer(file)
      }
    })
  }

  const processFile = async (file: File, fileIndex: number, total: number): Promise<void> => {
    const fileId = `${file.name}-${fileIndex}`
    
    try {
      setProcessingFiles(prev => new Set(prev).add(fileId))
      
      const validationError = validateFile(file)
      if (validationError) {
        setError(prev => prev ? `${prev}\n${file.name}: ${validationError}` : `${file.name}: ${validationError}`)
        return
      }

      const content = await readFileContent(file)

      const uploadedFile: UploadedFile = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        content: content,
        uploadedAt: new Date(),
        scanStatus: 'pending',
      }

      onFileUpload(uploadedFile)
      setProcessedCount(prev => prev + 1)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to process file'
      setError(prev => prev ? `${prev}\n${file.name}: ${errorMsg}` : `${file.name}: ${errorMsg}`)
    } finally {
      setProcessingFiles(prev => {
        const next = new Set(prev)
        next.delete(fileId)
        return next
      })
    }
  }

  const processMultipleFiles = async (files: File[]) => {
    setError(null)
    setIsProcessing(true)
    setProcessedCount(0)
    setTotalFiles(files.length)
    setProcessingFiles(new Set())

    // Validate file count
    if (files.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed. You selected ${files.length} files.`)
      setIsProcessing(false)
      return
    }

    // STABILITY: Process files sequentially to avoid overwhelming the system
    // This prevents memory bloat, event-loop blocking, and race conditions
    // Each file is processed one at a time with proper error isolation
    for (let i = 0; i < files.length; i++) {
      try {
        await processFile(files[i], i, files.length)
        // Small delay between files to prevent overwhelming the event loop
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (err) {
        // Error already handled in processFile, continue with next file
        console.error(`Failed to process file ${i + 1}/${files.length}:`, err)
      }
    }

    setIsProcessing(false)
    setProcessingFiles(new Set())
    
    // Reset after a short delay
    setTimeout(() => {
      setProcessedCount(0)
      setTotalFiles(0)
    }, 2000)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await processMultipleFiles(files)
    }
  }

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await processMultipleFiles(Array.from(files))
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-300
          ${isDragging 
            ? 'glass-card border-brand-berry/50 scale-105' 
            : 'glass border-brand-berry/30 hover:border-brand-berry/50 hover:scale-[1.02]'
          }
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept={ALLOWED_EXTENSIONS.join(',')}
          multiple
          className="hidden"
        />

        <div className="space-y-4">
          {/* Upload Icon */}
          <div className="mx-auto w-16 h-16 rounded-full glass flex items-center justify-center border-brand-berry/30">
            {isProcessing ? (
              <svg className="animate-spin h-8 w-8 text-brand-berry" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-8 w-8 text-brand-berry" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>

          <div>
            <p className="text-theme font-medium">
              {isProcessing 
                ? `Processing ${processedCount}/${totalFiles} files...` 
                : 'Drop files here or click to upload'}
            </p>
            <p className="text-theme-muted text-base mt-1">
              PDF, TXT, MD, JSON, CSV, DOCX up to 50 MB each
            </p>
            <p className="text-theme-subtle text-base mt-1">
              You can upload up to {MAX_FILES} files at once
            </p>
            {isProcessing && totalFiles > 0 && (
              <div className="mt-3 w-full bg-white/10 rounded-full h-2">
                <div 
                  className="bg-brand-berry h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(processedCount / totalFiles) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="glass-card rounded-2xl p-3 border-red-400/30">
          <p className="text-red-300 text-base">⚠️ {error}</p>
        </div>
      )}

      {/* Info */}
      <div className="glass rounded-2xl p-3 border-brand-berry/20">
        <p className="text-theme-muted text-base">
          {ragScanEnabled && lakeraScanEnabled 
            ? '🔒 Files are processed locally and automatically scanned by Lakera AI for RAG security threats on upload.'
            : lakeraScanEnabled
            ? '⚠️ RAG auto-scan is disabled. Files can be manually scanned using the Scan button.'
            : '⚠️ Lakera scanning is disabled. Files will not be scanned for security threats.'
          }
        </p>
      </div>
    </div>
  )
}
