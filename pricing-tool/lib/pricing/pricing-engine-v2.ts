/**
 * Pricing Engine v2: Advanced Pricing with Rules, Tiers, and Overrides
 *
 * Extends v1 with:
 * - Price lists with customer segment support
 * - Quantity tier pricing
 * - Dynamic pricing rules
 * - Manual overrides with approval workflow
 * - Price floor/ceiling enforcement
 * - Detailed audit trail
 * - Margin calculations
 *
 * Calculation order:
 * 1. Base product price + option adjustments (v1)
 * 2. Price list tier lookup
 * 3. Apply pricing rules (by priority)
 * 4. Apply manual override
 * 5. Enforce price floor/ceiling
 * 6. Calculate extended price
 * 7. Calculate margins
 */

import Decimal from 'decimal.js'
import { PricingContextV2, PricingResultV2, PriceTrace, PriceComponent, AppliedRule, PriceOverride } from './pricing-context-v2'
import { resolveActivePriceList, getPriceFromList } from './price-list-resolver'
import { getApplicableRules, applyRules } from './rules-engine'
import { getCachedPrice, setCachedPrice, generateCacheKey, clearPriceCache } from './pricing-cache'
import { calculatePrice as calculatePriceV1 } from '../pricing-engine'

// Configure Decimal for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN })

/**
 * Calculate price with advanced features (v2)
 *
 * Supports:
 * - Price lists with customer type matching
 * - Quantity tier pricing
 * - Dynamic pricing rules
 * - Manual overrides
 * - Price bounds enforcement
 *
 * Returns detailed result with:
 * - Unit and extended prices
 * - Price components breakdown
 * - Applied rules
 * - Full audit trace
 * - Margin calculations
 */
export async function calculatePriceV2(
  ctx: PricingContextV2
): Promise<PricingResultV2> {
  const trace: PriceTrace[] = []
  const warnings: string[] = []
  const price_components: PriceComponent[] = []

  // Check cache first (if not skipped)
  if (!ctx.skipCache) {
    const cacheKey = generateCacheKey(
      ctx.catalogItem.id,
      ctx.quantity,
      ctx.priceListId,
      ctx.options,
      ctx.customerType
    )
    const cachedPrice = getCachedPrice(cacheKey)
    if (cachedPrice !== null) {
      trace.push({
        step: 0,
        description: 'Price fetched from cache',
        calculation: `Cache hit for ${ctx.catalogItem.sku}`,
        result: cachedPrice
      })
    }
  }

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
    try {
      const v1Result = await calculatePriceV1({
        catalogItem: {
          id: ctx.catalogItem.id,
          sku: ctx.catalogItem.sku,
          name: ctx.catalogItem.name,
          unit_price: ctx.catalogItem.unit_price
        },
        options: ctx.options,
        quantity: 1  // Don't multiply yet
      })

      basePrice = new Decimal(v1Result.unit_price)
      trace.push({
        step: 2,
        description: 'Applied product options',
        calculation: `Base + options (${Object.keys(ctx.options).length} options)`,
        result: basePrice.toNumber()
      })

      // Merge option components
      price_components.push(...v1Result.price_breakdown)
    } catch (error) {
      console.error('Error applying options in v2:', error)
      warnings.push('Failed to apply product options, using base price')
    }
  }

  // Step 3: Get price from price list (if applicable)
  let listPrice = basePrice
  let priceListUsed: string | null = null
  let quantityTierUsed: string | null = null

  if (!ctx.overridePrice) {
    try {
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
            calculation: `Price list tier for qty ${ctx.quantity}`,
            result: listPrice.toNumber()
          })

          price_components.push({
            label: 'Price List Adjustment',
            amount: listPrice.minus(basePrice).toNumber(),
            type: 'rule'
          })
        }
      }
    } catch (error) {
      console.error('Error resolving price list:', error)
      warnings.push('Failed to resolve price list, using base price')
    }
  }

  // Step 4: Apply pricing rules
  let finalPrice = listPrice
  let appliedRules: AppliedRule[] = []

  if (ctx.applyRules !== false && !ctx.overridePrice) {
    try {
      const rules = await getApplicableRules(
        ctx.catalogItem.id,
        ctx.catalogItem.category_id,
        ctx.catalogItem.tags
      )

      if (rules.length > 0) {
        const rulesResult = applyRules(listPrice.toNumber(), rules, {
          quantity: ctx.quantity,
          customerType: ctx.customerType
        })

        finalPrice = new Decimal(rulesResult.final_price)
        appliedRules = rulesResult.applied_rules

        trace.push({
          step: 4,
          description: `Applied ${appliedRules.length} pricing rule(s)`,
          calculation: appliedRules.map(r => r.rule_name).join(', '),
          result: finalPrice.toNumber()
        })

        // Add rules as price components
        for (const rule of appliedRules) {
          price_components.push({
            label: rule.rule_name,
            amount: rule.adjustment,
            type: 'rule'
          })
        }
      }
    } catch (error) {
      console.error('Error applying pricing rules:', error)
      warnings.push('Failed to apply pricing rules')
    }
  }

  // Step 5: Apply manual override
  const overrides: PriceOverride[] = []
  if (ctx.overridePrice !== undefined) {
    const discountPercent = finalPrice.toNumber() > 0
      ? ((finalPrice.toNumber() - ctx.overridePrice) / finalPrice.toNumber()) * 100
      : 0

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

    price_components.push({
      label: 'Manual Override',
      amount: ctx.overridePrice - listPrice.toNumber(),
      type: 'override'
    })

    if (Math.abs(discountPercent) > 10) {
      warnings.push(`Override discount of ${discountPercent.toFixed(1)}% requires approval`)
    }
  }

  // Step 6: Enforce floor/ceiling
  const priceFloor = ctx.catalogItem.price_floor ? new Decimal(ctx.catalogItem.price_floor) : null
  const priceCeiling = ctx.catalogItem.price_ceiling ? new Decimal(ctx.catalogItem.price_ceiling) : null

  if (priceFloor && finalPrice.lt(priceFloor)) {
    warnings.push(`Price ${finalPrice} is below floor of ${priceFloor}`)
    finalPrice = priceFloor

    trace.push({
      step: 6,
      description: 'Enforced price floor',
      calculation: `Raised to floor`,
      result: finalPrice.toNumber()
    })
  }

  if (priceCeiling && finalPrice.gt(priceCeiling)) {
    warnings.push(`Price ${finalPrice} exceeds ceiling of ${priceCeiling}`)
    finalPrice = priceCeiling

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

  // Cache the result
  if (!ctx.skipCache) {
    const cacheKey = generateCacheKey(
      ctx.catalogItem.id,
      ctx.quantity,
      ctx.priceListId,
      ctx.options,
      ctx.customerType
    )
    setCachedPrice(cacheKey, unit_price)
  }

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

/**
 * Clear pricing cache (call after price list updates)
 */
export function clearPricingCache(): void {
  clearPriceCache()
}

/**
 * Export cache stats for debugging
 */
export { getCacheStats } from './pricing-cache'
