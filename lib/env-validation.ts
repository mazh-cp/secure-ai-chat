/**
 * Runtime Environment Variable Validation
 * Validates required and optional environment variables with clear error messages
 * Non-fatal validation - logs warnings but doesn't crash the application
 */

interface EnvValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate environment variables at runtime
 * Returns validation result without crashing the application
 */
export function validateEnv(): EnvValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required for production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.PORT || isNaN(parseInt(process.env.PORT, 10))) {
      warnings.push('PORT not set, defaulting to 3000')
    }
  }

  // Storage directory validation
  const storageDir = process.env.STORAGE_DIR || './.storage'
  if (storageDir.includes('..') || storageDir.startsWith('/')) {
    warnings.push(`STORAGE_DIR should be relative to project root: ${storageDir}`)
  }

  // Check for NEXT_PUBLIC_ variables that might leak secrets
  const nextPublicVars = Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_'))
  const unsafeNextPublic = nextPublicVars.filter(key => 
    key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN') || key.includes('PASSWORD')
  )
  if (unsafeNextPublic.length > 0) {
    errors.push(`SECURITY: NEXT_PUBLIC_ variables found that might leak secrets: ${unsafeNextPublic.join(', ')}`)
  }

  // Safe NEXT_PUBLIC_ variables
  const safeNextPublic = ['NEXT_PUBLIC_APP_NAME', 'NEXT_PUBLIC_APP_VERSION']
  nextPublicVars.forEach(key => {
    if (!safeNextPublic.includes(key)) {
      warnings.push(`NEXT_PUBLIC_ variable '${key}' is exposed to client. Ensure it doesn't contain secrets.`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Log environment validation results (non-fatal)
 * Call this at application startup to validate environment
 */
export function logEnvValidation(): void {
  // Only run on server-side (not in Edge Runtime or browser)
  if (typeof window !== 'undefined' || typeof process === 'undefined') {
    return
  }

  const result = validateEnv()
  
  if (result.errors.length > 0) {
    console.error('⚠️  Environment Validation Errors:')
    result.errors.forEach(error => console.error(`  ❌ ${error}`))
  }
  
  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment Validation Warnings:')
    result.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`))
  }
  
  if (result.valid && result.warnings.length === 0) {
    console.log('✅ Environment validation passed')
  }
}
