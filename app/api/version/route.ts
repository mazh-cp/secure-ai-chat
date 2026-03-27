import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { APP_VERSION } from '@/lib/app-release'

/** Package name only — version always comes from APP_VERSION (compiled at build) so disk/cwd drift cannot show 1.0.18 on a 1.0.20 build. */
function readPackageName(): string | null {
  const candidates = [
    join(process.cwd(), 'package.json'),
    join(process.cwd(), '..', 'package.json'),
  ]
  for (const packagePath of candidates) {
    try {
      if (!existsSync(packagePath)) continue
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8')) as { name?: string }
      if (packageJson.name) return packageJson.name
    } catch {
      continue
    }
  }
  return null
}

export async function GET() {
  return NextResponse.json({
    version: APP_VERSION,
    name: readPackageName() ?? 'secure-ai-chat',
  })
}
