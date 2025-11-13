'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getAvailableTransitions, formatStatus, type QuoteStatus } from '@/lib/quote-status-machine'
import type { Quote } from '@/lib/types'

interface StatusTransitionButtonProps {
  quote: Quote
  userRole: 'ADMIN' | 'SALES' | 'MANAGER'
  onTransition: () => void
}

export function StatusTransitionButton({
  quote,
  userRole,
  onTransition
}: StatusTransitionButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<QuoteStatus | null>(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableTransitions = getAvailableTransitions(quote.status, userRole)

  const handleTransition = async () => {
    if (!selectedStatus) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/quotes/${quote.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedStatus,
          reason
        })
      })

      const data = await res.json()

      if (!data.success && data.error) {
        setError(data.error)
      } else if (data.success || res.ok) {
        setShowMenu(false)
        setSelectedStatus(null)
        setReason('')
        onTransition()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transition status')
    } finally {
      setLoading(false)
    }
  }

  if (availableTransitions.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="btn btn-secondary flex items-center gap-2"
      >
        <ChevronDown className="h-4 w-4" />
        Change Status
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Change Quote Status</h3>
            <p className="text-sm text-gray-500">Current: {formatStatus(quote.status)}</p>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">New Status</label>
              <div className="space-y-2">
                {availableTransitions.map(status => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value={status}
                      checked={selectedStatus === status}
                      onChange={() => setSelectedStatus(status)}
                      className="rounded-full"
                    />
                    <span className="text-sm">{formatStatus(status)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input w-full h-20"
                placeholder="Why is this status change being made?"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-2">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowMenu(false)
                  setError(null)
                }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleTransition}
                disabled={!selectedStatus || loading}
                className="btn btn-primary flex-1"
              >
                {loading ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
