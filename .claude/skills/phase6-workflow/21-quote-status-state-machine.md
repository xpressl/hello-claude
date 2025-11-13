# Task 21: Quote Status State Machine

## Objective
Implement state machine for quote lifecycle with valid transitions, business rules, automatic timestamp updates, and prevention of invalid state changes.

## Context
- Quote progresses through defined statuses: draft → submitted → reviewed → sent → accepted/declined/expired
- Only valid transitions allowed (can't go from sent → draft)
- Status changes update corresponding timestamps
- Locked quotes cannot be edited
- Business rules enforced (e.g., must have lines before submit)
- Audit trail of all status changes

## Requirements

### 1. Status State Machine Definition

**Valid statuses and transitions:**
```
draft → submitted → reviewed → sent → accepted
                                    → declined
                                    → expired

Special transitions:
- Any status → draft (admin only, for corrections)
- sent → reviewed (for revisions)
```

**File:** `pricing-tool/lib/quote-status-machine.ts`

```typescript
export type QuoteStatus =
  | 'draft'
  | 'submitted'
  | 'reviewed'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired'

export interface StatusTransition {
  from: QuoteStatus
  to: QuoteStatus
  requiredRole?: 'ADMIN' | 'SALES' | 'MANAGER'
  validate?: (quote: Quote) => { valid: boolean; error?: string }
  onTransition?: (quote: Quote) => Promise<void>
}

export const STATUS_TRANSITIONS: StatusTransition[] = [
  // Normal workflow
  {
    from: 'draft',
    to: 'submitted',
    validate: (quote) => {
      if (!quote.customer_email) {
        return { valid: false, error: 'Customer email required' }
      }
      if (!quote.lines || quote.lines.length === 0) {
        return { valid: false, error: 'At least one line item required' }
      }
      return { valid: true }
    }
  },
  {
    from: 'submitted',
    to: 'reviewed',
    requiredRole: 'SALES'
  },
  {
    from: 'reviewed',
    to: 'sent',
    requiredRole: 'SALES',
    validate: (quote) => {
      const hasUnapprovedOverrides = quote.overrides?.some(
        o => o.requires_approval && o.approval_status !== 'approved'
      )
      if (hasUnapprovedOverrides) {
        return { valid: false, error: 'All price overrides must be approved' }
      }
      return { valid: true }
    },
    onTransition: async (quote) => {
      // Generate PDF, send email (handled in Task 22-23)
      await generateQuotePDF(quote.id)
      await sendQuoteEmail(quote.id)
    }
  },
  {
    from: 'sent',
    to: 'accepted',
    onTransition: async (quote) => {
      // Create celebration event, notify sales team
      await notifySalesTeam(quote.id, 'accepted')
    }
  },
  {
    from: 'sent',
    to: 'declined'
  },
  {
    from: 'sent',
    to: 'expired',
    validate: (quote) => {
      const isExpired = quote.expires_at && new Date(quote.expires_at) < new Date()
      if (!isExpired) {
        return { valid: false, error: 'Quote has not expired yet' }
      }
      return { valid: true }
    }
  },

  // Revision workflow
  {
    from: 'sent',
    to: 'reviewed',
    requiredRole: 'SALES'
  },

  // Admin correction (any → draft)
  {
    from: 'submitted',
    to: 'draft',
    requiredRole: 'ADMIN'
  },
  {
    from: 'reviewed',
    to: 'draft',
    requiredRole: 'ADMIN'
  },
  {
    from: 'sent',
    to: 'draft',
    requiredRole: 'ADMIN'
  }
]

export function isValidTransition(
  from: QuoteStatus,
  to: QuoteStatus,
  userRole?: string
): boolean {
  const transition = STATUS_TRANSITIONS.find(
    t => t.from === from && t.to === to
  )

  if (!transition) return false

  if (transition.requiredRole && transition.requiredRole !== userRole) {
    return false
  }

  return true
}

export function getAvailableTransitions(
  currentStatus: QuoteStatus,
  userRole: string
): QuoteStatus[] {
  return STATUS_TRANSITIONS
    .filter(t => t.from === currentStatus)
    .filter(t => !t.requiredRole || t.requiredRole === userRole)
    .map(t => t.to)
}
```

### 2. Status Transition Function

**File:** `pricing-tool/lib/quote-status-machine.ts` (continued)

```typescript
export async function transitionQuoteStatus(
  quoteId: string,
  newStatus: QuoteStatus,
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get current quote
  const { data: quote, error: fetchError } = await supabase
    .from('quotes')
    .select('*, lines:quote_lines(*), overrides:price_overrides(*)')
    .eq('id', quoteId)
    .single()

  if (fetchError || !quote) {
    return { success: false, error: 'Quote not found' }
  }

  // Get user role
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  // Check if transition is valid
  if (!isValidTransition(quote.status, newStatus, user?.role)) {
    return {
      success: false,
      error: `Invalid transition from ${quote.status} to ${newStatus}`
    }
  }

  // Find transition config
  const transition = STATUS_TRANSITIONS.find(
    t => t.from === quote.status && t.to === newStatus
  )

  // Run validation
  if (transition?.validate) {
    const validation = transition.validate(quote)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
  }

  // Prepare update data
  const updateData: any = {
    status: newStatus,
    version: quote.version + 1
  }

  // Set timestamps
  if (newStatus === 'submitted') {
    updateData.submitted_at = new Date().toISOString()
  } else if (newStatus === 'sent') {
    updateData.sent_at = new Date().toISOString()
    updateData.expires_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days
  }

  // Update quote
  const { error: updateError } = await supabase
    .from('quotes')
    .update(updateData)
    .eq('id', quoteId)
    .eq('version', quote.version) // Optimistic locking

  if (updateError) {
    if (updateError.message.includes('version')) {
      return {
        success: false,
        error: 'Quote was modified by another user. Please refresh.'
      }
    }
    return { success: false, error: updateError.message }
  }

  // Log event
  await supabase.from('events').insert({
    quote_id: quoteId,
    user_id: userId,
    event_type: 'status_changed',
    payload_json: {
      from: quote.status,
      to: newStatus,
      reason
    }
  })

  // Run onTransition callback
  if (transition?.onTransition) {
    try {
      await transition.onTransition(quote)
    } catch (error) {
      console.error('onTransition error:', error)
      // Don't fail the transition if callback fails
    }
  }

  return { success: true }
}
```

### 3. Database Trigger for Status Validation

**File:** Update `pricing-tool/supabase-schema.sql`

```sql
CREATE OR REPLACE FUNCTION validate_quote_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_valid_transitions TEXT[];
BEGIN
  -- Define valid transitions as array
  v_valid_transitions := ARRAY[
    'draft:submitted',
    'submitted:reviewed',
    'submitted:draft', -- admin only
    'reviewed:sent',
    'reviewed:draft', -- admin only
    'sent:accepted',
    'sent:declined',
    'sent:expired',
    'sent:reviewed', -- for revisions
    'sent:draft' -- admin only
  ];

  -- Check if transition is valid
  IF NOT (OLD.status || ':' || NEW.status) = ANY(v_valid_transitions) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  -- Prevent editing locked quotes
  IF OLD.status IN ('sent', 'accepted', 'declined', 'expired') AND
     NEW.status = OLD.status AND
     (OLD.subtotal <> NEW.subtotal OR OLD.total <> NEW.total) THEN
    RAISE EXCEPTION 'Cannot modify quote in % status', OLD.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_quote_status
BEFORE UPDATE OF status ON quotes
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION validate_quote_status_transition();
```

### 4. Auto-Expire Quotes Function

**File:** Update `pricing-tool/supabase-schema.sql`

```sql
CREATE OR REPLACE FUNCTION expire_old_quotes()
RETURNS void AS $$
BEGIN
  UPDATE quotes
  SET status = 'expired'
  WHERE status = 'sent'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Schedule to run daily (requires pg_cron extension)
SELECT cron.schedule('expire-quotes', '0 1 * * *', 'SELECT expire_old_quotes()');
```

### 5. Status Transition UI Component

**File:** `pricing-tool/components/admin/quotes/StatusTransitionButton.tsx`

```typescript
interface StatusTransitionButtonProps {
  quote: Quote
  onTransition: () => void
}

export function StatusTransitionButton({
  quote,
  onTransition
}: StatusTransitionButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<QuoteStatus | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const availableTransitions = getAvailableTransitions(
    quote.status,
    getCurrentUserRole()
  )

  const handleTransition = async () => {
    if (!selectedStatus) return

    setLoading(true)

    const res = await fetch(`/api/quotes/${quote.id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: selectedStatus,
        reason
      })
    })

    const data = await res.json()

    if (data.success) {
      toast.success(`Quote moved to ${selectedStatus}`)
      onTransition()
      setShowMenu(false)
    } else {
      toast.error(data.error || 'Transition failed')
    }

    setLoading(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="btn btn-secondary"
        disabled={availableTransitions.length === 0}
      >
        <GitBranch className="h-4 w-4 mr-2" />
        Change Status
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Change Quote Status</h3>
            <p className="text-sm text-gray-500">Current: {quote.status}</p>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">New Status</label>
              <div className="space-y-2">
                {availableTransitions.map(status => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value={status}
                      checked={selectedStatus === status}
                      onChange={() => setSelectedStatus(status)}
                      className="rounded-full"
                    />
                    <span className="text-sm">{formatStatus(status)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input w-full h-20"
                placeholder="Why is this status change being made?"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowMenu(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleTransition}
                disabled={!selectedStatus || loading}
                className="btn btn-primary flex-1"
              >
                {loading ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

### 6. Quote Lock Indicator

**File:** `pricing-tool/components/admin/quotes/QuoteLockIndicator.tsx`

```typescript
export function QuoteLockIndicator({ quote }: { quote: Quote }) {
  const isLocked = ['sent', 'accepted', 'declined', 'expired'].includes(quote.status)

  if (!isLocked) return null

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-yellow-900">Quote Locked</h3>
          <p className="text-sm text-yellow-700 mt-1">
            This quote is in <strong>{quote.status}</strong> status and cannot be edited.
            {quote.status === 'sent' && ' To make changes, move it back to "reviewed" status.'}
          </p>
        </div>
      </div>
    </div>
  )
}
```

### 7. API Route for Status Transition

**File:** `pricing-tool/app/api/quotes/[id]/transition/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { transitionQuoteStatus } from '@/lib/quote-status-machine'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { status, reason } = body

  const result = await transitionQuoteStatus(
    params.id,
    status,
    user.id,
    reason
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
```

### 8. Status Timeline Component

**File:** `pricing-tool/components/admin/quotes/StatusTimeline.tsx`

```typescript
export function StatusTimeline({ quote }: { quote: Quote }) {
  const statuses: Array<{ status: QuoteStatus; timestamp?: string }> = [
    { status: 'draft', timestamp: quote.created_at },
    { status: 'submitted', timestamp: quote.submitted_at },
    { status: 'reviewed', timestamp: quote.reviewed_at },
    { status: 'sent', timestamp: quote.sent_at },
    {
      status: quote.status === 'accepted' ? 'accepted' :
              quote.status === 'declined' ? 'declined' :
              quote.status === 'expired' ? 'expired' : null,
      timestamp: quote.accepted_at || quote.declined_at || quote.expires_at
    }
  ].filter(s => s.status !== null)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Status History</h3>

      <div className="space-y-3">
        {statuses.map((item, index) => {
          const isActive = quote.status === item.status
          const isPast = statuses.findIndex(s => s.status === quote.status) > index

          return (
            <div key={item.status} className="flex items-center gap-3">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  isPast ? 'bg-green-500' :
                  isActive ? 'bg-blue-500' :
                  'bg-gray-300'
                }`}
              >
                {isPast && <Check className="h-5 w-5 text-white" />}
                {isActive && <div className="h-3 w-3 bg-white rounded-full" />}
              </div>

              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  isPast || isActive ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {formatStatus(item.status)}
                </p>
                {item.timestamp && (
                  <p className="text-xs text-gray-500">
                    {formatDateTime(item.timestamp)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

## Files to Create

**Library:**
- `pricing-tool/lib/quote-status-machine.ts`

**API:**
- `pricing-tool/app/api/quotes/[id]/transition/route.ts`

**Components:**
- `pricing-tool/components/admin/quotes/StatusTransitionButton.tsx`
- `pricing-tool/components/admin/quotes/QuoteLockIndicator.tsx`
- `pricing-tool/components/admin/quotes/StatusTimeline.tsx`

**Schema:**
- Update `pricing-tool/supabase-schema.sql` (trigger, cron job)

## Testing Requirements

1. **Valid Transitions:**
   - draft → submitted (with validation)
   - submitted → reviewed
   - reviewed → sent
   - sent → accepted/declined

2. **Invalid Transitions:**
   - sent → draft (without ADMIN role)
   - draft → accepted (skipping steps)

3. **Business Rules:**
   - Cannot submit without email
   - Cannot submit without lines
   - Cannot send with unapproved overrides
   - Cannot edit locked quote

4. **Auto-Expiry:**
   - Quotes expire after expires_at date
   - Status updated to 'expired'

## Acceptance Criteria

- [ ] State machine enforces valid transitions
- [ ] Validation runs before transition
- [ ] Timestamps updated automatically
- [ ] Locked quotes cannot be edited
- [ ] Events logged for all transitions
- [ ] UI shows available transitions
- [ ] Optimistic locking prevents conflicts
- [ ] Auto-expiry runs daily
- [ ] Timeline shows status history
- [ ] Role-based permissions work

## Dependencies

- Task 01 (quotes schema)
- Task 02 (API routes)

## Estimated Effort

4-5 hours

## Review Checklist

- [ ] All transitions validated
- [ ] Database trigger prevents invalid changes
- [ ] Optimistic locking works
- [ ] Event logging complete
- [ ] Callbacks executed safely
- [ ] Error messages helpful
- [ ] TypeScript types accurate
- [ ] Role permissions enforced
- [ ] Auto-expiry tested
- [ ] UI/UX intuitive
