# Phase 7: Quick Start Guide

## Overview

Phase 7 provides three main capabilities:
1. **PDF Generation** - Convert quotes to PDF files
2. **Email Service** - Send quotes via email
3. **Customer View** - Secure public quote viewing links

## Quick API Examples

### 1. Generate and Send Quote PDF

```typescript
// Generate PDF
const pdfResponse = await fetch(`/api/quotes/${quoteId}/pdf`, {
  method: 'POST'
})
const pdfData = await pdfResponse.json()
// Response: { success, quoteId, storagePath, downloadUrl, size }

// Send email with PDF
const emailResponse = await fetch(`/api/quotes/${quoteId}/send-email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    template: 'quote_sent'
  })
})
const emailData = await emailResponse.json()
// Response: { success, quoteId, template, emailId }
```

### 2. Generate Customer View Link

```typescript
import { generateQuoteViewUrl } from '@/lib/quote-tokens'

// In your quote creation/sending code:
const viewUrl = generateQuoteViewUrl(quoteId)
// Returns: http://localhost:3000/quote/[id]/view?token=[token]

// Send this URL to customer in email
// Customer can view quote without login
```

### 3. Handle Customer Actions

```typescript
// When customer clicks Accept or Decline on the quote view page
// Form automatically submits to:
// POST /api/quote/[id]/action
// Body: { token, action: 'accepted' | 'declined' }

// This automatically:
// - Updates quote status in database
// - Logs action event
// - Notifies sales team
// - Returns success response
```

## Integration Examples

### Example 1: Complete Quote Send Flow

```typescript
// In your quote submission handler
import { sendQuoteEmail } from '@/lib/email/send-email'
import { generateQuoteViewUrl } from '@/lib/quote-tokens'

async function sendQuoteToCustomer(quoteId: string) {
  try {
    // Generate customer view URL
    const viewUrl = generateQuoteViewUrl(quoteId)

    // Send email (generates PDF automatically)
    const result = await sendQuoteEmail(quoteId, 'quote_sent')

    if (result.success) {
      console.log(`Quote sent successfully with email ID: ${result.emailId}`)
      console.log(`Customer can view at: ${viewUrl}`)

      // Update quote status
      await updateQuoteStatus(quoteId, 'sent')
    } else {
      console.error(`Failed to send quote: ${result.error}`)
    }
  } catch (error) {
    console.error('Error sending quote:', error)
  }
}
```

### Example 2: Email Queue Processing

```typescript
// For periodic email processing (e.g., cron job)
import { processEmailQueue, retryFailedEmails, getQueueStats } from '@/lib/email/email-queue'

// Process pending emails every minute
setInterval(async () => {
  const processed = await processEmailQueue(10)

  if (processed > 0) {
    console.log(`Processed ${processed} emails`)
  }
}, 60000)

// Retry failed emails every 5 minutes
setInterval(async () => {
  const retried = await retryFailedEmails(5)

  if (retried > 0) {
    console.log(`Retried ${retried} failed emails`)
  }
}, 5 * 60000)

// Get queue statistics
async function checkQueueHealth() {
  const stats = await getQueueStats()
  console.log(`Queue stats:`, stats)
  // Output: { pending: 5, sent: 100, failed: 2, total: 107 }
}
```

### Example 3: Manual PDF Download

```typescript
// User clicks download button on quote view page
// Automatically handled by:
// <a href={`/api/quotes/${quoteId}/pdf`}>Download PDF</a>

