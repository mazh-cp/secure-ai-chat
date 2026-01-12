/**
 * Test script to verify GPT-5 API response structure
 * Run with: npx tsx scripts/test-gpt5-api.ts
 * 
 * This script tests:
 * 1. GPT-5 API endpoint and response format
 * 2. Parameter support (max_tokens, temperature)
 * 3. Conversation history handling
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// Load API key from environment or secure storage
async function getApiKey(): Promise<string | null> {
  // Try environment variable first
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY
  }

  // Try to load from secure storage
  try {
    const { getApiKeys } = await import('../lib/api-keys-storage')
    const keys = await getApiKeys()
    return keys.openAiKey || null
  } catch (error) {
    console.error('Failed to load API key:', error)
    return null
  }
}

// Test GPT-5 API with basic request
async function testGPT5Basic() {
  console.log('\n=== Test 1: GPT-5 Basic Request ===')
  const apiKey = await getApiKey()
  if (!apiKey) {
    console.error('❌ No API key found. Set OPENAI_API_KEY environment variable.')
    return null
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        input: 'Say "Hello, GPT-5!" in one sentence.',
      }),
    })

    console.log('Status:', response.status)
    console.log('Headers:', Object.fromEntries(response.headers.entries()))

    const data = await response.json()
    console.log('Response structure:', JSON.stringify(data, null, 2))
    
    return data
  } catch (error) {
    console.error('❌ Error:', error)
    return null
  }
}

// Test GPT-5 API with parameters
async function testGPT5WithParameters() {
  console.log('\n=== Test 2: GPT-5 with Parameters ===')
  const apiKey = await getApiKey()
  if (!apiKey) {
    return null
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        input: 'Write a short 2-sentence summary about AI.',
        max_tokens: 100,
        temperature: 0.7,
      }),
    })

    const data = await response.json()
    console.log('Response with parameters:', JSON.stringify(data, null, 2))
    
    return data
  } catch (error) {
    console.error('❌ Error:', error)
    return null
  }
}

// Test GPT-5 with conversation history
async function testGPT5ConversationHistory() {
  console.log('\n=== Test 3: GPT-5 Conversation History ===')
  const apiKey = await getApiKey()
  if (!apiKey) {
    return null
  }

  // Simulate conversation history as text
  const conversationText = `[System Instructions: You are a helpful assistant.]

User: What is 2+2?
Assistant: 2+2 equals 4.

User: What about 3+3?`

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        input: conversationText,
      }),
    })

    const data = await response.json()
    console.log('Response with conversation history:', JSON.stringify(data, null, 2))
    
    return data
  } catch (error) {
    console.error('❌ Error:', error)
    return null
  }
}

// Main test function
async function main() {
  console.log('🔍 Testing GPT-5 API Structure...\n')

  const results = {
    basic: await testGPT5Basic(),
    withParams: await testGPT5WithParameters(),
    withHistory: await testGPT5ConversationHistory(),
  }

  console.log('\n=== Test Summary ===')
  console.log('Basic request:', results.basic ? '✅ Success' : '❌ Failed')
  console.log('With parameters:', results.withParams ? '✅ Success' : '❌ Failed')
  console.log('With history:', results.withHistory ? '✅ Success' : '❌ Failed')

  // Analyze response structure
  if (results.basic) {
    console.log('\n=== Response Structure Analysis ===')
    console.log('Top-level keys:', Object.keys(results.basic))
    
    // Check common response patterns
    if (results.basic.response) {
      console.log('✅ Response found in: data.response')
    } else if (results.basic.content) {
      console.log('✅ Response found in: data.content')
    } else if (results.basic.text) {
      console.log('✅ Response found in: data.text')
    } else if (results.basic.choices) {
      console.log('✅ Response found in: data.choices (similar to chat/completions)')
    } else {
      console.log('⚠️  Unknown response structure')
    }
  }
}

// Run tests
main().catch(console.error)
