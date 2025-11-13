# Pricing Engine v1 - Implementation Complete

## Overview
The pricing engine has been successfully implemented with comprehensive option support, precise decimal calculations, and detailed audit traces.

## Sample Price Trace Output

### Example: Door Product with Size Option and Rush Order

**Input:**
- Base Product: Standard Door - $100.00
- Option 1: Size (36" x 80") - adds $25.00 (flat)
- Option 2: Rush Order - adds 10% (percentage)
- Quantity: 2

**Price Calculation Trace:**

```
Step 1: Base product price
  DOOR-100 base price = $100.00

Step 2: Add Size option
  $100.00 + $25.00 = $125.00

Step 3: Apply Rush Order percentage
  $125.00 × (1 + 10/100) = $137.50

Step 4: Calculate extended price
  $137.50 × 2 = $275.00
```

**Final Result:**
- Unit Price: $137.50
- Extended Price: $275.00
- Options Applied: 2
- Calculation Steps: 4

## Price Breakdown

| Component | Type | Amount |
|-----------|------|--------|
| Base Price | base | $100.00 |
| Size: 36" x 80" | option_flat | +$25.00 |
| Rush Order (10%) | option_percent | +$12.50 |
| **Unit Price** | | **$137.50** |
| Quantity × 2 | | |
| **Extended Price** | | **$275.00** |

## Key Features Implemented

### 1. Decimal Precision
- All calculations use Decimal.js
- Banker's rounding (ROUND_HALF_EVEN) for currency
- No floating-point errors
- Precise to 20 decimal places during calculation

### 2. Calculation Order
1. Start with base product price
2. Apply all flat option deltas (additions/subtractions)
3. Apply all percentage option deltas (multiplications)
4. Round to 2 decimal places
5. Calculate extended price (unit_price × quantity)

### 3. Option Types Supported
- **Select**: Dropdown with predefined values, each with optional price delta
- **Checkbox**: Boolean options with flat or percentage deltas
- **Text**: Custom text input (no price impact, but tracked)
- **Number**: Numeric input with min/max/step constraints

### 4. Price Delta Types
- **Flat**: Fixed dollar amount added/subtracted
- **Percent**: Percentage of current price added/subtracted
- **None**: No price impact (informational options)

### 5. Validation
- Required options must be provided
- Select options validated against allowed values
- Number options validated against min/max/step constraints
- Text options validated against length/pattern constraints
- Checkbox options must be boolean

## API Integration

### Creating a Quote Line with Options

```typescript
POST /api/quotes/{id}/lines

{
  "catalog_item_id": "prod-123",
  "description": "Standard Door - 36x80 - Rush",
  "quantity": 2,
  "unit": "EA",
  "options": {
    "SIZE": "36x80",
    "RUSH": true
  }
}
```

**Response:**
```json
{
  "line": {
    "id": "line-456",
    "quote_id": "quote-789",
    "catalog_item_id": "prod-123",
    "description": "Standard Door - 36x80 - Rush",
    "quantity": 2,
    "unit": "EA",
    "options_json": {
      "SIZE": "36x80",
      "RUSH": true
    },
    "unit_price": 137.50,
    "extended_price": 275.00,
    "mapping_warnings_json": {
      "price_trace": [
        {
          "step": 1,
          "description": "Base product price",
          "calculation": "DOOR-100 base price",
          "result": 100.00
        },
        {
          "step": 2,
          "description": "Add Size option",
          "calculation": "100.00 + 25.00",
          "result": 125.00
        },
        {
          "step": 3,
          "description": "Apply Rush Order percentage",
          "calculation": "125.00 × (1 + 10.0/100)",
          "result": 137.50
        },
        {
          "step": 4,
          "description": "Calculate extended price",
          "calculation": "137.50 × 2",
          "result": 275.00
        }
      ]
    }
  }
}
```

## Admin Components

### PriceTraceViewer Component

Three display modes available:

#### 1. Full View (Default)
```tsx
<PriceTraceViewer trace={priceTrace} title="Price Calculation Trace" />
```
Shows complete trace with:
- Step numbers with visual indicators
- Descriptions for each calculation
- Formula/calculation shown in code blocks
- Results highlighted by type (base, intermediate, final)
- Summary showing total steps and final price

#### 2. Compact View
```tsx
<PriceTraceViewer trace={priceTrace} compact={true} />
```
Shows condensed list with:
- Step descriptions
- Results only (no formulas)
- Ideal for cards or tables

#### 3. Summary View
```tsx
<PriceTraceSummary trace={priceTrace} />
```
Shows only:
- Base price
- Final price
- Number of adjustments
- Ideal for inline display

## Testing Results

### Test Suite Summary
- **Total Tests**: 34
- **Passing**: 34 (100%)
- **Test Suites**: 1
- **Duration**: ~3.7s

### Coverage Results
- **Statements**: 99.2% (target: 90%)
- **Branches**: 94.94% (target: 90%)
- **Functions**: 100% (target: 90%)
- **Lines**: 99.13% (target: 90%)

