# Task 20: Approval System for Overrides

## Objective
Implement approval workflow for price overrides exceeding configured thresholds, with notifications, approval queue UI, and audit trail.

## Context
- Price overrides beyond thresholds require manager/admin approval
- Automated notifications to approvers
- Approval queue shows pending requests
- Approvers can approve/reject with comments
- Complete audit trail of approvals
- Configurable thresholds by role

## Requirements

### 1. Approval Workflow Schema

**Additions to schema:**
```sql
-- Approval requests (extends price_overrides table)
ALTER TABLE price_overrides ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ;
ALTER TABLE price_overrides ADD COLUMN IF NOT EXISTS approval_expires_at TIMESTAMPTZ;
ALTER TABLE price_overrides ADD COLUMN IF NOT EXISTS approver_notified_at TIMESTAMPTZ;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('approval_required', 'approval_approved', 'approval_rejected', 'quote_sent', 'quote_accepted')),
  title TEXT NOT NULL,
  message TEXT,
  link_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

### 2. Approval Trigger Function

**File:** Update `pricing-tool/supabase-schema.sql`

```sql
CREATE OR REPLACE FUNCTION request_price_override_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_approver_role TEXT;
  v_approver_ids UUID[];
BEGIN
  -- Only trigger if requires_approval is true
  IF NEW.requires_approval = true AND NEW.approval_status = 'pending' THEN
    -- Set approval metadata
    NEW.approval_requested_at := NOW();
    NEW.approval_expires_at := NOW() + INTERVAL '7 days';

    -- Determine required approver role based on discount amount
    SELECT approver_role INTO v_approver_role
    FROM approval_thresholds
    WHERE is_active = true
      AND (
        (threshold_type = 'discount_percent' AND ABS(NEW.discount_percent) >= threshold_value)
        OR
        (threshold_type = 'discount_amount' AND ABS(NEW.original_price - NEW.override_price) >= threshold_value)
      )
    ORDER BY threshold_value DESC
    LIMIT 1;

    -- Get users with required role
    SELECT ARRAY_AGG(id) INTO v_approver_ids
    FROM users
    WHERE role = v_approver_role;

    -- Create notification for each approver
    FOR i IN 1..COALESCE(array_length(v_approver_ids, 1), 0) LOOP
      INSERT INTO notifications (user_id, type, title, message, link_url)
      VALUES (
        v_approver_ids[i],
        'approval_required',
        'Price Override Approval Required',
        format('Price override of %s%% requires your approval', ROUND(ABS(NEW.discount_percent), 1)),
        format('/admin/pricing/approvals?override=%s', NEW.id)
      );
    END LOOP;

    NEW.approver_notified_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_request_approval
BEFORE INSERT OR UPDATE ON price_overrides
FOR EACH ROW
EXECUTE FUNCTION request_price_override_approval();
```

### 3. Approval API Routes

**File:** `pricing-tool/app/api/approvals/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action, notes } = body // action: 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Get override details
  const { data: override, error: fetchError } = await supabase
    .from('price_overrides')
    .select('*, quote:quotes(id, customer_name, created_by)')
    .eq('id', params.id)
    .single()

  if (fetchError || !override) {
    return NextResponse.json({ error: 'Override not found' }, { status: 404 })
  }

  // Check if user has permission to approve
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['ADMIN', 'MANAGER'].includes(userProfile?.role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Update override
  const { error: updateError } = await supabase
    .from('price_overrides')
    .update({
      approval_status: action === 'approve' ? 'approved' : 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: notes
    })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Notify quote creator
  await supabase.from('notifications').insert({
    user_id: override.quote.created_by,
    type: action === 'approve' ? 'approval_approved' : 'approval_rejected',
    title: `Price Override ${action === 'approve' ? 'Approved' : 'Rejected'}`,
    message: `Your price override for ${override.quote.customer_name} has been ${action === 'approve' ? 'approved' : 'rejected'}`,
    link_url: `/admin/quotes/${override.quote_id}/edit`
  })

  // Log event
  await supabase.from('events').insert({
    quote_id: override.quote_id,
    user_id: user.id,
    event_type: action === 'approve' ? 'override_approved' : 'override_rejected',
    payload_json: {
      override_id: params.id,
      discount_percent: override.discount_percent,
      notes
    }
  })

  return NextResponse.json({ success: true })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: override, error } = await supabase
    .from('price_overrides')
    .select(`
      *,
      quote:quotes(id, customer_name, customer_email, total),
      quote_line:quote_lines(description, quantity, unit),
      created_by_user:users!created_by(name, email),
      approved_by_user:users!approved_by(name, email)
    `)
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ override })
}
```

### 4. Approvals Queue Page

**File:** `pricing-tool/app/admin/approvals/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Check, X, Clock, AlertCircle } from 'lucide-react'

