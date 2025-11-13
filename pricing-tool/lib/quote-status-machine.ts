/**
 * Quote Status State Machine
 * Manages valid quote status transitions with validation and callbacks
 */

import { createClient } from '@supabase/supabase-js'
import type { Quote, QuoteStatus } from './types'

export interface StatusTransition {
  from: QuoteStatus
  to: QuoteStatus
  requiredRole?: 'ADMIN' | 'SALES' | 'MANAGER'
  validate?: (quote: Quote) => { valid: boolean; error?: string }
  onTransition?: (quote: Quote) => Promise<void>
}

// Define all valid status transitions
export const STATUS_TRANSITIONS: StatusTransition[] = [
  // Normal workflow
  {
    from: 'draft',
    to: 'submitted',
    validate: (quote) => {
      if (!quote.customer_email) {
        return { valid: false, error: 'Customer email required' }
      }
      if (!quote.line_count || quote.line_count === 0) {
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
    requiredRole: 'SALES'
  },
  {
    from: 'sent',
    to: 'accepted'
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

/**
 * Check if a transition from one status to another is valid for a given user role
 */
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

/**
 * Get available status transitions for current user role
 */
export function getAvailableTransitions(
  currentStatus: QuoteStatus,
  userRole: string
): QuoteStatus[] {
  return STATUS_TRANSITIONS
    .filter(t => t.from === currentStatus)
    .filter(t => !t.requiredRole || t.requiredRole === userRole)
    .map(t => t.to)
}

/**
 * Transition a quote to a new status with validation
 */
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
    .select('*')
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
    updateData.expires_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  }

  // Update quote
  const { error: updateError } = await supabase
    .from('quotes')
    .update(updateData)
    .eq('id', quoteId)
    .eq('version', quote.version)

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

  return { success: true }
}

/**
 * Format a status for display
 */
export function formatStatus(status: QuoteStatus): string {
  const labels: Record<QuoteStatus, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    reviewed: 'Reviewed',
    sent: 'Sent',
    accepted: 'Accepted',
    declined: 'Declined',
    expired: 'Expired'
  }
  return labels[status] || status
}
