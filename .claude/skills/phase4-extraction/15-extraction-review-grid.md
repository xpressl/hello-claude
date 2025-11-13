# Task 15: Extraction Review Grid UI

## Objective
Create an interactive admin UI for reviewing, correcting, and approving extracted line items with inline editing, confidence indicators, and bulk actions.

## Context
- After OCR/ASR/parsing, extracted items need human review
- Low-confidence items must be verified before quote finalization
- Admin can accept, reject, or fix extracted data
- Corrections feed back into mapping system for learning
- Grid must handle hundreds of items efficiently
- Mobile-responsive for field staff

## Requirements

### 1. Review Grid Component

**File:** `pricing-tool/components/admin/ExtractionReviewGrid.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Check, X, AlertCircle, Edit2, Save } from 'lucide-react'

export interface ExtractedLineItem {
  id: string
  quote_id: string
  raw_text: string
  sku?: string
  description?: string
  quantity?: number
  unit?: string
  size?: string
  catalog_item_id?: string
  confidence_score: number
  mapping_warnings_json: {
    warnings: string[]
  }
  source: 'ocr' | 'asr' | 'spreadsheet' | 'paste'
  status: 'pending' | 'approved' | 'rejected' | 'needs_review'
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

  useEffect(() => {
    fetchExtractedItems()
  }, [quoteId])

  async function fetchExtractedItems() {
    const res = await fetch(`/api/quotes/${quoteId}/extracted-items`)
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }

  // ... implementation below
}
```

### 2. Grid Layout and Styling

**Desktop view: Table with inline editing**
```tsx
return (
  <div className="space-y-4">
    {/* Header with actions */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">
          Review Extracted Items
        </h2>
        <span className="text-sm text-gray-500">
          {items.filter(i => i.status === 'pending').length} pending
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => bulkAction('approve')}
          disabled={selectedIds.size === 0}
          className="btn btn-sm btn-success"
        >
          <Check className="h-4 w-4 mr-1" />
          Approve Selected ({selectedIds.size})
        </button>
        <button
          onClick={() => bulkAction('reject')}
          disabled={selectedIds.size === 0}
          className="btn btn-sm btn-danger"
        >
          <X className="h-4 w-4 mr-1" />
          Reject Selected
        </button>
        <button
          onClick={onComplete}
          className="btn btn-sm btn-primary"
        >
          Done Reviewing
        </button>
      </div>
    </div>

    {/* Filter tabs */}
    <div className="flex gap-2 border-b">
      <TabButton
        active={filter === 'all'}
        onClick={() => setFilter('all')}
        count={items.length}
      >
        All
      </TabButton>
      <TabButton
        active={filter === 'pending'}
        onClick={() => setFilter('pending')}
        count={items.filter(i => i.status === 'pending').length}
      >
        Pending
      </TabButton>
      <TabButton
        active={filter === 'low_confidence'}
        onClick={() => setFilter('low_confidence')}
        count={items.filter(i => i.confidence_score < 0.7).length}
      >
        Low Confidence
      </TabButton>
    </div>

    {/* Grid table */}
    <div className="overflow-auto border rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="w-12 px-3 py-3">
              <input
                type="checkbox"
                checked={selectedIds.size === items.length}
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
  </div>
)
```

### 3. Grid Row Component

**File:** `pricing-tool/components/admin/ReviewGridRow.tsx`

```typescript
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

  const statusColor = (status: string) => {
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
            className="input-sm w-full"
            placeholder="SKU"
          />
        </td>
        <td className="px-3 py-3">
          <input
            type="text"
            value={editedItem.description || ''}
            onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
            className="input-sm w-full"
            placeholder="Description"
          />
        </td>
        <td className="px-3 py-3">
          <input
            type="number"
            value={editedItem.quantity || ''}
            onChange={(e) => setEditedItem({ ...editedItem, quantity: parseFloat(e.target.value) })}
            className="input-sm w-20"
            min="0"
            step="0.01"
          />
        </td>
        <td className="px-3 py-3">
          <input
            type="text"
            value={editedItem.size || ''}
            onChange={(e) => setEditedItem({ ...editedItem, size: e.target.value })}
            className="input-sm w-24"
            placeholder="30x80"
          />
        </td>
        <td className="px-3 py-3">
          <select
            value={editedItem.unit || 'EA'}
            onChange={(e) => setEditedItem({ ...editedItem, unit: e.target.value })}
            className="input-sm w-20"
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
              <Save className="h-4 w-4" />
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Cancel"
            >
              <X className="h-4 w-4" />
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
        {item.mapping_warnings_json?.warnings.length > 0 && (
          <div className="mt-1">
            <WarningBadge warnings={item.mapping_warnings_json.warnings} />
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
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onApprove}
            className="p-1 text-green-600 hover:bg-green-100 rounded"
            title="Approve"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onReject}
            className="p-1 text-red-600 hover:bg-red-100 rounded"
            title="Reject"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}
```

### 4. Warning Badge Component

**File:** `pricing-tool/components/admin/WarningBadge.tsx`

