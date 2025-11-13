'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import ApprovalRow from './ApprovalRow'

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

interface ApprovalsClientProps {
  userRole: 'ADMIN' | 'SALES' | 'MANAGER'
}

export default function ApprovalsClient({ userRole }: ApprovalsClientProps) {
  const [approvals, setApprovals] = useState<PriceOverride[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApprovals()
  }, [filter])

  async function fetchApprovals() {
    setLoading(true)
    try {
      const res = await fetch(`/api/approvals?status=${filter}`)
      const data = await res.json()
      setApprovals(data.approvals || [])
    } catch (err) {
      console.error('Failed to fetch approvals:', err)
    } finally {
      setLoading(false)
    }
  }

  const pendingCount = approvals.filter(a => a.approval_status === 'pending').length

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Queue</h1>
          <p className="text-gray-600">Review and approve price override requests</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <p>Loading approvals...</p>
          </div>
        ) : approvals.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Clock className="h-12 w-12 mx-auto mb-2" />
            <p className="text-sm">No approvals to show</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quote ID
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Original
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Override
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Discount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Requested
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {approvals.map(approval => (
                <ApprovalRow
                  key={approval.id}
                  approval={approval}
                  onApprovalChange={() => fetchApprovals()}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
