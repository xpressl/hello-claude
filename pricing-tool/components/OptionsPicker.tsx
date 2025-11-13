"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ItemOption } from "@/lib/types"
import {
  calculateOptionsPriceImpact,
  validateOptions,
  getDefaultSelections
} from "@/lib/options-pricing"
import SelectOption from "./options/SelectOption"
import NumberOption from "./options/NumberOption"
import TextOption from "./options/TextOption"
import BooleanOption from "./options/BooleanOption"
import OptionsPriceBreakdown from "./OptionsPriceBreakdown"

interface OptionsPickerProps {
  catalogItemId: string
  initialOptions?: Record<string, any>
  onOptionsChange: (options: Record<string, any>, priceImpact: number) => void
  basePrice: number
  compact?: boolean
}

export default function OptionsPicker({
  catalogItemId,
  initialOptions = {},
  onOptionsChange,
  basePrice,
  compact = false
}: OptionsPickerProps) {
  const [options, setOptions] = useState<ItemOption[]>([])
  const [selections, setSelections] = useState<Record<string, any>>(initialOptions)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Use ref to avoid infinite loop from onOptionsChange changing
  const onOptionsChangeRef = useRef(onOptionsChange)
  useEffect(() => {
    onOptionsChangeRef.current = onOptionsChange
  }, [onOptionsChange])

  // Fetch options from API
  useEffect(() => {
    async function fetchOptions() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const response = await fetch(
          `/api/catalog/${catalogItemId}/options/customer`
        )

        if (!response.ok) {
          throw new Error('Failed to load options')
        }

        const data = await response.json()

        if (data.options && Array.isArray(data.options)) {
          setOptions(data.options)

          // Set default selections if no initial options provided
          if (Object.keys(initialOptions).length === 0) {
            const defaults = getDefaultSelections(data.options)
            setSelections(defaults)
          }
        } else {
          setOptions([])
        }
      } catch (error) {
        console.error('Error fetching options:', error)
        setLoadError('Unable to load options. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    if (catalogItemId) {
      fetchOptions()
    }
  }, [catalogItemId, initialOptions])

  // Calculate price impact and notify parent whenever selections change
  useEffect(() => {
    if (options.length > 0) {
      const calculation = calculateOptionsPriceImpact(options, selections, basePrice)

      // Validate selections
      const validation = validateOptions(options, selections)
      setErrors(validation.errors)

      // Notify parent component
      onOptionsChangeRef.current(selections, calculation.total_impact)
    }
  }, [selections, options, basePrice])

  // Handle option value change
  const handleOptionChange = (code: string, value: any) => {
    setSelections(prev => ({
      ...prev,
      [code]: value
    }))
  }

  // Retry loading options
  const retryLoad = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const response = await fetch(
        `/api/catalog/${catalogItemId}/options/customer`
      )

      if (!response.ok) {
        throw new Error('Failed to load options')
      }

      const data = await response.json()

      if (data.options && Array.isArray(data.options)) {
        setOptions(data.options)

        // Reset to default selections
        const defaults = getDefaultSelections(data.options)
        setSelections(defaults)
      } else {
        setOptions([])
      }
    } catch (error) {
      console.error('Error fetching options:', error)
      setLoadError('Unable to load options. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [catalogItemId])

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  // Error state
  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm mb-3">{loadError}</p>
        <button
          onClick={retryLoad}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Retry
        </button>
      </div>
    )
  }

  // No options available
  if (options.length === 0) {
    return null
  }

  // Calculate current price breakdown
  const calculation = calculateOptionsPriceImpact(options, selections, basePrice)
  const totalPrice = basePrice + calculation.total_impact

  return (
    <div className="space-y-4">
      {/* Options grid */}
      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'sm:grid-cols-1 md:grid-cols-2'}`}>
        {options.map(option => {
          const value = selections[option.code]
          const error = errors[option.code]

          switch (option.type) {
            case 'select':
              return (
                <SelectOption
                  key={option.id}
                  option={option}
                  value={value || ''}
                  onChange={(val) => handleOptionChange(option.code, val)}
                  error={error}
                />
              )

            case 'number':
              return (
                <NumberOption
                  key={option.id}
                  option={option}
                  value={value ?? ''}
                  onChange={(val) => handleOptionChange(option.code, val)}
                  error={error}
                />
              )

            case 'text':
              return (
                <TextOption
                  key={option.id}
                  option={option}
                  value={value || ''}
                  onChange={(val) => handleOptionChange(option.code, val)}
                  error={error}
                />
              )

            case 'boolean':
              return (
                <BooleanOption
                  key={option.id}
                  option={option}
                  value={value || false}
                  onChange={(val) => handleOptionChange(option.code, val)}
                  error={error}
                />
              )

            default:
              return null
          }
        })}
      </div>

      {/* Price breakdown */}
      <OptionsPriceBreakdown
        basePrice={basePrice}
        breakdown={calculation.breakdown}
        totalPrice={totalPrice}
        compact={compact}
      />
    </div>
  )
}
