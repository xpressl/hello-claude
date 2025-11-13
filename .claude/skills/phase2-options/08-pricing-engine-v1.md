# Task 08: Pricing Engine v1 (Base + Options)

## Objective
Create a comprehensive pricing engine that calculates line prices based on product base price and selected options, with proper decimal precision and detailed price traces.

## Context
- Products have base prices
- Options can add flat amounts or percentages
- Need precise decimal calculations (financial data)
- Need audit trail showing how price was calculated
- Will expand in Phase 5 with rules, tiers, discounts
- Must be testable and maintainable

## Requirements

### 1. Core Pricing Engine

**File:** `pricing-tool/lib/pricing-engine.ts`

**Main Function:**
```typescript
export interface PricingContext {
  catalogItem: Product
  options: Record<string, any>  // Selected options
  quantity: number
  // Future: customerType, priceListId, etc.
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

export async function calculatePrice(
  ctx: PricingContext
): Promise<PricingResult> {
  // Implementation
}
```

### 2. Calculation Steps

**Step 1: Base Price**
```typescript
let price = new Decimal(ctx.catalogItem.unit_price)
trace.push({
  step: 1,
  description: 'Base product price',
  calculation: `${ctx.catalogItem.sku} base price`,
  result: price.toNumber()
})
```

**Step 2: Fetch Option Definitions**
```typescript
const options = await fetchItemOptions(ctx.catalogItem.id)
```

**Step 3: Apply Flat Option Deltas**
```typescript
for (const [code, value] of Object.entries(ctx.options)) {
  const option = options.find(o => o.code === code)
  if (!option) continue

  if (option.type === 'select') {
    const optionValue = option.values.find(v => v.value === value)
    if (optionValue && optionValue.price_delta) {
      price = price.plus(optionValue.price_delta)
      breakdown.push({
        label: `${option.label} (${optionValue.label})`,
        amount: optionValue.price_delta,
        type: 'option_flat'
      })
      trace.push({
        step: trace.length + 1,
        description: `Add ${option.label} option`,
        calculation: `${price.minus(optionValue.price_delta)} + ${optionValue.price_delta}`,
        result: price.toNumber()
      })
    }
  }

  if (option.price_delta_type === 'flat' && option.price_delta_value) {
    price = price.plus(option.price_delta_value)
    breakdown.push({
      label: option.label,
      amount: option.price_delta_value,
      type: 'option_flat'
    })
    trace.push({
      step: trace.length + 1,
      description: `Add ${option.label} flat delta`,
      calculation: `${price.minus(option.price_delta_value)} + ${option.price_delta_value}`,
      result: price.toNumber()
    })
  }
}
```

**Step 4: Apply Percentage Option Deltas**
```typescript
for (const [code, value] of Object.entries(ctx.options)) {
  const option = options.find(o => o.code === code)
  if (!option) continue

  if (option.price_delta_type === 'percent' && option.price_delta_value) {
    const delta = price.times(option.price_delta_value).div(100)
    price = price.plus(delta)
    breakdown.push({
      label: `${option.label} (${option.price_delta_value}%)`,
      amount: delta.toNumber(),
      type: 'option_percent'
    })
    trace.push({
      step: trace.length + 1,
      description: `Apply ${option.label} percentage`,
      calculation: `${price.minus(delta)} * (1 + ${option.price_delta_value}/100)`,
      result: price.toNumber()
    })
  }
}
```

**Step 5: Round to Currency Precision**
```typescript
const unit_price = price.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber()
trace.push({
  step: trace.length + 1,
  description: 'Round to 2 decimal places',
  calculation: `round(${price}, 2)`,
  result: unit_price
})
```

**Step 6: Calculate Extended Price**
```typescript
const extended_price = new Decimal(unit_price)
  .times(ctx.quantity)
  .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN)
  .toNumber()

trace.push({
  step: trace.length + 1,
  description: 'Calculate extended price',
  calculation: `${unit_price} * ${ctx.quantity}`,
  result: extended_price
})
```

### 3. Helper Functions

**Fetch Item Options:**
```typescript
async function fetchItemOptions(
  catalogItemId: string
): Promise<ItemOptionWithValues[]> {
  // Query database for item_options with option_values joined
  // Only return active options
  // Sort by sort_order
}
```

**Validate Options:**
```typescript
export function validateOptions(
  options: ItemOption[],
  selected: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check all required options are provided
  for (const option of options) {
    if (option.required && !selected[option.code]) {
      errors.push(`${option.label} is required`)
    }
  }

  // Validate constraints
  for (const [code, value] of Object.entries(selected)) {
    const option = options.find(o => o.code === code)
    if (!option) continue

    if (option.type === 'number' && option.constraints_json) {
      const { min, max } = option.constraints_json
      if (min !== undefined && value < min) {
        errors.push(`${option.label} must be at least ${min}`)
      }
      if (max !== undefined && value > max) {
        errors.push(`${option.label} must be at most ${max}`)
      }
    }

    if (option.type === 'text' && option.constraints_json) {
      const { min_length, max_length, pattern } = option.constraints_json
      if (min_length && value.length < min_length) {
        errors.push(`${option.label} must be at least ${min_length} characters`)
      }
      if (max_length && value.length > max_length) {
        errors.push(`${option.label} must be at most ${max_length} characters`)
      }
      if (pattern && !new RegExp(pattern).test(value)) {
        errors.push(`${option.label} format is invalid`)
      }
    }

    if (option.type === 'select') {
      const validValues = option.values.map(v => v.value)
      if (!validValues.includes(value)) {
        errors.push(`${option.label} value "${value}" is not valid`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
```

