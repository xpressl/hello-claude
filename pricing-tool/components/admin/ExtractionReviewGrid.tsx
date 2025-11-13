'use client'

import { useState, useEffect } from 'react'
import { ReviewGridRow } from './ReviewGridRow'
import { ExtractionReviewCard } from './ExtractionReviewCard'

export interface ExtractedLineItem {
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

interface ExtractionReviewGridProps {
  quoteId: string
  onComplete: () => void
}

export function ExtractionReviewGrid({
  quoteId,
  onComplete
}: ExtractionReviewGridProps) {
  const [items, setItems] = useState<ExtractedLineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'low_confidence'>('all')

  useEffect(() => {
    fetchExtractedItems()
  }, [quoteId])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        setSelectedIds(new Set())
        setEditingId(null)
      }

      // Ctrl/Cmd + Enter: Approve selected
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        bulkAction('approve')
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selectedIds])

  async function fetchExtractedItems() {
    const res = await fetch(`/api/quotes/${quoteId}/extracted-items`)
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }

  function selectAll() {
    setSelectedIds(new Set(filteredItems.map(i => i.id)))
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      selectAll()
    }
  }

  async function saveItem(itemId: string, updates: Partial<ExtractedLineItem>) {
    const res = await fetch(`/api/quotes/${quoteId}/extracted-items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, updates })
    })

    if (res.ok) {
      await fetchExtractedItems()
      setEditingId(null)
    }
  }

  async function approveItem(itemId: string) {
    await bulkAction('approve', [itemId])
  }

  async function rejectItem(itemId: string) {
    await bulkAction('reject', [itemId])
  }

  async function bulkAction(action: 'approve' | 'reject', itemIds?: string[]) {
    const ids = itemIds || Array.from(selectedIds)
    if (ids.length === 0) return

    const res = await fetch(`/api/quotes/${quoteId}/extracted-items/bulk-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: ids, action })
    })

    if (res.ok) {
      await fetchExtractedItems()
      setSelectedIds(new Set())
    }
  }

  const filteredItems = items.filter(item => {
    if (filter === 'pending') {
      return item.status === 'pending' || !item.status
    }
    if (filter === 'low_confidence') {
      return item.confidence_score < 0.7
    }
    return true
  })

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            Review Extracted Items
          </h2>
          <span className="text-sm text-gray-500">
            {items.filter(i => i.status === 'pending' || !i.status).length} pending
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => bulkAction('approve')}
            disabled={selectedIds.size === 0}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve Selected ({selectedIds.size})
            </span>
          </button>
          <button
            onClick={() => bulkAction('reject')}
            disabled={selectedIds.size === 0}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject Selected
            </span>
          </button>
          <button
            onClick={onComplete}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Done Reviewing
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            filter === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All ({items.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            filter === 'pending'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pending ({items.filter(i => i.status === 'pending' || !i.status).length})
        </button>
        <button
          onClick={() => setFilter('low_confidence')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            filter === 'low_confidence'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Low Confidence ({items.filter(i => i.confidence_score < 0.7).length})
        </button>
      </div>

      {/* Desktop: Grid table */}
      <div className="hidden md:block overflow-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="w-12 px-3 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredItems.map((item, index) => (
              <ReviewGridRow
                key={item.id}
                item={item}
                index={index}
                isSelected={selectedIds.has(item.id)}
                isEditing={editingId === item.id}
                onToggleSelect={() => toggleSelect(item.id)}
                onEdit={() => setEditingId(item.id)}
                onSave={(updated) => saveItem(item.id, updated)}
                onCancel={() => setEditingId(null)}
                onApprove={() => approveItem(item.id)}
                onReject={() => rejectItem(item.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {filteredItems.map((item, index) => (
          <ExtractionReviewCard
            key={item.id}
            item={item}
            index={index}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={() => toggleSelect(item.id)}
            onApprove={() => approveItem(item.id)}
            onReject={() => rejectItem(item.id)}
            onEdit={() => setEditingId(item.id)}
          />
        ))}
      </div>
    </div>
  )
}
