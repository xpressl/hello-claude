# Task 24: Customer Quote View Page

## Objective
Create public customer-facing quote view page with token authentication, read-only display, PDF download, accept/decline actions, and view tracking.

## Context
- Customers access via unique token link
- No login required
- Professional read-only display
- Download PDF option
- Optional accept/decline buttons
- Track all views in events table

## Requirements

### 1. Token Generation

**File:** `pricing-tool/lib/quote-tokens.ts`

```typescript
import { createHash } from 'crypto'

export function generateQuoteToken(quoteId: string): string {
  const secret = process.env.QUOTE_TOKEN_SECRET!
  const hash = createHash('sha256')
    .update(`${quoteId}:${secret}`)
    .digest('hex')
  return hash.substring(0, 32)
}

export function verifyQuoteToken(quoteId: string, token: string): boolean {
  return generateQuoteToken(quoteId) === token
}
```

### 2. Public Quote View Page

**File:** `pricing-tool/app/quote/[id]/view/page.tsx`

```typescript
export default async function QuoteViewPage({
  params,
  searchParams
}: {
  params: { id: string }
  searchParams: { token: string }
}) {
  const { id } = params
  const { token } = searchParams

  // Verify token
  if (!verifyQuoteToken(id, token)) {
    return <ErrorPage message="Invalid quote link" />
  }

  // Fetch quote
  const quote = await fetchQuotePublic(id)

  // Track view
  await trackQuoteView(id, request.headers.get('user-agent'))

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Quote #{id.substring(0, 8)}</h1>
              <p className="text-gray-600 mt-2">For: {quote.customer_name}</p>
            </div>
            <QuoteStatusBadge status={quote.status} />
          </div>

          {/* Quote details */}
          <QuoteDetailsView quote={quote} />

          {/* Actions */}
          <div className="mt-8 flex gap-4">
            <button onClick={downloadPDF} className="btn btn-primary">
              <Download className="h-5 w-5 mr-2" />
              Download PDF
            </button>
            {quote.status === 'sent' && (
              <>
                <button onClick={handleAccept} className="btn btn-success">
                  <Check className="h-5 w-5 mr-2" />
                  Accept Quote
                </button>
                <button onClick={handleDecline} className="btn btn-secondary">
                  <X className="h-5 w-5 mr-2" />
                  Decline
                </button>
              </>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-semibold mb-4">Line Items</h2>
          <QuoteLineItemsTable lines={quote.lines} />

          {/* Totals */}
          <div className="mt-6 border-t pt-4">
            <div className="flex justify-between text-lg">
              <span>Subtotal:</span>
              <span>${quote.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>${quote.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-2xl font-bold mt-2">
              <span>Total:</span>
              <span>${quote.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="bg-white rounded-lg shadow-lg p-8 mt-6">
          <h3 className="text-lg font-semibold mb-3">Terms & Conditions</h3>
          <p className="text-sm text-gray-600">
            Valid until: {new Date(quote.expires_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}
```

### 3. View Tracking

**File:** `pricing-tool/lib/track-view.ts`

```typescript
export async function trackQuoteView(quoteId: string, userAgent: string | null) {
  await supabase.from('events').insert({
    quote_id: quoteId,
    event_type: 'quote_viewed',
    user_agent: userAgent,
    ip_address: request.headers.get('x-forwarded-for')
  })

  // Update quote view count
  await supabase.rpc('increment_view_count', { quote_id: quoteId })
}
```

### 4. Accept/Decline Actions

**File:** `pricing-tool/app/api/quote/[id]/action/route.ts`

```typescript
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { token, action } = await request.json() // action: 'accept' or 'decline'

  if (!verifyQuoteToken(params.id, token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Update quote status
  await supabase
    .from('quotes')
    .update({ status: action === 'accept' ? 'accepted' : 'declined' })
    .eq('id', params.id)

  // Log event
  await supabase.from('events').insert({
    quote_id: params.id,
    event_type: action === 'accept' ? 'quote_accepted' : 'quote_declined'
  })

  // Notify sales team
  if (action === 'accept') {
    await notifySalesTeam(params.id, 'Quote accepted!')
  }

  return NextResponse.json({ success: true })
}
```

## Files to Create
- `pricing-tool/lib/quote-tokens.ts`
- `pricing-tool/app/quote/[id]/view/page.tsx`
- `pricing-tool/lib/track-view.ts`
- `pricing-tool/app/api/quote/[id]/action/route.ts`

## Testing Requirements
1. Access quote with valid token
2. Reject access with invalid token
3. Track view events
4. Accept/decline quote
5. Download PDF

## Acceptance Criteria
- [ ] Token authentication works
- [ ] Quote displays read-only
- [ ] View tracking logs events
- [ ] PDF download works
- [ ] Accept/decline updates status
- [ ] Sales team notified
- [ ] Mobile responsive

## Dependencies
- Task 22 (PDF generation)
- Task 01 (quotes schema)

## Estimated Effort
4-5 hours

## Review Checklist
- [ ] Token generation secure
- [ ] No sensitive data exposed
- [ ] View tracking accurate
- [ ] Mobile layout tested
- [ ] Error states handled
- [ ] Expired quotes show warning
