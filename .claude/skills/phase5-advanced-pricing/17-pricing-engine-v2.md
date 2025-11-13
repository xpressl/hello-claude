# Task 17: Pricing Engine v2 with Advanced Rules

## Objective
Extend the Phase 2 pricing engine to support price lists, quantity tiers, category/product discounts, pricing rules, and floor/ceiling enforcement.

## Context
- Build on Task 08 (Pricing Engine v1)
- Integrate with Task 16 (Price Lists schema)
- Support complex pricing scenarios
- Maintain audit trail with detailed traces
- Performance critical: cache frequently accessed prices
- Backwards compatible with v1

## Requirements

### 1. Enhanced Pricing Context

**File:** `pricing-tool/lib/pricing/pricing-context-v2.ts`

```typescript
import { Product } from '@/lib/types'

export interface PricingContextV2 {
  // Product info
  catalogItem: Product
  options: Record<string, any>
  quantity: number

  // Advanced context
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

export interface PricingResultV2 {
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
```

### 2. Price List Resolver

**File:** `pricing-tool/lib/pricing/price-list-resolver.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

export async function resolveActivePriceList(
  customerType?: string,
  date: Date = new Date()
): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get active price lists sorted by priority
  const { data: priceLists } = await supabase
    .from('price_lists')
    .select('id, name, type, priority')
    .eq('is_active', true)
    .or(`valid_from.is.null,valid_from.lte.${date.toISOString()}`)
    .or(`valid_to.is.null,valid_to.gte.${date.toISOString()}`)
    .order('priority', { ascending: false })

  if (!priceLists || priceLists.length === 0) {
    return null
  }

  // Match by customer type
  if (customerType) {
    const typeMap: Record<string, string[]> = {
      'contractor': ['contractor', 'customer_segment'],
      'wholesale': ['wholesale', 'customer_segment'],
      'retail': ['base', 'retail']
    }

    const preferredTypes = typeMap[customerType] || ['base']

    for (const type of preferredTypes) {
      const match = priceLists.find(pl => pl.type === type)
      if (match) {
        return match.id
      }
    }
  }

  // Return highest priority list
  return priceLists[0].id
}

export async function getPriceFromList(
  priceListId: string,
  productId: string,
  quantity: number
): Promise<number | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find matching quantity tier
  const { data: item } = await supabase
    .from('price_list_items')
    .select('unit_price')
    .eq('price_list_id', priceListId)
    .eq('product_id', productId)
    .lte('min_quantity', quantity)
    .or(`max_quantity.is.null,max_quantity.gte.${quantity}`)
    .order('min_quantity', { ascending: false })
    .limit(1)
    .single()

  return item?.unit_price || null
}
```

### 3. Pricing Rules Engine

**File:** `pricing-tool/lib/pricing/rules-engine.ts`

