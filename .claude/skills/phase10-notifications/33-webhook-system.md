# Task 33: Webhook System for External Integrations

## Objective
Implement webhook system allowing customers to register webhooks for quote events with retry logic, signature verification, and event filtering.

## Context
- Allow external systems to receive quote events
- POST events to customer-configured URLs
- Retry with exponential backoff
- HMAC signature for verification
- Event type filtering
- Webhook management UI

## Requirements

### 1. Webhooks Schema

```sql
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  event_types TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_user ON webhooks(user_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  retry_count INTEGER DEFAULT 0,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
```

### 2. Webhook Trigger Function

**File:** `pricing-tool/lib/webhooks/trigger.ts`

```typescript
export async function triggerWebhooks(
  eventType: string,
  payload: any
) {
  // Get active webhooks for this event type
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('is_active', true)
    .contains('event_types', [eventType])

  for (const webhook of webhooks || []) {
    // Queue delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhook.id,
      event_type: eventType,
      payload_json: payload
    })

    // Trigger delivery (async)
    deliverWebhook(webhook, eventType, payload).catch(console.error)
  }
}
```

### 3. Webhook Delivery with Retry

**File:** `pricing-tool/lib/webhooks/deliver.ts`

```typescript
export async function deliverWebhook(
  webhook: Webhook,
  eventType: string,
  payload: any,
  retryCount = 0
) {
  const signature = generateSignature(payload, webhook.secret)

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Event-Type': eventType,
        'User-Agent': 'QuotingApp/1.0'
      },
      body: JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload
      }),
      signal: AbortSignal.timeout(10000) // 10s timeout
    })

    // Log delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhook.id,
      event_type: eventType,
      payload_json: payload,
      response_status: response.status,
      response_body: await response.text(),
      delivered_at: new Date().toISOString()
    })

    // Update webhook
    await supabase
      .from('webhooks')
      .update({
        last_triggered_at: new Date().toISOString(),
        failure_count: 0
      })
      .eq('id', webhook.id)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
  } catch (error) {
    // Retry with exponential backoff
    if (retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
      setTimeout(() => {
        deliverWebhook(webhook, eventType, payload, retryCount + 1)
      }, delay)
    } else {
      // Max retries reached
      await supabase
        .from('webhooks')
        .update({
          failure_count: webhook.failure_count + 1,
          is_active: webhook.failure_count + 1 >= 10 ? false : true // Auto-disable after 10 failures
        })
        .eq('id', webhook.id)
    }

    console.error(`Webhook delivery failed: ${error.message}`)
  }
}

function generateSignature(payload: any, secret: string): string {
  const crypto = require('crypto')
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(JSON.stringify(payload))
  return hmac.digest('hex')
}
```

### 4. Webhook Management API

**File:** `pricing-tool/app/api/webhooks/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('user_id', user.id)

  return NextResponse.json({ webhooks })
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  const body = await request.json()
  const { url, event_types } = body

  // Generate secret
  const secret = crypto.randomBytes(32).toString('hex')

  const { data: webhook } = await supabase
    .from('webhooks')
    .insert({
      user_id: user.id,
      url,
      secret,
      event_types
    })
    .select()
    .single()

  return NextResponse.json({ webhook })
}
```

### 5. Webhook Management UI

**File:** `pricing-tool/app/settings/webhooks/page.tsx`

```typescript
export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          Create Webhook
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left">URL</th>
              <th className="px-6 py-3 text-left">Events</th>
              <th className="px-6 py-3 text-left">Last Triggered</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {webhooks.map(webhook => (
              <WebhookRow key={webhook.id} webhook={webhook} />
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateWebhookModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}

function CreateWebhookModal({ onClose }: Props) {
  const [url, setUrl] = useState('')
  const [eventTypes, setEventTypes] = useState([])

  const availableEvents = [
    { id: 'quote_created', label: 'Quote Created' },
    { id: 'quote_sent', label: 'Quote Sent' },
    { id: 'quote_accepted', label: 'Quote Accepted' },
    { id: 'quote_declined', label: 'Quote Declined' }
  ]

  return (
    <Modal open onClose={onClose}>
      <h2 className="text-xl font-bold mb-4">Create Webhook</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Webhook URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input w-full"
            placeholder="https://example.com/webhooks/quotes"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Event Types</label>
          {availableEvents.map(event => (
            <label key={event.id} className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={eventTypes.includes(event.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setEventTypes([...eventTypes, event.id])
                  } else {
                    setEventTypes(eventTypes.filter(t => t !== event.id))
                  }
                }}
              />
              <span className="text-sm">{event.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleCreate} className="btn btn-primary flex-1">
            Create Webhook
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

### 6. Test Webhook Function

**File:** `pricing-tool/app/api/webhooks/[id]/test/route.ts`

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: webhook } = await supabase
    .from('webhooks')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!webhook) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Send test event
  await deliverWebhook(webhook, 'webhook_test', {
    message: 'This is a test webhook',
    timestamp: new Date().toISOString()
  })

  return NextResponse.json({ success: true })
}
```

## Files to Create
- Update `pricing-tool/supabase-schema.sql`
- `pricing-tool/lib/webhooks/trigger.ts`
- `pricing-tool/lib/webhooks/deliver.ts`
- `pricing-tool/app/api/webhooks/route.ts`
- `pricing-tool/app/api/webhooks/[id]/test/route.ts`
- `pricing-tool/app/settings/webhooks/page.tsx`

## Testing Requirements
1. Create webhook
2. Trigger event
3. Verify delivery
4. Test signature verification
5. Test retry logic
6. Auto-disable after failures

## Acceptance Criteria
- [ ] Webhooks can be registered
- [ ] Events trigger webhooks
- [ ] Signature verification works
- [ ] Retry with exponential backoff
- [ ] Auto-disable after 10 failures
- [ ] Delivery logs kept
- [ ] Test webhook function

## Dependencies
- Task 01 (events table)

## Estimated Effort
5-6 hours

## Review Checklist
- [ ] Signature generation secure
- [ ] Retry logic robust
- [ ] Timeout prevents hanging
- [ ] Delivery logs retained
- [ ] UI shows delivery history
- [ ] Event filtering works
- [ ] Secret never exposed in responses
