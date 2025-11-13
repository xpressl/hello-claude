'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface PriceList {
  id: string
  name: string
  type: string
  priority: number
  is_active: boolean
  valid_from?: string
  valid_to?: string
  item_count?: number
}

export default function PricingPage() {
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPriceLists()
  }, [])

  async function fetchPriceLists() {
    try {
      setLoading(true)
      const res = await fetch('/api/pricing/lists')
      if (!res.ok) throw new Error('Failed to fetch price lists')
      const data = await res.json()
      setPriceLists(data.lists || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading price lists')
    } finally {
      setLoading(false)
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      base: 'Base',
      customer_segment: 'Customer Segment',
      promotional: 'Promotional',
      seasonal: 'Seasonal'
    }
    return labels[type] || type
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      base: 'bg-blue-100 text-blue-800',
      customer_segment: 'bg-green-100 text-green-800',
      promotional: 'bg-purple-100 text-purple-800',
      seasonal: 'bg-orange-100 text-orange-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading price lists...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pricing Management</h1>
            <p className="mt-2 text-gray-600">
              Manage price lists, pricing rules, and approvals
            </p>
          </div>
          <Link
            href="/admin/pricing/lists/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Price List
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex gap-8">
          <Link
            href="/admin/pricing"
            className="px-4 py-3 border-b-2 border-blue-600 text-blue-600 font-medium"
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
            className="px-4 py-3 border-b-2 border-transparent text-gray-600 hover:text-gray-900"
          >
            Price Overrides
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Price Lists Table */}
      {priceLists.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">No price lists yet</p>
          <Link
            href="/admin/pricing/lists/new"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Price List
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {priceLists.map(list => (
                <tr key={list.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{list.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${getTypeColor(list.type)}`}>
                      {getTypeLabel(list.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">{list.priority}</td>
                  <td className="px-6 py-4 text-center text-gray-600">{list.item_count || 0}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      list.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {list.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/pricing/lists/${list.id}`}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      Edit
                    </Link>
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
