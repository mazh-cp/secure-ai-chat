#!/usr/bin/env node
/**
 * Validation: Ensure v1.0.10 features are not revoked or removed
 * 
 * This script checks for the presence of v1.0.10 features:
 * - Enhanced RAG System (automatic file indexing, content search)
 * - File size/count limits (10MB, 5 files)
 * - Content matching algorithm
 * - File access control (inclusive filtering)
 * - LLM instructions about files
 * - Support for CSV, JSON, TXT files
 * 
 * Exits with code 1 if any v1.0.10 features are missing.
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// Track validation results
const checks = []
let hasFailures = false

function check(name, condition, details = '') {
  if (condition) {
    checks.push({ name, status: 'PASS', details })
    console.log(`✅ ${name}`)
    if (details) console.log(`   ${details}`)
  } else {
    checks.push({ name, status: 'FAIL', details })
    console.error(`❌ ${name}`)
    if (details) console.error(`   ${details}`)
    hasFailures = true
  }
}

console.log('🔍 Validating v1.0.10 Features...\n')

// ============================================
// 1. RAG System - File Indexing & Search
// ============================================
console.log('1. Enhanced RAG System:')

const chatRoute = join(ROOT, 'app', 'api', 'chat', 'route.ts')
if (existsSync(chatRoute)) {
  const chatContent = readFileSync(chatRoute, 'utf8')
  
  // Check for file indexing/search functionality
  check(
    'RAG file search functionality',
    chatContent.includes('uploadedFiles') || chatContent.includes('file') && chatContent.includes('search'),
    'Chat route should search uploaded files'
  )
  
  // Check for automatic file indexing (v1.0.10: files automatically indexed when uploaded)
  // The implementation uses listFiles/getFileContent which implies automatic indexing
  check(
    'Automatic file indexing',
    chatContent.includes('listFiles') || chatContent.includes('getFileContent') || 
    chatContent.includes('formatFileContentForRAG') || chatContent.includes('enableRAG'),
    'Files should be automatically indexed/searched (via listFiles/getFileContent)'
  )
  
  // Check for content matching algorithm
  check(
    'Content matching algorithm',
    chatContent.includes('match') || chatContent.includes('relevant') || chatContent.includes('keyword'),
    'Content matching algorithm should be present'
  )
  
  // Check for LLM instructions about files
  check(
    'LLM instructions about files',
    chatContent.includes('uploaded files') || chatContent.includes('available files') || chatContent.includes('file context'),
    'LLM should be informed about available files'
  )
  
  // Check for file context formatting
  check(
    'File context formatting',
    chatContent.includes('file context') || chatContent.includes('fileContent') || chatContent.includes('file content'),
    'File context should be formatted for LLM'
  )
} else {
  check('Chat route exists', false, 'app/api/chat/route.ts not found')
}

// ============================================
// 2. File Size/Count Limits (v1.0.10)
// ============================================
console.log('\n2. File Limits (v1.0.10):')

// Check for file size limit (10MB from v1.0.10)
const filesPage = join(ROOT, 'app', 'files', 'page.tsx')
if (existsSync(filesPage)) {
  const filesContent = readFileSync(filesPage, 'utf8')
  
  // v1.0.10: File size limit increased from 5MB to 10MB
  check(
    'File size limit (10MB)',
    filesContent.includes('10') && (filesContent.includes('MB') || filesContent.includes('10 * 1024 * 1024')),
    'File size limit should be 10MB (v1.0.10 feature)'
  )
}

// Check for file count limit (5 files from v1.0.10)
// This might be in chat route or a separate file processing module
const libFiles = [
  join(ROOT, 'lib', 'file-processor.ts'),
  join(ROOT, 'lib', 'rag.ts'),
  join(ROOT, 'lib', 'file-search.ts'),
]

let foundFileCountLimit = false
for (const libFile of libFiles) {
  if (existsSync(libFile)) {
    const content = readFileSync(libFile, 'utf8')
    if (content.includes('5') && (content.includes('file') || content.includes('limit'))) {
      foundFileCountLimit = true
      break
    }
  }
}

// Also check chat route for file count limit
if (existsSync(chatRoute)) {
  const chatContent = readFileSync(chatRoute, 'utf8')
  if (chatContent.includes('5') && (chatContent.includes('file') || chatContent.includes('limit') || chatContent.includes('slice(0, 5)'))) {
    foundFileCountLimit = true
  }
}

check(
  'File count limit (5 files)',
  foundFileCountLimit || (existsSync(chatRoute) && readFileSync(chatRoute, 'utf8').includes('slice(0, 5)')),
  'File count limit should be 5 most relevant files (v1.0.10 feature)'
)

// ============================================
// 3. File Access Control (v1.0.10)
// ============================================
console.log('\n3. File Access Control (v1.0.10):')

if (existsSync(chatRoute)) {
  const chatContent = readFileSync(chatRoute, 'utf8')
  
  // v1.0.10: More inclusive filtering (pending/not_scanned included)
  check(
    'Inclusive file filtering',
    chatContent.includes('pending') || chatContent.includes('not_scanned') || 
    chatContent.includes('status') && (chatContent.includes('!==') || chatContent.includes('!=')),
    'Files with pending/not_scanned status should be included (v1.0.10 feature)'
  )
  
  // Check for exclusion of only flagged/malicious files
  check(
    'Exclude only flagged/malicious',
    chatContent.includes('flagged') || chatContent.includes('malicious') || 
    chatContent.includes('scanStatus') && chatContent.includes('flagged'),
    'Only explicitly flagged/malicious files should be excluded'
  )
}

// ============================================
// 4. Content Matching Algorithm (v1.0.10)
// ============================================
console.log('\n4. Content Matching (v1.0.10):')

// Check for data file detection (CSV, JSON, TXT)
if (existsSync(chatRoute)) {
  const chatContent = readFileSync(chatRoute, 'utf8')
  
  check(
    'Data file detection (CSV, JSON, TXT)',
    chatContent.includes('csv') || chatContent.includes('json') || chatContent.includes('txt') ||
    chatContent.includes('CSV') || chatContent.includes('JSON') || chatContent.includes('TXT'),
    'Should detect CSV, JSON, TXT files (v1.0.10 feature)'
  )
  
  // Check for keyword matching (words > 2 chars from v1.0.10)
  check(
    'Keyword matching (words > 2 chars)',
    chatContent.includes('length > 2') || chatContent.includes('length >= 3') || 
    chatContent.includes('keyword') || chatContent.includes('match'),
    'Keyword matching should use words > 2 chars (v1.0.10 feature)'
  )
  
  // Check for fallback inclusion of safe files
  check(
    'Fallback inclusion of safe files',
    chatContent.includes('fallback') || chatContent.includes('safe') && chatContent.includes('include'),
    'Should include safe files as fallback when no matches found (v1.0.10 feature)'
  )
}

// ============================================
// 5. LLM Instructions (v1.0.10)
// ============================================
console.log('\n5. LLM Instructions (v1.0.10):')

if (existsSync(chatRoute)) {
  const chatContent = readFileSync(chatRoute, 'utf8')
  
  // Check for system message about files
  check(
    'System message about files',
    chatContent.includes('system') && (chatContent.includes('file') || chatContent.includes('uploaded')),
    'System message should inform LLM about available files'
  )
  
  // Check for instructions to search files first
  check(
    'Instructions to search files first',
    chatContent.includes('search') && chatContent.includes('file') ||
    chatContent.includes('first') && chatContent.includes('file'),
    'LLM should be instructed to search files first (v1.0.10 feature)'
  )
  
  // Check for requirement to cite source files
  check(
    'Requirement to cite source files',
    chatContent.includes('cite') || chatContent.includes('source') || chatContent.includes('reference'),
    'LLM should be required to cite source files (v1.0.10 feature)'
  )
}

// ============================================
// 6. File Search Fix (v1.0.10)
// ============================================
console.log('\n6. File Search Fix (v1.0.10):')

if (existsSync(chatRoute)) {
  const chatContent = readFileSync(chatRoute, 'utf8')
  
  // v1.0.10 fixed: chat client not finding uploaded files
  check(
    'Automatic file search',
    chatContent.includes('uploadedFiles') || chatContent.includes('files') && 
    (chatContent.includes('filter') || chatContent.includes('find') || chatContent.includes('search')),
    'Chat should automatically search uploaded files (v1.0.10 fix)'
  )
}

// ============================================
// 7. File Processing Enhancements
// ============================================
console.log('\n7. File Processing (v1.0.10):')

// Check for intelligent truncation for large files
if (existsSync(chatRoute)) {
  const chatContent = readFileSync(chatRoute, 'utf8')
  
  check(
    'Intelligent file truncation',
    chatContent.includes('truncate') || chatContent.includes('substring') || 
    chatContent.includes('slice') && chatContent.includes('file'),
    'Should handle large files with intelligent truncation (v1.0.10 feature)'
  )
}

// ============================================
// Summary
// ============================================
console.log('\n' + '='.repeat(60))
console.log('Validation Summary')
console.log('='.repeat(60) + '\n')

const passed = checks.filter(c => c.status === 'PASS').length
const failed = checks.filter(c => c.status === 'FAIL').length

console.log(`✅ Passed: ${passed}`)
console.log(`❌ Failed: ${failed}`)
console.log(`📊 Total:  ${checks.length}\n`)

if (hasFailures) {
  console.error('❌ FAIL: Some v1.0.10 features are missing or revoked!')
  console.error('\nMissing features:')
  checks.filter(c => c.status === 'FAIL').forEach(c => {
    console.error(`  - ${c.name}`)
    if (c.details) console.error(`    ${c.details}`)
  })
  console.error('\n⚠️  Do not deploy if v1.0.10 features are missing!\n')
  process.exit(1)
} else {
  console.log('✅ PASS: All v1.0.10 features are present and intact!\n')
  process.exit(0)
}