```typescript
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
}

export async function getApplicableRules(
  productId: string,
  categoryId?: string,
  tags?: string[],
  date: Date = new Date()
): Promise<PriceRule[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: rules } = await supabase
    .from('price_rules')
    .select('*')
    .eq('is_active', true)
    .or(`valid_from.is.null,valid_from.lte.${date.toISOString()}`)
    .or(`valid_to.is.null,valid_to.gte.${date.toISOString()}`)
    .order('priority', { ascending: false })

  if (!rules) return []

  // Filter rules by scope
  return rules.filter(rule => {
    if (rule.scope === 'all') return true
    if (rule.scope === 'product' && rule.scope_value === productId) return true
    if (rule.scope === 'category' && rule.scope_value === categoryId) return true
    if (rule.scope === 'tag' && tags?.includes(rule.scope_value!)) return true
    return false
  })
}

export function applyRules(
  basePrice: number,
  rules: PriceRule[],
  context: {
    quantity: number
    customerType?: string
    orderValue?: number
  }
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
    if (rule.min_quantity && context.quantity < rule.min_quantity) {
      continue
    }
    if (rule.max_quantity && context.quantity > rule.max_quantity) {
      continue
    }

    // Apply rule
    let adjustment = 0

    if (rule.rule_type === 'percentage') {
      adjustment = price.times(rule.adjustment_value).div(100).toNumber()
      price = price.plus(adjustment)
    } else if (rule.rule_type === 'fixed_amount') {
      adjustment = rule.adjustment_value
      price = price.plus(adjustment)
    } else if (rule.rule_type === 'fixed_price') {
      adjustment = rule.adjustment_value - price.toNumber()
      price = new Decimal(rule.adjustment_value)
    }

    applied_rules.push({
      rule_id: rule.id,
      rule_name: rule.name,
      rule_type: rule.rule_type,
      adjustment,
      order: applied_rules.length + 1
    })
  }

  return {
    final_price: price.toNumber(),
    applied_rules
  }
}

function evaluateConditions(
  conditions: Record<string, any>,
  context: {
    quantity: number
    customerType?: string
    orderValue?: number
  }
): boolean {
  // Min order value
  if (conditions.min_order_value && context.orderValue) {
    if (context.orderValue < conditions.min_order_value) {
      return false
    }
  }

  // Customer type
  if (conditions.customer_type && context.customerType) {
    if (context.customerType !== conditions.customer_type) {
      return false
    }
  }

  // Day of week
  if (conditions.day_of_week) {
    const today = new Date().toLocaleLowerCase().substring(0, 3)
    if (!conditions.day_of_week.map((d: string) => d.substring(0, 3)).includes(today)) {
      return false
    }
  }

  return true
}
```

### 4. Enhanced Pricing Engine v2

**File:** `pricing-tool/lib/pricing/pricing-engine-v2.ts`

