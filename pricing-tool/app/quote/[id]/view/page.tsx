import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifyQuoteToken } from '@/lib/quote-tokens'
import { trackQuoteView } from '@/lib/track-view'
import { headers } from 'next/headers'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

/**
 * Public Quote View Page
 * Customers access their quotes via token-based links
 * No authentication required
 */

interface QuoteLine {
  id: string
  line_number: number
  description: string
  quantity: number
  unit: string
  options_json: Record<string, any> | null
  unit_price: number
  extended_price: number
}

interface Quote {
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
}

async function getQuoteData(
  quoteId: string
): Promise<{ quote: Quote; lines: QuoteLine[] } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // Fetch quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single()

    if (quoteError || !quote) {
      return null
    }

    // Fetch quote lines
    const { data: lines, error: linesError } = await supabase
      .from('quote_lines')
      .select('*')
      .eq('quote_id', quoteId)
      .order('line_number', { ascending: true })

    if (linesError) {
      return null
    }

    return {
      quote: quote as Quote,
      lines: (lines || []) as QuoteLine[],
    }
  } catch (error) {
    console.error('Error fetching quote:', error)
    return null
  }
}

async function trackView(quoteId: string): Promise<void> {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || null
  const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null

  await trackQuoteView(quoteId, userAgent, ipAddress)
}

export default async function QuoteViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { id: quoteId } = await params
  const { token } = await searchParams

  // Verify token
  if (!token || !verifyQuoteToken(quoteId, token)) {
    notFound()
  }

  // Fetch quote data
  const data = await getQuoteData(quoteId)
  if (!data) {
    notFound()
  }

  const { quote, lines } = data

  // Track view
  await trackView(quoteId)

  const quoteNumber = quoteId.substring(0, 8).toUpperCase()
  const isExpired = quote.expires_at && new Date(quote.expires_at) < new Date()
  const expiresDate = quote.expires_at
    ? new Date(quote.expires_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'N/A'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quote #{quoteNumber}</h1>
              <p className="text-sm text-gray-600 mt-1">
                For: <span className="font-medium">{quote.customer_name || 'N/A'}</span>
              </p>
            </div>
            <div className="text-right">
              <div
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  isExpired
                    ? 'bg-red-100 text-red-800'
                    : quote.status === 'sent'
                      ? 'bg-blue-100 text-blue-800'
                      : quote.status === 'accepted'
                        ? 'bg-green-100 text-green-800'
                        : quote.status === 'declined'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {isExpired ? 'EXPIRED' : quote.status.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Expiry Warning */}
        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">
              <strong>This quote has expired.</strong> Valid until: {expiresDate}
            </p>
          </div>
        )}

        {/* Quote Details Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Customer</p>
              <p className="text-lg font-semibold text-gray-900">{quote.customer_name || 'N/A'}</p>
              {quote.customer_email && (
                <p className="text-sm text-gray-600">{quote.customer_email}</p>
              )}
              {quote.customer_phone && (
                <p className="text-sm text-gray-600">{quote.customer_phone}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Quote Details</p>
              <p className="text-sm text-gray-900">
                <span className="text-gray-600">Created:</span>{' '}
                {new Date(quote.created_at).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-900">
                <span className="text-gray-600">Expires:</span> {expiresDate}
              </p>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="px-8 py-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900">Quote Items</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">
                    #
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">
                    Description
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase">
                    Qty
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase">
                    Unit Price
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase">
                    Extended
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{line.line_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{line.description}</div>
                      {line.options_json && Object.keys(line.options_json).length > 0 && (
                        <div className="mt-1 text-xs text-gray-600">
                          {Object.entries(line.options_json)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-center">
                      {line.quantity} {line.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-mono">
                      ${line.unit_price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right font-mono">
                      ${line.extended_price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-200">
            <div className="space-y-2 text-right">
              <div className="flex justify-end gap-12">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-mono">${quote.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-12">
                <span className="text-gray-600">Tax:</span>
                <span className="font-mono">${quote.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-end gap-12 pt-2 border-t border-gray-200">
                <span className="text-lg font-semibold text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-gray-900 font-mono">
                  ${quote.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• This quote is valid for 14 days from the date shown above</li>
            <li>• Payment terms: Net 30 upon receipt of invoice</li>
            <li>• Delivery: 2-3 weeks from order confirmation</li>
            <li>• All prices are in {quote.currency}</li>
            <li>• Prices subject to change pending final confirmation</li>
            <li>• All sales final. Returns not accepted after 14 days</li>
          </ul>
        </div>

        {/* Actions */}
        {!isExpired && quote.status === 'sent' && (
          <QuoteActions quoteId={quoteId} token={token || ''} />
        )}

        {/* Download PDF Button */}
        <div className="flex justify-center">
          <a
            href={`/api/quotes/${quoteId}/pdf`}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download PDF
          </a>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
          <p>If you have any questions about this quote, please contact us.</p>
          <p className="mt-2">
            <span className="font-medium">Email:</span> sales@company.com |{' '}
            <span className="font-medium">Phone:</span> (555) 123-4567
          </p>
        </div>
      </main>
    </div>
  )
}

/**
 * Quote Actions Component
 * Allows customers to accept or decline quotes
 */
function QuoteActions({
  quoteId,
  token,
}: {
  quoteId: string
  token: string
}): JSX.Element {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">What Would You Like To Do?</h3>
      <div className="flex flex-col sm:flex-row gap-4">
        <form action={`/api/quote/${quoteId}/action`} method="POST" className="flex-1">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="action" value="accepted" />
          <button
            type="submit"
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center justify-center"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Accept Quote
          </button>
        </form>

        <form action={`/api/quote/${quoteId}/action`} method="POST" className="flex-1">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="action" value="declined" />
          <button
            type="submit"
            className="w-full px-6 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 font-medium transition-colors flex items-center justify-center"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Decline Quote
          </button>
        </form>
      </div>
    </div>
  )
}
