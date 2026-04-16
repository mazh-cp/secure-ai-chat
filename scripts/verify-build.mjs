#!/usr/bin/env node
/**
 * Confirms `next build` produced standalone + static output expected by `npm start`
 * (scripts/start-standalone.js). Exit 1 if anything required is missing.
 */

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { resolveStandaloneServer } = require('./resolve-standalone-server.cjs')

const root = path.join(fileURLToPath(import.meta.url), '..', '..')
const nextDir = path.join(root, '.next')
const staticDir = path.join(nextDir, 'static')

function fail(msg) {
  console.error('❌ verify-build:', msg)
  process.exit(1)
}

if (!fs.existsSync(nextDir)) {
  fail('Missing .next — run `next build` first.')
}

const resolved = resolveStandaloneServer(root)
if (!resolved) {
  const standaloneRoot = path.join(nextDir, 'standalone')
  if (fs.existsSync(standaloneRoot)) {
    try {
      const entries = fs.readdirSync(standaloneRoot, { withFileTypes: true })
      const names = entries.map(e => (e.isDirectory() ? `${e.name}/` : e.name)).join(', ')
      console.error(
        '❌ verify-build: .next/standalone exists but no server.js found. Top-level:',
        names || '(empty)'
      )
    } catch {
      console.error('❌ verify-build: could not list .next/standalone')
    }
  } else {
    try {
      const nextEntries = fs.readdirSync(nextDir)
      console.error('❌ verify-build: .next contains:', nextEntries.join(', ') || '(empty)')
    } catch {
      // ignore
    }
  }
  fail(
    'Missing standalone server.js under .next/standalone. Use: node scripts/next-build-production.mjs (webpack). Nested layouts (e.g. standalone/<app>/server.js) are supported once server.js exists.'
  )
}

if (!fs.existsSync(staticDir)) {
  fail(`Missing ${path.relative(root, staticDir)} — build may be incomplete.`)
}

const buildIdPath = path.join(nextDir, 'BUILD_ID')
let buildId = ''
try {
  if (fs.existsSync(buildIdPath)) {
    buildId = fs.readFileSync(buildIdPath, 'utf8').trim()
  }
} catch {
  // optional
}

const relServer = path.relative(root, resolved.serverJs)
console.log('✅ Build finalized: standalone server and static assets present.')
if (buildId) console.log(`   BUILD_ID: ${buildId}`)
console.log(`   Standalone: ${relServer}`)
console.log(`   Start with: npm start`)
