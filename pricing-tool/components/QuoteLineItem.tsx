"use client"

import { useState, useEffect, useRef } from "react"
import { QuoteLineDraft } from "@/lib/types"
import { formatMoney } from "@/lib/pricing"
import OptionsPicker from "./OptionsPicker"

interface QuoteLineItemProps {
  line: QuoteLineDraft
  index: number
  onChange: (index: number, field: keyof QuoteLineDraft, value: string | number | Record<string, any>) => void
  onDuplicate: (index: number) => void
  onRemove: (index: number) => void
  viewMode?: 'card' | 'table'
}

const UNIT_OPTIONS = ['EA', 'LF', 'SF', 'BOX', 'PKG', 'SET', 'CASE', 'BF']

export default function QuoteLineItem({
  line,
  index,
  onChange,
  onDuplicate,
  onRemove,
  viewMode = 'card'
}: QuoteLineItemProps) {
  const [showOptions, setShowOptions] = useState(false)

  // Store the original base price to avoid double-counting options
  // This should be the product's base price without any option adjustments
  const basePriceRef = useRef<number>(line.unit_price)

  // Update base price when catalog_item_id changes (new product selected)
  // or when unit_price changes and there are no options selected
  useEffect(() => {
    if (line.catalog_item_id) {
      // If no options are selected yet, the current unit_price is the base price
      if (!line.options_json || Object.keys(line.options_json).length === 0) {
        basePriceRef.current = line.unit_price
      }
    }
  }, [line.catalog_item_id, line.unit_price, line.options_json])

  const handleRemoveClick = () => {
    if (confirm('Remove this line item?')) {
      onRemove(index)
    }
  }

  const handleOptionsChange = (options: Record<string, any>, priceImpact: number) => {
    // Update options_json
    onChange(index, 'options_json', options)

    // Update unit_price with base price + price impact
    // Use the stored base price (not current unit_price) to avoid double-counting
    const newPrice = basePriceRef.current + priceImpact
    onChange(index, 'unit_price', newPrice)
  }

  if (viewMode === 'table') {
    return (
      <tr className="border-b hover:bg-gray-50">
        <td className="px-4 py-3 text-sm text-gray-600 align-top">
          #{index + 1}
        </td>
        <td className="px-4 py-3 align-top">
          <input
            type="text"
            value={line.description}
            onChange={(e) => onChange(index, 'description', e.target.value)}
            placeholder="Product description"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </td>
        <td className="px-4 py-3 align-top">
          <input
            type="number"
            value={line.quantity}
            onChange={(e) => onChange(index, 'quantity', parseFloat(e.target.value) || 0)}
            min="0.01"
            step="0.01"
            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </td>
        <td className="px-4 py-3 align-top">
          <select
            value={line.unit}
            onChange={(e) => onChange(index, 'unit', e.target.value)}
            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 align-top">
          <input
            type="number"
            value={line.unit_price}
            onChange={(e) => onChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            disabled={!!line.catalog_item_id}
            className={`w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              line.catalog_item_id ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
          />
        </td>
        <td className="px-4 py-3 align-top font-semibold text-green-700">
          {formatMoney(line.extended_price)}
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex gap-2">
            <button
              onClick={() => onDuplicate(index)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              aria-label="Duplicate line"
              title="Duplicate"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={handleRemoveClick}
              className="text-red-600 hover:text-red-800 text-sm"
              aria-label="Remove line"
              title="Remove"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    )
  }

  // Card view (mobile)
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div className="text-sm font-semibold text-gray-600">Line #{index + 1}</div>
        <div className="flex gap-2">
          <button
            onClick={() => onDuplicate(index)}
            className="text-blue-600 hover:text-blue-800 p-1"
            aria-label="Duplicate line"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={handleRemoveClick}
            className="text-red-600 hover:text-red-800 p-1"
            aria-label="Remove line"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <input
            type="text"
            value={line.description}
            onChange={(e) => onChange(index, 'description', e.target.value)}
            placeholder="Product description"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              value={line.quantity}
              onChange={(e) => onChange(index, 'quantity', parseFloat(e.target.value) || 0)}
              min="0.01"
              step="0.01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
            <select
              value={line.unit}
              onChange={(e) => onChange(index, 'unit', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Unit Price
              {line.catalog_item_id && <span className="ml-1 text-gray-400">(from catalog)</span>}
            </label>
            <input
              type="number"
              value={line.unit_price}
              onChange={(e) => onChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              disabled={!!line.catalog_item_id}
              className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                line.catalog_item_id ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Extended Price</label>
            <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-semibold text-green-700">
              {formatMoney(line.extended_price)}
            </div>
          </div>
        </div>

        {/* Options Section - Show if item has catalog_item_id */}
        {line.catalog_item_id && (
          <div className="border-t pt-3 mt-3">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center justify-between w-full text-sm font-medium text-gray-700 mb-3"
            >
              <span>Configure Options</span>
              <svg
                className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showOptions && (
              <OptionsPicker
                catalogItemId={line.catalog_item_id}
                initialOptions={line.options_json || {}}
                onOptionsChange={handleOptionsChange}
                basePrice={basePriceRef.current}
                compact={true}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
