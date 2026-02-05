#!/usr/bin/env node
/**
 * Start the Next.js server with REGISTRY_DB_PATH and UPLOADS_DIR set to absolute
 * paths so file list and chat RAG use the same data (required for multi-process).
 * Run from project root: node scripts/start-with-data-paths.js (or npm run start:with-data).
 */
const path = require('path')
const { spawn } = require('child_process')

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
  console.warn('Could not write path files:', e.message)
}

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const hostname = process.env.HOSTNAME || '127.0.0.1'
const childEnv = {
  ...process.env,
  REGISTRY_DB_PATH: registryPath,
  UPLOADS_DIR: uploadsDir,
  REGISTRY_PATH_FILE: registryPathFile,
  UPLOADS_PATH_FILE: uploadsPathFile,
}
const child = spawn(process.execPath, [nextBin, 'start', '--hostname', hostname], {
  env: childEnv,
  stdio: 'inherit',
  cwd: root,
})
child.on('exit', (code, signal) => {
  process.exit(code != null ? code : signal ? 1 : 0)
})