```typescript
interface WarningBadgeProps {
  warnings: string[]
}

export function WarningBadge({ warnings }: WarningBadgeProps) {
  if (warnings.length === 0) return null

  return (
    <div className="group relative inline-block">
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded cursor-help">
        <AlertCircle className="h-3 w-3" />
        {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
      </span>

      {/* Tooltip */}
      <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white text-xs rounded px-3 py-2 bottom-full mb-2 left-0 w-64">
        <ul className="space-y-1">
          {warnings.map((warning, index) => (
            <li key={index}>• {warning}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

### 5. API Routes for Review Actions

**File:** `pricing-tool/app/api/quotes/[id]/extracted-items/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: items, error } = await supabase
    .from('quote_lines')
    .select('*')
    .eq('quote_id', params.id)
    .in('source', ['ocr', 'asr', 'spreadsheet', 'paste'])
    .order('line_number')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })
  const body = await request.json()

  const { itemId, updates } = body

  const { data, error } = await supabase
    .from('quote_lines')
    .update(updates)
    .eq('id', itemId)
    .eq('quote_id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If SKU or description was corrected, learn the mapping
  if (updates.sku || updates.description) {
    await learnMapping(updates, data.catalog_item_id)
  }

  return NextResponse.json({ item: data })
}

async function learnMapping(updates: any, catalogItemId: string) {
  // Learn SKU mapping
  if (updates.sku && catalogItemId) {
    await fetch('/api/mappings/learn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sku',
        customerValue: updates.sku,
        catalogProductId: catalogItemId
      })
    })
  }

  // Learn description mapping
  if (updates.description && catalogItemId) {
    await fetch('/api/mappings/learn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'description',
        customerValue: updates.description,
        catalogProductId: catalogItemId
      })
    })
  }
}
```

**File:** `pricing-tool/app/api/quotes/[id]/extracted-items/bulk-action/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })
  const body = await request.json()

  const { itemIds, action } = body

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (action === 'approve') {
    const { error } = await supabase
      .from('quote_lines')
      .update({ status: 'approved' })
      .in('id', itemIds)
      .eq('quote_id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (action === 'reject') {
    // Soft delete: mark as rejected instead of deleting
    const { error } = await supabase
      .from('quote_lines')
      .update({ status: 'rejected' })
      .in('id', itemIds)
      .eq('quote_id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, affected: itemIds.length })
}
```

### 6. Keyboard Shortcuts

**Add to ReviewGrid:**
```typescript
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
```

### 7. Mobile Responsive View

**Mobile: Cards instead of table**
```tsx
{/* Mobile view */}
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
```

### 8. Raw Text Viewer Modal

**File:** `pricing-tool/components/admin/RawTextViewer.tsx`

**Purpose:** Show original extracted text for reference

```typescript
interface RawTextViewerProps {
  item: ExtractedLineItem
  onClose: () => void
}

export function RawTextViewer({ item, onClose }: RawTextViewerProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Original Extracted Text</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Source</label>
            <p className="mt-1 text-sm uppercase px-2 py-1 bg-gray-100 rounded inline-block">
              {item.source}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Raw Text</label>
            <pre className="mt-1 p-4 bg-gray-50 rounded text-sm whitespace-pre-wrap font-mono">
              {item.raw_text}
            </pre>
          </div>

          {item.mapping_warnings_json?.warnings.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700">Warnings</label>
              <ul className="mt-1 space-y-1">
                {item.mapping_warnings_json.warnings.map((warning, i) => (
                  <li key={i} className="text-sm text-yellow-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

## Files to Create

**Components:**
- `pricing-tool/components/admin/ExtractionReviewGrid.tsx`
- `pricing-tool/components/admin/ReviewGridRow.tsx`
- `pricing-tool/components/admin/ExtractionReviewCard.tsx` (mobile)
- `pricing-tool/components/admin/WarningBadge.tsx`
- `pricing-tool/components/admin/RawTextViewer.tsx`

**API:**
- `pricing-tool/app/api/quotes/[id]/extracted-items/route.ts`
- `pricing-tool/app/api/quotes/[id]/extracted-items/bulk-action/route.ts`

**Types:**
- Update `pricing-tool/lib/types.ts` with ExtractedLineItem interface

## Testing Requirements

1. **Manual Testing:**
   - Load grid with 50+ items
   - Edit item inline
   - Approve item
   - Reject item
   - Bulk approve multiple items
   - Filter by confidence
   - Check keyboard shortcuts work
   - Test on mobile device

2. **Edge Cases:**
   - Empty grid (no items)
   - All items approved
   - Item with no SKU
   - Item with many warnings
   - Very long description (truncation)

3. **Performance:**
   - Grid loads quickly with 100+ items
   - Inline editing is responsive
   - No lag when selecting multiple items

## Acceptance Criteria

- [ ] Grid displays all extracted items
- [ ] Inline editing works for all fields
- [ ] Confidence badges show correct colors
- [ ] Warnings displayed with tooltip
- [ ] Approve/reject actions work
- [ ] Bulk actions work on selected items
- [ ] Keyboard shortcuts functional
- [ ] Mobile responsive (card layout)
- [ ] Filters work (all, pending, low confidence)
- [ ] Raw text viewer shows original extraction
- [ ] Corrections feed into mapping system
- [ ] Status updates reflected immediately
- [ ] Select all / deselect all works
- [ ] Loading states shown

## Dependencies

- Task 01 (quote_lines table)
- Task 12 (OCR extraction)
- Task 13 (ASR extraction)
- Task 14 (mapping system)
- lucide-react for icons

## Estimated Effort

6-8 hours

## Review Checklist

- [ ] TypeScript types accurate
- [ ] No console.log statements
- [ ] Keyboard shortcuts don't conflict
- [ ] Inline editing cancels properly
- [ ] Bulk actions confirm before executing
- [ ] Mobile layout tested
- [ ] Confidence color thresholds calibrated
- [ ] Warning tooltips positioned correctly
- [ ] Table scrolls horizontally on small screens
- [ ] Sticky header works on scroll
- [ ] Select state maintained during edit
- [ ] API error handling comprehensive
- [ ] Loading states prevent duplicate actions
- [ ] Accessibility: keyboard navigation works
- [ ] Accessibility: focus indicators visible
