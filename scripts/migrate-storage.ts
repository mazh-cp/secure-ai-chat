#!/usr/bin/env node
/**
 * Storage Migration Runner
 * Idempotent migrations for storage schema changes
 * 
 * Usage: npm run migrate
 * 
 * This script:
 * 1. Checks current schema version
 * 2. Runs any pending migrations
 * 3. Updates schema version
 * 4. Safe to run multiple times (idempotent)
 */

import { migrateStorage } from '../lib/persistent-storage'

async function main() {
  try {
    console.log('Running storage migrations...')
    await migrateStorage()
    console.log('✅ Storage migrations completed')
    process.exit(0)
  } catch (error) {
    console.error('❌ Storage migration failed:', error)
    process.exit(1)
  }
}

main()
