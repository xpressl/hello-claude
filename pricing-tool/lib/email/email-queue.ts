import { createClient } from '@supabase/supabase-js'
import { sendQuoteEmail } from './send-email'
import { EmailTemplate } from './templates'

/**
 * Email Queue Management
 * Handles queuing and retrying email sends
 */

export interface QueuedEmail {
  id: string
  quote_id: string
  template: EmailTemplate
  status: 'pending' | 'sent' | 'failed'
  retry_count: number
  error_message?: string | null
  created_at: string
  updated_at: string
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000 // 5 seconds between retries

/**
 * Queue an email for sending
 */
export async function queueEmail(
  quoteId: string,
  template: EmailTemplate
): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const { error } = await supabase.from('email_queue').insert({
      quote_id: quoteId,
      template,
      status: 'pending',
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Error queuing email:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error queuing email:', error)
    return false
  }
}

/**
 * Process pending emails from queue
 * This should be called periodically by a cron job or scheduler
 */
export async function processEmailQueue(limit: number = 10): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // Fetch pending emails
    const { data: emails, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', MAX_RETRIES)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Error fetching email queue:', error)
      return 0
    }

    if (!emails || emails.length === 0) {
      return 0
    }

    let processedCount = 0

    for (const email of emails as QueuedEmail[]) {
      const result = await sendQuoteEmail(email.quote_id, email.template)

      if (result.success) {
        // Mark as sent
        await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id)

        processedCount++
      } else {
        // Increment retry count
        const newRetryCount = email.retry_count + 1
        const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending'

        await supabase
          .from('email_queue')
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            error_message: result.error,
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id)

        if (newStatus === 'failed') {
          console.error(`Email ${email.id} failed after ${newRetryCount} retries:`, result.error)
        }
      }
    }

    return processedCount
  } catch (error) {
    console.error('Error processing email queue:', error)
    return 0
  }
}

/**
 * Retry failed emails
 */
export async function retryFailedEmails(limit: number = 5): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // Fetch failed emails that haven't exceeded max retries
    const { data: emails, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', MAX_RETRIES)
      .order('updated_at', { ascending: true })
      .limit(limit)

    if (error || !emails) {
      return 0
    }

    let retryCount = 0

    for (const email of emails as QueuedEmail[]) {
      // Reset to pending and retry
      const result = await sendQuoteEmail(email.quote_id, email.template)

      if (result.success) {
        await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id)

        retryCount++
      } else {
        const newRetryCount = email.retry_count + 1
        const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending'

        await supabase
          .from('email_queue')
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            error_message: result.error,
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id)
      }
    }

    return retryCount
  } catch (error) {
    console.error('Error retrying failed emails:', error)
    return 0
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number
  sent: number
  failed: number
  total: number
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const { data: pending } = await supabase
      .from('email_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    const { data: sent } = await supabase
      .from('email_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')

    const { data: failed } = await supabase
      .from('email_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')

    const { count: total } = await supabase
      .from('email_queue')
      .select('*', { count: 'exact', head: true })

    return {
      pending: pending?.length || 0,
      sent: sent?.length || 0,
      failed: failed?.length || 0,
      total: total || 0,
    }
  } catch (error) {
    console.error('Error getting queue stats:', error)
    return {
      pending: 0,
      sent: 0,
      failed: 0,
      total: 0,
    }
  }
}
