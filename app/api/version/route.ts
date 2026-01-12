import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    // Read package.json to get version
    const packagePath = join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
    
    return NextResponse.json({
      version: packageJson.version || '1.0.5',
      name: packageJson.name || 'secure-ai-chat',
    })
  } catch (error) {
    // Fallback to default version if package.json can't be read
    console.error('Failed to read version from package.json:', error)
    return NextResponse.json({
      version: '1.0.5',
      name: 'secure-ai-chat',
    })
  }
}
