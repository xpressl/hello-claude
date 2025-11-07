import Decimal from 'decimal.js'

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/**
 * Compute total cost based on unit price and quantity
 * @param unitPrice - Price per unit
 * @param qty - Quantity of units
 * @returns Total cost rounded to 2 decimals
 */
export function computeTotal(unitPrice: number, qty: number): number {
  const price = new Decimal(unitPrice)
  const quantity = new Decimal(qty)
  const total = price.times(quantity)
  return total.toDecimalPlaces(2).toNumber()
}

/**
 * Apply markup percentage to a cost and calculate profit and margin
 * @param cost - Base cost amount
 * @param markupPct - Markup percentage (e.g., 20 for 20%)
 * @returns Object with selling price, profit amount, and margin percentage
 */
export function applyMarkup(
  cost: number,
  markupPct: number
): { price: number; profit: number; marginPct: number } {
  const costDecimal = new Decimal(cost)
  const markupDecimal = new Decimal(markupPct).dividedBy(100)

  // Calculate selling price: cost * (1 + markup%)
  const price = costDecimal.times(markupDecimal.plus(1))

  // Calculate profit: selling price - cost
  const profit = price.minus(costDecimal)

  // Calculate margin: (profit / selling price) * 100
  const marginPct = profit.dividedBy(price).times(100)

  return {
    price: price.toDecimalPlaces(2).toNumber(),
    profit: profit.toDecimalPlaces(2).toNumber(),
    marginPct: marginPct.toDecimalPlaces(2).toNumber(),
  }
}

/**
 * Format a number as US currency
 * @param n - Number to format
 * @returns Formatted string with $ and 2 decimals (e.g., "$1,234.56")
 */
export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/**
 * Calculate margin percentage from cost and selling price
 * @param cost - Base cost
 * @param sellingPrice - Final selling price
 * @returns Margin percentage
 */
export function calculateMargin(cost: number, sellingPrice: number): number {
  const costDecimal = new Decimal(cost)
  const priceDecimal = new Decimal(sellingPrice)

  if (priceDecimal.isZero()) {
    return 0
  }

  const profit = priceDecimal.minus(costDecimal)
  const marginPct = profit.dividedBy(priceDecimal).times(100)

  return marginPct.toDecimalPlaces(2).toNumber()
}

/**
 * Calculate markup percentage from cost and selling price
 * @param cost - Base cost
 * @param sellingPrice - Final selling price
 * @returns Markup percentage
 */
export function calculateMarkup(cost: number, sellingPrice: number): number {
  const costDecimal = new Decimal(cost)
  const priceDecimal = new Decimal(sellingPrice)

  if (costDecimal.isZero()) {
    return 0
  }

  const profit = priceDecimal.minus(costDecimal)
  const markupPct = profit.dividedBy(costDecimal).times(100)

  return markupPct.toDecimalPlaces(2).toNumber()
}
