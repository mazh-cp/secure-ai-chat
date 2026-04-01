'use strict'

/**
 * Next.js may emit standalone as .next/standalone/server.js or nested
 * .next/standalone/<app>/server.js. Skip traced junk like .nvm/.
 */

const fs = require('fs')
const path = require('path')

const MAX_DEPTH = 6

/**
 * @param {string} projectRoot
 * @returns {{ serverJs: string, appDir: string } | null}
 */
function resolveStandaloneServer(projectRoot) {
  const standaloneRoot = path.join(projectRoot, '.next', 'standalone')
  if (!fs.existsSync(standaloneRoot)) return null

  const direct = path.join(standaloneRoot, 'server.js')
  if (fs.existsSync(direct)) {
    return { serverJs: direct, appDir: standaloneRoot }
  }

  function search(dir, depth) {
    if (depth < 0) return null
    const here = path.join(dir, 'server.js')
    if (fs.existsSync(here)) {
      return { serverJs: here, appDir: dir }
    }
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return null
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const name = e.name
      if (name === 'node_modules') continue
      if (name === '.nvm') continue
      const found = search(path.join(dir, name), depth - 1)
      if (found) return found
    }
    return null
  }

  return search(standaloneRoot, MAX_DEPTH)
}

module.exports = { resolveStandaloneServer }
