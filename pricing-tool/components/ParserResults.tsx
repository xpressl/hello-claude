'use client'

import { ExtractedLineItem } from '@/lib/parsers/text-parser'
import { useState } from 'react'

interface ParserResultsProps {
  items: ExtractedLineItem[]
  onAccept: (items: ExtractedLineItem[]) => void
  onReject: () => void
}

export function ParserResults({
  items,
  onAccept,
  onReject
}: ParserResultsProps) {
  const [editedItems, setEditedItems] = useState(items)

  const updateItem = (index: number, field: string, value: any) => {
    setEditedItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const confidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800'
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Extracted {items.length} line items
        </h3>
        <p className="text-sm text-gray-500">
          Review and correct before adding to quote
        </p>
      </div>

      <div className="overflow-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Size</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Unit</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Confidence</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {editedItems.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2 text-sm">{index + 1}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.sku || ''}
                    onChange={(e) => updateItem(index, 'sku', e.target.value)}
                    className="input-sm w-full"
                    placeholder="SKU"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="input-sm w-full"
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.quantity || ''}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                    className="input-sm w-20"
                    min="0"
                    step="0.01"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.size || ''}
                    onChange={(e) => updateItem(index, 'size', e.target.value)}
                    className="input-sm w-24"
                    placeholder="30x80"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={item.unit || 'EA'}
                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                    className="input-sm w-20"
                  >
                    <option value="EA">EA</option>
                    <option value="LF">LF</option>
                    <option value="SF">SF</option>
                    <option value="BOX">BOX</option>
                    <option value="SET">SET</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${confidenceColor(item.confidence)}`}>
                    {Math.round(item.confidence * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          onClick={onReject}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={() => onAccept(editedItems)}
          className="btn btn-primary"
        >
          Add {editedItems.length} items to quote
        </button>
      </div>
    </div>
  )
}
