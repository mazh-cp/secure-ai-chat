/**
 * Rate Limiter Utility
 * 
 * Implements in-memory rate limiting for API calls to prevent hitting rate limits.
 * Uses a sliding window approach for accurate rate limiting.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
  windowStart: number
}

// In-memory store for rate limits (keyed by API key or user identifier)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Default rate limits (requests per minute)
const DEFAULT_RATE_LIMITS = {
  // OpenAI rate limits (requests per minute)
  openai: {
    'gpt-4': 100,
    'gpt-4o': 200,
    'gpt-4o-mini': 200,
    'gpt-4-turbo': 100,
    // GPT-5.x models: Increased to match GPT-4o limits (OpenAI typically allows similar rates)
    'gpt-5': 200,
    'gpt-5.1': 200,
    'gpt-5.2': 200,
    'gpt-5.3': 200,
    'gpt-5.4': 200,
    'gpt-5.5': 200,
    default: 100, // Default fallback
  },
}

// Cleanup interval (remove old entries every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000

/**
 * Generate a rate limit key from API key and model
 */
function getRateLimitKey(apiKey: string, model: string): string {
  // Use first 8 chars of API key for identification (don't store full key)
  const keyPrefix = apiKey.substring(0, 8)
  return `openai:${keyPrefix}:${model}`
}

/**
 * Get rate limit for a model
 */
function getRateLimit(model: string): number {
  const limits = DEFAULT_RATE_LIMITS.openai
  
  // Normalize model name to lowercase for matching
  const normalizedModel = model.toLowerCase().trim()
  
  // Check for exact model match first
  if (limits[normalizedModel as keyof typeof limits]) {
    return limits[normalizedModel as keyof typeof limits] as number
  }
  
  // Special handling for GPT-5.x models (they may have suffixes like -pro-2025-12-11)
  // Check for GPT-5.x models first (including gpt-5, gpt-5.1, gpt-5.2, etc.)
  if (normalizedModel.startsWith('gpt-5')) {
    // Extract base version (e.g., 'gpt-5' or 'gpt-5.1' or 'gpt-5.2' from gpt-5.2-pro-2025-12-11)
    const gpt5Match = normalizedModel.match(/^gpt-5(\.\d+)?/)
    if (gpt5Match) {
      const baseVersion = gpt5Match[0] // e.g., 'gpt-5' or 'gpt-5.1' or 'gpt-5.2'
      
      // Try exact version match first (e.g., gpt-5.1)
      if (limits[baseVersion as keyof typeof limits]) {
        return limits[baseVersion as keyof typeof limits] as number
      }
      
      // If specific version not found, use gpt-5 as fallback
      if (limits['gpt-5' as keyof typeof limits]) {
        return limits['gpt-5' as keyof typeof limits] as number
      }
    }
    
    // Fallback: if it starts with gpt-5 but doesn't match above, use gpt-5 limit
    return limits['gpt-5' as keyof typeof limits] || limits.default || 100
  }
  
  // Check other models with prefix match (e.g., gpt-4-turbo-preview matches gpt-4-turbo)
  for (const [key, value] of Object.entries(limits)) {
    if (key !== 'default' && normalizedModel.startsWith(key.toLowerCase())) {
      return value
    }
  }
  
  // Return default
  return limits.default || 100
}

/**
 * Check if a request should be rate limited
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  apiKey: string,
  model: string
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  const key = getRateLimitKey(apiKey, model)
  const limit = getRateLimit(model)
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute window
  
  let entry = rateLimitStore.get(key)
  
  // Clean up old entries
  if (entry && entry.resetTime < now) {
    entry = undefined
    rateLimitStore.delete(key)
  }
  
  // Create new entry if none exists
  if (!entry) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
      windowStart: now,
    }
    rateLimitStore.set(key, entry)
  }
  
  // Check if we're within the rate limit
  if (entry.count < limit) {
    entry.count++
    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: entry.resetTime,
    }
  }
  
  // Rate limit exceeded
  const retryAfter = Math.ceil((entry.resetTime - now) / 1000) // seconds until reset
  return {
    allowed: false,
    remaining: 0,
    resetAt: entry.resetTime,
    retryAfter,
  }
}

/**
 * Reset rate limit for a key (useful for testing or manual reset)
 */
export function resetRateLimit(apiKey: string, model: string): void {
  const key = getRateLimitKey(apiKey, model)
  rateLimitStore.delete(key)
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(
  apiKey: string,
  model: string
): { limit: number; remaining: number; resetAt: number } {
  const key = getRateLimitKey(apiKey, model)
  const limit = getRateLimit(model)
  const entry = rateLimitStore.get(key)
  const now = Date.now()
  
  if (!entry || entry.resetTime < now) {
    return {
      limit,
      remaining: limit,
      resetAt: now + 60 * 1000,
    }
  }
  
  return {
    limit,
    remaining: limit - entry.count,
    resetAt: entry.resetTime,
  }
}

/**
 * Cleanup old rate limit entries (call periodically)
 */
function cleanupRateLimitStore(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}

// Start cleanup interval (only in server environment)
if (typeof window === 'undefined') {
  setInterval(cleanupRateLimitStore, CLEANUP_INTERVAL)
}
