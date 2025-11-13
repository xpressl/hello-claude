# Task 07: Dynamic Options Picker Component

## Objective
Create a customer-facing component that dynamically renders option selectors based on product configuration and updates price in real-time.

## Context
- Customers select products with configurable options
- Options vary by product (doors have size/color, studs have length/gauge)
- Some options are required, some optional
- Options affect final price
- Need instant price feedback as options change
- Mobile-friendly interface

## Requirements

### 1. Main Component
**File:** `pricing-tool/components/OptionsPicker.tsx`

**Props:**
```typescript
interface OptionsPickerProps {
  catalogItemId: string
  initialOptions?: Record<string, any>  // Pre-selected options
  onOptionsChange: (options: Record<string, any>, priceImpact: number) => void
  basePrice: number
  compact?: boolean  // Compact mode for mobile
}
```

**Features:**
- Fetches options for the product from API
- Renders appropriate input for each option type
- Validates required options
- Calculates price impact as options change
- Shows running price calculation
- Handles loading and error states

### 2. Option Input Components

Create specialized components for each option type:

#### SelectOption Component
**File:** `pricing-tool/components/options/SelectOption.tsx`

**For:** Select-type options (size, color, finish)

**UI:**
```tsx
<div>
  <label>Size *</label>
  <select value={value} onChange={handleChange}>
    <option value="">-- Select Size --</option>
    <option value="30x80">30" x 80" (+$0.00)</option>
    <option value="36x80">36" x 80" (+$25.00)</option>
    <option value="36x84">36" x 84" (+$50.00)</option>
  </select>
</div>
```

**Features:**
- Shows price delta in parentheses
- Required indicator (*)
- Disabled state if option inactive
- Error state if required but not selected

#### NumberOption Component
**File:** `pricing-tool/components/options/NumberOption.tsx`

**For:** Number-type options (quantity multipliers, custom dimensions)

**UI:**
```tsx
<div>
  <label>Custom Width (inches)</label>
  <input
    type="number"
    value={value}
    min={constraints.min}
    max={constraints.max}
    step={constraints.step || 1}
  />
  <span>Min: {min}, Max: {max}</span>
</div>
```

**Features:**
- Enforces min/max constraints
- Step increment support
- Real-time validation
- Error message if out of range

#### TextOption Component
**File:** `pricing-tool/components/options/TextOption.tsx`

**For:** Text-type options (custom engraving, special notes)

**UI:**
```tsx
<div>
  <label>Custom Text</label>
  <input
    type="text"
    value={value}
    maxLength={constraints.max_length}
    placeholder="Enter custom text"
  />
  <span>{value.length}/{max_length} characters</span>
</div>
```

**Features:**
- Character counter
- Pattern validation (regex)
- Length constraints
- Error message display

#### BooleanOption Component
**File:** `pricing-tool/components/options/BooleanOption.tsx`

**For:** Boolean-type options (include hardware, rush order)

**UI:**
```tsx
<div>
  <label>
    <input type="checkbox" checked={value} onChange={handleChange} />
    Include Hardware Package (+$15.00)
  </label>
</div>
```

**Features:**
- Shows price impact if applicable
- Clear label
- Toggle state

### 3. Price Calculation Display

**Component:** `pricing-tool/components/OptionsPriceBreakdown.tsx`

**Shows:**
```
Base Price:              $100.00
  + Size (36x80):        + $25.00
  + Color (White):       +  $0.00
  + Hardware Package:    + $15.00
─────────────────────────────────
Total:                   $140.00
```

**Features:**
- Line-by-line breakdown
- Highlight options that add cost
- Collapsible on mobile
- Updates instantly as options change

### 4. Validation

**Validate on:**
- Option change
- Form submission
- Field blur

**Rules:**
- Required options must be selected
- Number values within min/max
- Text values match pattern
- Text length within constraints

**Error Display:**
```tsx
{errors.SIZE && (
  <span className="error">Please select a size</span>
)}
```

### 5. API Integration

**Endpoint to create:**
```
GET /api/catalog/[id]/options/customer

Response:
{
  options: [
    {
      id: uuid,
      code: "SIZE",
      label: "Door Size",
      type: "select",
      required: true,
      default_value: null,
      values: [
        { value: "30x80", label: '30" x 80"', price_delta: 0 },
        { value: "36x80", label: '36" x 80"', price_delta: 25 },
      ]
    },
    {
      id: uuid,
      code: "COLOR",
      label: "Color",
      type: "select",
      required: false,
      default_value: "white",
      values: [...]
    }
  ]
}
```

