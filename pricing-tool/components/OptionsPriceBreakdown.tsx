"use client"

import { useState } from "react"
import { formatMoney } from "@/lib/pricing"
import { OptionSelection } from "@/lib/types"

interface OptionsPriceBreakdownProps {
  basePrice: number
  breakdown: OptionSelection[]
  totalPrice: number
  compact?: boolean
}

export default function OptionsPriceBreakdown({
  basePrice,
  breakdown,
  totalPrice,
  compact = false
}: OptionsPriceBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // If no options selected, show simple display
  if (breakdown.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Total Price:</span>
          <span className="text-lg font-bold text-green-700">
            {formatMoney(basePrice)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      {/* Header - collapsible on mobile */}
      <div
        className={`flex justify-between items-center ${
          compact ? 'cursor-pointer' : ''
        }`}
        onClick={() => compact && setIsExpanded(!isExpanded)}
      >
        <span className="text-sm font-medium text-gray-700">
          Price Breakdown
          {compact && (
            <span className="ml-2 text-xs text-gray-500">
              ({isExpanded ? 'hide' : 'show'})
            </span>
          )}
        </span>
        {compact && (
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
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
        )}
      </div>

      {/* Breakdown details */}
      {(!compact || isExpanded) && (
        <div className="mt-3 space-y-2">
          {/* Base price */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Base Price:</span>
            <span className="font-medium">{formatMoney(basePrice)}</span>
          </div>

          {/* Option impacts */}
          {breakdown.map((item, index) => (
            <div
              key={`${item.code}-${index}`}
              className="flex justify-between items-center text-sm pl-4"
            >
              <span className="text-gray-600">
                + {item.label}:
              </span>
              <span
                className={`font-medium ${
                  item.price_impact > 0
                    ? 'text-green-600'
                    : item.price_impact < 0
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}
              >
                {item.price_impact > 0 ? '+' : ''}
                {formatMoney(item.price_impact)}
              </span>
            </div>
          ))}

          {/* Divider */}
          <div className="border-t border-gray-300 pt-2 mt-2"></div>

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Total:</span>
            <span className="text-lg font-bold text-green-700">
              {formatMoney(totalPrice)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
