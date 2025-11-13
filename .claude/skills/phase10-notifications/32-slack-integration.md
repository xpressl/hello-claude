# Task 32: Slack Integration (Optional)

## Objective
Integrate Slack webhooks for real-time notifications to sales team channels with rich formatting and quick action links.

## Context
- Notify sales team in Slack when quotes accepted
- Rich message formatting with quote details
- Link back to admin interface
- Configurable per notification type
- Optional feature, disabled by default

## Requirements

### 1. Slack Webhook Configuration

**Environment:**
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_ENABLED=true
```

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS slack_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL UNIQUE,
  webhook_url TEXT NOT NULL,
  channel TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Slack Message Formatter

**File:** `pricing-tool/lib/slack/format-message.ts`

```typescript
export function formatQuoteAcceptedMessage(quote: Quote): SlackMessage {
  return {
    text: `Quote #${quote.id.substring(0, 8)} Accepted! 🎉`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Quote Accepted! 🎉`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Customer:*\n${quote.customer_name}`
          },
          {
            type: 'mrkdwn',
            text: `*Total:*\n$${quote.total.toFixed(2)}`
          },
          {
            type: 'mrkdwn',
            text: `*Quote #:*\n${quote.id.substring(0, 8)}`
          },
          {
            type: 'mrkdwn',
            text: `*Margin:*\n${quote.margin_percent?.toFixed(1)}%`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `View in admin: ${process.env.NEXT_PUBLIC_APP_URL}/admin/quotes/${quote.id}/edit`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Accepted at ${new Date().toLocaleString()}`
          }
        ]
      }
    ]
  }
}

export function formatApprovalRequiredMessage(override: PriceOverride): SlackMessage {
  return {
    text: 'Price Override Approval Required',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Price Override Needs Approval*\nDiscount: ${Math.abs(override.discount_percent).toFixed(1)}%`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Review'
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/approvals?override=${override.id}`,
            style: 'primary'
          }
        ]
      }
    ]
  }
}
```

### 3. Slack Send Function

**File:** `pricing-tool/lib/slack/send-message.ts`

```typescript
export async function sendSlackMessage(
  eventType: string,
  message: SlackMessage
) {
  // Check if enabled
  const { data: config } = await supabase
    .from('slack_configs')
    .select('*')
    .eq('event_type', eventType)
    .eq('enabled', true)
    .single()

  if (!config) return

  try {
    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`)
    }
  } catch (error) {
    console.error('Failed to send Slack message:', error)
    // Don't throw - Slack failures shouldn't break core functionality
  }
}
```

### 4. Integration Points

**File:** `pricing-tool/lib/events/quote-accepted-handler.ts`

```typescript
export async function handleQuoteAccepted(quoteId: string) {
  const quote = await fetchQuote(quoteId)

  // Send Slack notification
  if (process.env.SLACK_ENABLED === 'true') {
    const message = formatQuoteAcceptedMessage(quote)
    await sendSlackMessage('quote_accepted', message)
  }

  // ... other handling
}
```

### 5. Slack Configuration UI

**File:** `pricing-tool/app/admin/settings/slack/page.tsx`

```typescript
export default function SlackSettingsPage() {
  const [configs, setConfigs] = useState([])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Slack Integration</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={slackEnabled}
              onChange={(e) => updateSetting('SLACK_ENABLED', e.target.checked)}
            />
            <span className="font-medium">Enable Slack Integration</span>
          </label>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Webhook URL</label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="input w-full"
            placeholder="https://hooks.slack.com/services/..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Get webhook URL from your Slack workspace settings
          </p>
        </div>

        <h3 className="font-semibold mb-3">Event Configuration</h3>
        <table className="w-full border rounded">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-4 py-2 text-left">Event</th>
              <th className="px-4 py-2 text-left">Channel</th>
              <th className="px-4 py-2 text-center">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {eventTypes.map(type => (
              <tr key={type.id} className="border-b">
                <td className="px-4 py-2">{type.label}</td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={getChannel(type.id)}
                    onChange={(e) => updateChannel(type.id, e.target.value)}
                    className="input-sm"
                    placeholder="#sales"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={isEnabled(type.id)}
                    onChange={(e) => updateEnabled(type.id, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button onClick={testSlackConnection} className="btn btn-secondary mt-6">
          Send Test Message
        </button>
      </div>
    </div>
  )
}
```

## Files to Create
- Update `pricing-tool/supabase-schema.sql`
- `pricing-tool/lib/slack/format-message.ts`
- `pricing-tool/lib/slack/send-message.ts`
- `pricing-tool/app/admin/settings/slack/page.tsx`

## Testing Requirements
1. Configure webhook URL
2. Send test message
3. Verify quote accepted notification
4. Check rich formatting
5. Test link back to admin

## Acceptance Criteria
- [ ] Slack webhooks configured
- [ ] Messages send successfully
- [ ] Rich formatting displays
- [ ] Links work correctly
- [ ] Can be disabled globally
- [ ] Per-event configuration

## Dependencies
- Slack workspace with webhook permissions

## Estimated Effort
3-4 hours

## Review Checklist
- [ ] Webhook URL secured
- [ ] Failures don't break app
- [ ] Message formatting tested
- [ ] Links absolute URLs
- [ ] Rate limiting considered
- [ ] Error logging adequate
