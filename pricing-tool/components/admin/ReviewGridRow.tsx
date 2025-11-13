'use client'

import { useState } from 'react'

interface ExtractedLineItem {
  id: string
  quote_id: string
  raw_text?: string
  sku?: string
  description?: string
  quantity?: number
  unit?: string
  size?: string
  catalog_item_id?: string
  confidence_score: number
  mapping_warnings_json?: {
    warnings: string[]
  }
  source: 'ocr' | 'asr' | 'spreadsheet' | 'paste'
  status?: 'pending' | 'approved' | 'rejected' | 'needs_review'
}

interface ReviewGridRowProps {
  item: ExtractedLineItem
  index: number
  isSelected: boolean
  isEditing: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onSave: (updated: Partial<ExtractedLineItem>) => void
  onCancel: () => void
  onApprove: () => void
  onReject: () => void
}

export function ReviewGridRow({
  item,
  index,
  isSelected,
  isEditing,
  onToggleSelect,
  onEdit,
  onSave,
  onCancel,
  onApprove,
  onReject
}: ReviewGridRowProps) {
  const [editedItem, setEditedItem] = useState(item)

  const confidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800'
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const statusColor = (status?: string) => {
    switch (status) {
      case 'approved': return 'bg-green-50 border-green-200'
      case 'rejected': return 'bg-red-50 border-red-200'
      case 'needs_review': return 'bg-yellow-50 border-yellow-200'
      default: return ''
    }
  }

  if (isEditing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-3 py-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded"
          />
        </td>
        <td className="px-3 py-3 text-sm">{index + 1}</td>
        <td className="px-3 py-3">
          <input
            type="text"
            value={editedItem.sku || ''}
            onChange={(e) => setEditedItem({ ...editedItem, sku: e.target.value })}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="SKU"
          />
        </td>
        <td className="px-3 py-3">
          <input
            type="text"
            value={editedItem.description || ''}
            onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="Description"
          />
        </td>
        <td className="px-3 py-3">
          <input
            type="number"
            value={editedItem.quantity || ''}
            onChange={(e) => setEditedItem({ ...editedItem, quantity: parseFloat(e.target.value) })}
            className="w-20 border rounded px-2 py-1 text-sm"
            min="0"
            step="0.01"
          />
        </td>
        <td className="px-3 py-3">
          <input
            type="text"
            value={editedItem.size || ''}
            onChange={(e) => setEditedItem({ ...editedItem, size: e.target.value })}
            className="w-24 border rounded px-2 py-1 text-sm"
            placeholder="30x80"
          />
        </td>
        <td className="px-3 py-3">
          <select
            value={editedItem.unit || 'EA'}
            onChange={(e) => setEditedItem({ ...editedItem, unit: e.target.value })}
            className="w-20 border rounded px-2 py-1 text-sm"
          >
            <option value="EA">EA</option>
            <option value="LF">LF</option>
            <option value="SF">SF</option>
            <option value="BOX">BOX</option>
            <option value="SET">SET</option>
          </select>
        </td>
        <td className="px-3 py-3">
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${confidenceColor(item.confidence_score)}`}>
            {Math.round(item.confidence_score * 100)}%
          </span>
        </td>
        <td className="px-3 py-3">
          <div className="flex gap-1">
            <button
              onClick={() => onSave(editedItem)}
              className="p-1 text-green-600 hover:bg-green-100 rounded"
              title="Save changes"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Cancel"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={statusColor(item.status)}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="rounded"
        />
      </td>
      <td className="px-3 py-3 text-sm text-gray-900">{index + 1}</td>
      <td className="px-3 py-3">
        <div className="text-sm font-medium text-gray-900">{item.sku || '—'}</div>
      </td>
      <td className="px-3 py-3">
        <div className="text-sm text-gray-900 max-w-xs truncate" title={item.description}>
          {item.description || '—'}
        </div>
        {item.mapping_warnings_json?.warnings && item.mapping_warnings_json.warnings.length > 0 && (
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
              {item.mapping_warnings_json.warnings.length} warning{item.mapping_warnings_json.warnings.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-sm">{item.quantity || '—'}</td>
      <td className="px-3 py-3 text-sm">{item.size || '—'}</td>
      <td className="px-3 py-3 text-sm">{item.unit || 'EA'}</td>
      <td className="px-3 py-3">
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${confidenceColor(item.confidence_score)}`}>
          {Math.round(item.confidence_score * 100)}%
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
            title="Edit"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onApprove}
            className="p-1 text-green-600 hover:bg-green-100 rounded"
            title="Approve"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            onClick={onReject}
            className="p-1 text-red-600 hover:bg-red-100 rounded"
            title="Reject"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
