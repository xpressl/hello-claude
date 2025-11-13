"use client"

import { ItemOption, OptionValue } from "@/lib/types"
import { formatMoney } from "@/lib/pricing"

interface SelectOptionProps {
  option: ItemOption
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export default function SelectOption({
  option,
  value,
  onChange,
  error,
  disabled = false
}: SelectOptionProps) {
  const values = option.values || []

  return (
    <div className="space-y-1">
      <label
        htmlFor={`option-${option.code}`}
        className="block text-sm font-medium text-gray-700"
      >
        {option.label}
        {option.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <select
        id={`option-${option.code}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !option.active}
        required={option.required}
        aria-required={option.required}
        aria-invalid={!!error}
        aria-describedby={error ? `option-${option.code}-error` : undefined}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:ring-blue-500'
        } ${
          disabled || !option.active
            ? 'bg-gray-100 cursor-not-allowed'
            : 'bg-white'
        }`}
      >
        <option value="">
          -- Select {option.label} --
        </option>
        {values.map((optionValue: OptionValue) => (
          <option
            key={optionValue.id}
            value={optionValue.value}
          >
            {optionValue.label}
            {optionValue.price_delta !== 0 && ` (${optionValue.price_delta > 0 ? '+' : ''}${formatMoney(optionValue.price_delta)})`}
          </option>
        ))}
      </select>

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