```typescript
import Decimal from 'decimal.js'
import { PricingContextV2, PricingResultV2 } from './pricing-context-v2'
import { resolveActivePriceList, getPriceFromList } from './price-list-resolver'
import { getApplicableRules, applyRules } from './rules-engine'
import { calculatePrice as calculatePriceV1 } from '../pricing-engine'  // v1 for options

export async function calculatePriceV2(
  ctx: PricingContextV2
): Promise<PricingResultV2> {
  const trace: PriceTrace[] = []
  const warnings: string[] = []
  const price_components: PriceComponent[] = []

  // Step 1: Get base product price
  let basePrice = new Decimal(ctx.catalogItem.unit_price)
  trace.push({
    step: 1,
    description: 'Base product price',
    calculation: `${ctx.catalogItem.sku} base price`,
    result: basePrice.toNumber()
  })
  price_components.push({
    label: 'Base Price',
    amount: basePrice.toNumber(),
    type: 'base'
  })

  // Step 2: Apply options (using v1 engine)
  if (Object.keys(ctx.options).length > 0) {
    const v1Result = await calculatePriceV1({
      catalogItem: ctx.catalogItem,
      options: ctx.options,
      quantity: 1  // Don't multiply yet
    })

    basePrice = new Decimal(v1Result.unit_price)
    trace.push({
      step: 2,
      description: 'Applied product options',
      calculation: `Base + options`,
      result: basePrice.toNumber()
    })

    // Merge option components
    price_components.push(...v1Result.price_breakdown)
  }

  // Step 3: Get price from price list (if applicable)
  let listPrice = basePrice
  let priceListUsed: string | null = null
  let quantityTierUsed: string | null = null

  if (!ctx.overridePrice) {
    const priceListId = ctx.priceListId || await resolveActivePriceList(ctx.customerType, ctx.quoteDate)

    if (priceListId) {
      const priceFromList = await getPriceFromList(priceListId, ctx.catalogItem.id, ctx.quantity)

      if (priceFromList) {
        listPrice = new Decimal(priceFromList)
        priceListUsed = priceListId
        quantityTierUsed = `Qty ${ctx.quantity}`

        trace.push({
          step: 3,
          description: 'Price from list',
          calculation: `Price list price for qty ${ctx.quantity}`,
          result: listPrice.toNumber()
        })
      }
    }
  }

  // Step 4: Apply pricing rules
  let finalPrice = listPrice
  let appliedRules: AppliedRule[] = []

  if (ctx.applyRules !== false && !ctx.overridePrice) {
    const rules = await getApplicableRules(
      ctx.catalogItem.id,
      ctx.catalogItem.category_id,
      ctx.catalogItem.tags
    )

    const rulesResult = applyRules(listPrice.toNumber(), rules, {
      quantity: ctx.quantity,
      customerType: ctx.customerType
    })

    finalPrice = new Decimal(rulesResult.final_price)
    appliedRules = rulesResult.applied_rules

    if (appliedRules.length > 0) {
      trace.push({
        step: 4,
        description: `Applied ${appliedRules.length} pricing rule(s)`,
        calculation: appliedRules.map(r => r.rule_name).join(', '),
        result: finalPrice.toNumber()
      })
    }
  }

  // Step 5: Apply manual override
  const overrides: PriceOverride[] = []
  if (ctx.overridePrice !== undefined) {
    const discountPercent = ((finalPrice.toNumber() - ctx.overridePrice) / finalPrice.toNumber()) * 100

    overrides.push({
      type: Math.abs(discountPercent) > 10 ? 'approval_required' : 'manual',
      original_price: finalPrice.toNumber(),
      override_price: ctx.overridePrice,
      reason: 'Manual override',
      requires_approval: Math.abs(discountPercent) > 10
    })

    finalPrice = new Decimal(ctx.overridePrice)

    trace.push({
      step: 5,
      description: 'Manual price override',
      calculation: `Override to ${ctx.overridePrice}`,
      result: finalPrice.toNumber()
    })

    if (Math.abs(discountPercent) > 10) {
      warnings.push(`Override discount of ${discountPercent.toFixed(1)}% requires approval`)
    }
  }

  // Step 6: Enforce floor/ceiling
  if (ctx.catalogItem.price_floor && finalPrice.lt(ctx.catalogItem.price_floor)) {
    warnings.push(`Price ${finalPrice} is below floor of ${ctx.catalogItem.price_floor}`)
    finalPrice = new Decimal(ctx.catalogItem.price_floor)

    trace.push({
      step: 6,
      description: 'Enforced price floor',
      calculation: `Raised to floor`,
      result: finalPrice.toNumber()
    })
  }

  if (ctx.catalogItem.price_ceiling && finalPrice.gt(ctx.catalogItem.price_ceiling)) {
    warnings.push(`Price ${finalPrice} exceeds ceiling of ${ctx.catalogItem.price_ceiling}`)
    finalPrice = new Decimal(ctx.catalogItem.price_ceiling)

    trace.push({
      step: 6,
      description: 'Enforced price ceiling',
      calculation: `Reduced to ceiling`,
      result: finalPrice.toNumber()
    })
  }

  // Step 7: Round and calculate extended
  const unit_price = finalPrice.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber()
  const extended_price = finalPrice
    .times(ctx.quantity)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN)
    .toNumber()

  trace.push({
    step: 7,
    description: 'Calculate extended price',
    calculation: `${unit_price} * ${ctx.quantity}`,
    result: extended_price
  })

  // Calculate margins
  const cost_basis = ctx.catalogItem.cost_basis || 0
  const margin_amount = unit_price - cost_basis
  const margin_percent = cost_basis > 0 ? (margin_amount / cost_basis) * 100 : 0

  return {
    unit_price,
    extended_price,
    base_price: basePrice.toNumber(),
    list_price: listPrice.toNumber(),
    final_price: unit_price,
    price_components,
    rules_applied: appliedRules,
    overrides,
    price_list_used: priceListUsed,
    quantity_tier_used: quantityTierUsed,
    warnings,
    trace,
    cost_basis,
    margin_amount,
    margin_percent
  }
}
```

### 5. Pricing Cache

**File:** `pricing-tool/lib/pricing/pricing-cache.ts`

