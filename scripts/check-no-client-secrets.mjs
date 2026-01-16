#!/usr/bin/env node
/**
 * Security Hard Gate: Check for ThreatCloud API key leakage to client
 * 
 * This script scans client-side code for:
 * - Direct references to ThreatCloud/CheckPoint TE API keys
 * - Imports of server-only modules (checkpoint-te, api-keys-storage)
 * - process.env usage for secrets in client files
 * 
 * Exits with code 1 if violations are found.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..', '..')

// Client-side roots to scan
const CLIENT_ROOTS = [
  'app', // Next.js app directory (excluding api routes)
  'components',
  'src/components', // If exists
  'pages', // If using pages directory (excluding api routes)
]

// Server-only folders (allowed to import secrets)
const SERVER_ONLY_PATHS = [
  'app/api',
  'pages/api',
  'lib/server',
  'server',
  'middleware.ts',
  'middleware.js',
]

// Patterns to detect
const THREATCLOUD_PATTERNS = [
  /CHECKPOINT.*TE.*API.*KEY/gi,
  /CHECKPOINT_TE_API_KEY/gi,
  /TE_API_KEY/gi,
  /ThreatCloud/gi,
  /threatcloud/gi,
]

const SERVER_ONLY_IMPORTS = [
  // Only match imports from @/lib/checkpoint-te (server-only implementation), NOT @/types/checkpoint-te (types only)
  /from\s+['"]@\/lib\/checkpoint-te['"]/gi,
  /from\s+['"]\.\.?\/.*\/lib\/checkpoint-te['"]/gi,
  // Do NOT match @/types/checkpoint-te (types are safe - TypeScript strips them at compile time)
  
  // Only match imports from @/lib/api-keys-storage (server-only implementation), NOT @/types
  /from\s+['"]@\/lib\/api-keys-storage['"]/gi,
  /from\s+['"]\.\.?\/.*\/lib\/api-keys-storage['"]/gi,
]

const ENV_SECRET_PATTERNS = [
  /process\.env\.CHECKPOINT_TE_API_KEY/gi,
  /process\.env\[['"]CHECKPOINT_TE_API_KEY['"]\]/gi,
]

// Track violations
const violations = []

/**
 * Check if a file path is in a server-only directory
 */
function isServerOnlyPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  return SERVER_ONLY_PATHS.some(serverPath => normalized.includes(serverPath))
}

/**
 * Check if a file is a client component
 */
function isClientFile(filePath) {
  // Exclude server-only paths
  if (isServerOnlyPath(filePath)) {
    return false
  }
  
  // Check if in client roots
  const normalized = filePath.replace(/\\/g, '/')
  return CLIENT_ROOTS.some(root => normalized.startsWith(root + '/') || normalized.startsWith(root + '\\'))
}

/**
 * Scan a file for violations
 */
