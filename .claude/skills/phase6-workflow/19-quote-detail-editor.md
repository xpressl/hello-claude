# Task 19: Quote Detail Editor Page

## Objective
Create comprehensive quote detail editor for admins with side-by-side view of original uploads and normalized lines, inline editing, catalog remapping, discount application, and internal notes.

## Context
- Admins need full control over quote details before sending
- View original uploads alongside extracted/manual line items
- Remap products, adjust quantities, apply discounts
- Add internal notes not visible to customers
- Real-time price recalculation
- Audit trail of all changes

## Requirements

### 1. Quote Detail Page Structure

**File:** `pricing-tool/app/admin/quotes/[id]/edit/page.tsx`

```typescript
export default async function QuoteDetailEditPage({
  params
}: {
  params: { id: string }
}) {
  const quote = await fetchQuoteWithDetails(params.id)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with quote status and actions */}
      <QuoteHeader quote={quote} />

      {/* Main content: 3-column layout on large screens */}
      <div className="max-w-[1920px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Uploads and source data */}
          <div className="lg:col-span-1">
            <OriginalUploadsPanel quoteId={params.id} />
          </div>

          {/* Center: Line items editor */}
          <div className="lg:col-span-1">
            <LineItemsEditor quoteId={params.id} />
          </div>

          {/* Right: Summary and actions */}
          <div className="lg:col-span-1">
            <QuoteSummaryPanel quote={quote} />
            <InternalNotesPanel quoteId={params.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 2. Quote Header Component

**File:** `pricing-tool/components/admin/quotes/QuoteHeader.tsx`

```typescript
export function QuoteHeader({ quote }: { quote: Quote }) {
  return (
    <div className="bg-white border-b shadow-sm">
      <div className="max-w-[1920px] mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/quotes" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Quote #{quote.id.substring(0, 8)}
              </h1>
              <p className="text-sm text-gray-500">
                {quote.customer_name} • {quote.customer_email}
              </p>
            </div>

            <StatusBadge status={quote.status} />
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-secondary">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </button>

            <button className="btn btn-secondary">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </button>

            <button className="btn btn-primary">
              <Send className="h-4 w-4 mr-2" />
              Send to Customer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 3. Original Uploads Panel

**File:** `pricing-tool/components/admin/quotes/OriginalUploadsPanel.tsx`

**Features:**
- List all uploads for quote
- Display thumbnails for images
- Show extracted text for OCR/ASR
- Download original files

```typescript
export function OriginalUploadsPanel({ quoteId }: { quoteId: string }) {
  const [uploads, setUploads] = useState<Upload[]>([])

  useEffect(() => {
    fetchUploads()
  }, [quoteId])

  async function fetchUploads() {
    const res = await fetch(`/api/quotes/${quoteId}/uploads`)
    const data = await res.json()
    setUploads(data.uploads)
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Original Uploads</h2>
        <p className="text-sm text-gray-500">{uploads.length} file(s)</p>
      </div>

      <div className="p-4 space-y-3 max-h-[calc(100vh-300px)] overflow-auto">
        {uploads.map(upload => (
          <UploadCard key={upload.id} upload={upload} />
        ))}

        {uploads.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-2" />
            <p className="text-sm">No uploads for this quote</p>
          </div>
        )}
      </div>
    </div>
  )
}

function UploadCard({ upload }: { upload: Upload }) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start gap-3">
        <FileIcon type={upload.file_type} className="h-10 w-10 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {upload.original_name}
          </p>
          <p className="text-xs text-gray-500">
            {formatFileSize(upload.size_bytes)} • {upload.status}
          </p>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-gray-400 hover:text-gray-600"
        >
          {showDetails ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
      </div>

      {showDetails && upload.parsed_payload_json && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs font-medium text-gray-700 mb-2">Extracted Text:</p>
          <div className="bg-gray-50 rounded p-2 text-xs font-mono max-h-40 overflow-auto">
            {upload.parsed_payload_json.text}
          </div>
        </div>
      )}
    </div>
  )
}
```

### 4. Line Items Editor

**File:** `pricing-tool/components/admin/quotes/LineItemsEditor.tsx`

**Features:**
- Inline editing of all fields
- Product search and remap
- Options selector
- Delete/duplicate lines
- Drag to reorder

```typescript
export function LineItemsEditor({ quoteId }: { quoteId: string }) {
  const [lines, setLines] = useState<QuoteLine[]>([])
  const [editingLineId, setEditingLineId] = useState<string | null>(null)

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Line Items</h2>
        <button onClick={handleAddLine} className="btn btn-sm btn-primary">
          <Plus className="h-4 w-4 mr-1" />
          Add Line
        </button>
      </div>

      <div className="divide-y max-h-[calc(100vh-300px)] overflow-auto">
        {lines.map((line, index) => (
          <LineItemRow
            key={line.id}
            line={line}
            index={index}
            isEditing={editingLineId === line.id}
            onEdit={() => setEditingLineId(line.id)}
            onSave={(updated) => handleSaveLine(line.id, updated)}
            onCancel={() => setEditingLineId(null)}
            onDelete={() => handleDeleteLine(line.id)}
            onDuplicate={() => handleDuplicateLine(line)}
          />
        ))}
      </div>

      {lines.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-2" />
          <p className="text-sm">No line items yet</p>
          <button onClick={handleAddLine} className="btn btn-sm btn-secondary mt-4">
            Add First Item
          </button>
        </div>
      )}
    </div>
  )
}
```

### 5. Line Item Row Component

**File:** `pricing-tool/components/admin/quotes/LineItemRow.tsx`

```typescript
interface LineItemRowProps {
  line: QuoteLine
  index: number
  isEditing: boolean
  onEdit: () => void
  onSave: (updated: Partial<QuoteLine>) => void
  onCancel: () => void
  onDelete: () => void
  onDuplicate: () => void
}

export function LineItemRow({
  line,
  index,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onDuplicate
}: LineItemRowProps) {
  const [editedLine, setEditedLine] = useState(line)

  if (isEditing) {
    return (
      <div className="p-4 bg-blue-50">
        <div className="space-y-3">
          {/* Product search */}
          <div>
            <label className="text-xs font-medium text-gray-700">Product</label>
            <ProductSearchCombobox
              value={editedLine.catalog_item_id}
              onChange={(productId) => setEditedLine({ ...editedLine, catalog_item_id: productId })}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-700">Description</label>
            <input
              type="text"
              value={editedLine.description}
              onChange={(e) => setEditedLine({ ...editedLine, description: e.target.value })}
              className="input-sm w-full"
            />
          </div>

          {/* Quantity and Unit */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-700">Quantity</label>
              <input
                type="number"
                value={editedLine.quantity}
                onChange={(e) => setEditedLine({ ...editedLine, quantity: parseFloat(e.target.value) })}
                className="input-sm w-full"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Unit</label>
              <select
                value={editedLine.unit}
                onChange={(e) => setEditedLine({ ...editedLine, unit: e.target.value })}
                className="input-sm w-full"
              >
                <option value="EA">EA</option>
                <option value="LF">LF</option>
                <option value="SF">SF</option>
                <option value="BOX">BOX</option>
                <option value="SET">SET</option>
              </select>
            </div>
          </div>

          {/* Options */}
          {editedLine.catalog_item_id && (
            <div>
              <label className="text-xs font-medium text-gray-700">Options</label>
              <OptionsSelector
                productId={editedLine.catalog_item_id}
                value={editedLine.options_json}
                onChange={(options) => setEditedLine({ ...editedLine, options_json: options })}
              />
            </div>
          )}

          {/* Price override */}
          <div>
            <label className="text-xs font-medium text-gray-700">
              Unit Price Override (optional)
            </label>
            <input
              type="number"
              value={editedLine.unit_price}
              onChange={(e) => setEditedLine({ ...editedLine, unit_price: parseFloat(e.target.value) })}
              className="input-sm w-full"
              step="0.01"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button onClick={() => onSave(editedLine)} className="btn btn-sm btn-primary flex-1">
              <Save className="h-4 w-4 mr-1" />
              Save
            </button>
            <button onClick={onCancel} className="btn btn-sm btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 hover:bg-gray-50 group">
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <div className="opacity-0 group-hover:opacity-100 cursor-move">
          <GripVertical className="h-5 w-5 text-gray-400" />
        </div>

        {/* Line number */}
        <div className="w-8 text-sm font-medium text-gray-500">
          {index + 1}
        </div>

        {/* Line details */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{line.description}</p>
          <p className="text-xs text-gray-500">
            SKU: {line.catalog_item?.sku || 'N/A'} •
            Qty: {line.quantity} {line.unit}
          </p>
          {line.source !== 'manual' && (
            <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {line.source.toUpperCase()}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            ${line.unit_price.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">
            ${line.extended_price.toFixed(2)} ext
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <button onClick={onEdit} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Edit">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={onDuplicate} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title="Duplicate">
            <Copy className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 6. Quote Summary Panel

**File:** `pricing-tool/components/admin/quotes/QuoteSummaryPanel.tsx`

```typescript
export function QuoteSummaryPanel({ quote }: { quote: Quote }) {
  return (
    <div className="space-y-4">
      {/* Pricing summary */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Pricing Summary</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">${quote.subtotal.toFixed(2)}</span>
          </div>

          {quote.discount_amount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-${quote.discount_amount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-gray-600">Tax ({quote.tax_rate}%)</span>
            <span className="font-medium">${quote.tax.toFixed(2)}</span>
          </div>

          <div className="flex justify-between pt-2 border-t">
            <span className="font-semibold">Total</span>
            <span className="font-semibold text-lg">${quote.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Margin info */}
        {quote.margin_percent && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Margin</span>
              <span className={`font-medium ${quote.margin_percent > 20 ? 'text-green-600' : 'text-yellow-600'}`}>
                {quote.margin_percent.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Discount controls */}
        <div className="mt-4 pt-4 border-t">
          <DiscountEditor quoteId={quote.id} currentDiscount={quote.discount_amount} />
        </div>
      </div>

      {/* Customer info */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Customer Details</h3>

        <div className="space-y-2 text-sm">
          <div>
            <p className="text-gray-600">Name</p>
            <p className="font-medium">{quote.customer_name}</p>
          </div>
          <div>
            <p className="text-gray-600">Email</p>
            <p className="font-medium">{quote.customer_email}</p>
          </div>
          {quote.customer_phone && (
            <div>
              <p className="text-gray-600">Phone</p>
              <p className="font-medium">{quote.customer_phone}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

### 7. Internal Notes Panel

**File:** `pricing-tool/components/admin/quotes/InternalNotesPanel.tsx`

```typescript
export function InternalNotesPanel({ quoteId }: { quoteId: string }) {
  const [notes, setNotes] = useState('')
  const [savedNotes, setSavedNotes] = useState<InternalNote[]>([])

  const handleSaveNote = async () => {
    const res = await fetch(`/api/quotes/${quoteId}/internal-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: notes })
    })

    if (res.ok) {
      setNotes('')
      fetchNotes()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mt-4">
      <h3 className="text-lg font-semibold mb-4">Internal Notes</h3>

      {/* Add note */}
      <div className="space-y-2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input w-full h-24"
          placeholder="Add internal note (not visible to customer)..."
        />
        <button
          onClick={handleSaveNote}
          disabled={!notes.trim()}
          className="btn btn-sm btn-primary w-full"
        >
          Add Note
        </button>
      </div>

      {/* Notes history */}
      <div className="mt-4 space-y-3 max-h-64 overflow-auto">
        {savedNotes.map(note => (
          <div key={note.id} className="border-l-2 border-blue-500 pl-3 py-2">
            <p className="text-sm text-gray-900">{note.note}</p>
            <p className="text-xs text-gray-500 mt-1">
              {note.created_by_user.name} • {formatDate(note.created_at)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Files to Create

**Pages:**
- `pricing-tool/app/admin/quotes/[id]/edit/page.tsx`

**Components:**
- `pricing-tool/components/admin/quotes/QuoteHeader.tsx`
- `pricing-tool/components/admin/quotes/OriginalUploadsPanel.tsx`
- `pricing-tool/components/admin/quotes/LineItemsEditor.tsx`
- `pricing-tool/components/admin/quotes/LineItemRow.tsx`
- `pricing-tool/components/admin/quotes/QuoteSummaryPanel.tsx`
- `pricing-tool/components/admin/quotes/InternalNotesPanel.tsx`
- `pricing-tool/components/admin/quotes/DiscountEditor.tsx`
- `pricing-tool/components/admin/quotes/ProductSearchCombobox.tsx`

**API:**
- `pricing-tool/app/api/quotes/[id]/internal-notes/route.ts`

**Schema Addition:**
```sql
CREATE TABLE IF NOT EXISTS internal_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing Requirements

1. **Editing:**
   - Edit line item details
   - Remap to different product
   - Change quantity updates price
   - Options selector works

2. **Actions:**
   - Add new line
   - Duplicate line
   - Delete line
   - Reorder lines (drag)

3. **Uploads:**
   - View uploaded files
   - See extracted text
   - Download original

4. **Notes:**
   - Add internal note
   - View note history
   - Notes not in customer view

## Acceptance Criteria

- [ ] Three-column layout on large screens
- [ ] Responsive on tablet/mobile
- [ ] Inline editing works
- [ ] Product remapping works
- [ ] Real-time price updates
- [ ] Drag-to-reorder functional
- [ ] Upload panel shows files
- [ ] Internal notes saved
- [ ] Discount editor works
- [ ] All changes logged in events

## Dependencies

- Task 01 (quote schema)
- Task 03 (frontend components)
- Task 17 (pricing engine v2)

## Estimated Effort

8-10 hours

## Review Checklist

- [ ] TypeScript types accurate
- [ ] No data loss on edit cancel
- [ ] Confirmation before delete
- [ ] Loading states shown
- [ ] Error handling comprehensive
- [ ] Keyboard navigation works
- [ ] Focus management correct
- [ ] Responsive layout tested
- [ ] Price recalculation accurate
- [ ] Audit trail complete
