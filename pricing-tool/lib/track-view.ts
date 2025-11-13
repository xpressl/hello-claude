import { createClient } from '@supabase/supabase-js'

/**
 * Quote View Tracking
 * Logs customer view events and updates view count
 */

export async function trackQuoteView(
  quoteId: string,
  userAgent: string | null,
  ipAddress: string | null
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // Log view event
    await supabase.from('events').insert({
      quote_id: quoteId,
      event_type: 'quote_viewed',
      user_agent: userAgent,
      ip_address: ipAddress,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error tracking quote view:', error)
    // Don't throw - view tracking failures shouldn't block the page
  }
}

export async function trackQuoteAction(
  quoteId: string,
  action: 'accepted' | 'declined',
  userAgent: string | null
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const eventType = action === 'accepted' ? 'quote_accepted' : 'quote_declined'

    // Log action event
    await supabase.from('events').insert({
      quote_id: quoteId,
      event_type: eventType,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    })

    // Update quote status
    await supabase
      .from('quotes')
      .update({
        status: action === 'accepted' ? 'accepted' : 'declined',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
  } catch (error) {
    console.error('Error tracking quote action:', error)
    throw error
  }
}
