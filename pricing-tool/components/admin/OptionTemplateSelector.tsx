'use client'

import { useState } from 'react'

interface OptionTemplateProps {
  catalogItemId: string
  onSelected: () => void
  onClose: () => void
}

interface Template {
  name: string
  description: string
  option: {
    code: string
    label: string
    type: 'select' | 'number' | 'text' | 'boolean'
    required: boolean
    price_delta_type: 'none' | 'flat' | 'percent'
    price_delta_value?: number
  }
  values?: Array<{
    value: string
    label: string
    price_delta: number
    sku_suffix?: string
  }>
}

const TEMPLATES: Template[] = [
  {
    name: 'Size',
    description: 'Standard door sizes with price adjustments',
    option: {
      code: 'SIZE',
      label: 'Door Size',
      type: 'select',
      required: true,
      price_delta_type: 'none',
    },
    values: [
      { value: '30x80', label: '30" x 80"', price_delta: 0, sku_suffix: '-3080' },
      { value: '36x80', label: '36" x 80"', price_delta: 25.0, sku_suffix: '-3680' },
      { value: '36x84', label: '36" x 84"', price_delta: 50.0, sku_suffix: '-3684' },
      { value: '42x80', label: '42" x 80"', price_delta: 75.0, sku_suffix: '-4280' },
    ],
  },
  {
    name: 'Color',
    description: 'Standard color options',
    option: {
      code: 'COLOR',
      label: 'Color',
      type: 'select',
      required: false,
      price_delta_type: 'none',
    },
    values: [
      { value: 'white', label: 'White', price_delta: 0, sku_suffix: '-WHT' },
      { value: 'black', label: 'Black', price_delta: 0, sku_suffix: '-BLK' },
      { value: 'gray', label: 'Gray', price_delta: 0, sku_suffix: '-GRY' },
      { value: 'brown', label: 'Brown', price_delta: 0, sku_suffix: '-BRN' },
    ],
  },
  {
    name: 'Finish',
    description: 'Surface finish options',
    option: {
      code: 'FINISH',
      label: 'Finish',
      type: 'select',
      required: false,
      price_delta_type: 'none',
    },
    values: [
      { value: 'primed', label: 'Primed', price_delta: 0, sku_suffix: '-PRM' },
      { value: 'painted', label: 'Painted', price_delta: 50.0, sku_suffix: '-PNT' },
      { value: 'stained', label: 'Stained', price_delta: 75.0, sku_suffix: '-STN' },
      { value: 'clear', label: 'Clear Coat', price_delta: 35.0, sku_suffix: '-CLR' },
    ],
  },
  {
    name: 'Handedness',
    description: 'Left-hand, right-hand, or universal',
    option: {
      code: 'HANDEDNESS',
      label: 'Handedness',
      type: 'select',
      required: true,
      price_delta_type: 'none',
    },
    values: [
      { value: 'left', label: 'Left Hand', price_delta: 0, sku_suffix: '-LH' },
      { value: 'right', label: 'Right Hand', price_delta: 0, sku_suffix: '-RH' },
      { value: 'universal', label: 'Universal', price_delta: 25.0, sku_suffix: '-UNI' },
    ],
  },
  {
    name: 'Hardware Package',
    description: 'Hardware options with pricing',
    option: {
      code: 'HARDWARE',
      label: 'Hardware Package',
      type: 'select',
      required: false,
      price_delta_type: 'none',
    },
    values: [
      { value: 'none', label: 'No Hardware', price_delta: 0, sku_suffix: '' },
      { value: 'knob_basic', label: 'Basic Knob', price_delta: 25.0, sku_suffix: '-HW-KB' },
      {
        value: 'lever_basic',
        label: 'Basic Lever',
        price_delta: 45.0,
        sku_suffix: '-HW-LB',
      },
      {
        value: 'lever_satin',
        label: 'Satin Nickel Lever',
        price_delta: 75.0,
        sku_suffix: '-HW-LS',
      },
      {
        value: 'lever_bronze',
        label: 'Oil Rubbed Bronze Lever',
        price_delta: 95.0,
        sku_suffix: '-HW-LO',
      },
    ],
  },
  {
    name: 'Quantity Discount',
    description: 'Percentage discount based on quantity',
    option: {
      code: 'QTY_DISCOUNT',
      label: 'Quantity Discount',
      type: 'boolean',
      required: false,
      price_delta_type: 'percent',
      price_delta_value: -10,
    },
  },
]

export default function OptionTemplateSelector({
  catalogItemId,
  onSelected,
  onClose,
}: OptionTemplateProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return

    try {
      setCreating(true)

      // Create the option
      const optionResponse = await fetch(`/api/catalog/${catalogItemId}/options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          ...selectedTemplate.option,
          sort_order: 0,
          active: true,
        }),
      })

      if (!optionResponse.ok) {
        const data = await optionResponse.json()
        throw new Error(data.error || 'Failed to create option')
      }

      const { option } = await optionResponse.json()

      // If template has values, create them
      if (selectedTemplate.values && selectedTemplate.values.length > 0) {
        const valuePromises = selectedTemplate.values.map((value, index) =>
          fetch(`/api/options/${option.id}/values`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            },
            body: JSON.stringify({
              ...value,
              sort_order: index,
              active: true,
            }),
          })
        )

        const results = await Promise.all(valuePromises)
        const failedResults = results.filter((r) => !r.ok)

        if (failedResults.length > 0) {
          console.warn('Some values failed to create:', failedResults)
        }
      }

      onSelected()
    } catch (err: any) {
      console.error('Error creating option from template:', err)
      alert('Failed to create option: ' + err.message)
    } finally {
      setCreating(false)
    }
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Select Option Template</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
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

          {/* Template list */}
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Select a pre-configured option template to quickly add common options with default
              values.
            </p>

            <div className="space-y-3">
              {TEMPLATES.map((template) => (
                <button
                  key={template.option.code}
                  onClick={() => setSelectedTemplate(template)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedTemplate?.option.code === template.option.code
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">
                        {template.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">{template.description}</p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {template.option.type}
                        </span>
                        {template.option.required && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Required
                          </span>
                        )}
                        {template.values && (
                          <span className="text-xs text-gray-500">
                            {template.values.length} values
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedTemplate?.option.code === template.option.code && (
                      <svg
                        className="h-6 w-6 text-blue-600 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateFromTemplate}
              disabled={!selectedTemplate || creating}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create from Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
