/**
 * Token Counter and Limit Validator
 * 
 * Estimates token count and validates against model-specific token limits.
 * Uses a simple approximation: ~4 characters per token (rough estimate for English text).
 * For production, consider using tiktoken or similar libraries for accurate counting.
 * 
 * Supports both static (hardcoded) and dynamic (from OpenAI API) token limits.
 */

import { getModelLimit } from './model-limits-fetcher'

/**
 * Model-specific token limits (context window sizes)
 * These are the maximum tokens that can be processed in a single request.
 */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  // GPT-4 models
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  
  // GPT-3.5 models (for reference, not currently supported)
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  
  // GPT-5 models (estimated, adjust based on actual API specs)
  'gpt-5': 128000,
  'gpt-5.1': 128000,
  'gpt-5.2': 128000,
  'gpt-5.3': 128000,
  'gpt-5.4': 128000,
  'gpt-5.5': 128000,
}

/**
 * Default token limit for unknown models
 */
const DEFAULT_TOKEN_LIMIT = 8192

/**
 * Get token limit for a model (synchronous version - uses hardcoded limits)
 * For dynamic limits, use getTokenLimitAsync instead
 */
export function getTokenLimit(model: string): number {
  // Normalize model name (remove version suffixes like -preview, -0613, etc.)
  const normalizedModel = model.toLowerCase().split('-').slice(0, 2).join('-')
  
  // Check exact match first
  if (MODEL_TOKEN_LIMITS[model.toLowerCase()]) {
    return MODEL_TOKEN_LIMITS[model.toLowerCase()]
  }
  
  // Check normalized model
  if (MODEL_TOKEN_LIMITS[normalizedModel]) {
    return MODEL_TOKEN_LIMITS[normalizedModel]
  }
  
  // Check prefix match (e.g., gpt-4-turbo-preview matches gpt-4-turbo)
  for (const [key, value] of Object.entries(MODEL_TOKEN_LIMITS)) {
    if (model.toLowerCase().startsWith(key.toLowerCase())) {
      return value
    }
  }
  
  // Return default for unknown models
  console.warn(`Unknown model token limit for ${model}, using default ${DEFAULT_TOKEN_LIMIT}`)
  return DEFAULT_TOKEN_LIMIT
}

/**
 * Get token limit for a model (async version - uses dynamic limits from OpenAI API)
 * Falls back to hardcoded limits if API is unavailable
 */
export async function getTokenLimitAsync(
  model: string,
  apiKey?: string
): Promise<number> {
  // Normalize model name
  const normalizedModel = model.toLowerCase().split('-').slice(0, 2).join('-')
  
  // Get hardcoded limit as fallback
  let hardcodedLimit = DEFAULT_TOKEN_LIMIT
  if (MODEL_TOKEN_LIMITS[model.toLowerCase()]) {
    hardcodedLimit = MODEL_TOKEN_LIMITS[model.toLowerCase()]
  } else if (MODEL_TOKEN_LIMITS[normalizedModel]) {
    hardcodedLimit = MODEL_TOKEN_LIMITS[normalizedModel]
  } else {
    for (const [key, value] of Object.entries(MODEL_TOKEN_LIMITS)) {
      if (model.toLowerCase().startsWith(key.toLowerCase())) {
        hardcodedLimit = value
        break
      }
    }
  }
  
  // If API key is available, try to fetch dynamic limit
  if (apiKey) {
    try {
      const dynamicLimit = await getModelLimit(model, apiKey, hardcodedLimit)
      // Use dynamic limit if it's different (prefer API over hardcoded)
      if (dynamicLimit !== hardcodedLimit) {
        console.log(`Using dynamic limit for ${model}: ${dynamicLimit} (hardcoded: ${hardcodedLimit})`)
        return dynamicLimit
      }
      return hardcodedLimit
    } catch (error) {
      console.warn(`Failed to fetch dynamic limit for ${model}, using hardcoded:`, error)
      return hardcodedLimit
    }
  }
  
  // No API key, use hardcoded
  return hardcodedLimit
}

/**
 * Estimate token count from text
 * Simple approximation: ~4 characters per token for English text
 * For more accuracy, consider using tiktoken library
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.length === 0) {
    return 0
  }
  
  // Rough approximation: ~4 characters per token
  // This is a simplified approach. For production, use tiktoken or similar.
  const charCount = text.length
  const estimatedTokens = Math.ceil(charCount / 4)
  
  // Add overhead for message formatting (roles, system prompts, etc.)
  // Each message adds ~5-10 tokens for formatting
  return estimatedTokens
}

/**
 * Estimate tokens for a chat message
 */
export function estimateMessageTokens(message: { role: string; content: string }): number {
  // Base tokens for message structure (role, formatting)
  const baseTokens = 10
  
  // Content tokens
  const contentTokens = estimateTokenCount(message.content)
  
  return baseTokens + contentTokens
}

/**
 * Estimate total tokens for a conversation (messages + max_tokens output)
 */
