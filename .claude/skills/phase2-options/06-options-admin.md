# Task 06: Options Admin UI

## Objective
Create admin interface for managing product options and option values.

## Context
- ADMIN users need to configure options for products
- Options include: size, color, finish, hardware packages, handedness, etc.
- Each option can have predefined values (for select type)
- Options affect pricing
- Need CRUD for both options and their values

## Requirements

### 1. Page Route
Create: `pricing-tool/app/admin/catalog/[id]/options/page.tsx`

**URL:** `/admin/catalog/{product_id}/options`

**Auth:** Require ADMIN role (SALES can view only)

### 2. Page Structure

```
┌──────────────────────────────────────────┐
│ Header: Product Name & SKU               │
│ [← Back to Catalog]                      │
├──────────────────────────────────────────┤
│ Product Options Configuration            │
│                                           │
│ [+ Add Option]                           │
│                                           │
│ ┌────────────────────────────────────┐  │
│ │ Option: Size                       │  │
│ │ Type: Select    Required: Yes      │  │
│ │ Price Impact: None                 │  │
│ │                                    │  │
│ │ Values:                            │  │
│ │  ☑ 30x80 - $0.00  [Edit] [Delete] │  │
│ │  ☑ 36x80 - +$25.00 [Edit] [Delete]│  │
│ │  ☑ 36x84 - +$50.00 [Edit] [Delete]│  │
│ │                                    │  │
│ │ [+ Add Value] [Edit Option] [🗑]  │  │
│ └────────────────────────────────────┘  │
│                                           │
│ ┌────────────────────────────────────┐  │
│ │ Option: Color                      │  │
│ │ Type: Select    Required: No       │  │
│ │ ... (similar structure)            │  │
│ └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 3. Components to Create

#### OptionsList Component
**File:** `pricing-tool/components/admin/OptionsList.tsx`

**Features:**
- Display all options for a product
- Sort by sort_order
- Show active/inactive status
- Drag-and-drop reordering
- Expand/collapse each option to show values

#### OptionCard Component
**File:** `pricing-tool/components/admin/OptionCard.tsx`

**Shows:**
- Option code, label, type
- Required status badge
- Price impact (flat, percent, none)
- Default value if set
- Constraints summary
- Active/inactive toggle
- Values list (for select type)
- Edit/Delete buttons

#### OptionForm Component
**File:** `pricing-tool/components/admin/OptionForm.tsx`

**Form Fields:**
- Code (uppercase, no spaces: "SIZE", "COLOR")
- Label (display name)
- Type (select, number, text, boolean)
- Required (checkbox)
- Default Value (optional)
- Sort Order (number input)
- Price Delta Type (select: none, flat, percent)
- Price Delta Value (number, if type is flat/percent)
- Constraints (JSON editor or specific fields based on type):
  - For select: allowed_values (handled by option_values table)
  - For number: min, max, step
  - For text: min_length, max_length, pattern
- Active (checkbox)

**Validation:**
- Code must be uppercase alphanumeric with underscores
- Label required
- Price delta value required if type is flat/percent
- Constraints must be valid JSON

#### OptionValuesTable Component
**File:** `pricing-tool/components/admin/OptionValuesTable.tsx`

**For select-type options only**

**Shows:**
- Table of values with columns: Value, Label, Price Delta, SKU Suffix, Active, Actions
- Drag-and-drop reordering
- Inline editing
- Add new value row
- Delete with confirmation

**Features:**
- Quick toggle active/inactive
- Bulk actions (delete selected, activate all)
- Duplicate value for similar options

### 4. API Routes to Create

#### Get Product Options
```
GET /api/catalog/[id]/options
Response: { options: ItemOption[] }
```

#### Create Option
```
POST /api/catalog/[id]/options
Body: { code, label, type, required, ... }
Response: { option: ItemOption }
```

#### Update Option
```
PATCH /api/catalog/[id]/options/[optionId]
Body: { label?, required?, ... }
Response: { option: ItemOption }
```

#### Delete Option
```
DELETE /api/catalog/[id]/options/[optionId]
Response: 204
```

#### Reorder Options
```
PATCH /api/catalog/[id]/options/reorder
Body: { options: Array<{id, sort_order}> }
Response: { success: true }
```

#### Get Option Values
```
GET /api/options/[optionId]/values
Response: { values: OptionValue[] }
```

#### Create Option Value
```
POST /api/options/[optionId]/values
Body: { value, label, price_delta, ... }
Response: { value: OptionValue }
```

#### Update Option Value
```
PATCH /api/options/values/[valueId]
Body: { label?, price_delta?, ... }
Response: { value: OptionValue }
```

#### Delete Option Value
```
DELETE /api/options/values/[valueId]
Response: 204
```

### 5. Validation Rules

**Option Code:**
- Required, 2-50 characters
- Uppercase letters, numbers, underscores only
- Unique per product

**Option Label:**
- Required, 1-100 characters

**Price Delta:**
- If type is flat: must be numeric, can be negative
- If type is percent: must be 0-100
- If type is none: ignore value

**Constraints JSON:**
- Must be valid JSON
- Schema depends on option type:
  ```typescript
  type: 'number' → { min?: number, max?: number, step?: number }
  type: 'text' → { min_length?: number, max_length?: number, pattern?: string }
  type: 'select' → (handled by option_values)
  type: 'boolean' → (no constraints)
  ```

### 6. UX Enhancements

**Default Option Templates:**
Provide quick-add templates for common options:
- Size (select, required)
- Color (select, not required)
- Finish (select, not required)
- Handedness (select: left, right, universal)
- Hardware Package (select with prices)

**Bulk Import:**
Allow CSV import of option values:
```csv
value,label,price_delta,sku_suffix
30x80,"30"" x 80""",0.00,-3080
36x80,"36"" x 80""",25.00,-3680
```

**Preview:**
Show live preview of how options will appear to customers

### 7. Mobile Responsive

**Mobile (<768px):**
- Option cards stack vertically
- Collapse values by default
- Drawer for forms instead of modals
- Simplified edit mode

**Desktop:**
- Side-by-side layout
- Modals for forms
- Inline editing for values
- Drag handles visible

## Files to Create

**Page:**
- `pricing-tool/app/admin/catalog/[id]/options/page.tsx`

**Components:**
- `pricing-tool/components/admin/OptionsList.tsx`
- `pricing-tool/components/admin/OptionCard.tsx`
- `pricing-tool/components/admin/OptionForm.tsx`
- `pricing-tool/components/admin/OptionValuesTable.tsx`
- `pricing-tool/components/admin/OptionTemplateSelector.tsx`

**API Routes:**
- `pricing-tool/app/api/catalog/[id]/options/route.ts` (GET, POST)
- `pricing-tool/app/api/catalog/[id]/options/[optionId]/route.ts` (PATCH, DELETE)
- `pricing-tool/app/api/catalog/[id]/options/reorder/route.ts` (PATCH)
- `pricing-tool/app/api/options/[optionId]/values/route.ts` (GET, POST)
- `pricing-tool/app/api/options/values/[valueId]/route.ts` (PATCH, DELETE)

**Types:**
- Update `pricing-tool/lib/types.ts` with ItemOption, OptionValue interfaces

## Testing Requirements

1. Create option with all fields
2. Create select-type option with values
3. Test required validation
4. Test price delta calculations
5. Test reordering (drag-and-drop)
6. Test delete with confirmation
7. Test ADMIN-only access
8. Test mobile layout

## Acceptance Criteria

- [ ] Page requires ADMIN authentication
- [ ] Can create options with all types
- [ ] Can add values to select-type options
- [ ] Can edit options and values
- [ ] Can delete options (with cascade to values)
- [ ] Can reorder options and values
- [ ] Validation prevents invalid data
- [ ] Price delta displays correctly
- [ ] Mobile responsive
- [ ] Loading states shown
- [ ] Error handling works
- [ ] Template selector speeds up common options

## Dependencies

- Task 05 (options schema must exist)
- Phase 1 (admin auth, catalog)

## Estimated Effort

6-8 hours

## Review Checklist

- [ ] ADMIN-only access enforced
- [ ] Proper TypeScript types
- [ ] Form validation comprehensive
- [ ] API routes follow REST conventions
- [ ] RLS policies respected
- [ ] Drag-and-drop works smoothly
- [ ] Deletion confirms to prevent accidents
- [ ] Mobile UX is usable
- [ ] Code is DRY (reusable components)
