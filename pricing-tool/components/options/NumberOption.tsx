"use client"

import { ItemOption } from "@/lib/types"

interface NumberOptionProps {
  option: ItemOption
  value: number | string
  onChange: (value: number | string) => void
  error?: string
  disabled?: boolean
}

export default function NumberOption({
  option,
  value,
  onChange,
  error,
  disabled = false
}: NumberOptionProps) {
  const constraints = option.constraints_json || {}
  const min = constraints.min
  const max = constraints.max
  const step = constraints.step || 1

  return (
    <div className="space-y-1">
      <label
        htmlFor={`option-${option.code}`}
        className="block text-sm font-medium text-gray-700"
      >
        {option.label}
        {option.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <input
        id={`option-${option.code}`}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        disabled={disabled || !option.active}
        required={option.required}
        aria-required={option.required}
        aria-invalid={!!error}
        aria-describedby={
          error
            ? `option-${option.code}-error`
            : min !== undefined || max !== undefined
            ? `option-${option.code}-constraints`
            : undefined
        }
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:ring-blue-500'
        } ${
          disabled || !option.active
            ? 'bg-gray-100 cursor-not-allowed'
            : 'bg-white'
        }`}
      />

      {(min !== undefined || max !== undefined) && !error && (
        <p
          id={`option-${option.code}-constraints`}
          className="text-xs text-gray-500"
        >
          {min !== undefined && max !== undefined
            ? `Min: ${min}, Max: ${max}`
            : min !== undefined
            ? `Min: ${min}`
            : `Max: ${max}`}
        </p>
      )}

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
