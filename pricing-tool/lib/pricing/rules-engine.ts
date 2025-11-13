/**
 * Pricing Rules Engine
 *
 * Evaluates and applies dynamic pricing rules with:
 * - Percentage adjustments
 * - Fixed amount adjustments
 * - Fixed price replacements
 * - Conditional logic
 * - Quantity-based rules
 * - Priority ordering
 */

import { createClient } from '@supabase/supabase-js'
import Decimal from 'decimal.js'

export interface PriceRule {
  id: string
  name: string
  rule_type: 'percentage' | 'fixed_amount' | 'fixed_price'
  adjustment_value: number
  scope: 'all' | 'category' | 'product' | 'tag'
  scope_value?: string
  conditions_json: Record<string, any>
  priority: number
  min_quantity?: number
  max_quantity?: number
  is_active: boolean
}

export interface AppliedRule {
  rule_id: string
  rule_name: string
  rule_type: 'percentage' | 'fixed_amount' | 'fixed_price'
  adjustment: number
  order: number
}

interface RuleContext {
  quantity: number
  customerType?: string
  orderValue?: number
  categoryId?: string
  tags?: string[]
}

/**
 * Get applicable pricing rules for a product
 * Filters by:
 * - Active status
 * - Valid date range
 * - Scope (all, category, product, tag)
 */
export async function getApplicableRules(
  productId: string,
  categoryId?: string,
  tags?: string[],
  date: Date = new Date()
): Promise<PriceRule[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: rules, error } = await supabase
      .from('price_rules')
      .select('*')
      .eq('is_active', true)
      .lte('valid_from', date.toISOString())
      .gte('valid_to', date.toISOString())
      .order('priority', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching price rules:', error)
      return []
    }

    if (!rules) {
      return []
    }

    // Filter by valid date range manually
    const validRules = rules.filter(r => {
      const isAfterStart = !r.valid_from || new Date(r.valid_from) <= date
      const isBeforeEnd = !r.valid_to || new Date(r.valid_to) >= date
      return isAfterStart && isBeforeEnd
    })

    // Filter rules by scope
    return validRules.filter(rule => {
      if (rule.scope === 'all') return true
      if (rule.scope === 'product' && rule.scope_value === productId) return true
      if (rule.scope === 'category' && rule.scope_value === categoryId) return true
      if (rule.scope === 'tag' && tags?.includes(rule.scope_value!)) return true
      return false
    })
  } catch (error) {
    console.error('Error in getApplicableRules:', error)
    return []
  }
}

/**
 * Apply applicable rules to a base price
 * Returns final price and list of applied rules with adjustments
 */
export function applyRules(
  basePrice: number,
  rules: PriceRule[],
  context: RuleContext
): {
  final_price: number
  applied_rules: AppliedRule[]
} {
  let price = new Decimal(basePrice)
  const applied_rules: AppliedRule[] = []

  // Sort by priority (highest first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority)

  for (const rule of sortedRules) {
    // Check conditions
    if (!evaluateConditions(rule.conditions_json, context)) {
      continue
    }

    // Check quantity constraints
    if (rule.min_quantity !== undefined && rule.min_quantity !== null) {
      if (context.quantity < rule.min_quantity) {
        continue
      }
    }
    if (rule.max_quantity !== undefined && rule.max_quantity !== null) {
      if (context.quantity > rule.max_quantity) {
        continue
      }
    }

    // Apply rule
    let adjustment = new Decimal(0)

    if (rule.rule_type === 'percentage') {
      const percentValue = new Decimal(rule.adjustment_value)
      adjustment = price.times(percentValue).div(100)
      price = price.plus(adjustment)
    } else if (rule.rule_type === 'fixed_amount') {
      adjustment = new Decimal(rule.adjustment_value)
      price = price.plus(adjustment)
    } else if (rule.rule_type === 'fixed_price') {
      adjustment = new Decimal(rule.adjustment_value).minus(price)
      price = new Decimal(rule.adjustment_value)
    }

    applied_rules.push({
      rule_id: rule.id,
      rule_name: rule.name,
      rule_type: rule.rule_type,
      adjustment: adjustment.toNumber(),
      order: applied_rules.length + 1
    })
  }

  return {
    final_price: price.toNumber(),
    applied_rules
  }
}

/**
 * Evaluate rule conditions against context
 * Supports:
 * - min_order_value: Minimum order total
 * - customer_type: Specific customer type
 * - day_of_week: Specific days only
 * - min_quantity: Minimum order quantity
 */
function evaluateConditions(
  conditions: Record<string, any>,
  context: RuleContext
): boolean {
  // Min order value
  if (conditions.min_order_value !== undefined && conditions.min_order_value !== null) {
    if (context.orderValue === undefined || context.orderValue < conditions.min_order_value) {
      return false
    }
  }

  // Customer type
  if (conditions.customer_type !== undefined && conditions.customer_type !== null) {
    if (context.customerType && context.customerType !== conditions.customer_type) {
      return false
    }
  }

  // Day of week
  if (conditions.day_of_week && Array.isArray(conditions.day_of_week)) {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const allowedDays = conditions.day_of_week.map((d: string) => d.toLowerCase())
    if (!allowedDays.includes(today)) {
      return false
    }
  }

  // Min quantity
  if (conditions.min_quantity !== undefined && conditions.min_quantity !== null) {
    if (context.quantity < conditions.min_quantity) {
      return false
    }
  }

  return true
}

/**
 * Get all active rules (for admin UI)
 */
export async function getAllRules(): Promise<PriceRule[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: rules, error } = await supabase
      .from('price_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (error) {
      console.error('Error fetching all rules:', error)
      return []
    }

    return rules || []
  } catch (error) {
    console.error('Error in getAllRules:', error)
    return []
  }
}
