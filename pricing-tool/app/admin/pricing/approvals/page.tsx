'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface PriceOverride {
  id: string
  quote_id: string
  original_price: number
  override_price: number
  discount_percent: number | null
  reason: string
  approval_status: string
  created_by?: string
  created_at: string
}

export default function ApprovalsPage() {
  const [overrides, setOverrides] = useState<PriceOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')

  useEffect(() => {
    fetchOverrides()
  }, [filter])

  async function fetchOverrides() {
    try {
      setLoading(true)
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const res = await fetch(`/api/pricing/overrides${params}`)
      if (!res.ok) throw new Error('Failed to fetch overrides')
      const data = await res.json()
      setOverrides(data.overrides || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading overrides')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(overrideId: string) {
    try {
      const res = await fetch('/api/pricing/overrides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideId,
          action: 'approved',
          notes: 'Approved'
        })
      })
      if (!res.ok) throw new Error('Failed to approve')
      fetchOverrides()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error approving override')
    }
  }

  async function handleReject(overrideId: string) {
    const notes = prompt('Rejection reason:')
    if (!notes) return

    try {
      const res = await fetch('/api/pricing/overrides', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideId,
          action: 'rejected',
          notes
        })
      })
      if (!res.ok) throw new Error('Failed to reject')
      fetchOverrides()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error rejecting override')
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading overrides...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Price Override Approvals</h1>
          <p className="mt-2 text-gray-600">
            Review and approve price override requests
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex gap-8">
          <Link
            href="/admin/pricing"
            className="px-4 py-3 border-b-2 border-transparent text-gray-600 hover:text-gray-900"
          >
            Price Lists
          </Link>
          <Link
            href="/admin/pricing/rules"
            className="px-4 py-3 border-b-2 border-transparent text-gray-600 hover:text-gray-900"
          >
            Pricing Rules
          </Link>
          <Link
            href="/admin/pricing/approvals"
            className="px-4 py-3 border-b-2 border-blue-600 text-blue-600 font-medium"
          >
            Price Overrides
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6 flex gap-4">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Overrides Table */}
      {overrides.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">No overrides found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quote ID</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Original</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Override</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {overrides.map(override => (
                <tr key={override.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/quotes/${override.quote_id}`}
                      className="font-medium text-blue-600 hover:text-blue-900"
                    >
                      {override.quote_id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    ${override.original_price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    ${override.override_price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-red-600 font-semibold">
                    {override.discount_percent ? `${override.discount_percent.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{override.reason}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusColor(override.approval_status)}`}>
                      {override.approval_status.charAt(0).toUpperCase() + override.approval_status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {override.approval_status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleApprove(override.id)}
                          className="text-green-600 hover:text-green-900 font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(override.id)}
                          className="text-red-600 hover:text-red-900 font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
