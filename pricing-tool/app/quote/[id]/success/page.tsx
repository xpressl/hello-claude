import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { formatCurrency, formatQuoteId } from "@/lib/format"

// Create Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

interface QuoteLine {
  id: string
  line_number: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  extended_price: number
}

interface Quote {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  status: string
  total_amount: number
  created_at: string
}

async function getQuote(id: string): Promise<{ quote: Quote; lines: QuoteLine[] } | null> {
  const supabase = getSupabaseClient()

  try {
    // Fetch quote
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", id)
      .single()

    if (quoteError || !quote) {
      return null
    }

    // Fetch quote lines
    const { data: lines, error: linesError } = await supabase
      .from("quote_lines")
      .select("*")
      .eq("quote_id", id)
      .order("line_number", { ascending: true })

    if (linesError) {
      return null
    }

    return {
      quote: quote as Quote,
      lines: (lines || []) as QuoteLine[],
    }
  } catch (error) {
    console.error("Error fetching quote:", error)
    return null
  }
}

export default async function QuoteSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getQuote(id)

  if (!result) {
    notFound()
  }

  const { quote, lines } = result

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Quote Submitted</h1>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-semibold text-green-900 mb-2">
                Thank You for Your Quote Request!
              </h2>
              <p className="text-green-800 mb-2">
                Your quote has been successfully submitted and is being reviewed by our team.
              </p>
              <p className="text-green-700 text-sm">
                We typically review quotes within 24 business hours and will send a response to{" "}
                <span className="font-medium">{quote.customer_email}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Quote Details */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Quote Details</h3>
          </div>
          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Quote ID</dt>
                <dd className="mt-1 text-lg font-mono text-gray-900">
                  {formatQuoteId(quote.id)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    {quote.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Customer Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{quote.customer_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{quote.customer_email}</dd>
              </div>
              {quote.customer_phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{quote.customer_phone}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Extended
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {line.line_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {line.description}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      {line.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {line.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      {formatCurrency(line.unit_price)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(line.extended_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-4 text-right text-sm font-semibold text-gray-900"
                  >
                    Total:
                  </td>
                  <td className="px-6 py-4 text-right text-lg font-bold text-gray-900">
                    {formatCurrency(quote.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">What Happens Next?</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Our team will review your quote request within 24 business hours</li>
            <li>We'll verify product availability and pricing</li>
            <li>You'll receive an email with the finalized quote and next steps</li>
            <li>If you have any questions, you can reply to that email directly</li>
          </ol>
        </div>

        {/* Contact Information */}
        <div className="bg-gray-100 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Need Help?</h3>
          <p className="text-gray-700 mb-2">
            If you have any questions about your quote, please don't hesitate to contact us:
          </p>
          <ul className="space-y-1 text-gray-700">
            <li>
              <span className="font-medium">Email:</span> sales@company.com
            </li>
            <li>
              <span className="font-medium">Phone:</span> (555) 123-4567
            </li>
            <li>
              <span className="font-medium">Hours:</span> Monday-Friday, 9am-5pm EST
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/quote/new"
            className="flex-1 px-6 py-3 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            Create Another Quote
          </Link>
          <Link
            href="/"
            className="flex-1 px-6 py-3 bg-white text-gray-700 text-center rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            Back to Home
          </Link>
        </div>

        {/* Reference Number Notice */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Please save your quote ID <span className="font-mono font-medium">{formatQuoteId(quote.id)}</span> for reference
          </p>
        </div>
      </main>
    </div>
  )
}