```typescript
// Simple in-memory cache for frequently accessed prices
const priceCache = new Map<string, { price: number; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

export function getCachedPrice(key: string): number | null {
  const cached = priceCache.get(key)

  if (!cached) return null

  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    priceCache.delete(key)
    return null
  }

  return cached.price
}

export function setCachedPrice(key: string, price: number): void {
  priceCache.set(key, {
    price,
    timestamp: Date.now()
  })
}

export function generateCacheKey(
  productId: string,
  quantity: number,
  priceListId?: string,
  options?: Record<string, any>
): string {
  return `${productId}:${quantity}:${priceListId || 'default'}:${JSON.stringify(options || {})}`
}

export function clearPriceCache(): void {
  priceCache.clear()
}
```

### 6. Update Quote Line API

**Modify:** `pricing-tool/app/api/quotes/[id]/lines/route.ts`

```typescript
import { calculatePriceV2 } from '@/lib/pricing/pricing-engine-v2'

// In POST handler for creating quote line:
if (catalogItemId && options_json) {
  const product = await fetchProduct(catalogItemId)

  const pricingResult = await calculatePriceV2({
    catalogItem: product,
    options: options_json,
    quantity: quantity,
    priceListId: quote.price_list_id,  // From quote
    customerType: quote.customer_type,
    quoteDate: new Date(quote.created_at)
  })

  unit_price = pricingResult.unit_price
  extended_price = pricingResult.extended_price

  // Store pricing metadata
  metadata_json = {
    ...metadata_json,
    price_trace: pricingResult.trace,
    rules_applied: pricingResult.rules_applied,
    margin_percent: pricingResult.margin_percent
  }

  // Create override record if manual override
  if (override_price) {
    await createPriceOverride({
      quote_id: quoteId,
      quote_line_id: lineId,
      original_price: pricingResult.final_price,
      override_price: override_price,
      reason: override_reason
    })
  }
}
```

## Files to Create/Modify

**New Files:**
- `pricing-tool/lib/pricing/pricing-context-v2.ts`
- `pricing-tool/lib/pricing/price-list-resolver.ts`
- `pricing-tool/lib/pricing/rules-engine.ts`
- `pricing-tool/lib/pricing/pricing-engine-v2.ts`
- `pricing-tool/lib/pricing/pricing-cache.ts`

**Modified:**
- `pricing-tool/app/api/quotes/[id]/lines/route.ts`

**Tests:**
- `pricing-tool/lib/pricing/__tests__/pricing-engine-v2.test.ts`

## Testing Requirements

1. **Price List Resolution:**
   - Resolves correct list by customer type
   - Priority order respected
   - Date-based validity works

2. **Quantity Tiers:**
   - 1-9 units = tier 1 price
   - 10-49 units = tier 2 price
   - 50+ units = tier 3 price

3. **Pricing Rules:**
   - Category discount applied
   - Product-specific markup applied
   - Bulk discount for large quantities
   - Multiple rules combine correctly

4. **Floor/Ceiling:**
   - Price below floor → raised to floor
   - Price above ceiling → capped at ceiling
   - Warning generated

5. **Overrides:**
   - Manual override accepted
   - Override > 10% flagged for approval
   - Original price preserved

## Acceptance Criteria

- [ ] Price lists resolve by priority and date
- [ ] Quantity tiers work correctly
- [ ] Pricing rules apply in priority order
- [ ] Floor/ceiling enforcement works
- [ ] Manual overrides supported
- [ ] Approval flags set correctly
- [ ] Margins calculated accurately
- [ ] Trace shows all steps
- [ ] Warnings generated appropriately
- [ ] Cache improves performance
- [ ] Backwards compatible with v1
- [ ] Test coverage > 85%

## Dependencies

- Task 08 (Pricing Engine v1)
- Task 16 (Price Lists schema)
- Decimal.js library

## Estimated Effort

6-8 hours

## Review Checklist

- [ ] All calculations use Decimal.js
- [ ] Rules evaluated in correct order
- [ ] Conditions logic is sound
- [ ] Cache invalidation works
- [ ] Performance acceptable (< 200ms)
- [ ] TypeScript types accurate
- [ ] Error handling comprehensive
- [ ] Audit trail complete
- [ ] Compatible with existing quotes
- [ ] Ready for admin UI (Task 18)
