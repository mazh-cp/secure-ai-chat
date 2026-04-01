#!/usr/bin/env node
/**
 * Confirms `next build` produced standalone + static output expected by `npm start`
 * (scripts/start-standalone.js). Exit 1 if anything required is missing.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(fileURLToPath(import.meta.url), '..', '..')
const nextDir = path.join(root, '.next')
const standaloneServer = path.join(nextDir, 'standalone', 'server.js')
const staticDir = path.join(nextDir, 'static')

function fail(msg) {
  console.error('❌ verify-build:', msg)
  process.exit(1)
}

if (!fs.existsSync(nextDir)) {
  fail('Missing .next — run `next build` first.')
}
if (!fs.existsSync(standaloneServer)) {
  const standaloneRoot = path.join(nextDir, 'standalone')
  if (fs.existsSync(standaloneRoot)) {
    try {
      const entries = fs.readdirSync(standaloneRoot, { withFileTypes: true })
      const names = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join(', ')
      console.error('❌ verify-build: .next/standalone exists but server.js missing. Contents:', names || '(empty)')
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
    `Missing standalone server (${path.relative(root, standaloneServer)}). Use project-local Next with webpack: node scripts/next-build-production.mjs (or next build --webpack). If you see only Turbopack in the build log, pull latest main and run npm ci.`,
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

console.log('✅ Build finalized: standalone server and static assets present.')
if (buildId) console.log(`   BUILD_ID: ${buildId}`)
console.log(`   Start with: npm start  (uses ${path.join('.next', 'standalone', 'server.js')})`)
