'use client'

import { useState, useEffect } from 'react'

interface PriceListItem {
  id: string
  product_id: string
  product_name?: string
  unit_price: number
  min_quantity: number
  max_quantity?: number
}

interface Props {
  priceListId: string
  readOnly?: boolean
}

export function PriceListItemsTable({ priceListId, readOnly = false }: Props) {
  const [items, setItems] = useState<PriceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchItems()
  }, [priceListId])

  async function fetchItems() {
    try {
      setLoading(true)
      const res = await fetch(`/api/pricing/lists/${priceListId}/items`)
      if (!res.ok) throw new Error('Failed to fetch items')
      const data = await res.json()
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading items')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(itemId: string) {
    if (!confirm('Delete this price item?')) return

    try {
      const res = await fetch(`/api/pricing/lists/${priceListId}/items/${itemId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete')
      fetchItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting item')
    }
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-600">Loading items...</div>
  }

  if (error) {
    return <div className="text-center py-4 text-red-600">{error}</div>
  }

  if (items.length === 0) {
    return <div className="text-center py-4 text-gray-600">No items in this price list</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Product</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Unit Price</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Min Qty</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Max Qty</th>
            {!readOnly && (
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-sm text-gray-900">{item.product_name}</td>
              <td className="px-4 py-2 text-sm font-mono text-gray-600">
                ${item.unit_price.toFixed(2)}
              </td>
              <td className="px-4 py-2 text-sm text-gray-600">{item.min_quantity}</td>
              <td className="px-4 py-2 text-sm text-gray-600">
                {item.max_quantity || 'Unlimited'}
              </td>
              {!readOnly && (
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