### 4. Update Quote Line API to Use Pricing Engine

**Modify:** `pricing-tool/app/api/quotes/[id]/lines/route.ts`

**In POST handler:**
```typescript
// If catalog_item_id provided, calculate price
if (catalogItemId && options_json) {
  const product = await fetchProduct(catalogItemId)
  const pricingResult = await calculatePrice({
    catalogItem: product,
    options: options_json,
    quantity: quantity
  })

  unit_price = pricingResult.unit_price
  extended_price = pricingResult.extended_price

  // Store pricing trace in metadata for audit
  metadata_json = {
    ...metadata_json,
    price_trace: pricingResult.trace
  }
}
```

### 5. Price Trace Viewer Component (Admin)

**File:** `pricing-tool/components/admin/PriceTraceViewer.tsx`

**Purpose:** Show admins how a price was calculated

**Display:**
```
Price Calculation Trace
─────────────────────────────────────
Step 1: Base product price
  DR-3080-20G base price = $150.00

Step 2: Add Size option
  $150.00 + $25.00 = $175.00

Step 3: Add Hardware Package flat delta
  $175.00 + $15.00 = $190.00

Step 4: Apply Rush Order percentage
  $190.00 * 1.10 = $209.00

Step 5: Round to 2 decimal places
  round($209.00, 2) = $209.00

Step 6: Calculate extended price
  $209.00 * 5 = $1,045.00
─────────────────────────────────────
```

### 6. Testing

**Create:** `pricing-tool/lib/__tests__/pricing-engine.test.ts`

**Test Cases:**
```typescript
describe('Pricing Engine', () => {
  test('calculates base price with no options', async () => {
    const result = await calculatePrice({
      catalogItem: { id: '1', unit_price: 100 },
      options: {},
      quantity: 1
    })
    expect(result.unit_price).toBe(100)
  })

  test('adds flat option delta', async () => {
    // Product: $100, Size option adds $25
    const result = await calculatePrice({
      catalogItem: { id: '1', unit_price: 100 },
      options: { SIZE: '36x80' },
      quantity: 1
    })
    expect(result.unit_price).toBe(125)
  })

  test('applies percentage option delta', async () => {
    // Product: $100, Rush adds 10%
    const result = await calculatePrice({
      catalogItem: { id: '1', unit_price: 100 },
      options: { RUSH: true },
      quantity: 1
    })
    expect(result.unit_price).toBe(110)
  })

  test('combines multiple options correctly', async () => {
    // Product: $100
    // Size: +$25 (flat)
    // Rush: +10% (percent)
    // Expected: (100 + 25) * 1.10 = 137.50
    const result = await calculatePrice({
      catalogItem: { id: '1', unit_price: 100 },
      options: { SIZE: '36x80', RUSH: true },
      quantity: 1
    })
    expect(result.unit_price).toBe(137.50)
  })

  test('calculates extended price with quantity', async () => {
    const result = await calculatePrice({
      catalogItem: { id: '1', unit_price: 100 },
      options: {},
      quantity: 5
    })
    expect(result.extended_price).toBe(500)
  })

  test('handles decimal precision correctly', async () => {
    // Ensure no floating point errors
    const result = await calculatePrice({
      catalogItem: { id: '1', unit_price: 99.99 },
      options: {},
      quantity: 3
    })
    expect(result.extended_price).toBe(299.97)
  })

  test('validates required options', () => {
    const validation = validateOptions(
      [{ code: 'SIZE', required: true, label: 'Size' }],
      {}
    )
    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Size is required')
  })

  test('validates number constraints', () => {
    const validation = validateOptions(
      [{
        code: 'WIDTH',
        type: 'number',
        constraints_json: { min: 24, max: 96 },
        label: 'Width'
      }],
      { WIDTH: 120 }
    )
    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Width must be at most 96')
  })
})
```

## Files to Create/Modify

**New Files:**
- `pricing-tool/lib/pricing-engine.ts` (core engine)
- `pricing-tool/lib/__tests__/pricing-engine.test.ts` (tests)
- `pricing-tool/components/admin/PriceTraceViewer.tsx` (trace display)

**Modified Files:**
- `pricing-tool/app/api/quotes/[id]/lines/route.ts` (use engine)
- `pricing-tool/lib/types.ts` (add pricing interfaces)

## Acceptance Criteria

- [ ] Pricing engine calculates base + options correctly
- [ ] Flat deltas applied before percentage deltas
- [ ] Decimal.js used for all money math (no floats)
- [ ] Price trace generated for audit
- [ ] Validation function checks required options and constraints
- [ ] Extended price = unit_price * quantity
- [ ] Rounding uses banker's rounding (ROUND_HALF_EVEN)
- [ ] Test suite passes with >90% coverage
- [ ] API routes use pricing engine
- [ ] Price trace viewer displays calculation steps

## Dependencies

- Task 05 (options schema)
- Task 07 (options picker uses this)
- Decimal.js library (already installed)

## Estimated Effort

4-6 hours

## Review Checklist

- [ ] All calculations use Decimal.js
- [ ] No floating-point arithmetic
- [ ] Trace provides complete audit trail
- [ ] Tests cover edge cases
- [ ] Type safety maintained
- [ ] Performance acceptable (< 100ms per calculation)
- [ ] Error handling for missing options
- [ ] Compatible with future pricing rules (Phase 5)
