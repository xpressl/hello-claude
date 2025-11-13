"use client"

import { ItemOption } from "@/lib/types"
import { formatMoney } from "@/lib/pricing"

interface BooleanOptionProps {
  option: ItemOption
  value: boolean
  onChange: (value: boolean) => void
  error?: string
  disabled?: boolean
}

export default function BooleanOption({
  option,
  value,
  onChange,
  error,
  disabled = false
}: BooleanOptionProps) {
  // Calculate price impact for display
  let priceImpact = 0
  if (option.price_delta_type === 'flat' && option.price_delta_value !== null) {
    priceImpact = option.price_delta_value
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor={`option-${option.code}`}
        className="flex items-center space-x-3 cursor-pointer"
      >
        <input
          id={`option-${option.code}`}
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || !option.active}
          aria-invalid={!!error}
          aria-describedby={error ? `option-${option.code}-error` : undefined}
          className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 ${
            disabled || !option.active
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer'
          }`}
        />
        <span className="text-sm font-medium text-gray-700">
          {option.label}
          {priceImpact !== 0 && (
            <span className="ml-1 text-green-600">
              ({priceImpact > 0 ? '+' : ''}{formatMoney(priceImpact)})
            </span>
          )}
        </span>
      </label>

      {error && (
        <p
          id={`option-${option.code}-error`}
          className="text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}
