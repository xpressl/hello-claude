'use client'

import { Lock } from 'lucide-react'
import type { Quote } from '@/lib/types'
import { formatStatus } from '@/lib/quote-status-machine'

export function QuoteLockIndicator({ quote }: { quote: Quote }) {
  const isLocked = ['sent', 'accepted', 'declined', 'expired'].includes(quote.status)

  if (!isLocked) return null

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-yellow-900">Quote Locked</h3>
          <p className="text-sm text-yellow-700 mt-1">
            This quote is in <strong>{formatStatus(quote.status)}</strong> status and cannot be edited.
            {quote.status === 'sent' && ' To make changes, move it back to "reviewed" status.'}
          </p>
        </div>
      </div>
    </div>
  )
}
