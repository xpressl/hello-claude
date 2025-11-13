/**
 * Pricing Engine v1: Base + Options
 *
 * Calculates line prices based on product base price and selected options.
 * Uses Decimal.js for precise financial calculations and generates detailed
 * price traces for audit purposes.
 *
 * Calculation order:
 * 1. Start with base product price
 * 2. Apply flat option deltas
 * 3. Apply percentage option deltas
 * 4. Round to currency precision
 * 5. Calculate extended price (unit_price * quantity)
 */

import Decimal from 'decimal.js'
import { createClient } from '@supabase/supabase-js'

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN })

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PricingContext {
  catalogItem: {
    id: string
    sku: string
    name: string
    unit_price: number
  }
  options: Record<string, any>  // Selected options { code: value }
  quantity: number
  // Future: customerType, priceListId, discountRules, etc.
}

export interface PricingResult {
  unit_price: number
  extended_price: number
  price_breakdown: PriceComponent[]
  trace: PriceTrace[]
}

export interface PriceComponent {
  label: string
  amount: number
  type: 'base' | 'option_flat' | 'option_percent'
}

export interface PriceTrace {
  step: number
  description: string
  calculation: string
  result: number
}

export interface ItemOption {
  id: string
  item_id: string
  code: string
  label: string
  type: 'select' | 'text' | 'number' | 'checkbox'
  required: boolean
  sort_order: number
  price_delta_type?: 'flat' | 'percent' | null
  price_delta_value?: number | null
  constraints_json?: Record<string, any> | null
  values: OptionValue[]
}

export interface OptionValue {
  id: string
  option_id: string
  value: string
  label: string
  price_delta?: number | null
  sort_order: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ============================================================================
// Main Pricing Function
// ============================================================================

/**
 * Calculate price for a quote line item based on product and selected options
 *
 * @param ctx - Pricing context with catalog item, options, and quantity
 * @returns Pricing result with unit price, extended price, breakdown, and trace
 */
export async function calculatePrice(
  ctx: PricingContext
): Promise<PricingResult> {
  const breakdown: PriceComponent[] = []
  const trace: PriceTrace[] = []

  // Step 1: Start with base product price
  let price = new Decimal(ctx.catalogItem.unit_price)

  breakdown.push({
    label: 'Base Price',
    amount: price.toNumber(),
    type: 'base'
  })

  trace.push({
    step: 1,
    description: 'Base product price',
    calculation: `${ctx.catalogItem.sku} base price`,
    result: price.toNumber()
  })

  // Step 2: Fetch option definitions for this item
  const itemOptions = await fetchItemOptions(ctx.catalogItem.id)

  // Step 3: Apply flat option deltas first
  for (const [code, value] of Object.entries(ctx.options)) {
    const option = itemOptions.find(o => o.code === code)
    if (!option) continue

    // Handle select options with value-specific price deltas
    if (option.type === 'select') {
      const optionValue = option.values.find(v => v.value === value)
      if (optionValue && optionValue.price_delta) {
        const delta = new Decimal(optionValue.price_delta)
        const previousPrice = price
        price = price.plus(delta)

        breakdown.push({
          label: `${option.label}: ${optionValue.label}`,
          amount: delta.toNumber(),
          type: 'option_flat'
        })

        trace.push({
          step: trace.length + 1,
          description: `Add ${option.label} option`,
          calculation: `${previousPrice.toFixed(2)} + ${delta.toFixed(2)}`,
          result: price.toNumber()
        })
      }
    }

    // Handle option-level flat price deltas (applies when option is selected)
    if (option.price_delta_type === 'flat' && option.price_delta_value !== null && option.price_delta_value !== undefined) {
      const delta = new Decimal(option.price_delta_value)
      const previousPrice = price
      price = price.plus(delta)

      breakdown.push({
        label: `${option.label}`,
        amount: delta.toNumber(),
        type: 'option_flat'
      })

      trace.push({
        step: trace.length + 1,
        description: `Add ${option.label} flat delta`,
        calculation: `${previousPrice.toFixed(2)} + ${delta.toFixed(2)}`,
        result: price.toNumber()
      })
    }
  }

  // Step 4: Apply percentage option deltas (after all flat deltas)
  for (const [code, value] of Object.entries(ctx.options)) {
    const option = itemOptions.find(o => o.code === code)
    if (!option) continue

    if (option.price_delta_type === 'percent' && option.price_delta_value !== null && option.price_delta_value !== undefined) {
      const previousPrice = price
      const percentValue = new Decimal(option.price_delta_value)
      const delta = price.times(percentValue).div(100)
      price = price.plus(delta)

      breakdown.push({
        label: `${option.label} (${percentValue.toFixed(1)}%)`,
        amount: delta.toNumber(),
        type: 'option_percent'
      })

      trace.push({
        step: trace.length + 1,
        description: `Apply ${option.label} percentage`,
        calculation: `${previousPrice.toFixed(2)} × (1 + ${percentValue.toFixed(1)}/100)`,
        result: price.toNumber()
      })
    }
  }

  // Step 5: Round to currency precision (2 decimal places, banker's rounding)
  const rawPrice = price
  const unit_price = price.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber()

  if (!rawPrice.equals(unit_price)) {
    trace.push({
      step: trace.length + 1,
      description: 'Round to 2 decimal places',
      calculation: `round(${rawPrice.toFixed(4)}, 2)`,
      result: unit_price
    })
  }

  // Step 6: Calculate extended price (unit_price × quantity)
  const extended_price = new Decimal(unit_price)
    .times(ctx.quantity)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN)
    .toNumber()

