/**
 * Slack Message Formatter
 * Formats rich messages for Slack webhook delivery
 */

export interface SlackBlock {
  type: string
  [key: string]: any
}

export interface SlackMessage {
  text: string
  blocks?: SlackBlock[]
}

export interface Quote {
  id: string
  customer_name: string | null
  total: number
  margin_percent?: number
  status: string
}

export interface PriceOverride {
  id: string
  discount_percent: number
}

/**
 * Format quote accepted message for Slack
 */
export function formatQuoteAcceptedMessage(quote: Quote): SlackMessage {
  const quoteNumber = quote.id.substring(0, 8).toUpperCase()

  return {
    text: `Quote #${quoteNumber} Accepted! 🎉`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Quote Accepted! 🎉',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Customer:*\n${quote.customer_name || 'Unknown'}`
          },
          {
            type: 'mrkdwn',
            text: `*Total:*\n$${quote.total.toFixed(2)}`
          },
          {
            type: 'mrkdwn',
            text: `*Quote #:*\n${quoteNumber}`
          },
          {
            type: 'mrkdwn',
            text: `*Margin:*\n${(quote.margin_percent || 0).toFixed(1)}%`
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

/**
 * Format quote declined message for Slack
 */
export function formatQuoteDeclinedMessage(quote: Quote): SlackMessage {
  const quoteNumber = quote.id.substring(0, 8).toUpperCase()

  return {
    text: `Quote #${quoteNumber} Declined`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Quote Declined ⚠️',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Customer:*\n${quote.customer_name || 'Unknown'}`
          },
          {
            type: 'mrkdwn',
            text: `*Quote #:*\n${quoteNumber}`
          },
          {
            type: 'mrkdwn',
            text: `*Amount:*\n$${quote.total.toFixed(2)}`
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
            text: `Declined at ${new Date().toLocaleString()}`
          }
        ]
      }
    ]
  }
}

/**
 * Format approval required message for Slack
 */
export function formatApprovalRequiredMessage(
  override: PriceOverride,
  quoteId: string
): SlackMessage {
  return {
    text: 'Price Override Approval Required',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Price Override Needs Approval ⚠️',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Discount:* ${Math.abs(override.discount_percent).toFixed(1)}%\n*Quote:* ${quoteId.substring(0, 8).toUpperCase()}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Review',
              emoji: true
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/admin/approvals?override=${override.id}`,
            style: 'primary'
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Requested at ${new Date().toLocaleString()}`
          }
        ]
      }
    ]
  }
}

/**
 * Format approval approved message for Slack
 */
export function formatApprovalApprovedMessage(
  override: PriceOverride,
  quoteId: string,
  approverName: string
): SlackMessage {
  return {
    text: 'Price Override Approved ✅',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Price Override Approved ✅',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Discount:*\n${Math.abs(override.discount_percent).toFixed(1)}%`
          },
          {
            type: 'mrkdwn',
            text: `*Approved By:*\n${approverName}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Quote: ${quoteId.substring(0, 8).toUpperCase()}`
          }
        ]
      }
    ]
  }
}

/**
 * Format test message for Slack configuration
 */
export function formatTestMessage(): SlackMessage {
  return {
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
          text: 'This is a test message from your Quote System notification integration.'
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
}
