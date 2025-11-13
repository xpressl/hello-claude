'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Quote } from '@/lib/types'
import { QuoteHeader } from './QuoteHeader'
import { QuoteLockIndicator } from './QuoteLockIndicator'
import { StatusTimeline } from './StatusTimeline'
import { StatusTransitionButton } from './StatusTransitionButton'
import { InternalNotesPanel } from './InternalNotesPanel'

interface QuoteDetailClientProps {
  quote: Quote
  userRole: 'ADMIN' | 'SALES' | 'MANAGER'
  userId: string
}

export default function QuoteDetailClient({
  quote: initialQuote,
  userRole,
  userId
}: QuoteDetailClientProps) {
  const [quote, setQuote] = useState(initialQuote)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleTransition = () => {
    setRefreshKey(k => k + 1)
    // Refetch quote data
    fetch(`/api/quotes/${quote.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.quote) {
          setQuote(data.quote)
        }
      })
      .catch(console.error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/quotes"
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Quote #{quote.id.substring(0, 8)}
                </h1>
                <p className="text-sm text-gray-500">
                  {quote.customer_name || 'No customer'} • {quote.customer_email || 'No email'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusTransitionButton
                quote={quote}
                userRole={userRole}
                onTransition={handleTransition}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <QuoteLockIndicator quote={quote} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Summary */}
          <div className="lg:col-span-1">
            <StatusTimeline key={refreshKey} quote={quote} />
          </div>

          {/* Right: Notes and pricing */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {/* Pricing Summary */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Pricing Summary</h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">${quote.subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">${quote.tax.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold text-lg">${quote.total.toFixed(2)}</span>
                  </div>
                </div>

                {quote.margin_percent && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Margin</span>
                      <span className={`font-medium ${quote.margin_percent > 20 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {quote.margin_percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Info */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Customer Details</h3>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-600">Name</p>
                    <p className="font-medium">{quote.customer_name || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Email</p>
                    <p className="font-medium">{quote.customer_email || 'Not specified'}</p>
                  </div>
                  {quote.customer_phone && (
                    <div>
                      <p className="text-gray-600">Phone</p>
                      <p className="font-medium">{quote.customer_phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Internal Notes */}
              <InternalNotesPanel quoteId={quote.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