  trace.push({
    step: trace.length + 1,
    description: 'Calculate extended price',
    calculation: `${unit_price.toFixed(2)} × ${ctx.quantity}`,
    result: extended_price
  })

  return {
    unit_price,
    extended_price,
    price_breakdown: breakdown,
    trace
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch all active options for a catalog item, including option values
 *
 * @param catalogItemId - The product/catalog item ID
 * @returns Array of item options with their values
 */
export async function fetchItemOptions(
  catalogItemId: string
): Promise<ItemOption[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Query item_options table
    const { data: options, error: optionsError } = await supabase
      .from('item_options')
      .select(`
        id,
        item_id,
        code,
        label,
        type,
        required,
        sort_order,
        price_delta_type,
        price_delta_value,
        constraints_json
      `)
      .eq('item_id', catalogItemId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (optionsError) {
      // If table doesn't exist yet (Phase 2 development), return empty array
      if (optionsError.code === '42P01') {
        console.warn('item_options table not found, returning empty options array')
        return []
      }
      throw optionsError
    }

    if (!options || options.length === 0) {
      return []
    }

    // Fetch option values for select-type options
    const optionIds = options.map(o => o.id)
    const { data: values, error: valuesError } = await supabase
      .from('option_values')
      .select(`
        id,
        option_id,
        value,
        label,
        price_delta,
        sort_order
      `)
      .in('option_id', optionIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (valuesError) {
      // If table doesn't exist yet, continue without values
      if (valuesError.code === '42P01') {
        console.warn('option_values table not found, continuing without values')
        return options.map(o => ({ ...o, values: [] }))
      }
      throw valuesError
    }

    // Combine options with their values
    const optionsWithValues: ItemOption[] = options.map(option => ({
      ...option,
      values: values?.filter(v => v.option_id === option.id) || []
    }))

    return optionsWithValues
  } catch (error) {
    console.error('Error fetching item options:', error)
    // Return empty array to allow pricing to proceed with base price only
    return []
  }
}

/**
 * Validate selected options against option definitions
 *
 * @param options - Array of option definitions
 * @param selected - Object with selected option values { code: value }
 * @returns Validation result with errors if any
 */
export function validateOptions(
  options: ItemOption[],
  selected: Record<string, any>
): ValidationResult {
  const errors: string[] = []

  // Check all required options are provided
  for (const option of options) {
    if (option.required && (selected[option.code] === undefined || selected[option.code] === null || selected[option.code] === '')) {
      errors.push(`${option.label} is required`)
    }
  }

  // Validate constraints for each selected option
  for (const [code, value] of Object.entries(selected)) {
    const option = options.find(o => o.code === code)
    if (!option) {
      // Unknown option codes are ignored (may be legacy/deprecated)
      continue
    }

    // Skip validation if value is empty and not required
    if (!option.required && (value === undefined || value === null || value === '')) {
      continue
    }

    // Validate select options
    if (option.type === 'select') {
      const validValues = option.values.map(v => v.value)
      if (!validValues.includes(value)) {
        errors.push(`${option.label} value "${value}" is not valid`)
      }
    }

    // Validate number options
    if (option.type === 'number' && option.constraints_json) {
      const numValue = typeof value === 'number' ? value : parseFloat(value)
      if (isNaN(numValue)) {
        errors.push(`${option.label} must be a valid number`)
        continue
      }

      const { min, max, step } = option.constraints_json

      if (min !== undefined && numValue < min) {
        errors.push(`${option.label} must be at least ${min}`)
      }
      if (max !== undefined && numValue > max) {
        errors.push(`${option.label} must be at most ${max}`)
      }
      if (step !== undefined) {
        const remainder = (numValue - (min || 0)) % step
        if (remainder !== 0 && Math.abs(remainder) > 0.0001) {
          errors.push(`${option.label} must be a multiple of ${step}`)
        }
      }
    }

    // Validate text options
    if (option.type === 'text' && option.constraints_json) {
      const strValue = String(value)
      const { min_length, max_length, pattern } = option.constraints_json

      if (min_length !== undefined && strValue.length < min_length) {
        errors.push(`${option.label} must be at least ${min_length} characters`)
      }
      if (max_length !== undefined && strValue.length > max_length) {
        errors.push(`${option.label} must be at most ${max_length} characters`)
      }
      if (pattern) {
        try {
          const regex = new RegExp(pattern)
          if (!regex.test(strValue)) {
            errors.push(`${option.label} format is invalid`)
          }
        } catch (e) {
          console.error(`Invalid regex pattern for ${option.code}:`, pattern)
        }
      }
    }

    // Validate checkbox options
    if (option.type === 'checkbox') {
      if (typeof value !== 'boolean') {
        errors.push(`${option.label} must be true or false`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Format price for display
 *
 * @param amount - Price amount
 * @param currency - Currency code (default: USD)
 * @returns Formatted price string
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}
