import Decimal from "decimal.js"
import type { MarkupHierarchy, Product, Customer } from "./types"

// Default global markup percentage
export const DEFAULT_GLOBAL_MARKUP = 25

export function computeTotal(unitPrice: number, qty: number) {
  const up = new Decimal(unitPrice || 0)
  const q = new Decimal(qty || 0)
  return Number(up.mul(q).toDecimalPlaces(4)) // keep precision, round later for display
}

export function applyMarkup(cost: number, markupPct: number) {
  const c = new Decimal(cost || 0)
  const m = new Decimal(markupPct || 0).div(100)
  const price = c.mul(m.add(1))
  const profit = price.sub(c)
  const marginPct = profit.div(price.gt(0) ? price : new Decimal(1)).mul(100)
  return {
    price: Number(price.toDecimalPlaces(2)),
    profit: Number(profit.toDecimalPlaces(2)),
    marginPct: Number(marginPct.toDecimalPlaces(1)),
  }
}

export function formatMoney(n: number) {
  return `$${(n || 0).toFixed(2)}`
}

/**
 * Get effective markup based on hierarchy:
 * Customer markup > Product markup > Global default
 */
export function getEffectiveMarkup(
  customerMarkup?: number,
  productMarkup?: number,
  globalMarkup: number = DEFAULT_GLOBAL_MARKUP
): MarkupHierarchy {
  let effectiveMarkup: number
  let source: "global" | "product" | "customer" | "custom"

  if (customerMarkup !== undefined && customerMarkup !== null) {
    effectiveMarkup = customerMarkup
    source = "customer"
  } else if (productMarkup !== undefined && productMarkup !== null) {
    effectiveMarkup = productMarkup
    source = "product"
  } else {
    effectiveMarkup = globalMarkup
    source = "global"
  }

  return {
    globalDefault: globalMarkup,
    productDefault: productMarkup,
    customerDefault: customerMarkup,
    effectiveMarkup,
    source,
  }
}

/**
 * Calculate line item totals
 */
export function calculateLineItem(
  unitPrice: number,
  quantity: number,
  markupPct: number
) {
  const cost = computeTotal(unitPrice, quantity)
  const { price, profit, marginPct } = applyMarkup(cost, markupPct)
  return { cost, price, profit, marginPct }
}

/**
 * Calculate quote totals from line items
 */
export function calculateQuoteTotals(
  items: Array<{ cost: number; price: number }>
) {
  const subtotal = items.reduce((sum, item) => sum + item.cost, 0)
  const total = items.reduce((sum, item) => sum + item.price, 0)
  const totalProfit = total - subtotal

  return {
    subtotal: Number(new Decimal(subtotal).toDecimalPlaces(2)),
    total: Number(new Decimal(total).toDecimalPlaces(2)),
    totalProfit: Number(new Decimal(totalProfit).toDecimalPlaces(2)),
  }
}

/**
 * Format markup source for display
 */
export function formatMarkupSource(hierarchy: MarkupHierarchy): string {
  switch (hierarchy.source) {
    case "customer":
      return `Using customer markup (${hierarchy.effectiveMarkup}%)`
    case "product":
      return `Using product markup (${hierarchy.effectiveMarkup}%)`
    case "global":
      return `Using standard markup (${hierarchy.effectiveMarkup}%)`
    case "custom":
      return `Custom markup (${hierarchy.effectiveMarkup}%)`
  }
}
