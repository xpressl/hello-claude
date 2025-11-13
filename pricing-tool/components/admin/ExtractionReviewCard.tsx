'use client'

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

interface ExtractionReviewCardProps {
  item: ExtractedLineItem
  index: number
  isSelected: boolean
  onToggleSelect: () => void
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
}

export function ExtractionReviewCard({
  item,
  index,
  isSelected,
  onToggleSelect,
  onApprove,
  onReject,
  onEdit
}: ExtractionReviewCardProps) {
  const confidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800'
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded ${confidenceColor(item.confidence_score)}`}>
          {Math.round(item.confidence_score * 100)}%
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <label className="text-xs text-gray-500">SKU</label>
          <p className="text-sm font-medium">{item.sku || '—'}</p>
        </div>
        <div>
          <label className="text-xs text-gray-500">Description</label>
          <p className="text-sm">{item.description || '—'}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-500">Qty</label>
            <p className="text-sm">{item.quantity || '—'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Size</label>
            <p className="text-sm">{item.size || '—'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Unit</label>
            <p className="text-sm">{item.unit || 'EA'}</p>
          </div>
        </div>
      </div>

      {item.mapping_warnings_json?.warnings && item.mapping_warnings_json.warnings.length > 0 && (
        <div className="mb-3 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
          {item.mapping_warnings_json.warnings.length} warning{item.mapping_warnings_json.warnings.length !== 1 ? 's' : ''}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-2 text-sm border rounded hover:bg-gray-50"
        >
          Edit
        </button>
        <button
          onClick={onApprove}
          className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
