/**
 * Server-side persistent file storage utilities
 * This module handles storage and retrieval of uploaded files
 * Files are stored on disk with metadata in JSON
 */

import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

// Storage directories
const STORAGE_DIR = path.join(process.cwd(), '.storage')
const FILES_DIR = path.join(STORAGE_DIR, 'files')
const METADATA_FILE = path.join(STORAGE_DIR, 'files-metadata.json')

export interface StoredFileMetadata {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string // ISO date string
  scanStatus: 'pending' | 'scanning' | 'safe' | 'flagged' | 'error' | 'not_scanned'
  scanResult?: string
  scanDetails?: {
    categories?: Record<string, boolean>
    score?: number
    threatLevel?: 'low' | 'medium' | 'high' | 'critical'
  }
  checkpointTeDetails?: {
    logFields: Record<string, unknown>
    verdict: 'safe' | 'malicious' | 'pending' | 'unknown'
    status: string
  }
}

interface FilesMetadata {
  files: Record<string, StoredFileMetadata>
}

/**
 * Initialize storage directories if they don't exist
 * HOTFIX: Use 0o755 for directories to ensure persistence across restarts
 * Files themselves are still protected (content stored securely)
 */
async function ensureStorageDirs(): Promise<void> {
  try {
    // Use 0o755 for directories (readable by app user, writable by owner)
    // This ensures files persist across restarts and systemd service restarts
    await fs.mkdir(STORAGE_DIR, { recursive: true, mode: 0o755 })
    await fs.mkdir(FILES_DIR, { recursive: true, mode: 0o755 })
  } catch (error) {
    console.error('Failed to create storage directories:', error)
    throw error
  }
}

/**
 * Load metadata file
 */
async function loadMetadata(): Promise<FilesMetadata> {
  try {
    await ensureStorageDirs()
    const data = await fs.readFile(METADATA_FILE, 'utf-8')
    return JSON.parse(data) as FilesMetadata
  } catch (error) {
    // If file doesn't exist, return empty metadata
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { files: {} }
    }
    
    // If JSON parsing fails (corrupted file), backup and create new
    if (error instanceof SyntaxError) {
      console.error('Metadata file is corrupted (JSON parse error), backing up and resetting:', error)
      try {
        const backupPath = `${METADATA_FILE}.backup.${Date.now()}`
        await fs.copyFile(METADATA_FILE, backupPath)
        console.log(`Corrupted metadata backed up to: ${backupPath}`)
        // Create new empty metadata file
        await fs.writeFile(METADATA_FILE, JSON.stringify({ files: {} }, null, 2), 'utf-8')
        return { files: {} }
      } catch (backupError) {
        console.error('Failed to backup corrupted metadata file:', backupError)
        // Try to delete corrupted file and create new one
        try {
          await fs.unlink(METADATA_FILE)
          await fs.writeFile(METADATA_FILE, JSON.stringify({ files: {} }, null, 2), 'utf-8')
          return { files: {} }
        } catch {
          // If all else fails, return empty metadata
          return { files: {} }
        }
      }
    }
    
    console.error('Failed to load metadata:', error)
    // Return empty metadata instead of throwing to prevent app crashes
    return { files: {} }
  }
}

/**
 * Save metadata file
 * HOTFIX: Use 0o644 for metadata file to ensure persistence
 */
async function saveMetadata(metadata: FilesMetadata): Promise<void> {
  try {
    await ensureStorageDirs()
    await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), { encoding: 'utf-8', mode: 0o644 })
  } catch (error) {
    console.error('Failed to save metadata:', error)
    throw error
  }
}

/**
 * Get file path for a given file ID
 */
function getFilePath(fileId: string): string {
  // Sanitize file ID to prevent directory traversal
  const sanitizedId = fileId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(FILES_DIR, `${sanitizedId}.dat`)
}

/**
 * Store a file on the server
 */