// Or programmatically:
async function downloadQuotePDF(quoteId: string) {
  const response = await fetch(`/api/quotes/${quoteId}/pdf`)
  const blob = await response.blob()

  // Trigger download
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quote_${quoteId.substring(0, 8)}.pdf`
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
}
```

## Email Template Examples

### Sending Different Email Types

```typescript
import { sendQuoteEmail } from '@/lib/email/send-email'

// When quote is initially sent
await sendQuoteEmail(quoteId, 'quote_sent')

// When you want to notify about quote view
// (manually, not automatic)
await sendQuoteEmail(quoteId, 'quote_viewed')

// When quote is accepted by customer
// (also triggered automatically on action)
await sendQuoteEmail(quoteId, 'quote_accepted')

// When quote is declined by customer
// (also triggered automatically on action)
await sendQuoteEmail(quoteId, 'quote_declined')
```

## Environment Variables Setup

### Minimal Setup (Development)

```env
# Required for customer links to work
QUOTE_TOKEN_SECRET=dev-secret-key-change-in-production
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Full Setup (Production)

```env
# Quote tokens
QUOTE_TOKEN_SECRET=<your-secret-key>
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Email service
RESEND_API_KEY=re_your_api_key
FROM_EMAIL=quotes@your-domain.com
SALES_TEAM_EMAIL=sales@your-domain.com

# Storage
SUPABASE_STORAGE_BUCKET=quote-pdfs
```

## Testing

### Test PDF Generation

```bash
# Get a quote ID from your database
QUOTE_ID="<quote-id>"

# Generate PDF
curl -X POST http://localhost:3000/api/quotes/$QUOTE_ID/pdf

# Download PDF
curl http://localhost:3000/api/quotes/$QUOTE_ID/pdf \
  -o quote.pdf
```

### Test Email Sending

```bash
# Test sending quote email (will log to console if no API key)
curl -X POST http://localhost:3000/api/quotes/$QUOTE_ID/send-email \
  -H "Content-Type: application/json" \
  -d '{"template": "quote_sent"}'
```

### Test Customer View Link

```typescript
import { generateQuoteToken, generateQuoteViewUrl } from '@/lib/quote-tokens'

const quoteId = '<your-quote-id>'
const token = generateQuoteToken(quoteId)
const viewUrl = generateQuoteViewUrl(quoteId)

console.log(`View URL: ${viewUrl}`)
// Open in browser: http://localhost:3000/quote/[id]/view?token=[token]
```

## Common Tasks

### Task: Enable Email Notifications When Quote Status Changes

```typescript
// In your quote status update endpoint
import { sendQuoteEmail } from '@/lib/email/send-email'

async function updateQuoteStatus(quoteId: string, newStatus: string) {
  // Update in database
  const quote = await updateQuote(quoteId, { status: newStatus })

  // Send appropriate email
  if (newStatus === 'sent') {
    await sendQuoteEmail(quoteId, 'quote_sent')
  } else if (newStatus === 'accepted') {
    await sendQuoteEmail(quoteId, 'quote_accepted')
  } else if (newStatus === 'declined') {
    await sendQuoteEmail(quoteId, 'quote_declined')
  }
}
```

### Task: Display Quote View Link in Admin Dashboard

```typescript
import { generateQuoteViewUrl } from '@/lib/quote-tokens'

function QuoteRow({ quote }) {
  const viewUrl = generateQuoteViewUrl(quote.id)

  return (
    <tr>
      <td>{quote.id}</td>
      <td>{quote.customer_name}</td>
      <td>{quote.total}</td>
      <td>
        <a href={viewUrl} target="_blank" rel="noopener noreferrer">
          View Link
        </a>
      </td>
    </tr>
  )
}
```

### Task: Track Quote Interactions

```typescript
// Automatic tracking:
// 1. Customer opens quote view page -> quote_viewed event
// 2. Customer accepts quote -> quote_accepted event
// 3. Customer declines quote -> quote_declined event
// 4. Email opens -> email_opened event (via Resend webhook)
// 5. Email clicks -> email_clicked event (via Resend webhook)

// View all events for a quote:
const { data: events } = await supabase
  .from('events')
  .select('*')
  .eq('quote_id', quoteId)
  .order('created_at', { ascending: false })
```

## Troubleshooting

### Issue: PDF generation fails

**Solution:**
- Check quote exists in database
- Verify quote has valid line items
- Check Supabase storage bucket exists and is writable

### Issue: Emails not sending

**Solution:**
- Without RESEND_API_KEY: Check console logs (emails log to console in dev)
- With RESEND_API_KEY: Verify API key is correct
- Check email address is valid
- Check Supabase connection

### Issue: Customer can't access quote view

**Solution:**
- Verify token is correct (use `generateQuoteToken()`)
- Check URL format: `/quote/[id]/view?token=[token]`
- Verify quote exists in database
- Check `QUOTE_TOKEN_SECRET` matches on server

### Issue: Email bounces

**Solution:**
- Verify FROM_EMAIL is set correctly
- Check customer email is valid
- Review Resend webhook events for bounce reason
- In Resend dashboard, check sender authentication

## Next Steps

1. **Set environment variables** for your deployment
2. **Create email_queue table** in Supabase (if using queue features)
3. **Create quote-pdfs storage bucket** in Supabase
4. **Integrate with quote creation flow** to auto-send PDFs
5. **Add email sending triggers** in your quote management pages
6. **Set up Resend webhook** for delivery tracking (optional but recommended)
7. **Monitor events table** for quote interactions and email metrics

## API Reference

See `PHASE7_IMPLEMENTATION.md` for complete API documentation.

## Support

For questions or issues:
1. Check implementation logs in database events table
2. Review email templates in `lib/email/templates.ts`
3. Check Supabase logs for storage/database errors
4. Review Resend dashboard for email service issues
