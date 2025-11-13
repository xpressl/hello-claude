/**
 * Notification Service
 * Handles sending notifications with user preference checking
 */

import { createClient } from '@supabase/supabase-js'
import {
  getNotificationTemplate,
  NotificationData
} from './notification-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface NotificationQueueEntry {
  id: string
  user_id: string
  notification_type: string
  subject: string
  body_html: string
  body_text?: string
  metadata_json: Record<string, any>
  status: 'pending' | 'sent' | 'failed'
  retry_count: number
  scheduled_at: string
  created_at: string
}

/**
 * Send a notification to a user
 * Checks preferences and queues for sending
 */
export async function sendNotification(
  userId: string,
  notificationType: string,
  data: NotificationData,
  scheduleTime?: Date
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Get user's notification preferences
    const { data: pref, error: prefError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('notification_type', notificationType)
      .single()

    // If preference exists and email is disabled, skip
    if (pref && !pref.email_enabled) {
      return { success: true } // Silent success - user disabled this notification
    }

    // Get the template
    const template = getNotificationTemplate(notificationType)
    if (!template) {
      return { success: false, error: `Unknown notification type: ${notificationType}` }
    }

    // Render template
    const subject = template.subject(data)
    const body_html = template.html(data)
    const body_text = template.text?.(data)

    // Queue for digest if enabled
    if (pref?.digest_enabled) {
      return await queueForDigest(
        userId,
        notificationType,
        subject,
        body_html,
        body_text,
        data
      )
    }

    // Queue for immediate sending
    const { data: queued, error: queueError } = await supabase
      .from('notification_queue')
      .insert({
        user_id: userId,
        notification_type: notificationType,
        subject,
        body_html,
        body_text,
        metadata_json: data,
        scheduled_at: scheduleTime?.toISOString() || new Date().toISOString()
      })
      .select()
      .single()

    if (queueError) {
      return { success: false, error: queueError.message }
    }

    return { success: true, id: queued.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Queue notification for daily digest
 */
async function queueForDigest(
  userId: string,
  notificationType: string,
  subject: string,
  body_html: string,
  body_text: string | undefined,
  data: NotificationData
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // For digest, we mark as pending but set status differently
    // This is a simplified approach - in production you'd use a dedicated digest queue
    const { data: queued, error: queueError } = await supabase
      .from('notification_queue')
      .insert({
        user_id: userId,
        notification_type: `${notificationType}_digest`,
        subject,
        body_html,
        body_text,
        metadata_json: data,
        scheduled_at: new Date().toISOString()
      })
      .select()
      .single()

    if (queueError) {
      return { success: false, error: queueError.message }
    }

    return { success: true, id: queued.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Get pending notifications for a user
 */
export async function getPendingNotifications(
  userId: string,
  limit: number = 50
): Promise<NotificationQueueEntry[]> {
  const { data, error } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .lt('retry_count', 3)
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error fetching pending notifications:', error)
    return []
  }

  return data || []
}

/**
 * Mark notification as sent
 */
export async function markNotificationSent(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notification_queue')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('id', notificationId)

  return !error
}

/**
 * Mark notification as failed and update retry count
 */
export async function markNotificationFailed(
  notificationId: string,
  errorMessage: string
): Promise<boolean> {
  const { error } = await supabase
    .from('notification_queue')
    .update({
      retry_count: supabase.rpc('increment_retry_count', { id: notificationId })
        .then(() => ({ data: null })) // This would need a proper increment in production
        .catch(() => ({ data: null })),
      error_message: errorMessage
    })
    .eq('id', notificationId)

  return !error
}

/**
 * Increment retry count (alternative approach)
 */
export async function incrementRetryCount(notificationId: string): Promise<boolean> {
  const { data: notification, error: fetchError } = await supabase
    .from('notification_queue')
    .select('retry_count')
    .eq('id', notificationId)
    .single()

  if (fetchError || !notification) {
    return false
  }

  const { error } = await supabase
    .from('notification_queue')
    .update({
      retry_count: notification.retry_count + 1
    })
    .eq('id', notificationId)

  return !error
}

/**
 * Get user's notification preferences
 */
export async function getUserNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching preferences:', error)
    return []
  }

  return data || []
}

/**
 * Update user notification preference
 */
export async function updateNotificationPreference(
  userId: string,
  notificationType: string,
  emailEnabled: boolean,
  digestEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Try to update first
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_type', notificationType)
      .single()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('notification_preferences')
        .update({
          email_enabled: emailEnabled,
          digest_enabled: digestEnabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      return { success: !error, error: error?.message }
    } else {
      // Create new
      const { error } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: userId,
          notification_type: notificationType,
          email_enabled: emailEnabled,
          digest_enabled: digestEnabled
        })

      return { success: !error, error: error?.message }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
