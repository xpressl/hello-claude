# Task 31: Email Notification System

## Objective
Implement comprehensive email notification system with template engine, user preferences, queue management, and daily digest option.

## Context
- Notify users of important events
- Customizable per-user preferences
- Queue system for reliable delivery
- Daily digest to reduce email volume
- Template-based for consistency

## Requirements

### 1. Notification Preferences Schema

```sql
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
```

### 2. Notification Queue

```sql
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  retry_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_status ON notification_queue(status, scheduled_at);
CREATE INDEX idx_notification_queue_user ON notification_queue(user_id);
```

### 3. Template Engine

**File:** `pricing-tool/lib/notifications/templates.ts`

```typescript
export const notificationTemplates = {
  quote_status_changed: {
    subject: (data: any) => `Quote #${data.quoteId} ${data.newStatus}`,
    html: (data: any) => `
      <h2>Quote Status Updated</h2>
      <p>Quote #${data.quoteId} is now <strong>${data.newStatus}</strong></p>
      <p><a href="${data.quoteUrl}">View Quote</a></p>
    `,
    text: (data: any) => `Quote #${data.quoteId} is now ${data.newStatus}. View: ${data.quoteUrl}`
  },
  approval_required: {
    subject: () => 'Approval Required',
    html: (data: any) => `
      <h2>Price Override Approval Needed</h2>
      <p>A price override of ${data.discountPercent}% requires your approval.</p>
      <p><a href="${data.approvalUrl}">Review Now</a></p>
    `
  },
  daily_digest: {
    subject: (data: any) => `Daily Digest - ${new Date().toLocaleDateString()}`,
    html: (data: any) => `
      <h2>Your Daily Digest</h2>
      <ul>
        ${data.notifications.map((n: any) => `<li>${n.message}</li>`).join('')}
      </ul>
    `
  }
}
```

### 4. Notification Service

**File:** `pricing-tool/lib/notifications/notification-service.ts`

```typescript
export async function sendNotification(
  userId: string,
  notificationType: string,
  data: any
) {
  // Check user preferences
  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('notification_type', notificationType)
    .single()

  if (pref && !pref.email_enabled) {
    return // User disabled this notification type
  }

  // Queue for digest if enabled
  if (pref?.digest_enabled) {
    await queueForDigest(userId, notificationType, data)
    return
  }

  // Send immediately
  const template = notificationTemplates[notificationType]

  await supabase.from('notification_queue').insert({
    user_id: userId,
    notification_type: notificationType,
    subject: template.subject(data),
    body_html: template.html(data),
    body_text: template.text?.(data),
    metadata_json: data
  })
}
```

### 5. Queue Processor

**File:** `pricing-tool/lib/notifications/queue-processor.ts`

```typescript
export async function processNotificationQueue() {
  const { data: pending } = await supabase
    .from('notification_queue')
    .select('*, user:users(email, name)')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .lt('retry_count', 3)
    .limit(50)

  for (const notification of pending || []) {
    try {
      await resend.emails.send({
        from: process.env.FROM_EMAIL!,
        to: notification.user.email,
        subject: notification.subject,
        html: notification.body_html,
        text: notification.body_text
      })

      await supabase
        .from('notification_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notification.id)
    } catch (error) {
      await supabase
        .from('notification_queue')
        .update({
          retry_count: notification.retry_count + 1,
          error_message: error.message
        })
        .eq('id', notification.id)
    }
  }
}

// Run every minute
setInterval(processNotificationQueue, 60000)
```

### 6. Daily Digest

**File:** `pricing-tool/lib/notifications/daily-digest.ts`

```typescript
export async function sendDailyDigests() {
  const { data: users } = await supabase
    .from('notification_preferences')
    .select('user_id')
    .eq('digest_enabled', true)
    .group('user_id')

  for (const { user_id } of users || []) {
    const { data: notifications } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (notifications && notifications.length > 0) {
      await sendDigest(user_id, notifications)

      // Mark as sent
      await supabase
        .from('notification_queue')
        .update({ status: 'sent' })
        .in('id', notifications.map(n => n.id))
    }
  }
}

// Schedule daily at 8am
cron.schedule('0 8 * * *', sendDailyDigests)
```

### 7. Preferences UI

**File:** `pricing-tool/app/settings/notifications/page.tsx`

```typescript
export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState([])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Notification Preferences</h1>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="px-6 py-3 text-left">Notification Type</th>
              <th className="px-6 py-3 text-center">Email</th>
              <th className="px-6 py-3 text-center">Daily Digest</th>
            </tr>
          </thead>
          <tbody>
            {notificationTypes.map(type => (
              <tr key={type.id} className="border-b">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium">{type.label}</p>
                    <p className="text-sm text-gray-500">{type.description}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={isEnabled(type.id, 'email')}
                    onChange={(e) => updatePreference(type.id, 'email', e.target.checked)}
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={isEnabled(type.id, 'digest')}
                    onChange={(e) => updatePreference(type.id, 'digest', e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

## Files to Create
- Update `pricing-tool/supabase-schema.sql`
- `pricing-tool/lib/notifications/templates.ts`
- `pricing-tool/lib/notifications/notification-service.ts`
- `pricing-tool/lib/notifications/queue-processor.ts`
- `pricing-tool/lib/notifications/daily-digest.ts`
- `pricing-tool/app/settings/notifications/page.tsx`

## Testing Requirements
1. Send immediate notification
2. Queue for digest
3. Process queue
4. Send daily digest
5. Update preferences

## Acceptance Criteria
- [ ] Notifications queue properly
- [ ] Preferences respected
- [ ] Queue processes reliably
- [ ] Daily digest sent
- [ ] Retry logic works
- [ ] UI for preferences

## Dependencies
- Task 23 (email service)
- Resend integration

## Estimated Effort
5-6 hours

## Review Checklist
- [ ] Queue processing reliable
- [ ] Retry exponential backoff
- [ ] Templates render correctly
- [ ] Digest combines notifications
- [ ] Preferences save properly
- [ ] No duplicate sends
