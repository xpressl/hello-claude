# Task 22: PDF Quote Generation

## Objective
Implement professional PDF quote generation with customizable branding, detailed line items, terms and conditions, and version watermarks using Puppeteer.

## Context
- Generate professional PDF from quote data
- Include company branding, logo, contact info
- Line items table with options clearly displayed
- Terms and conditions footer
- Version watermark for drafts
- Save PDFs to storage for email attachment

## Requirements

### 1. PDF Template System

**Install Puppeteer:**
```bash
npm install puppeteer
npm install --save-dev @types/puppeteer
```

**File:** `pricing-tool/lib/pdf/quote-template.ts`

```typescript
export function generateQuoteHTML(quote: Quote): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .company-info { font-size: 14px; }
        .quote-info { text-align: right; }
        .quote-number { font-size: 24px; font-weight: bold; color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; }
        td { padding: 10px; border-bottom: 1px solid #e9ecef; }
        .total-row { font-weight: bold; font-size: 18px; }
        .terms { margin-top: 40px; font-size: 12px; color: #666; }
        ${quote.status !== 'sent' ? '.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; color: rgba(255,0,0,0.1); z-index: -1; }' : ''}
      </style>
    </head>
    <body>
      ${quote.status !== 'sent' ? '<div class="watermark">DRAFT</div>' : ''}

      <div class="header">
        <div class="company-info">
          <h1>Your Company</h1>
          <p>123 Business St<br>City, State 12345<br>Phone: (555) 123-4567<br>Email: sales@company.com</p>
        </div>
        <div class="quote-info">
          <div class="quote-number">Quote #${quote.id.substring(0, 8)}</div>
          <p>Date: ${new Date().toLocaleDateString()}<br>
          Valid Until: ${quote.expires_at ? new Date(quote.expires_at).toLocaleDateString() : 'N/A'}</p>
        </div>
      </div>

      <div class="customer-info">
        <h3>Quote For:</h3>
        <p><strong>${quote.customer_name}</strong><br>
        ${quote.customer_email}<br>
        ${quote.customer_phone || ''}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Extended</th>
          </tr>
        </thead>
        <tbody>
          ${quote.lines.map((line, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>
                ${line.description}
                ${line.options_json ? '<br><small>' + Object.entries(line.options_json).map(([k, v]) => `${k}: ${v}`).join(', ') + '</small>' : ''}
              </td>
              <td>${line.quantity} ${line.unit}</td>
              <td>$${line.unit_price.toFixed(2)}</td>
              <td>$${line.extended_price.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="4" style="text-align: right;">Subtotal:</td><td>$${quote.subtotal.toFixed(2)}</td></tr>
          <tr><td colspan="4" style="text-align: right;">Tax:</td><td>$${quote.tax.toFixed(2)}</td></tr>
          <tr class="total-row"><td colspan="4" style="text-align: right;">Total:</td><td>$${quote.total.toFixed(2)}</td></tr>
        </tfoot>
      </table>

      <div class="terms">
        <h4>Terms & Conditions</h4>
        <p>1. Quote valid for 14 days<br>
        2. Payment terms: Net 30<br>
        3. Delivery: 2-3 weeks from order<br>
        4. All sales final</p>
      </div>
    </body>
    </html>
  `
}
```

### 2. PDF Generation Function

**File:** `pricing-tool/lib/pdf/generate-pdf.ts`

```typescript
import puppeteer from 'puppeteer'
import { generateQuoteHTML } from './quote-template'

export async function generateQuotePDF(quoteId: string): Promise<string> {
  // Fetch quote data
  const quote = await fetchQuote(quoteId)

  // Generate HTML
  const html = generateQuoteHTML(quote)

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setContent(html)

  // Generate PDF
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
  })

  await browser.close()

  // Upload to storage
  const filename = `quote_${quoteId}_${Date.now()}.pdf`
  const storagePath = `quotes/${quoteId}/${filename}`

  await supabase.storage
    .from('quote-pdfs')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf' })

  return storagePath
}
```

### 3. API Route

**File:** `pricing-tool/app/api/quotes/[id]/pdf/route.ts`

```typescript
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const pdfPath = await generateQuotePDF(params.id)
  return NextResponse.json({ pdfPath })
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  // Stream PDF download
  const { data } = await supabase.storage.from('quote-pdfs').download(pdfPath)
  return new NextResponse(data, {
    headers: { 'Content-Type': 'application/pdf' }
  })
}
```

## Files to Create
- `pricing-tool/lib/pdf/quote-template.ts`
- `pricing-tool/lib/pdf/generate-pdf.ts`
- `pricing-tool/app/api/quotes/[id]/pdf/route.ts`

## Testing Requirements
1. Generate PDF for quote with line items
2. Verify branding displays correctly
3. Test watermark on draft quotes
4. Download generated PDF

## Acceptance Criteria
- [ ] PDF generated with professional layout
- [ ] Line items display with options
- [ ] Totals calculated correctly
- [ ] Watermark on non-sent quotes
- [ ] PDF saved to storage
- [ ] Download works

## Dependencies
- Task 01 (quotes schema)
- Puppeteer library

## Estimated Effort
4-5 hours

## Review Checklist
- [ ] PDF template matches brand guidelines
- [ ] All quote data included
- [ ] Layout responsive to content length
- [ ] Puppeteer process terminated properly
- [ ] Storage paths organized
- [ ] Performance acceptable (< 5s generation)