export default function ApprovalsQueuePage() {
  const [approvals, setApprovals] = useState<PriceOverride[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  useEffect(() => {
    fetchApprovals()
  }, [filter])

  async function fetchApprovals() {
    const res = await fetch(`/api/approvals?status=${filter}`)
    const data = await res.json()
    setApprovals(data.approvals)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Queue</h1>
          <p className="text-gray-600">Review and approve price override requests</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Pending ({approvals.filter(a => a.approval_status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quote</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Original</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Override</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {approvals.map(approval => (
              <ApprovalRow
                key={approval.id}
                approval={approval}
                onApprove={() => handleApprove(approval.id)}
                onReject={() => handleReject(approval.id)}
              />
            ))}
          </tbody>
        </table>

        {approvals.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Clock className="h-12 w-12 mx-auto mb-2" />
            <p className="text-sm">No pending approvals</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### 5. Approval Row Component

**File:** `pricing-tool/components/admin/approvals/ApprovalRow.tsx`

```typescript
interface ApprovalRowProps {
  approval: PriceOverride
  onApprove: () => void
  onReject: () => void
}

export function ApprovalRow({ approval, onApprove, onReject }: ApprovalRowProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [notes, setNotes] = useState('')

  const discountColor = (percent: number) => {
    const abs = Math.abs(percent)
    if (abs >= 20) return 'text-red-600'
    if (abs >= 10) return 'text-yellow-600'
    return 'text-green-600'
  }

  const isExpiring = approval.approval_expires_at &&
    new Date(approval.approval_expires_at) < new Date(Date.now() + 24 * 60 * 60 * 1000)

  return (
    <>
      <tr className={approval.approval_status === 'pending' ? '' : 'bg-gray-50'}>
        <td className="px-6 py-4">
          <div className="text-sm">
            <p className="font-medium text-gray-900">{approval.quote.customer_name}</p>
            <p className="text-gray-500">Quote #{approval.quote_id.substring(0, 8)}</p>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-gray-900">
            {approval.quote_line?.description || 'Quote Total'}
          </div>
        </td>
        <td className="px-6 py-4 text-right text-sm text-gray-900">
          ${approval.original_price.toFixed(2)}
        </td>
        <td className="px-6 py-4 text-right text-sm text-gray-900">
          ${approval.override_price.toFixed(2)}
        </td>
        <td className="px-6 py-4 text-right">
          <span className={`text-sm font-medium ${discountColor(approval.discount_percent)}`}>
            {approval.discount_percent > 0 ? '+' : ''}{approval.discount_percent.toFixed(1)}%
          </span>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm">
            <p className="text-gray-900">{approval.created_by_user.name}</p>
            <p className="text-gray-500">{approval.created_by_user.email}</p>
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {formatRelativeTime(approval.approval_requested_at)}
          {isExpiring && (
            <div className="flex items-center gap-1 text-orange-600 mt-1">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs">Expiring soon</span>
            </div>
          )}
        </td>
        <td className="px-6 py-4">
          <StatusBadge status={approval.approval_status} />
        </td>
        <td className="px-6 py-4 text-right">
          {approval.approval_status === 'pending' ? (
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-blue-600 hover:text-blue-900 text-sm"
              >
                Details
              </button>
            </div>
          ) : (
            <span className="text-sm text-gray-500">
              {approval.approved_by_user?.name}
            </span>
          )}
        </td>
      </tr>

      {/* Details row */}
      {showDetails && (
        <tr>
          <td colSpan={9} className="px-6 py-4 bg-gray-50 border-t">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
                <p className="text-sm text-gray-600">{approval.reason}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approval Notes (optional):
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input w-full h-20"
                  placeholder="Add comments about this approval..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDetails(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onReject()
                    setShowDetails(false)
                  }}
                  className="btn btn-danger"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </button>
                <button
                  onClick={() => {
                    onApprove()
                    setShowDetails(false)
                  }}
                  className="btn btn-success"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
```

### 6. Notification System

**File:** `pricing-tool/components/Notifications.tsx`

```typescript
'use client'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [])

  async function fetchNotifications() {
    const res = await fetch('/api/notifications')
    const data = await res.json()
    setNotifications(data.notifications)
    setUnreadCount(data.notifications.filter((n: Notification) => !n.read_at).length)
  }

  async function markAsRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    fetchNotifications()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Notifications</h3>
          </div>

          <div className="max-h-96 overflow-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(notif => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onRead={() => markAsRead(notif.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

## Files to Create

**API:**
- `pricing-tool/app/api/approvals/[id]/route.ts`
- `pricing-tool/app/api/approvals/route.ts`
- `pricing-tool/app/api/notifications/route.ts`
- `pricing-tool/app/api/notifications/[id]/read/route.ts`

**Pages:**
- `pricing-tool/app/admin/approvals/page.tsx`

**Components:**
- `pricing-tool/components/admin/approvals/ApprovalRow.tsx`
- `pricing-tool/components/Notifications.tsx`

**Schema:**
- Update `pricing-tool/supabase-schema.sql` (add notifications, triggers)

## Testing Requirements

1. Create override > 10% discount → requires approval
2. Notification sent to approver
3. Approve override → quote updated
4. Reject override → creator notified
5. Expiring approvals highlighted
6. Audit trail complete

## Acceptance Criteria

- [ ] Approval trigger fires correctly
- [ ] Notifications sent to approvers
- [ ] Approval queue displays pending items
- [ ] Approve/reject actions work
- [ ] Notes saved with approval
- [ ] Creator notified of decision
- [ ] Events logged
- [ ] Expired approvals auto-reject (optional)
- [ ] Email notifications sent (optional)

## Dependencies

- Task 16 (approval thresholds schema)
- Task 19 (quote editor for overrides)

## Estimated Effort

5-6 hours

## Review Checklist

- [ ] Trigger logic correct
- [ ] Role permissions enforced
- [ ] Notifications real-time
- [ ] Audit trail complete
- [ ] Error handling comprehensive
- [ ] UI/UX intuitive
- [ ] Keyboard navigation works
- [ ] Accessibility compliance
