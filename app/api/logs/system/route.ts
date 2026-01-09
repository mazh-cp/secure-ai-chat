import { NextRequest, NextResponse } from 'next/server'
import { addSystemLog, readSystemLogs, writeSystemLogs } from '@/lib/system-logging'

/**
 * POST - Add a system log entry (client-side can use this to log system events)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { level, service, message, details, metadata } = body

    if (!level || !service || !message) {
      return NextResponse.json(
        { error: 'level, service, and message are required' },
        { status: 400 }
      )
    }

    // Use the direct logging function
    await addSystemLog(level, service, message, details, metadata)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to add system log:', error)
    return NextResponse.json(
      { error: 'Failed to add system log' },
      { status: 500 }
    )
  }
}

/**
 * GET - Retrieve system logs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level')
    const service = searchParams.get('service')
    const limit = parseInt(searchParams.get('limit') || '100')

    let logs = await readSystemLogs()

    // Filter by level
    if (level) {
      logs = logs.filter(log => log.level === level)
    }

    // Filter by service
    if (service) {
      logs = logs.filter(log => log.service === service)
    }

    // Limit results
    logs = logs.slice(0, limit)

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Failed to retrieve system logs:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve system logs' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Clear system logs
 */
export async function DELETE() {
  try {
    await writeSystemLogs([])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to clear system logs:', error)
    return NextResponse.json(
      { error: 'Failed to clear system logs' },
      { status: 500 }
    )
  }
}
