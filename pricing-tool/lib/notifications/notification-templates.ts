/**
 * Notification Templates for Email and Alert System
 * Extends Phase 7 email templates with notification preferences
 */

export interface NotificationData {
  quoteId?: string
  quoteNumber?: string
  customerName?: string
  total?: number
  status?: string
  quoteUrl?: string
  discountPercent?: number
  approvalUrl?: string
  notifications?: Array<{ message: string }>
  [key: string]: any
}

export interface NotificationTemplate {
  subject: (data: NotificationData) => string
  html: (data: NotificationData) => string
  text?: (data: NotificationData) => string
}

export const notificationTemplates: Record<string, NotificationTemplate> = {
  quote_status_changed: {
    subject: (data: NotificationData) =>
      `Quote #${data.quoteNumber || data.quoteId?.substring(0, 8)} ${data.status}`,
    html: (data: NotificationData) => `
      <h2>Quote Status Updated</h2>
      <p>Hi ${data.customerName || 'Valued Customer'},</p>
      <p>Your quote <strong>#${data.quoteNumber || data.quoteId?.substring(0, 8)}</strong> is now <strong>${data.status}</strong>.</p>
      ${data.quoteUrl ? `<p><a href="${data.quoteUrl}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Quote</a></p>` : ''}
    `,
    text: (data: NotificationData) =>
      `Quote #${data.quoteNumber || data.quoteId?.substring(0, 8)} is now ${data.status}. ${data.quoteUrl ? `View: ${data.quoteUrl}` : ''}`
  },

  approval_required: {
    subject: () => 'Approval Required - Price Override',
    html: (data: NotificationData) => `
      <h2>Price Override Approval Needed</h2>
      <p>A price override of <strong>${Math.abs(data.discountPercent || 0).toFixed(1)}%</strong> requires your approval.</p>
      ${data.approvalUrl ? `<p><a href="${data.approvalUrl}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Review Now</a></p>` : ''}
    `,
    text: (data: NotificationData) =>
      `A price override of ${Math.abs(data.discountPercent || 0).toFixed(1)}% requires your approval. ${data.approvalUrl ? `Review: ${data.approvalUrl}` : ''}`
  },

  approval_approved: {
    subject: () => 'Price Override Approved',
    html: (data: NotificationData) => `
      <h2>Your Price Override Has Been Approved</h2>
      <p>Your requested discount of <strong>${Math.abs(data.discountPercent || 0).toFixed(1)}%</strong> has been approved.</p>
      ${data.quoteUrl ? `<p><a href="${data.quoteUrl}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Continue with Quote</a></p>` : ''}
    `,
    text: (data: NotificationData) =>
      `Your price override of ${Math.abs(data.discountPercent || 0).toFixed(1)}% has been approved.`
  },

  approval_rejected: {
    subject: () => 'Price Override Rejected',
    html: (data: NotificationData) => `
      <h2>Your Price Override Request Was Rejected</h2>
      <p>Your requested discount of <strong>${Math.abs(data.discountPercent || 0).toFixed(1)}%</strong> was not approved.</p>
      <p>Please contact your manager for further assistance.</p>
    `,
    text: (data: NotificationData) =>
      `Your price override of ${Math.abs(data.discountPercent || 0).toFixed(1)}% was not approved.`
  },

  quote_accepted: {
    subject: (data: NotificationData) =>
      `Quote #${data.quoteNumber || data.quoteId?.substring(0, 8)} Accepted!`,
    html: (data: NotificationData) => `
      <h2>Quote Accepted!</h2>
      <p>Hi ${data.customerName || 'Sales Team'},</p>
      <p>Quote <strong>#${data.quoteNumber || data.quoteId?.substring(0, 8)}</strong> for <strong>$${(data.total || 0).toFixed(2)}</strong> has been accepted.</p>
      ${data.quoteUrl ? `<p><a href="${data.quoteUrl}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Details</a></p>` : ''}
    `,
    text: (data: NotificationData) =>
      `Quote #${data.quoteNumber || data.quoteId?.substring(0, 8)} for $${(data.total || 0).toFixed(2)} has been accepted.`
  },

  quote_declined: {
    subject: (data: NotificationData) =>
      `Quote #${data.quoteNumber || data.quoteId?.substring(0, 8)} Declined`,
    html: (data: NotificationData) => `
      <h2>Quote Declined</h2>
      <p>Hi ${data.customerName || 'Sales Team'},</p>
      <p>Quote <strong>#${data.quoteNumber || data.quoteId?.substring(0, 8)}</strong> has been declined.</p>
      ${data.quoteUrl ? `<p><a href="${data.quoteUrl}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Review Quote</a></p>` : ''}
    `,
    text: (data: NotificationData) =>
      `Quote #${data.quoteNumber || data.quoteId?.substring(0, 8)} has been declined.`
  },

  daily_digest: {
    subject: (data: NotificationData) =>
      `Daily Digest - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    html: (data: NotificationData) => `
      <h2>Your Daily Digest</h2>
      <p>Hi,</p>
      <p>Here's a summary of your notifications for today:</p>
      <ul>
        ${(data.notifications || []).map(n => `<li>${n.message}</li>`).join('')}
      </ul>
      <p>Log in to view more details.</p>
    `,
    text: (data: NotificationData) =>
      `Daily Digest:\n${(data.notifications || []).map(n => `- ${n.message}`).join('\n')}`
  }
}

/**
 * Get notification template by type
 */
export function getNotificationTemplate(
  notificationType: string
): NotificationTemplate | null {
  return notificationTemplates[notificationType] || null
}

/**
 * Available notification types for user preferences
 */
export const NOTIFICATION_TYPES = [
  {
    id: 'quote_status_changed',
    label: 'Quote Status Changes',
    description: 'Get notified when quote status changes'
  },
  {
    id: 'approval_required',
    label: 'Approvals Required',
    description: 'Get notified when approval is needed'
  },
  {
    id: 'approval_approved',
    label: 'Approval Approved',
    description: 'Get notified when your approval request is approved'
  },
  {
    id: 'approval_rejected',
    label: 'Approval Rejected',
    description: 'Get notified when your approval request is rejected'
  },
  {
    id: 'quote_accepted',
    label: 'Quote Accepted',
    description: 'Get notified when a quote is accepted'
  },
  {
    id: 'quote_declined',
    label: 'Quote Declined',
    description: 'Get notified when a quote is declined'
  }
]
