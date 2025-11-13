/**
 * Webhook Delivery Function with Retry Logic
 * Handles sending webhooks with exponential backoff retry
 */

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

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
  failure_count: number
}

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: any, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(JSON.stringify(payload))
  return hmac.digest('hex')
}

/**
 * Deliver a webhook with automatic retry on failure
 */
export async function deliverWebhook(
  webhook: Webhook,
  eventType: string,
  payload: any,
  retryCount = 0
): Promise<void> {
  const maxRetries = 3
  const signature = generateSignature(payload, webhook.secret)
  const webhookPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: payload
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Event-Type': eventType,
        'X-Webhook-ID': webhook.id,
        'User-Agent': 'QuotingApp/1.0'
      },
      body: JSON.stringify(webhookPayload),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const responseBody = await response.text()

    // Log delivery attempt
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhook.id,
      event_type: eventType,
      payload_json: payload,
      response_status: response.status,
      response_body: responseBody,
      retry_count: retryCount,
      delivered_at: response.ok ? new Date().toISOString() : null
    })

    if (response.ok) {
      // Success - reset failure count
      await supabase
        .from('webhooks')
        .update({
          last_triggered_at: new Date().toISOString(),
          failure_count: 0
        })
        .eq('id', webhook.id)

      return
    }

    // Non-2xx response
    throw new Error(`HTTP ${response.status}: ${responseBody}`)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    console.error(
      `Webhook delivery failed for ${webhook.id} (attempt ${retryCount + 1}): ${errorMessage}`
    )

    // Retry logic with exponential backoff
    if (retryCount < maxRetries) {
      const delayMs = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
      console.log(
        `Retrying webhook ${webhook.id} in ${delayMs}ms (attempt ${retryCount + 1}/${maxRetries})`
      )

      // Schedule retry
      setTimeout(() => {
        deliverWebhook(webhook, eventType, payload, retryCount + 1).catch(
          (err) => {
            console.error(`Final retry failed for webhook ${webhook.id}:`, err)
          }
        )
      }, delayMs)
    } else {
      // Max retries reached - update failure count and potentially disable
      const newFailureCount = webhook.failure_count + 1
      const shouldDisable = newFailureCount >= 10

      await supabase
        .from('webhooks')
        .update({
          failure_count: newFailureCount,
          is_active: !shouldDisable
        })
        .eq('id', webhook.id)

      if (shouldDisable) {
        console.warn(
          `Webhook ${webhook.id} disabled after ${newFailureCount} failures`
        )
      }

      // Log final delivery attempt
      await supabase.from('webhook_deliveries').insert({
        webhook_id: webhook.id,
        event_type: eventType,
        payload_json: payload,
        response_status: null,
        response_body: `Failed after ${maxRetries} retries: ${errorMessage}`,
        retry_count: retryCount
      })
    }
  }
}

/**
 * Manually retry a failed webhook delivery
 */
export async function retryWebhookDelivery(
  webhookId: string,
  eventType: string,
  payload: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .single()

    if (error || !webhook) {
      return { success: false, error: 'Webhook not found' }
    }

    // Trigger delivery
    deliverWebhook(webhook as Webhook, eventType, payload).catch((err) => {
      console.error(`Failed to deliver webhook ${webhookId}:`, err)
    })

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Verify webhook signature
 * Use this in your webhook receiver endpoint to verify authenticity
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
