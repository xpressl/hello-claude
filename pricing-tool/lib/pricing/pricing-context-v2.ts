/**
 * Pricing Engine v2 Context and Result Types
 *
 * Extends v1 with support for:
 * - Price lists (base, segment, promotional, seasonal)
 * - Quantity tiers and volume discounts
 * - Pricing rules with conditions
 * - Customer-specific pricing
 * - Price overrides with approval workflow
 * - Floor/ceiling enforcement
 * - Margin calculations
 */

export interface Product {
  id: string
  sku: string
  name: string
  unit_price: number
  category_id?: string
  tags?: string[]
  price_floor?: number
  price_ceiling?: number
  cost_basis?: number
}

export interface PricingContextV2 {
  // Product info
  catalogItem: Product
  options: Record<string, any>
  quantity: number

  // Advanced pricing context
  priceListId?: string
  customerType?: 'retail' | 'contractor' | 'wholesale'
  quoteId?: string
  quoteDate?: Date
  applyRules?: boolean  // Default true
  overridePrice?: number  // Manual override

  // Debug options
  debugMode?: boolean
  skipCache?: boolean
}

export interface PriceComponent {
  label: string
  amount: number
  type: 'base' | 'option_flat' | 'option_percent' | 'rule' | 'override'
}

export interface AppliedRule {
  rule_id: string
  rule_name: string
  rule_type: 'percentage' | 'fixed_amount' | 'fixed_price'
  adjustment: number
  order: number
}

export interface PriceOverride {
  type: 'manual' | 'approval_required'
  original_price: number
  override_price: number
  reason: string
  requires_approval: boolean
}

export interface PriceTrace {
  step: number
  description: string
  calculation: string
  result: number
}

export interface PricingResultV2 {
  // Core prices
  unit_price: number
  extended_price: number
  base_price: number
  list_price: number
  final_price: number

  // Breakdown
  price_components: PriceComponent[]
  rules_applied: AppliedRule[]
  overrides: PriceOverride[]

  // Metadata
  price_list_used: string | null
  quantity_tier_used: string | null
  warnings: string[]
  trace: PriceTrace[]

  // Margins
  cost_basis?: number
  margin_amount?: number
  margin_percent?: number
}
