'use client'

import { useState, useEffect } from 'react'
import { ItemOption, OptionType, PriceDeltaType } from '@/lib/types'

interface OptionFormProps {
  catalogItemId: string
  option?: ItemOption | null
  onSaved: () => void
  onClose: () => void
}

export default function OptionForm({
  catalogItemId,
  option,
  onSaved,
  onClose,
}: OptionFormProps) {
  const [formData, setFormData] = useState({
    code: option?.code || '',
    label: option?.label || '',
    type: option?.type || 'select' as OptionType,
    required: option?.required || false,
    default_value: option?.default_value || '',
    sort_order: option?.sort_order || 0,
    price_delta_type: option?.price_delta_type || 'none' as PriceDeltaType,
    price_delta_value: option?.price_delta_value || 0,
    active: option?.active !== undefined ? option.active : true,
    constraints_json: option?.constraints_json || {},
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [constraintsText, setConstraintsText] = useState(
    JSON.stringify(option?.constraints_json || {}, null, 2)
  )

  const isEditing = !!option

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.code) {
      newErrors.code = 'Code is required'
    } else if (!/^[A-Z0-9_]+$/.test(formData.code)) {
      newErrors.code = 'Code must be uppercase letters, numbers, and underscores only'
    } else if (formData.code.length < 2 || formData.code.length > 50) {
      newErrors.code = 'Code must be between 2 and 50 characters'
    }

    if (!formData.label) {
      newErrors.label = 'Label is required'
    } else if (formData.label.length > 100) {
      newErrors.label = 'Label must be less than 100 characters'
    }

    if (formData.price_delta_type !== 'none' && !formData.price_delta_value) {
      newErrors.price_delta_value = 'Price delta value is required when type is not "none"'
    }

    if (formData.price_delta_type === 'percent' && formData.price_delta_value > 100) {
      newErrors.price_delta_value = 'Percent must be between 0 and 100'
    }

    // Validate constraints JSON
    try {
      JSON.parse(constraintsText)
    } catch (err) {
      newErrors.constraints_json = 'Invalid JSON format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    try {
      setSaving(true)
      setSaveError(null)

      const body = {
        ...formData,
        constraints_json: JSON.parse(constraintsText),
      }

      const url = isEditing
        ? `/api/catalog/${catalogItemId}/options/${option.id}`
        : `/api/catalog/${catalogItemId}/options`

      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save option')
      }

      onSaved()
    } catch (err: any) {
      console.error('Error saving option:', err)
      setSaveError('Failed to save option: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Handle code input (auto-uppercase)
  const handleCodeChange = (value: string) => {
    setFormData({ ...formData, code: value.toUpperCase() })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Option' : 'Create Option'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Save error message */}
            {saveError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <div className="flex items-center">
                  <svg
                    className="h-5 w-5 text-red-400 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm text-red-800">{saveError}</p>
                  <button
                    type="button"
                    onClick={() => setSaveError(null)}
                    className="ml-auto text-red-400 hover:text-red-600"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Code and Label */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                  Code <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  disabled={isEditing}
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                    errors.code
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  } ${isEditing ? 'bg-gray-100' : ''}`}
                  placeholder="SIZE"
                />
                {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  Uppercase letters, numbers, and underscores only
                </p>
              </div>

              <div>
                <label htmlFor="label" className="block text-sm font-medium text-gray-700">
                  Label <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                    errors.label
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  placeholder="Door Size"
                />
                {errors.label && <p className="mt-1 text-sm text-red-600">{errors.label}</p>}
              </div>
            </div>

            {/* Type and Required */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                  Type <span className="text-red-600">*</span>
                </label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as OptionType })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="select">Select (dropdown)</option>
                  <option value="number">Number</option>
                  <option value="text">Text</option>
                  <option value="boolean">Boolean (yes/no)</option>
                </select>
              </div>

              <div>
                <label htmlFor="sort_order" className="block text-sm font-medium text-gray-700">
                  Sort Order
                </label>
                <input
                  type="number"
                  id="sort_order"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Required and Active checkboxes */}
            <div className="flex items-center gap-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Required</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Active</span>
              </label>
            </div>

            {/* Default Value */}
            <div>
              <label htmlFor="default_value" className="block text-sm font-medium text-gray-700">
                Default Value
              </label>
              <input
                type="text"
                id="default_value"
                value={formData.default_value || ''}
                onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Optional"
              />
            </div>

            {/* Price Delta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="price_delta_type"
                  className="block text-sm font-medium text-gray-700"
                >
                  Price Delta Type
                </label>
                <select
                  id="price_delta_type"
                  value={formData.price_delta_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_delta_type: e.target.value as PriceDeltaType,
                    })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="none">None</option>
                  <option value="flat">Flat ($)</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </div>

              {formData.price_delta_type !== 'none' && (
                <div>
                  <label
                    htmlFor="price_delta_value"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Price Delta Value
                  </label>
                  <input
                    type="number"
                    id="price_delta_value"
                    step="0.01"
                    value={formData.price_delta_value}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price_delta_value: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                      errors.price_delta_value
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                  />
                  {errors.price_delta_value && (
                    <p className="mt-1 text-sm text-red-600">{errors.price_delta_value}</p>
                  )}
                </div>
              )}
            </div>

            {/* Constraints JSON */}
            <div>
              <label
                htmlFor="constraints_json"
                className="block text-sm font-medium text-gray-700"
              >
                Constraints (JSON)
              </label>
              <textarea
                id="constraints_json"
                value={constraintsText}
                onChange={(e) => setConstraintsText(e.target.value)}
                rows={5}
                className={`mt-1 block w-full rounded-md shadow-sm font-mono text-sm ${
                  errors.constraints_json
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
                placeholder='{"min": 0, "max": 100}'
              />
              {errors.constraints_json && (
                <p className="mt-1 text-sm text-red-600">{errors.constraints_json}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                For number: {`{"min": 0, "max": 100, "step": 1}`} <br />
                For text: {`{"min_length": 1, "max_length": 50, "pattern": ".*"}`}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : isEditing ? 'Update Option' : 'Create Option'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
