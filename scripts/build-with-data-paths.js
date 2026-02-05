#!/usr/bin/env node
/**
 * Run Next.js build with REGISTRY_DB_PATH and UPLOADS_DIR set to absolute paths.
 * Prevents "[secure-ai-chat] Production: REGISTRY_DB_PATH is not set" during build.
 * Same path resolution as start-with-data-paths.js for consistency.
 */
const path = require('path')
const { spawnSync } = require('child_process')
const fs = require('fs')

const root = process.cwd()
const dataDir = path.join(root, 'data')
const registryPath = path.join(dataDir, 'app.db')
const uploadsDir = path.join(dataDir, 'uploads')
const registryPathFile = path.join(dataDir, '.registry-db-path')
const uploadsPathFile = path.join(dataDir, '.uploads-dir')

if (!process.env.REGISTRY_DB_PATH) process.env.REGISTRY_DB_PATH = registryPath
if (!process.env.UPLOADS_DIR) process.env.UPLOADS_DIR = uploadsDir
try {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o755 })
  fs.writeFileSync(registryPathFile, registryPath, 'utf-8')
  fs.writeFileSync(uploadsPathFile, uploadsDir, 'utf-8')
} catch (e) {
  // ignore
}

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const childEnv = {
  ...process.env,
  REGISTRY_DB_PATH: registryPath,
  UPLOADS_DIR: uploadsDir,
  REGISTRY_PATH_FILE: registryPathFile,
  UPLOADS_PATH_FILE: uploadsPathFile,
}

const result = spawnSync(process.execPath, [nextBin, 'build', '--webpack'], {
  env: childEnv,
  stdio: 'inherit',
  cwd: root,
})
process.exit(result.status != null ? result.status : result.signal ? 1 : 0)