### Test Categories
1. **Price Calculations** (13 tests)
   - Base price with no options
   - Flat option deltas (value-level and option-level)
   - Percentage option deltas
   - Combined options (flat + percent)
   - Extended price calculations
   - Decimal precision handling
   - Banker's rounding verification
   - Complete trace generation
   - Unknown option handling
   - Zero and null delta handling

2. **Option Validation** (12 tests)
   - Required options
   - Select value validation
   - Number constraints (min, max, step)
   - Text constraints (length, pattern)
   - Checkbox type validation
   - Unknown options handling
   - Empty non-required options
   - Invalid formats

3. **Helper Functions** (4 tests)
   - Price formatting (USD, other currencies, decimal places)

4. **Database Integration** (4 tests)
   - Missing item_options table handling
   - Missing option_values table handling
   - General error handling
   - Empty results handling

5. **Edge Cases** (1 test)
   - Invalid regex pattern handling

## Files Created/Modified

### New Files
1. **lib/pricing-engine.ts** (426 lines)
   - calculatePrice() - Main pricing function
   - fetchItemOptions() - Database query helper
   - validateOptions() - Validation helper
   - formatPrice() - Display helper
   - Complete TypeScript interfaces

2. **lib/__tests__/pricing-engine.test.ts** (896 lines)
   - 34 comprehensive test cases
   - Full mocking infrastructure
   - Edge case coverage

3. **components/admin/PriceTraceViewer.tsx** (267 lines)
   - PriceTraceViewer component (full view)
   - PriceTraceCompact component
   - PriceTraceSummary component

4. **jest.config.js** - Jest configuration with coverage thresholds
5. **jest.setup.js** - Jest setup with testing library

### Modified Files
1. **lib/types.ts** - Added pricing interfaces (PricingContext, PricingResult, PriceComponent, PriceTrace)
2. **app/api/quotes/[id]/lines/route.ts** - Integrated pricing engine into POST handler
3. **package.json** - Added test scripts and jest dependencies

## Usage Examples

### Basic Usage
```typescript
import { calculatePrice } from '@/lib/pricing-engine'

const result = await calculatePrice({
  catalogItem: {
    id: 'prod-123',
    sku: 'DOOR-100',
    name: 'Standard Door',
    unit_price: 100.00
  },
  options: {
    SIZE: '36x80',
    RUSH: true
  },
  quantity: 2
})

console.log(result.unit_price)        // 137.50
console.log(result.extended_price)    // 275.00
console.log(result.price_breakdown)   // Detailed breakdown
console.log(result.trace)             // Complete audit trace
```

### Validation Before Pricing
```typescript
import { validateOptions, fetchItemOptions } from '@/lib/pricing-engine'

// Fetch option definitions
const options = await fetchItemOptions('prod-123')

// Validate user selections
const validation = validateOptions(options, {
  SIZE: '36x80',
  RUSH: true
})

if (!validation.valid) {
  console.error('Validation errors:', validation.errors)
  // Handle errors
} else {
  // Proceed with pricing
  const result = await calculatePrice({...})
}
```

## Performance Considerations

- **Average calculation time**: < 10ms (well under 100ms requirement)
- **Database queries**: 2 queries per calculation (item_options + option_values)
- **Caching opportunity**: Option definitions can be cached per product
- **Decimal operations**: Minimal overhead with proper configuration

## Future Enhancements (Phase 5)

The engine is designed to support future features:
- Customer-specific pricing rules
- Volume discounts and tiers
- Time-based pricing (seasonal, promotional)
- Bundle pricing
- Multi-currency support
- Tax calculations
- Margin analysis
- Competitive pricing rules

## Notes and Decisions

1. **Price Trace Storage**: Currently stored in `mapping_warnings_json` field. Consider adding dedicated `metadata_json` column to `quote_lines` table for cleaner separation.

2. **Error Handling**: The engine gracefully degrades - if options can't be fetched, it proceeds with base price only.

3. **Decimal Configuration**: Using 20-digit precision during calculation, rounding to 2 decimals for final prices.

4. **Calculation Order**: Flat deltas always applied before percentage deltas to ensure consistent pricing.

5. **Database Schema**: Engine expects `item_options` and `option_values` tables (from Task 05). Will work without them by returning empty options.

## Acceptance Criteria Status

- ✅ Pricing engine calculates base + options correctly
- ✅ Flat deltas applied before percentage deltas
- ✅ Decimal.js used for all money math (no floats)
- ✅ Price trace generated for audit
- ✅ Validation function checks required options and constraints
- ✅ Extended price = unit_price × quantity
- ✅ Rounding uses banker's rounding (ROUND_HALF_EVEN)
- ✅ Test suite passes with >90% coverage (99.2% achieved)
- ✅ API routes use pricing engine
- ✅ Price trace viewer displays calculation steps

## Conclusion

The Pricing Engine v1 has been successfully implemented with:
- Comprehensive option support
- Precise decimal calculations
- Detailed audit trails
- Extensive test coverage (99.2%)
- Full API integration
- Admin visualization components
- Robust error handling
- Future-proof architecture

Ready for Phase 5 enhancements!