export function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>,
  maxOutputTokens: number = 1000
): number {
  // Sum of all message tokens
  const inputTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
  
  // Add system prompt overhead (if present)
  const systemPromptTokens = 100 // Estimated overhead for system instructions
  
  // Add max output tokens (reserved for response)
  const totalTokens = inputTokens + systemPromptTokens + maxOutputTokens
  
  return totalTokens
}

/**
 * Estimate total tokens for a request (prompt + max output)
 * Formula: estimated_tokens = prompt_tokens + max_tokens
 */
export function estimateRequestTokens(
  messages: Array<{ role: string; content: string }>,
  maxOutputTokens: number = 1000
): {
  promptTokens: number
  maxOutputTokens: number
  estimatedTotalTokens: number
  breakdown: {
    inputTokens: number
    systemPromptTokens: number
    maxOutputTokens: number
  }
} {
  // Calculate input tokens (all messages)
  const inputTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
  
  // System prompt overhead (estimated)
  const systemPromptTokens = 100
  
  // Total prompt tokens (input + system)
  const promptTokens = inputTokens + systemPromptTokens
  
  // Total estimated tokens (prompt + max output)
  const estimatedTotalTokens = promptTokens + maxOutputTokens
  
  return {
    promptTokens,
    maxOutputTokens,
    estimatedTotalTokens,
    breakdown: {
      inputTokens,
      systemPromptTokens,
      maxOutputTokens,
    },
  }
}

/**
 * Check if estimated tokens would exceed model limits (for throttling)
 * Returns throttling decision and details
 */
export async function shouldThrottleByTokens(
  messages: Array<{ role: string; content: string }>,
  model: string,
  maxOutputTokens: number = 1000,
  apiKey?: string
): Promise<{
  shouldThrottle: boolean
  estimatedTokens: number
  limit: number
  excessTokens?: number
  recommendation?: string
}> {
  const limit = await getTokenLimitAsync(model, apiKey)
  const estimation = estimateRequestTokens(messages, maxOutputTokens)
  
  // Reserve 10% buffer for safety
  const effectiveLimit = Math.floor(limit * 0.9)
  
  if (estimation.estimatedTotalTokens > effectiveLimit) {
    const excessTokens = estimation.estimatedTotalTokens - effectiveLimit
    return {
      shouldThrottle: true,
      estimatedTokens: estimation.estimatedTotalTokens,
      limit,
      excessTokens,
      recommendation: `Estimated tokens (${estimation.estimatedTotalTokens}) exceed limit (${limit}). Reduce message length or max_output_tokens.`,
    }
  }
  
  return {
    shouldThrottle: false,
    estimatedTokens: estimation.estimatedTotalTokens,
    limit,
  }
}

/**
 * Validate if a conversation fits within model token limits (synchronous version)
 * @returns { valid: boolean, inputTokens: number, totalTokens: number, limit: number, remaining?: number, error?: string }
 */
export function validateTokenLimit(
  messages: Array<{ role: string; content: string }>,
  model: string,
  maxOutputTokens: number = 1000
): {
  valid: boolean
  inputTokens: number
  totalTokens: number
  limit: number
  remaining?: number
  error?: string
} {
  const limit = getTokenLimit(model)
  const inputTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
  const systemPromptTokens = 100 // Estimated overhead
  const totalTokens = inputTokens + systemPromptTokens + maxOutputTokens
  
  // Reserve 10% buffer for safety
  const effectiveLimit = Math.floor(limit * 0.9)
  
  if (totalTokens > effectiveLimit) {
    const excess = totalTokens - effectiveLimit
    return {
      valid: false,
      inputTokens,
      totalTokens,
      limit,
      error: `Conversation exceeds token limit. Total: ${totalTokens}, Limit: ${limit} (effective: ${effectiveLimit}). Excess: ${excess} tokens. Please reduce message length or use a model with a larger context window.`,
    }
  }
  
  return {
    valid: true,
    inputTokens,
    totalTokens,
    limit,
    remaining: effectiveLimit - totalTokens,
  }
}

/**
 * Validate if a conversation fits within model token limits (async version with dynamic limits)
 * @returns { valid: boolean, inputTokens: number, totalTokens: number, limit: number, remaining?: number, error?: string }
 */
export async function validateTokenLimitAsync(
  messages: Array<{ role: string; content: string }>,
  model: string,
  maxOutputTokens: number = 1000,
  apiKey?: string
): Promise<{
  valid: boolean
  inputTokens: number
  totalTokens: number
  limit: number
  remaining?: number
  error?: string
}> {
  const limit = await getTokenLimitAsync(model, apiKey)
  const inputTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)
  const systemPromptTokens = 100 // Estimated overhead
  const totalTokens = inputTokens + systemPromptTokens + maxOutputTokens
  
  // Reserve 10% buffer for safety
  const effectiveLimit = Math.floor(limit * 0.9)
  
  if (totalTokens > effectiveLimit) {
    const excess = totalTokens - effectiveLimit
    return {
      valid: false,
      inputTokens,
      totalTokens,
      limit,
      error: `Conversation exceeds token limit. Total: ${totalTokens}, Limit: ${limit} (effective: ${effectiveLimit}). Excess: ${excess} tokens. Please reduce message length or use a model with a larger context window.`,
    }
  }
  
  return {
    valid: true,
    inputTokens,
    totalTokens,
    limit,
    remaining: effectiveLimit - totalTokens,
  }
}

