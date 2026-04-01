#!/usr/bin/env node
/**
 * Run `next build --webpack` via the project's installed Next.js CLI (not global `next`).
 * Avoids PATH picking up an older global binary that ignores --webpack or uses Turbopack-only output.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')

if (!fs.existsSync(nextCli)) {
  console.error('❌ next-build-production: local Next CLI missing:', nextCli)
  console.error('   Run: npm ci   (or npm install)')
  process.exit(1)
}

const env = { ...process.env }
if (!env.NODE_ENV) env.NODE_ENV = 'production'

const build = spawnSync(process.execPath, [nextCli, 'build', '--webpack'], {
  cwd: root,
  stdio: 'inherit',
  env,
})

if (build.status !== 0 && build.status != null) {
  process.exit(build.status)
}
if (build.error) {
  console.error(build.error)
  process.exit(1)
}

const verify = spawnSync(process.execPath, [path.join(root, 'scripts', 'verify-build.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env,
})

process.exit(verify.status ?? (verify.error ? 1 : 0))
