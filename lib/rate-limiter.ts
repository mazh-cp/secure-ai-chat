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
    'gpt-5': 50,
    'gpt-5.1': 50,
    'gpt-5.2': 50,
    'gpt-5.3': 50,
    'gpt-5.4': 50,
    'gpt-5.5': 50,
    default: 100, // Default fallback
  },
  // Azure OpenAI rate limits (requests per minute) - typically higher
  azure: {
    default: 300, // Azure typically allows higher rates
  },
}

// Cleanup interval (remove old entries every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000

/**
 * Generate a rate limit key from API key and model
 */
function getRateLimitKey(apiKey: string, model: string, provider: 'openai' | 'azure' = 'openai'): string {
  // Use first 8 chars of API key for identification (don't store full key)
  const keyPrefix = apiKey.substring(0, 8)
  return `${provider}:${keyPrefix}:${model}`
}

/**
 * Get rate limit for a model
 */
function getRateLimit(model: string, provider: 'openai' | 'azure' = 'openai'): number {
  const limits = DEFAULT_RATE_LIMITS[provider]
  
  // Check for exact model match
  if (limits[model as keyof typeof limits]) {
    return limits[model as keyof typeof limits] as number
  }
  
  // Check for model prefix match (e.g., gpt-4-turbo-preview matches gpt-4-turbo)
  for (const [key, value] of Object.entries(limits)) {
    if (key !== 'default' && model.toLowerCase().startsWith(key.toLowerCase())) {
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
  model: string,
  provider: 'openai' | 'azure' = 'openai'
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  const key = getRateLimitKey(apiKey, model, provider)
  const limit = getRateLimit(model, provider)
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
export function resetRateLimit(apiKey: string, model: string, provider: 'openai' | 'azure' = 'openai'): void {
  const key = getRateLimitKey(apiKey, model, provider)
  rateLimitStore.delete(key)
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(
  apiKey: string,
  model: string,
  provider: 'openai' | 'azure' = 'openai'
): { limit: number; remaining: number; resetAt: number } {
  const key = getRateLimitKey(apiKey, model, provider)
  const limit = getRateLimit(model, provider)
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
