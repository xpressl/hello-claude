# Task 23: Email Service Integration

## Objective
Integrate Resend email service for sending quotes with tracking, templates, attachments, and retry logic.

## Context
- Send professional emails when quote status changes
- Attach PDF quotes
- Track email opens and views
- Use templates for consistency
- Retry failed sends
- Unsubscribe handling

## Requirements

### 1. Resend Setup

**Install Resend:**
```bash
npm install resend
```

**Environment:**
```
RESEND_API_KEY=re_...
FROM_EMAIL=quotes@company.com
```

### 2. Email Templates

**File:** `pricing-tool/lib/email/templates.ts`

```typescript
export const quoteEmailTemplates = {
  quote_sent: {
    subject: (quote: Quote) => `Your Quote #${quote.id.substring(0, 8)} is Ready`,
    html: (quote: Quote, viewUrl: string) => `
      <h1>Your Quote is Ready</h1>
      <p>Hi ${quote.customer_name},</p>
      <p>Thank you for your interest. Your quote is attached.</p>
      <p><strong>Total: $${quote.total.toFixed(2)}</strong></p>
      <p><a href="${viewUrl}">View Quote Online</a></p>
      <p>Valid until: ${new Date(quote.expires_at).toLocaleDateString()}</p>
    `
  },
  quote_viewed: {
    subject: () => 'Your quote was viewed',
    html: (quote: Quote) => `Quote #${quote.id} was viewed`
  },
  quote_accepted: {
    subject: (quote: Quote) => `Quote #${quote.id.substring(0, 8)} Accepted!`,
    html: (quote: Quote) => `
      <h1>Great News!</h1>
      <p>${quote.customer_name} accepted your quote.</p>
      <p>Total: $${quote.total.toFixed(2)}</p>
    `
  }
}
```

### 3. Send Email Function

**File:** `pricing-tool/lib/email/send-email.ts`

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendQuoteEmail(
  quoteId: string,
  template: 'quote_sent' | 'quote_viewed' | 'quote_accepted'
): Promise<{ success: boolean; emailId?: string }> {
  const quote = await fetchQuote(quoteId)
  const pdfPath = await generateQuotePDF(quoteId)
  const pdfData = await fetchPDFData(pdfPath)

  const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/quote/${quoteId}/view?token=${generateToken(quoteId)}`

  const emailTemplate = quoteEmailTemplates[template]

  try {
    const { id } = await resend.emails.send({
      from: process.env.FROM_EMAIL!,
      to: quote.customer_email,
      subject: emailTemplate.subject(quote),
      html: emailTemplate.html(quote, viewUrl),
      attachments: template === 'quote_sent' ? [
        {
          filename: `quote_${quoteId.substring(0, 8)}.pdf`,
          content: pdfData
        }
      ] : [],
      tags: [
        { name: 'quote_id', value: quoteId },
        { name: 'template', value: template }
      ]
    })

    // Log email sent event
    await logEmailEvent(quoteId, template, id)

    return { success: true, emailId: id }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false }
  }
}

async function logEmailEvent(quoteId: string, template: string, emailId: string) {
  await supabase.from('events').insert({
    quote_id: quoteId,
    event_type: 'email_sent',
    payload_json: { template, emailId }
  })
}
```

### 4. Webhook Handler for Tracking

**File:** `pricing-tool/app/api/webhooks/resend/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json()

  // Handle email events: delivered, opened, clicked, bounced
  if (body.type === 'email.opened') {
    await supabase.from('events').insert({
      quote_id: body.data.tags.quote_id,
      event_type: 'email_opened',
      payload_json: { emailId: body.data.email_id }
    })
  }

  return NextResponse.json({ received: true })
}
```

### 5. Retry Logic

**File:** `pricing-tool/lib/email/email-queue.ts`

```typescript
export async function queueEmail(quoteId: string, template: string) {
  await supabase.from('email_queue').insert({
    quote_id: quoteId,
    template,
    status: 'pending',
    retry_count: 0
  })
}

export async function processEmailQueue() {
  const { data: emails } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('retry_count', 3)
    .limit(10)

  for (const email of emails) {
    const result = await sendQuoteEmail(email.quote_id, email.template)

    if (result.success) {
      await supabase.from('email_queue').update({ status: 'sent' }).eq('id', email.id)
    } else {
      await supabase.from('email_queue')
        .update({ retry_count: email.retry_count + 1 })
        .eq('id', email.id)
    }
  }
}
```

## Files to Create
- `pricing-tool/lib/email/templates.ts`
- `pricing-tool/lib/email/send-email.ts`
- `pricing-tool/lib/email/email-queue.ts`
- `pricing-tool/app/api/webhooks/resend/route.ts`

## Testing Requirements
1. Send test email with PDF attachment
2. Verify email opens tracked
3. Test retry logic for failures
4. Check unsubscribe links

## Acceptance Criteria
- [ ] Emails sent successfully
- [ ] PDF attached correctly
- [ ] Templates render properly
- [ ] Tracking pixels work
- [ ] Retry logic functions
- [ ] Webhooks process events

## Dependencies
- Task 22 (PDF generation)
- Resend account

## Estimated Effort
4-5 hours

## Review Checklist
- [ ] API key secured
- [ ] Templates mobile-responsive
- [ ] Unsubscribe link included
- [ ] Retry exponential backoff
- [ ] Error logging comprehensive
- [ ] Webhook signature verified
