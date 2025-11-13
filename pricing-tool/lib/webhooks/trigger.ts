/**
 * Webhook Trigger Function
 * Triggers registered webhooks for events
 */

import { createClient } from '@supabase/supabase-js'
import { deliverWebhook } from './deliver'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface Webhook {
  id: string
  user_id: string
  url: string
  secret: string
  event_types: string[]
  is_active: boolean
}

/**
 * Trigger webhooks for an event
 * Finds all active webhooks that are subscribed to the event type
 * and queues delivery for each
 */
export async function triggerWebhooks(
  eventType: string,
  payload: any
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Get active webhooks for this event type
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('is_active', true)
      .or(`event_types.cs.{"${eventType}"}`) // Contains event_type in array

    if (error) {
      console.error('Error fetching webhooks:', error)
      return { success: false, count: 0, error: error.message }
    }

    if (!webhooks || webhooks.length === 0) {
      return { success: true, count: 0 }
    }

    let successCount = 0

    // Queue delivery for each webhook
    for (const webhook of webhooks) {
      try {
        // Queue delivery record first
        await supabase.from('webhook_deliveries').insert({
          webhook_id: webhook.id,
          event_type: eventType,
          payload_json: payload
        })

        // Trigger async delivery
        // In production, this should be queued to a job processor
        deliverWebhook(webhook as Webhook, eventType, payload).catch((err) => {
          console.error(`Failed to deliver webhook ${webhook.id}:`, err)
        })

        successCount++
      } catch (err) {
        console.error(`Error queueing webhook delivery ${webhook.id}:`, err)
      }
    }

    return { success: true, count: successCount }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, count: 0, error: message }
  }
}

/**
 * Trigger webhooks for a specific user
 * Only triggers webhooks owned by that user
 */
export async function triggerUserWebhooks(
  userId: string,
  eventType: string,
  payload: any
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Get active webhooks for this user and event type
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`event_types.cs.{"${eventType}"}`) // Contains event_type in array

    if (error) {
      console.error('Error fetching user webhooks:', error)
      return { success: false, count: 0, error: error.message }
    }

    if (!webhooks || webhooks.length === 0) {
      return { success: true, count: 0 }
    }

    let successCount = 0

    // Queue delivery for each webhook
    for (const webhook of webhooks) {
      try {
        // Queue delivery record first
        await supabase.from('webhook_deliveries').insert({
          webhook_id: webhook.id,
          event_type: eventType,
          payload_json: payload
        })

        // Trigger async delivery
        deliverWebhook(webhook as Webhook, eventType, payload).catch((err) => {
          console.error(`Failed to deliver webhook ${webhook.id}:`, err)
        })

        successCount++
      } catch (err) {
        console.error(`Error queueing webhook delivery ${webhook.id}:`, err)
      }
    }

    return { success: true, count: successCount }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, count: 0, error: message }
  }
}

/**
 * Check if a user has webhooks subscribed to an event type
 */
export async function hasWebhooks(
  userId: string,
  eventType: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('webhooks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`event_types.cs.{"${eventType}"}`)

  return !error && (data?.length || 0) > 0
}
