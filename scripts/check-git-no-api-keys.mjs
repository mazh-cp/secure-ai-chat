#!/usr/bin/env node
/**
 * Ensures no OpenAI / Anthropic / Lakera-style API secrets or key material
 * are committed in the GitHub-tracked tree. Complements check-no-client-secrets.mjs
 * (client bundle) by scanning what would be pushed to the repo.
 *
 * Exits 1 if any tracked file matches high-confidence secret patterns or paths.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

/** Tracked paths that must never appear (encrypted blobs belong only on disk). */
const FORBIDDEN_PATH_SUBSTRINGS = ['.secure-storage/', 'api-keys.enc', 'checkpoint-te-key.enc']

/** Lines matching these are ignored (documentation examples). */
const ALLOW_LINE_SUBSTRINGS = [
  'YOUR_',
  'your_',
  'xxx',
  '…',
  '...',
  '<redacted>',
  'redacted',
  'placeholder',
  'example key',
  'fake',
  'test key',
]

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.env',
  '.example',
  '.sh',
  '.bash',
  '.css',
  '.html',
  '.svg',
])

const SKIP_FILES = new Set(['package-lock.json'])

/** High-confidence token shapes (not env var names). */
const SECRET_PATTERNS = [
  { name: 'OpenAI-style API key (sk-…)', re: /\bsk-[a-zA-Z0-9]{20,}\b/g },
  { name: 'Anthropic API key (sk-ant-api…)', re: /\bsk-ant-api[a-zA-Z0-9_-]{10,}\b/g },
]

function isSkippablePath(rel) {
  if (SKIP_FILES.has(rel.split('/').pop() || '')) return true
  if (rel.startsWith('node_modules/')) return true
  if (rel.includes('/node_modules/')) return true
  if (rel.startsWith('.next/')) return true
  const ext = rel.includes('.') ? '.' + rel.split('.').pop() : ''
  if (rel.endsWith('.md')) return true
  if (rel.endsWith('.map')) return true
  if (
    !TEXT_EXTENSIONS.has(ext) &&
    !rel.endsWith('eslint.config.mjs') &&
    !rel.endsWith('next.config.js')
  ) {
    return true
  }
  return false
}

function lineAllowed(line) {
  const t = line.trim()
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return true
  if (t.startsWith('#')) return true
  const lower = line.toLowerCase()
  return ALLOW_LINE_SUBSTRINGS.some(s => lower.includes(s))
}

function scanLine(line, fileRel) {
  const hits = []
  if (lineAllowed(line)) return hits
  for (const { name, re } of SECRET_PATTERNS) {
    re.lastIndex = 0
    if (re.test(line)) hits.push(name)
  }
  return hits
}

function main() {
  let files = []
  try {
    const out = execSync('git ls-files', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    files = out
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
  } catch {
    console.warn('⚠️  check-git-no-api-keys: not a git repository (or git failed); skipping.')
    process.exit(0)
  }

  const violations = []

  for (const rel of files) {
    for (const bad of FORBIDDEN_PATH_SUBSTRINGS) {
      if (rel.includes(bad)) {
        violations.push({
          file: rel,
          reason: `Tracked path must not contain secret storage artifact: "${bad}"`,
        })
      }
    }
  }

  for (const rel of files) {
    if (isSkippablePath(rel)) continue
    const abs = join(REPO_ROOT, rel)
    let content
    try {
      content = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    if (content.includes('\0')) continue
    const lines = content.split('\n')
    lines.forEach((line, i) => {
      const hits = scanLine(line, rel)
      for (const h of hits) {
        violations.push({ file: rel, line: i + 1, reason: `Possible ${h} in tracked file` })
      }
    })
  }

  if (violations.length > 0) {
    console.error(
      '❌ GIT LEAK CHECK FAILED: do not commit API keys or .secure-storage artifacts.\n'
    )
    for (const v of violations.slice(0, 40)) {
      console.error(`   ${v.file}${v.line ? `:${v.line}` : ''} — ${v.reason}`)
    }
    if (violations.length > 40) console.error(`   … and ${violations.length - 40} more`)
    console.error(
      '\n   Fix: remove secrets, rotate keys if they were ever pushed, and ensure .gitignore covers .env* and .secure-storage/'
    )
    process.exit(1)
  }

  console.log('✅ PASS: No high-confidence API key material in git-tracked files.')
  console.log('   (.secure-storage/, real sk-… tokens must stay local — never commit.)')
}

main()
