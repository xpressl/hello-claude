/**
 * API Route: Get and Update Notification Preferences
 * GET /api/preferences/notifications - Get user's notification preferences
 * POST /api/preferences/notifications - Update notification preferences
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import {
  getUserNotificationPreferences,
  updateNotificationPreference
} from '@/lib/notifications/notification-service'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await getUserNotificationPreferences(user.id)

    return NextResponse.json({ preferences })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching notification preferences:', error)
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

    const body = await request.json()
    const {
      notificationType,
      emailEnabled = true,
      digestEnabled = false
    } = body

    if (!notificationType) {
      return NextResponse.json(
        { error: 'notificationType is required' },
        { status: 400 }
      )
    }

    const result = await updateNotificationPreference(
      user.id,
      notificationType,
      emailEnabled,
      digestEnabled
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    const preferences = await getUserNotificationPreferences(user.id)
    return NextResponse.json({ preferences })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating notification preferences:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
