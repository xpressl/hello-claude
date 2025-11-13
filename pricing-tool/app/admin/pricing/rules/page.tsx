'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface PriceRule {
  id: string
  name: string
  rule_type: string
  adjustment_value: number
  scope: string
  priority: number
  is_active: boolean
  valid_from?: string
  valid_to?: string
}

export default function PricingRulesPage() {
  const [rules, setRules] = useState<PriceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRules()
  }, [])

  async function fetchRules() {
    try {
      setLoading(true)
      const res = await fetch('/api/pricing/rules')
      if (!res.ok) throw new Error('Failed to fetch rules')
      const data = await res.json()
      setRules(data.rules || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading rules')
    } finally {
      setLoading(false)
    }
  }

  const getRuleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      percentage: 'Percentage',
      fixed_amount: 'Fixed Amount',
      fixed_price: 'Fixed Price'
    }
    return labels[type] || type
  }

  const getScopeLabel = (scope: string) => {
    const labels: Record<string, string> = {
      all: 'All Products',
      category: 'Category',
      product: 'Product',
      tag: 'Tag'
    }
    return labels[scope] || scope
  }

  const formatAdjustment = (type: string, value: number) => {
    if (type === 'percentage') return `${value > 0 ? '+' : ''}${value}%`
    return `${value > 0 ? '+' : ''}$${Math.abs(value).toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading pricing rules...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pricing Rules</h1>
            <p className="mt-2 text-gray-600">
              Create and manage dynamic pricing rules
            </p>
          </div>
          <Link
            href="/admin/pricing/rules/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Rule
          </Link>
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
            className="px-4 py-3 border-b-2 border-blue-600 text-blue-600 font-medium"
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

      {/* Rules Table */}
      {rules.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">No pricing rules yet</p>
          <Link
            href="/admin/pricing/rules/new"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Rule
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adjustment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{rule.name}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{getRuleTypeLabel(rule.rule_type)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {formatAdjustment(rule.rule_type, rule.adjustment_value)}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{getScopeLabel(rule.scope)}</td>
                  <td className="px-6 py-4 text-center text-gray-600">{rule.priority}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      rule.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/pricing/rules/${rule.id}`}
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
