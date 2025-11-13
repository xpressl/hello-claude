import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/resend
 * Webhook handler for Resend email events
 * Tracks email opens, clicks, bounces, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verify webhook signature (optional but recommended)
    // For MVP, we'll skip this and rely on endpoint privacy
    // In production, verify: https://resend.com/docs/api-reference/webhooks/verify-request-signature

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Extract event type and data
    const eventType = body.type
    const eventData = body.data

    console.log(`[WEBHOOK] Resend event: ${eventType}`)

    // Handle different event types
    switch (eventType) {
      case 'email.sent':
        await handleEmailSent(supabase, eventData)
        break
      case 'email.delivered':
        await handleEmailDelivered(supabase, eventData)
        break
      case 'email.opened':
        await handleEmailOpened(supabase, eventData)
        break
      case 'email.clicked':
        await handleEmailClicked(supabase, eventData)
        break
      case 'email.bounced':
        await handleEmailBounced(supabase, eventData)
        break
      case 'email.complained':
        await handleEmailComplained(supabase, eventData)
        break
      default:
        console.log(`[WEBHOOK] Unhandled event type: ${eventType}`)
    }

    return NextResponse.json({
      received: true,
      event: eventType,
    })
  } catch (error) {
    console.error('[WEBHOOK] Error processing Resend webhook:', error)
    // Return 200 to acknowledge receipt, even on error
    // This prevents Resend from retrying
    return NextResponse.json({
      received: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

async function handleEmailSent(
  supabase: ReturnType<typeof createClient>,
  data: any
): Promise<void> {
  try {
    const quoteId = data.tags?.find((t: any) => t.name === 'quote_id')?.value
    if (!quoteId) return

    await supabase.from('events').insert({
      quote_id: quoteId,
      event_type: 'email_sent',
      payload_json: {
        emailId: data.id,
        to: data.to,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error handling email.sent:', error)
  }
}

async function handleEmailDelivered(
  supabase: ReturnType<typeof createClient>,
  data: any
): Promise<void> {
  try {
    const quoteId = data.tags?.find((t: any) => t.name === 'quote_id')?.value
    if (!quoteId) return

    await supabase.from('events').insert({
      quote_id: quoteId,
      event_type: 'email_delivered',
      payload_json: {
        emailId: data.id,
        to: data.to,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error handling email.delivered:', error)
  }
}

async function handleEmailOpened(
  supabase: ReturnType<typeof createClient>,
  data: any
): Promise<void> {
  try {
    const quoteId = data.tags?.find((t: any) => t.name === 'quote_id')?.value
    if (!quoteId) return

    await supabase.from('events').insert({
      quote_id: quoteId,
      event_type: 'email_opened',
      payload_json: {
        emailId: data.id,
        userAgent: data.user_agent,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error handling email.opened:', error)
  }
}

async function handleEmailClicked(
  supabase: ReturnType<typeof createClient>,
  data: any
): Promise<void> {
  try {
    const quoteId = data.tags?.find((t: any) => t.name === 'quote_id')?.value
    if (!quoteId) return

    await supabase.from('events').insert({
      quote_id: quoteId,
      event_type: 'email_clicked',
      payload_json: {
        emailId: data.id,
        link: data.link,
        userAgent: data.user_agent,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error handling email.clicked:', error)
  }
}

async function handleEmailBounced(
  supabase: ReturnType<typeof createClient>,
  data: any
): Promise<void> {
  try {
    const quoteId = data.tags?.find((t: any) => t.name === 'quote_id')?.value
    if (!quoteId) return

    // Log bounce event
    await supabase.from('events').insert({
      quote_id: quoteId,
      event_type: 'email_bounced',
      payload_json: {
        emailId: data.id,
        bounceType: data.bounce_type || 'unknown',
        reason: data.bounce_description,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })

    // Optionally mark email as failed in queue
    await supabase
      .from('email_queue')
      .update({
        status: 'failed',
        error_message: `Email bounced: ${data.bounce_description}`,
        updated_at: new Date().toISOString(),
      })
      .eq('quote_id', quoteId)
  } catch (error) {
    console.error('Error handling email.bounced:', error)
  }
}

async function handleEmailComplained(
  supabase: ReturnType<typeof createClient>,
  data: any
): Promise<void> {
  try {
    const quoteId = data.tags?.find((t: any) => t.name === 'quote_id')?.value
    if (!quoteId) return

    // Log complaint event
    await supabase.from('events').insert({
      quote_id: quoteId,
      event_type: 'email_complained',
      payload_json: {
        emailId: data.id,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error handling email.complained:', error)
  }
}