function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8')
    const relativePath = relative(__dirname, filePath)
    
    // Check for ThreatCloud patterns
    for (const pattern of THREATCLOUD_PATTERNS) {
      const matches = content.match(pattern)
      if (matches) {
        // Allow comments/documentation
        const lines = content.split('\n')
        matches.forEach(match => {
          const lineNum = lines.findIndex(line => line.includes(match))
          if (lineNum >= 0) {
            const line = lines[lineNum]
            // Skip if it's a comment or string literal in comments
            if (!line.trim().startsWith('//') && !line.includes('/*') && !line.includes('*')) {
              violations.push({
                file: relativePath,
                line: lineNum + 1,
                type: 'THREATCLOUD_REFERENCE',
                pattern: match,
                context: line.trim().substring(0, 100),
              })
            }
          }
        })
      }
    }
    
    // Check for server-only imports (but skip type-only imports)
    for (const pattern of SERVER_ONLY_IMPORTS) {
      if (pattern.test(content)) {
        const lines = content.split('\n')
        const lineNum = lines.findIndex(line => pattern.test(line))
        if (lineNum >= 0) {
          const line = lines[lineNum]
          
          // Skip type-only imports from @/types (safe - TypeScript strips these at compile time)
          // Examples: "import { CheckPointTEResponse } from '@/types/checkpoint-te'"
          // Examples: "import type { ... } from '@/types/checkpoint-te'"
          if (line.includes('@/types/checkpoint-te') || 
              line.includes('@/types/api-keys') ||
              line.trim().startsWith('import type') ||
              /from\s+['"]@\/types\//.test(line)) {
            // This is a type-only import - safe to ignore (no runtime code, no secrets)
            continue
          }
          
          violations.push({
            file: relativePath,
            line: lineNum + 1,
            type: 'SERVER_ONLY_IMPORT',
            pattern: pattern.toString(),
            context: line.trim().substring(0, 100),
          })
        }
      }
    }
    
    // Check for process.env secret usage
    for (const pattern of ENV_SECRET_PATTERNS) {
      if (pattern.test(content)) {
        const lines = content.split('\n')
        const lineNum = lines.findIndex(line => pattern.test(line))
        if (lineNum >= 0) {
          violations.push({
            file: relativePath,
            line: lineNum + 1,
            type: 'ENV_SECRET_USAGE',
            pattern: pattern.toString(),
            context: lines[lineNum].trim().substring(0, 100),
          })
        }
      }
    }
  } catch (error) {
    // Skip files that can't be read (permissions, etc.)
    if (error.code !== 'EACCES' && error.code !== 'ENOENT') {
      console.warn(`Warning: Could not read ${filePath}: ${error.message}`)
    }
  }
}

/**
 * Recursively scan directory
 */
function scanDirectory(dirPath) {
  try {
    const entries = readdirSync(dirPath)
    
    for (const entry of entries) {
      // Skip common ignore patterns
      if (entry.startsWith('.') || 
          entry === 'node_modules' || 
          entry === '.next' || 
          entry === 'dist' || 
          entry === 'build') {
        continue
      }
      
      const fullPath = join(dirPath, entry)
      const stat = statSync(fullPath)
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath)
      } else if (stat.isFile()) {
        // Only scan TypeScript/JavaScript files
        if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) {
          // Only scan if it's a client file
          if (isClientFile(fullPath)) {
            scanFile(fullPath)
          }
        }
      }
    }
  } catch (error) {
    // Skip directories that can't be read
    if (error.code !== 'EACCES' && error.code !== 'ENOENT') {
      console.warn(`Warning: Could not scan ${dirPath}: ${error.message}`)
    }
  }
}

// Main execution
console.log('🔒 Scanning for ThreatCloud API key leakage to client...\n')

// Scan client roots
for (const root of CLIENT_ROOTS) {
  const rootPath = join(__dirname, root)
  try {
    if (statSync(rootPath).isDirectory()) {
      console.log(`Scanning ${root}/...`)
      scanDirectory(rootPath)
    }
  } catch (error) {
    // Directory doesn't exist, skip
    if (error.code === 'ENOENT') {
      continue
    }
  }
}

// Report results
if (violations.length === 0) {
  console.log('\n✅ PASS: No ThreatCloud API key leakage detected')
  console.log('   All client files are clean of server-only secret references.\n')
  process.exit(0)
} else {
  console.error('\n❌ FAIL: ThreatCloud API key leakage detected!\n')
  console.error(`Found ${violations.length} violation(s):\n`)
  
  // Group by type
  const byType = {}
  for (const violation of violations) {
    if (!byType[violation.type]) {
      byType[violation.type] = []
    }
    byType[violation.type].push(violation)
  }
  
  for (const [type, items] of Object.entries(byType)) {
    console.error(`\n${type} (${items.length}):`)
    for (const item of items) {
      console.error(`  ${item.file}:${item.line}`)
      console.error(`    ${item.context}`)
    }
  }
  
  console.error('\n🚨 SECURITY VIOLATION: ThreatCloud API key must NEVER reach the client!')
  console.error('   Fix these issues before deployment.\n')
  process.exit(1)
}
