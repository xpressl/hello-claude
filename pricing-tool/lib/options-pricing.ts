import Decimal from "decimal.js"
import { ItemOption, OptionsPriceCalculation, OptionSelection } from "./types"

/**
 * Calculate the total price impact of selected options
 *
 * Calculation Order:
 * 1. For select-type options: find the selected value's price_delta
 * 2. For flat price_delta_type: add the price_delta_value directly
 * 3. For percent price_delta_type: calculate percentage of base price
 * 4. Sum all impacts and round to 2 decimals
 *
 * @param options - Available options for the product
 * @param selections - Selected option values (key: option code, value: selected value)
 * @param basePrice - Base product price (for percentage calculations)
 * @returns Total price impact and breakdown
 */
export function calculateOptionsPriceImpact(
  options: ItemOption[],
  selections: Record<string, any>,
  basePrice: number = 0
): OptionsPriceCalculation {
  const breakdown: OptionSelection[] = []
  let totalImpact = new Decimal(0)

  for (const option of options) {
    const selectedValue = selections[option.code]

    // Skip if option not selected
    if (selectedValue === undefined || selectedValue === null || selectedValue === '') {
      continue
    }

    let priceImpact = new Decimal(0)
    let displayLabel = option.label

    // Calculate price impact based on option type
    if (option.type === 'select' && option.values) {
      // Find the selected value in option values
      const optionValue = option.values.find(v => v.value === selectedValue)
      if (optionValue) {
        priceImpact = new Decimal(optionValue.price_delta || 0)
        displayLabel = optionValue.label
      }
    } else if (option.type === 'boolean' && selectedValue === true) {
      // Boolean options apply their price delta when true
      if (option.price_delta_type === 'flat' && option.price_delta_value !== null) {
        priceImpact = new Decimal(option.price_delta_value)
      } else if (option.price_delta_type === 'percent' && option.price_delta_value !== null) {
        priceImpact = new Decimal(basePrice)
          .mul(new Decimal(option.price_delta_value).div(100))
      }
    } else if (option.type === 'number' || option.type === 'text') {
      // Number and text options apply their price delta if configured
      if (option.price_delta_type === 'flat' && option.price_delta_value !== null) {
        priceImpact = new Decimal(option.price_delta_value)
      } else if (option.price_delta_type === 'percent' && option.price_delta_value !== null) {
        priceImpact = new Decimal(basePrice)
          .mul(new Decimal(option.price_delta_value).div(100))
      }
    }

    // Add to breakdown if there's a price impact
    if (!priceImpact.isZero()) {
      breakdown.push({
        code: option.code,
        value: selectedValue,
        label: displayLabel,
        price_impact: Number(priceImpact.toDecimalPlaces(2))
      })

      totalImpact = totalImpact.add(priceImpact)
    }
  }

  return {
    total_impact: Number(totalImpact.toDecimalPlaces(2)),
    breakdown
  }
}

/**
 * Validate selected options against option constraints
 *
 * @param options - Available options for the product
 * @param selections - Selected option values
 * @returns Object with isValid flag and array of error messages
 */
export function validateOptions(
  options: ItemOption[],
  selections: Record<string, any>
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  for (const option of options) {
    const selectedValue = selections[option.code]
    const isEmpty = selectedValue === undefined || selectedValue === null || selectedValue === ''

    // Check required options
    if (option.required && isEmpty) {
      errors[option.code] = `${option.label} is required`
      continue
    }

    // Skip further validation if not selected
    if (isEmpty) {
      continue
    }

    const constraints = option.constraints_json

    // Validate select type
    if (option.type === 'select' && option.values) {
      const validValues = option.values.filter(v => v.active).map(v => v.value)
      if (!validValues.includes(selectedValue)) {
        errors[option.code] = `Invalid selection for ${option.label}`
      }
    }

    // Validate number type
    if (option.type === 'number' && constraints) {
      const numValue = Number(selectedValue)

      if (isNaN(numValue)) {
        errors[option.code] = `${option.label} must be a number`
      } else {
        if (constraints.min !== undefined && numValue < constraints.min) {
          errors[option.code] = `${option.label} must be at least ${constraints.min}`
        }
        if (constraints.max !== undefined && numValue > constraints.max) {
          errors[option.code] = `${option.label} must be at most ${constraints.max}`
        }
      }
    }

    // Validate text type
    if (option.type === 'text' && constraints) {
      const textValue = String(selectedValue)

      if (constraints.max_length !== undefined && textValue.length > constraints.max_length) {
        errors[option.code] = `${option.label} must be ${constraints.max_length} characters or less`
      }

      if (constraints.pattern) {
        try {
          const regex = new RegExp(constraints.pattern)
          if (!regex.test(textValue)) {
            errors[option.code] = `${option.label} format is invalid`
          }
        } catch (e) {
          // Invalid regex pattern in constraints
          console.error('Invalid regex pattern in constraints:', e)
        }
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Get default option selections from option definitions
 *
 * @param options - Available options for the product
 * @returns Object with default selections
 */
export function getDefaultSelections(options: ItemOption[]): Record<string, any> {
  const defaults: Record<string, any> = {}

  for (const option of options) {
    if (option.default_value !== null && option.default_value !== undefined) {
      defaults[option.code] = option.default_value
    } else if (option.type === 'boolean') {
      defaults[option.code] = false
    }
  }

  return defaults
}