/**
 * Truncate messages to fit within token limit if necessary (synchronous version)
 * Returns truncated messages array and a flag indicating if truncation occurred
 */
export function truncateToTokenLimit(
  messages: Array<{ role: string; content: string }>,
  model: string,
  maxOutputTokens: number = 1000
): {
  messages: Array<{ role: string; content: string }>
  truncated: boolean
  originalTokenCount: number
  finalTokenCount: number
} {
  const validation = validateTokenLimit(messages, model, maxOutputTokens)
  
  if (validation.valid) {
    return {
      messages,
      truncated: false,
      originalTokenCount: validation.totalTokens,
      finalTokenCount: validation.totalTokens,
    }
  }
  
  // Need to truncate - keep system messages and recent user/assistant messages
  const limit = getTokenLimit(model)
  const effectiveLimit = Math.floor(limit * 0.9)
  const reservedTokens = 100 + maxOutputTokens // System prompt + output
  const availableForMessages = effectiveLimit - reservedTokens
  
  const truncatedMessages: Array<{ role: string; content: string }> = []
  let currentTokens = 0
  
  // Keep system messages first
  for (const msg of messages) {
    if (msg.role === 'system') {
      const tokens = estimateMessageTokens(msg)
      if (currentTokens + tokens <= availableForMessages) {
        truncatedMessages.push(msg)
        currentTokens += tokens
      }
    }
  }
  
  // Add recent messages from the end (most recent first)
  const nonSystemMessages = messages.filter(msg => msg.role !== 'system').reverse()
  for (const msg of nonSystemMessages) {
    const tokens = estimateMessageTokens(msg)
    if (currentTokens + tokens <= availableForMessages) {
      truncatedMessages.unshift(msg) // Add to beginning to maintain order
      currentTokens += tokens
    } else {
      break // Can't fit more messages
    }
  }
  
  // Restore original order (system messages first, then chronological)
  const sortedMessages = [
    ...truncatedMessages.filter(msg => msg.role === 'system'),
    ...truncatedMessages.filter(msg => msg.role !== 'system'),
  ]
  
  return {
    messages: sortedMessages,
    truncated: true,
    originalTokenCount: validation.totalTokens,
    finalTokenCount: estimateConversationTokens(sortedMessages, maxOutputTokens),
  }
}

/**
 * Truncate messages to fit within token limit if necessary (async version with dynamic limits)
 * Returns truncated messages array and a flag indicating if truncation occurred
 */
export async function truncateToTokenLimitAsync(
  messages: Array<{ role: string; content: string }>,
  model: string,
  maxOutputTokens: number = 1000,
  apiKey?: string
): Promise<{
  messages: Array<{ role: string; content: string }>
  truncated: boolean
  originalTokenCount: number
  finalTokenCount: number
}> {
  const validation = await validateTokenLimitAsync(messages, model, maxOutputTokens, apiKey)
  
  if (validation.valid) {
    return {
      messages,
      truncated: false,
      originalTokenCount: validation.totalTokens,
      finalTokenCount: validation.totalTokens,
    }
  }
  
  // Need to truncate - keep system messages and recent user/assistant messages
  const limit = await getTokenLimitAsync(model, apiKey)
  const effectiveLimit = Math.floor(limit * 0.9)
  const reservedTokens = 100 + maxOutputTokens // System prompt + output
  const availableForMessages = effectiveLimit - reservedTokens
  
  const truncatedMessages: Array<{ role: string; content: string }> = []
  let currentTokens = 0
  
  // Keep system messages first
  for (const msg of messages) {
    if (msg.role === 'system') {
      const tokens = estimateMessageTokens(msg)
      if (currentTokens + tokens <= availableForMessages) {
        truncatedMessages.push(msg)
        currentTokens += tokens
      }
    }
  }
  
  // Add recent messages from the end (most recent first)
  const nonSystemMessages = messages.filter(msg => msg.role !== 'system').reverse()
  for (const msg of nonSystemMessages) {
    const tokens = estimateMessageTokens(msg)
    if (currentTokens + tokens <= availableForMessages) {
      truncatedMessages.unshift(msg) // Add to beginning to maintain order
      currentTokens += tokens
    } else {
      break // Can't fit more messages
    }
  }
  
  // Restore original order (system messages first, then chronological)
  const sortedMessages = [
    ...truncatedMessages.filter(msg => msg.role === 'system'),
    ...truncatedMessages.filter(msg => msg.role !== 'system'),
  ]
  
  return {
    messages: sortedMessages,
    truncated: true,
    originalTokenCount: validation.totalTokens,
    finalTokenCount: estimateConversationTokens(sortedMessages, maxOutputTokens),
  }
}
