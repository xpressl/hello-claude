'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Quote } from '@/lib/types'
import { StatusBadge } from '@/components/StatusBadge'

interface QuoteHeaderProps {
  quote: Quote
}

export function QuoteHeader({ quote }: QuoteHeaderProps) {
  return (
    <div className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/quotes" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Quote #{quote.id.substring(0, 8)}
              </h1>
              <p className="text-sm text-gray-500">
                {quote.customer_name} • {quote.customer_email}
              </p>
            </div>

            <StatusBadge status={quote.status} />
          </div>
        </div>
      </div>
    </div>
  )
}