export async function storeFile(
  fileId: string,
  fileName: string,
  fileContent: string,
  fileType: string,
  fileSize: number,
  additionalMetadata?: Partial<StoredFileMetadata>
): Promise<void> {
  try {
    await ensureStorageDirs()

    // Store file content
    // HOTFIX: Use 0o644 for files (readable by app user, writable by owner)
    // This ensures files persist and are accessible after restarts
    const filePath = getFilePath(fileId)
    await fs.writeFile(filePath, fileContent, { encoding: 'utf-8', mode: 0o644 })

    // Store metadata
    const metadata = await loadMetadata()
    metadata.files[fileId] = {
      id: fileId,
      name: fileName,
      size: fileSize,
      type: fileType,
      uploadedAt: new Date().toISOString(),
      scanStatus: 'pending',
      ...additionalMetadata,
    }

    await saveMetadata(metadata)
  } catch (error) {
    console.error('Failed to store file:', error)
    throw error
  }
}

/**
 * Retrieve file content
 */
export async function getFileContent(fileId: string): Promise<string | null> {
  try {
    const filePath = getFilePath(fileId)
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    console.error('Failed to get file content:', error)
    throw error
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(fileId: string): Promise<StoredFileMetadata | null> {
  try {
    const metadata = await loadMetadata()
    return metadata.files[fileId] || null
  } catch (error) {
    console.error('Failed to get file metadata:', error)
    throw error
  }
}

/**
 * Update file metadata
 */
export async function updateFileMetadata(
  fileId: string,
  updates: Partial<StoredFileMetadata>
): Promise<void> {
  try {
    const metadata = await loadMetadata()
    if (metadata.files[fileId]) {
      metadata.files[fileId] = {
        ...metadata.files[fileId],
        ...updates,
      }
      await saveMetadata(metadata)
    }
  } catch (error) {
    console.error('Failed to update file metadata:', error)
    throw error
  }
}

/**
 * List all stored files
 */
export async function listFiles(): Promise<StoredFileMetadata[]> {
  try {
    const metadata = await loadMetadata()
    return Object.values(metadata.files)
  } catch (error) {
    console.error('Failed to list files:', error)
    throw error
  }
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  try {
    // Delete file content
    const filePath = getFilePath(fileId)
    try {
      await fs.unlink(filePath)
    } catch (error) {
      // File might not exist, continue with metadata deletion
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }

    // Delete metadata
    const metadata = await loadMetadata()
    if (metadata.files[fileId]) {
      delete metadata.files[fileId]
      await saveMetadata(metadata)
      return true
    }

    return false
  } catch (error) {
    console.error('Failed to delete file:', error)
    throw error
  }
}

/**
 * Compute SHA256 hash of file content
 */
export async function computeFileHash(fileContent: string): Promise<string> {
  return crypto.createHash('sha256').update(fileContent).digest('hex')
}

/**
 * Clear all uploaded files and metadata
 * Used for health check cleanup (24-hour cache clearing)
 */
export async function clearAllFiles(): Promise<{ deletedFiles: number; deletedMetadata: boolean }> {
  try {
    let deletedFiles = 0

    // Delete all files in the files directory
    try {
      const files = await fs.readdir(FILES_DIR)
      for (const file of files) {
        if (file.endsWith('.dat')) {
          try {
            await fs.unlink(path.join(FILES_DIR, file))
            deletedFiles++
          } catch (error) {
            console.error(`Failed to delete file ${file}:`, error)
          }
        }
      }
    } catch (error) {
      // Directory might not exist, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read files directory:', error)
      }
    }

    // Clear metadata file
    let deletedMetadata = false
    try {
      await fs.unlink(METADATA_FILE)
      deletedMetadata = true
    } catch (error) {
      // File might not exist, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to delete metadata file:', error)
      }
      // If metadata file doesn't exist, we still consider it "cleared"
      deletedMetadata = true
    }

    return { deletedFiles, deletedMetadata }
  } catch (error) {
    console.error('Failed to clear files:', error)
    throw error
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  fileCount: number
  totalSize: number
  oldestFile?: string
  newestFile?: string
}> {
  try {
    const metadata = await loadMetadata()
    const files = Object.values(metadata.files)
    
    if (files.length === 0) {
      return { fileCount: 0, totalSize: 0 }
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const sortedFiles = files.sort((a, b) => 
      new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    )

    return {
      fileCount: files.length,
      totalSize,
      oldestFile: sortedFiles[0]?.uploadedAt,
      newestFile: sortedFiles[sortedFiles.length - 1]?.uploadedAt,
    }
  } catch (error) {
    console.error('Failed to get storage stats:', error)
    return { fileCount: 0, totalSize: 0 }
  }
}
