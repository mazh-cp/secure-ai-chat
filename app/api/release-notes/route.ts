import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface ReleaseNote {
  version: string
  date: string
  type: 'major' | 'minor' | 'patch' | 'hotfix'
  changes: {
    added?: string[]
    fixed?: string[]
    improved?: string[]
    security?: string[]
  }
}

// Parse CHANGELOG.md and convert to structured format
function parseChangelog(): ReleaseNote[] {
  try {
    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md')
    const content = fs.readFileSync(changelogPath, 'utf-8')
    
    const releases: ReleaseNote[] = []
    const sections = content.split(/^## \[/m)
    
    for (const section of sections.slice(1)) {
      const versionMatch = section.match(/^(\d+\.\d+\.\d+)\]/)
      if (!versionMatch) continue
      
      const version = versionMatch[1]
      const dateMatch = section.match(/- (\d{4}-\d{2}-\d{2})/)
      const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0]
      
      // Determine type based on version
      const [major, minor, patch] = version.split('.').map(Number)
      let type: 'major' | 'minor' | 'patch' | 'hotfix' = 'patch'
      if (patch === 0 && minor === 0) {
        type = 'major'
      } else if (patch === 0) {
        type = 'minor'
      } else {
        type = 'patch'
      }
      
      const release: ReleaseNote = {
        version,
        date,
        type,
        changes: {},
      }
      
      // Parse Added section
      const addedMatch = section.match(/### Added\n([\s\S]*?)(?=### |$)/)
      if (addedMatch) {
        release.changes.added = addedMatch[1]
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^-\s*/, '').trim())
          .filter(Boolean)
      }
      
      // Parse Fixed section
      const fixedMatch = section.match(/### Fixed\n([\s\S]*?)(?=### |$)/)
      if (fixedMatch) {
        release.changes.fixed = fixedMatch[1]
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^-\s*/, '').trim())
          .filter(Boolean)
      }
      
      // Parse Improved section
      const improvedMatch = section.match(/### Improved\n([\s\S]*?)(?=### |$)/)
      if (improvedMatch) {
        release.changes.improved = improvedMatch[1]
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^-\s*/, '').trim())
          .filter(Boolean)
      }
      
      // Parse Security section
      const securityMatch = section.match(/### Security\n([\s\S]*?)(?=### |$)/)
      if (securityMatch) {
        release.changes.security = securityMatch[1]
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^-\s*/, '').trim())
          .filter(Boolean)
      }
      
      releases.push(release)
    }
    
    // Sort by version (newest first)
    return releases.sort((a, b) => {
      const aParts = a.version.split('.').map(Number)
      const bParts = b.version.split('.').map(Number)
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0
        const bVal = bParts[i] || 0
        if (bVal !== aVal) return bVal - aVal
      }
      return 0
    })
  } catch (error) {
    console.error('Failed to parse CHANGELOG.md:', error)
    return []
  }
}

export async function GET() {
  try {
    const releaseNotes = parseChangelog()
    return NextResponse.json({ releaseNotes })
  } catch (error) {
    console.error('Failed to load release notes:', error)
    return NextResponse.json(
      { error: 'Failed to load release notes' },
      { status: 500 }
    )
  }
}
