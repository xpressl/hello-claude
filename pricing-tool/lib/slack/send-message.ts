/**
 * Slack Send Message Function
 * Sends formatted messages to configured Slack webhooks
 */

import { createClient } from '@supabase/supabase-js'
import { SlackMessage } from './format-message'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface SlackConfig {
  id: string
  event_type: string
  webhook_url: string
  channel?: string
  enabled: boolean
}

/**
 * Send a message to Slack webhook
 */
export async function sendSlackMessage(
  eventType: string,
  message: SlackMessage
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Slack integration is globally enabled
    if (process.env.SLACK_ENABLED !== 'true') {
      return { success: true } // Silent success - Slack disabled
    }

    // Get Slack config for this event type
    const { data: config, error: configError } = await supabase
      .from('slack_configs')
      .select('*')
      .eq('event_type', eventType)
      .eq('enabled', true)
      .single()

    if (configError || !config) {
      // No config for this event type - silent success
      return { success: true }
    }

    // Send to webhook
    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Slack API error: ${response.statusText} - ${errorText}`)
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to send Slack message:', message)
    // Don't throw - Slack failures shouldn't break core functionality
    return { success: false, error: message }
  }
}

/**
 * Send test message to Slack webhook
 */
export async function sendSlackTestMessage(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const message = {
      text: 'Test message from Quote System',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Test Message 🧪',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'This is a test message from your Quote System notification integration. If you see this, your Slack integration is working correctly!'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Sent at ${new Date().toLocaleString()}`
            }
          ]
        }
      ]
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Slack API error: ${response.statusText} - ${errorText}`)
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Get all Slack configurations
 */
export async function getSlackConfigs(): Promise<SlackConfig[]> {
  const { data, error } = await supabase
    .from('slack_configs')
    .select('*')
    .order('event_type')

  if (error) {
    console.error('Error fetching Slack configs:', error)
    return []
  }

  return data || []
}

/**
 * Update Slack configuration
 */
export async function updateSlackConfig(
  eventType: string,
  webhookUrl: string,
  channel?: string,
  enabled: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    // Try to update first
    const { data: existing } = await supabase
      .from('slack_configs')
      .select('id')
      .eq('event_type', eventType)
      .single()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('slack_configs')
        .update({
          webhook_url: webhookUrl,
          channel: channel || null,
          enabled,
          updated_at: new Date().toISOString()
        })
        .eq('event_type', eventType)

      return { success: !error, error: error?.message }
    } else {
      // Create new
      const { error } = await supabase
        .from('slack_configs')
        .insert({
          event_type: eventType,
          webhook_url: webhookUrl,
          channel: channel || null,
          enabled
        })

      return { success: !error, error: error?.message }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Toggle Slack configuration enabled status
 */
export async function toggleSlackConfig(
  eventType: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('slack_configs')
      .update({
        enabled,
        updated_at: new Date().toISOString()
      })
      .eq('event_type', eventType)

    return { success: !error, error: error?.message }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
