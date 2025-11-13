"use client"

import { ItemOption } from "@/lib/types"

interface TextOptionProps {
  option: ItemOption
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
}

export default function TextOption({
  option,
  value,
  onChange,
  error,
  disabled = false
}: TextOptionProps) {
  const constraints = option.constraints_json || {}
  const maxLength = constraints.max_length
  const currentLength = (value || '').length

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
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        disabled={disabled || !option.active}
        required={option.required}
        placeholder={`Enter ${option.label.toLowerCase()}`}
        aria-required={option.required}
        aria-invalid={!!error}
        aria-describedby={
          error
            ? `option-${option.code}-error`
            : maxLength
            ? `option-${option.code}-length`
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

      {maxLength && !error && (
        <p
          id={`option-${option.code}-length`}
          className="text-xs text-gray-500"
        >
          {currentLength}/{maxLength} characters
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
