import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { APP_VERSION } from '@/lib/app-release'

function readPackageVersion(): { version: string; name: string } | null {
  const candidates = [
    join(process.cwd(), 'package.json'),
    // next start with output: 'standalone' often runs with cwd = .next/standalone
    join(process.cwd(), '..', 'package.json'),
  ]
  for (const packagePath of candidates) {
    try {
      if (!existsSync(packagePath)) continue
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8')) as {
        version?: string
        name?: string
      }
      if (packageJson.version) {
        return { version: packageJson.version, name: packageJson.name || 'secure-ai-chat' }
      }
    } catch {
      continue
    }
  }
  return null
}

export async function GET() {
  const fromFile = readPackageVersion()
  if (fromFile) {
    return NextResponse.json(fromFile)
  }
  console.warn('[api/version] package.json not found; using APP_VERSION from lib/app-release')
  return NextResponse.json({
    version: APP_VERSION,
    name: 'secure-ai-chat',
  })
}
