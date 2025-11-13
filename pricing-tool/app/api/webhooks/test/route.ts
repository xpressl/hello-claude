/**
 * API Route: Test Webhook
 * POST /api/webhooks/test - Send test event to webhook
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { deliverWebhook } from '@/lib/webhooks/deliver'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { webhookId } = body

    if (!webhookId) {
      return NextResponse.json(
        { error: 'webhookId is required' },
        { status: 400 }
      )
    }

    // Get webhook
    const { data: webhook, error: fetchError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    // Send test event
    const testPayload = {
      message: 'This is a test webhook event',
      timestamp: new Date().toISOString()
    }

    // Trigger delivery asynchronously
    deliverWebhook(webhook, 'webhook_test', testPayload).catch((err) => {
      console.error('Error delivering test webhook:', err)
    })

    return NextResponse.json({
      success: true,
      message: 'Test event sent to webhook'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error testing webhook:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