**Note:** Only returns active options and values, sorted by sort_order

### 6. Price Calculation Logic

**File:** `pricing-tool/lib/options-pricing.ts`

```typescript
export interface OptionSelection {
  code: string
  value: any
  price_impact: number
}

export function calculateOptionsPriceImpact(
  options: ItemOption[],
  selections: Record<string, any>
): {
  total_impact: number
  breakdown: OptionSelection[]
} {
  // For each selected option:
  // 1. Find the option definition
  // 2. If select type, find the selected value's price_delta
  // 3. If flat price_delta_type, add price_delta_value
  // 4. If percent price_delta_type, calculate percentage
  // 5. Sum all impacts
}
```

**Calculation Order:**
1. Base price (from product)
2. Add flat price deltas from options
3. Apply percentage price deltas
4. Round to 2 decimals

### 7. Integration with Quote Line Item

**Update:** `pricing-tool/components/QuoteLineItem.tsx`

**Add OptionsPicker when editing a line:**
```tsx
{isEditing && line.catalog_item_id && (
  <OptionsPicker
    catalogItemId={line.catalog_item_id}
    initialOptions={line.options_json}
    onOptionsChange={(options, priceImpact) => {
      updateLine({
        options_json: options,
        unit_price: basePrice + priceImpact
      })
    }}
    basePrice={product.unit_price}
  />
)}
```

### 8. Mobile Optimization

**Mobile (<640px):**
- Stack options vertically
- Use native select dropdowns
- Larger touch targets
- Price breakdown collapsible
- Sticky "Update Price" button at bottom

**Desktop:**
- Grid layout for options (2 columns)
- Inline price updates
- Hover states on selects
- Side-by-side price breakdown

### 9. Accessibility

- Proper label associations (htmlFor)
- Required fields indicated (* and aria-required)
- Error messages linked with aria-describedby
- Keyboard navigation works
- Screen reader friendly option descriptions
- Focus management after selection

### 10. Loading States

**While fetching options:**
```tsx
<div>
  <SkeletonLabel />
  <SkeletonSelect />
  <SkeletonLabel />
  <SkeletonSelect />
</div>
```

**Error State:**
```tsx
<div className="error">
  Unable to load options. Please try again.
  <button onClick={retry}>Retry</button>
</div>
```

## Files to Create

**Main Component:**
- `pricing-tool/components/OptionsPicker.tsx`

**Option Type Components:**
- `pricing-tool/components/options/SelectOption.tsx`
- `pricing-tool/components/options/NumberOption.tsx`
- `pricing-tool/components/options/TextOption.tsx`
- `pricing-tool/components/options/BooleanOption.tsx`

**Supporting Components:**
- `pricing-tool/components/OptionsPriceBreakdown.tsx`

**Utilities:**
- `pricing-tool/lib/options-pricing.ts` (calculation logic)

**API Route:**
- `pricing-tool/app/api/catalog/[id]/options/customer/route.ts`

**Types:**
- Update `pricing-tool/lib/types.ts` with option-related interfaces

## Testing Requirements

1. Load options for product with multiple option types
2. Select required options
3. Verify price updates instantly
4. Test validation (required fields)
5. Test number constraints (min/max)
6. Test text constraints (length, pattern)
7. Test mobile layout
8. Test keyboard navigation
9. Test with product that has no options

## Acceptance Criteria

- [ ] Options load dynamically for any product
- [ ] All 4 option types render correctly
- [ ] Price updates in real-time as options change
- [ ] Required validation works
- [ ] Constraints enforced (min/max, length, pattern)
- [ ] Error messages clear and helpful
- [ ] Mobile responsive
- [ ] Accessible (WCAG AA)
- [ ] Loading and error states handled
- [ ] Integrates with quote line item
- [ ] Price breakdown is accurate

## Dependencies

- Task 05 (options schema)
- Task 06 (options must be configured in admin)
- Phase 1 (quote system)

## Estimated Effort

6-8 hours

## Review Checklist

- [ ] TypeScript types strict
- [ ] Price calculation uses Decimal.js
- [ ] Validation is comprehensive
- [ ] UI components are reusable
- [ ] API only returns active options
- [ ] Mobile UX is smooth
- [ ] Accessibility standards met
- [ ] Error handling robust
- [ ] Performance good with many options
- [ ] Code follows existing patterns
