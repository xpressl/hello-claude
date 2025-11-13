/**
 * Email Templates
 * Professional email templates for quote notifications
 */

export interface Quote {
  id: string
  customer_name: string | null
  customer_email: string | null
  total: number
  expires_at: string | null
  status: string
}

export type EmailTemplate = 'quote_sent' | 'quote_viewed' | 'quote_accepted' | 'quote_declined'

export interface EmailTemplateContent {
  subject: string
  html: string
  text: string
}

export function getEmailTemplate(
  template: EmailTemplate,
  quote: Quote,
  viewUrl?: string
): EmailTemplateContent {
  const quoteNumber = quote.id.substring(0, 8).toUpperCase()
  const expiresDate = quote.expires_at
    ? new Date(quote.expires_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'N/A'

  switch (template) {
    case 'quote_sent':
      return generateQuoteSentEmail(quote, quoteNumber, viewUrl, expiresDate)
    case 'quote_viewed':
      return generateQuoteViewedEmail(quote, quoteNumber)
    case 'quote_accepted':
      return generateQuoteAcceptedEmail(quote, quoteNumber)
    case 'quote_declined':
      return generateQuoteDeclinedEmail(quote, quoteNumber)
    default:
      throw new Error(`Unknown email template: ${template}`)
  }
}

function generateQuoteSentEmail(
  quote: Quote,
  quoteNumber: string,
  viewUrl?: string,
  expiresDate?: string
): EmailTemplateContent {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .quote-details { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #666; }
    .value { color: #333; }
    .total-amount { font-size: 28px; font-weight: bold; color: #667eea; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .cta-button:hover { background: #764ba2; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
    .expiry-warning { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 12px; border-radius: 4px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Quote is Ready!</h1>
    </div>

    <div class="content">
      <p>Hi <strong>${quote.customer_name || 'Valued Customer'}</strong>,</p>

      <p>Thank you for your interest in our products and services. Your professional quote is attached to this email and is ready for your review.</p>

      <div class="quote-details">
        <div class="detail-row">
          <span class="label">Quote Number:</span>
          <span class="value">#${quoteNumber}</span>
        </div>
        <div class="detail-row">
          <span class="label">Quote Total:</span>
          <span class="value total-amount">$${quote.total.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Valid Until:</span>
          <span class="value">${expiresDate}</span>
        </div>
      </div>

      <div class="expiry-warning">
        <strong>Important:</strong> This quote is valid for 14 days from the date above. Please review and respond within this timeframe.
      </div>

      ${
        viewUrl
          ? `<p style="text-align: center;">
        <a href="${viewUrl}" class="cta-button">View Quote Online</a>
      </p>
      <p style="text-align: center; color: #666; font-size: 13px;">You can also view this quote online without downloading the PDF</p>`
          : ''
      }

      <h3>What's Included:</h3>
      <ul style="color: #666; line-height: 1.8;">
        <li>Detailed line item breakdown</li>
        <li>Pricing for all selected options</li>
        <li>Terms and conditions</li>
        <li>Delivery timeline</li>
      </ul>

      <h3>Next Steps:</h3>
      <ol style="color: #666; line-height: 1.8;">
        <li>Review the attached quote document</li>
        <li>Contact us with any questions or modifications</li>
        <li>Accept or decline the quote to proceed</li>
      </ol>

      <p style="color: #666;">If you have any questions or would like to discuss the quote, please don't hesitate to reach out. We're here to help!</p>

      <p>Best regards,<br><strong>Sales Team</strong></p>
    </div>

    <div class="footer">
      <p>This is an automated quote notification. Please do not reply to this email.</p>
      <p>&copy; 2024 Professional Services. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`

  const text = `Your Quote is Ready!

Hi ${quote.customer_name || 'Valued Customer'},

Thank you for your interest. Your quote #${quoteNumber} is ready for review.

Quote Details:
- Quote Number: #${quoteNumber}
- Total Amount: $${quote.total.toFixed(2)}
- Valid Until: ${expiresDate}

${viewUrl ? `You can view this quote online: ${viewUrl}\n` : ''}

The attached PDF contains the full quote details including line items, pricing, and terms.

Please review and contact us with any questions.

Best regards,
Sales Team`

  return {
    subject: `Your Quote #${quoteNumber} is Ready`,
    html,
    text,
  }
}

function generateQuoteViewedEmail(quote: Quote, quoteNumber: string): EmailTemplateContent {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f0f4f8; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Quote Viewed</h2>
      <p>Quote #${quoteNumber} was viewed by the customer.</p>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`

  const text = `Quote Viewed - #${quoteNumber}\nViewed at: ${new Date().toLocaleString()}`

  return {
    subject: `Quote #${quoteNumber} Was Viewed`,
    html,
    text,
  }
}

function generateQuoteAcceptedEmail(quote: Quote, quoteNumber: string): EmailTemplateContent {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .success-box { background: #d1fae5; border: 2px solid #10b981; color: #047857; padding: 20px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Quote Accepted!</h1>
    </div>

    <div class="content">
      <div class="success-box">
        <h2 style="margin-top: 0;">Excellent news!</h2>
        <p>Quote #${quoteNumber} has been accepted.</p>
        <p><strong>Amount: $${quote.total.toFixed(2)}</strong></p>
      </div>

      <p>The customer has accepted your quote and is ready to proceed. Our team will be in touch to discuss next steps and finalize the order.</p>

      <h3>What Happens Next:</h3>
      <ol style="color: #666; line-height: 1.8;">
        <li>Order confirmation will be sent to the customer</li>
        <li>Production/delivery timeline will be provided</li>
        <li>Payment arrangements will be finalized</li>
      </ol>

      <p>Best regards,<br><strong>System Notification</strong></p>
    </div>
  </div>
</body>
</html>`

  const text = `Quote Accepted - #${quoteNumber}\n\nQuote #${quoteNumber} for $${quote.total.toFixed(
    2
  )} has been accepted by the customer.`

  return {
    subject: `Quote #${quoteNumber} Accepted!`,
    html,
    text,
  }
}

function generateQuoteDeclinedEmail(quote: Quote, quoteNumber: string): EmailTemplateContent {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Quote Declined</h1>
    </div>

    <div class="content">
      <p>Quote #${quoteNumber} has been declined by the customer.</p>
      <p><strong>Amount:</strong> $${quote.total.toFixed(2)}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>

      <p>Our team may follow up with the customer to understand their concerns and explore alternative solutions.</p>

      <p>Best regards,<br><strong>System Notification</strong></p>
    </div>
  </div>
</body>
</html>`

  const text = `Quote Declined - #${quoteNumber}\n\nQuote #${quoteNumber} for $${quote.total.toFixed(
    2
  )} has been declined by the customer.`

  return {
    subject: `Quote #${quoteNumber} Declined`,
    html,
    text,
  }
}
