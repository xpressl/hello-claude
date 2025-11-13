'use client'

import { useState } from 'react'
import { Check, X, AlertCircle } from 'lucide-react'

interface PriceOverride {
  id: string
  quote_id: string
  original_price: number
  override_price: number
  discount_percent: number
  reason: string | null
  approval_status: string
  approval_requested_at: string
  approval_expires_at: string | null
  created_by: string | null
  created_at: string
}

interface ApprovalRowProps {
  approval: PriceOverride
  onApprovalChange: () => void
}

function formatRelativeTime(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'approved':
      return 'bg-green-100 text-green-800'
    case 'rejected':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export default function ApprovalRow({
  approval,
  onApprovalChange
}: ApprovalRowProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const discountColor = approval.discount_percent >= 20 ? 'text-red-600' :
                       approval.discount_percent >= 10 ? 'text-yellow-600' : 'text-green-600'

  const isExpiring = approval.approval_expires_at &&
    new Date(approval.approval_expires_at) < new Date(Date.now() + 24 * 60 * 60 * 1000)

  const handleApprove = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/approvals/${approval.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', notes })
      })

      if (res.ok) {
        setShowDetails(false)
        onApprovalChange()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to approve')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/approvals/${approval.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', notes })
      })

      if (res.ok) {
        setShowDetails(false)
        onApprovalChange()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to reject')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <tr className={approval.approval_status === 'pending' ? '' : 'bg-gray-50'}>
        <td className="px-6 py-4">
          <div className="text-sm font-medium text-gray-900">
            {approval.quote_id.substring(0, 8)}
          </div>
        </td>
        <td className="px-6 py-4 text-right text-sm text-gray-900">
          ${approval.original_price.toFixed(2)}
        </td>
        <td className="px-6 py-4 text-right text-sm text-gray-900">
          ${approval.override_price.toFixed(2)}
        </td>
        <td className="px-6 py-4 text-right">
          <span className={`text-sm font-medium ${discountColor}`}>
            {approval.discount_percent > 0 ? '+' : ''}{approval.discount_percent.toFixed(1)}%
          </span>
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {formatRelativeTime(approval.created_at)}
          {isExpiring && (
            <div className="flex items-center gap-1 text-orange-600 mt-1">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs">Expiring soon</span>
            </div>
          )}
        </td>
        <td className="px-6 py-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(approval.approval_status)}`}>
            {approval.approval_status}
          </span>
        </td>
        <td className="px-6 py-4 text-right">
          {approval.approval_status === 'pending' ? (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
            >
              Review
            </button>
          ) : (
            <span className="text-sm text-gray-500">Completed</span>
          )}
        </td>
      </tr>

      {showDetails && (
        <tr>
          <td colSpan={7} className="px-6 py-4 bg-gray-50 border-t">
            <div className="space-y-4">
              {approval.reason && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
                  <p className="text-sm text-gray-600">{approval.reason}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approval Notes (optional):
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20"
                  placeholder="Add comments about this approval..."
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDetails(false)
                    setError(null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
