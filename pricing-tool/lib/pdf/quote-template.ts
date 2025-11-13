/**
 * PDF Quote Template
 * Generates HTML for PDF rendering with professional formatting
 */

export interface QuoteData {
  id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  status: string
  currency: string
  subtotal: number
  tax: number
  total: number
  created_at: string
  expires_at: string | null
  lines: Array<{
    description: string
    quantity: number
    unit: string
    options_json?: Record<string, any> | null
    unit_price: number
    extended_price: number
  }>
}

export function generateQuoteHTML(quote: QuoteData): string {
  const isDraft = quote.status !== 'sent'
  const createdDate = new Date(quote.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const expiresDate = quote.expires_at
    ? new Date(quote.expires_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A'

  const quoteNumber = quote.id.substring(0, 8).toUpperCase()

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quote #${quoteNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      color: #333;
      line-height: 1.6;
      padding: 40px;
      background: white;
    }

    .page {
      max-width: 8.5in;
      height: auto;
      margin: 0 auto;
      padding: 40px;
    }

    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 100px;
      font-weight: bold;
      color: rgba(255, 0, 0, 0.08);
      z-index: 0;
      white-space: nowrap;
      pointer-events: none;
    }

    .content {
      position: relative;
      z-index: 1;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 20px;
    }

    .company-info h1 {
      font-size: 24px;
      color: #1a1a1a;
      margin-bottom: 10px;
    }

    .company-info p {
      font-size: 13px;
      color: #666;
      line-height: 1.8;
    }

    .quote-info {
      text-align: right;
    }

    .quote-number {
      font-size: 28px;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 5px;
      font-family: 'Courier New', monospace;
    }

    .quote-meta {
      font-size: 13px;
      color: #666;
      line-height: 1.8;
    }

    .customer-section {
      margin-bottom: 30px;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 4px;
    }

    .customer-section h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .customer-section p {
      font-size: 13px;
      margin-bottom: 5px;
      color: #333;
    }

    .customer-name {
      font-weight: 600;
      font-size: 14px;
      color: #1a1a1a;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
      font-size: 13px;
    }

    thead {
      background: #f8f8f8;
      border-top: 1px solid #ddd;
      border-bottom: 2px solid #333;
    }

    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #333;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid #eee;
    }

    tbody tr:last-child td {
      border-bottom: 1px solid #ddd;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    .amount {
      font-family: 'Courier New', monospace;
      font-weight: 500;
    }

    .line-options {
      font-size: 11px;
      color: #999;
      margin-top: 4px;
      font-style: italic;
    }

    tfoot tr:first-child td {
      border-top: 2px solid #333;
      padding-top: 16px;
      font-weight: 600;
    }

    .total-row td {
      border-top: 2px solid #333;
      border-bottom: none;
      padding: 16px 12px;
      font-size: 14px;
      font-weight: 700;
    }

    .total-row .amount {
      font-size: 18px;
    }

    .terms-section {
      margin-top: 40px;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 4px;
      font-size: 12px;
      color: #666;
      line-height: 1.8;
    }

    .terms-section h4 {
      font-size: 13px;
      font-weight: 600;
      color: #333;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .terms-section ol {
      margin-left: 20px;
    }

    .terms-section li {
      margin-bottom: 6px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 11px;
      color: #999;
      text-align: center;
    }

    @media print {
      body {
        padding: 0;
      }
      .page {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  ${isDraft ? '<div class="watermark">DRAFT</div>' : ''}

  <div class="page">
    <div class="content">
      <!-- Header -->
      <div class="header">
        <div class="company-info">
          <h1>Professional Pricing Quote</h1>
          <p>123 Business Street<br>City, State 12345<br>Phone: (555) 123-4567<br>Email: sales@company.com</p>
        </div>
        <div class="quote-info">
          <div class="quote-number">Quote #${quoteNumber}</div>
          <div class="quote-meta">
            <div>Date: ${createdDate}</div>
            <div>Valid Until: ${expiresDate}</div>
            <div style="margin-top: 8px; font-size: 12px;">Status: <strong>${quote.status.toUpperCase()}</strong></div>
          </div>
        </div>
      </div>

      <!-- Customer Info -->
      <div class="customer-section">
        <h3>Quote For</h3>
        <p class="customer-name">${quote.customer_name || 'N/A'}</p>
        ${quote.customer_email ? `<p>${quote.customer_email}</p>` : ''}
        ${quote.customer_phone ? `<p>${quote.customer_phone}</p>` : ''}
      </div>

      <!-- Line Items Table -->
      <table>
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th style="width: 50%">Description</th>
            <th style="width: 15%; text-align: center;">Qty</th>
            <th style="width: 15%; text-align: right;">Unit Price</th>
            <th style="width: 15%; text-align: right;">Extended</th>
          </tr>
        </thead>
        <tbody>
          ${quote.lines
            .map(
              (line, i) => `
            <tr>
              <td class="text-center">${i + 1}</td>
              <td>
                ${line.description}
                ${
                  line.options_json && Object.keys(line.options_json).length > 0
                    ? `<div class="line-options">${Object.entries(line.options_json)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ')}</div>`
                    : ''
                }
              </td>
              <td class="text-center">${line.quantity} ${line.unit}</td>
              <td class="amount text-right">$${line.unit_price.toFixed(2)}</td>
              <td class="amount text-right">$${line.extended_price.toFixed(2)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align: right; border-top: 1px solid #ddd;">Subtotal:</td>
            <td class="amount text-right">$${quote.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="text-align: right;">Tax (${quote.currency}):</td>
            <td class="amount text-right">$${quote.tax.toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td colspan="4" style="text-align: right;">Total:</td>
            <td class="amount text-right">$${quote.total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Terms & Conditions -->
      <div class="terms-section">
        <h4>Terms & Conditions</h4>
        <ol>
          <li>This quote is valid for 14 days from the date listed above</li>
          <li>Payment terms: Net 30 upon receipt of invoice</li>
          <li>Delivery: 2-3 weeks from order confirmation</li>
          <li>All prices are in ${quote.currency} USD</li>
          <li>Prices subject to change pending final confirmation</li>
          <li>All sales final. Returns not accepted after 14 days</li>
        </ol>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>This is a professional quote document. For questions, contact sales@company.com</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}
