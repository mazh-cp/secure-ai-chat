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
  fail(
    `Missing standalone server (${path.relative(root, standaloneServer)}). Ensure next.config has output: 'standalone'.`,
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
