/**
 * API Route: Slack Configuration Management
 * GET /api/admin/slack - Get all Slack configurations
 * POST /api/admin/slack - Create/Update Slack configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import {
  getSlackConfigs,
  updateSlackConfig,
  toggleSlackConfig,
  sendSlackTestMessage
} from '@/lib/slack/send-message'

async function checkAdminRole(supabase: any, userId: string): Promise<boolean> {
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  return user?.role === 'ADMIN'
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await checkAdminRole(supabase, user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const configs = await getSlackConfigs()

    return NextResponse.json({ configs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching Slack configs:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await checkAdminRole(supabase, user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, eventType, webhookUrl, channel, enabled } = body

    if (action === 'update') {
      if (!eventType || !webhookUrl) {
        return NextResponse.json(
          { error: 'eventType and webhookUrl are required' },
          { status: 400 }
        )
      }

      const result = await updateSlackConfig(
        eventType,
        webhookUrl,
        channel,
        enabled !== false
      )

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        )
      }

      const configs = await getSlackConfigs()
      return NextResponse.json({ configs })
    } else if (action === 'toggle') {
      if (!eventType) {
        return NextResponse.json(
          { error: 'eventType is required' },
          { status: 400 }
        )
      }

      const result = await toggleSlackConfig(eventType, enabled !== false)

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        )
      }

      const configs = await getSlackConfigs()
      return NextResponse.json({ configs })
    } else if (action === 'test') {
      if (!webhookUrl) {
        return NextResponse.json(
          { error: 'webhookUrl is required' },
          { status: 400 }
        )
      }

      const result = await sendSlackTestMessage(webhookUrl)

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, message: 'Test message sent' })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error managing Slack config:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
