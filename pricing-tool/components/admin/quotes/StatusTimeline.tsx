'use client'

import { Check } from 'lucide-react'
import type { Quote } from '@/lib/types'
import { formatStatus, type QuoteStatus } from '@/lib/quote-status-machine'

function formatDateTime(date: string | null): string {
  if (!date) return ''
  try {
    return new Date(date).toLocaleString()
  } catch {
    return date
  }
}

export function StatusTimeline({ quote }: { quote: Quote }) {
  const statuses: Array<{ status: QuoteStatus; timestamp?: string }> = [
    { status: 'draft', timestamp: quote.created_at },
    { status: 'submitted', timestamp: quote.submitted_at || undefined },
    { status: 'reviewed', timestamp: undefined },
    { status: 'sent', timestamp: quote.sent_at || undefined },
    {
      status: quote.status === 'accepted' ? 'accepted' :
              quote.status === 'declined' ? 'declined' :
              quote.status === 'expired' ? 'expired' : undefined as unknown as QuoteStatus,
      timestamp: quote.expires_at
    }
  ].filter((s): s is { status: QuoteStatus; timestamp?: string } => s.status !== undefined)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Status History</h3>

      <div className="space-y-4">
        {statuses.map((item, index) => {
          const isActive = quote.status === item.status
          const isPast = statuses.findIndex(s => s.status === quote.status) > index

          return (
            <div key={item.status} className="flex items-center gap-4">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isPast ? 'bg-green-500' :
                  isActive ? 'bg-blue-500' :
                  'bg-gray-300'
                }`}
              >
                {isPast && <Check className="h-6 w-6 text-white" />}
                {isActive && <div className="h-3 w-3 bg-white rounded-full" />}
              </div>

              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  isPast || isActive ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {formatStatus(item.status)}
                </p>
                {item.timestamp && (
                  <p className="text-xs text-gray-500">
                    {formatDateTime(item.timestamp)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
