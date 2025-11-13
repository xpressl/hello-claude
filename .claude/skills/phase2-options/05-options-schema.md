# Task 05: Item Options Database Schema

## Objective
Create database schema for configurable product options (size, color, finish, hardware, etc.) with price impacts.

## Context
- Building on Phase 1 quote system
- Products need configurable options (e.g., door: size, color, hinge location)
- Options affect pricing (some add cost, some are included)
- Need to support multiple option types (select, number, text, boolean)
- Constraints (e.g., size required for doors, min/max values)

## Requirements

### 1. Item Options Table
Create table: `public.item_options`

**Purpose:** Define available options for each product type

**Columns:**
- `id` UUID PRIMARY KEY (default uuid_generate_v4())
- `catalog_item_id` UUID REFERENCES products(id) ON DELETE CASCADE (which product has this option)
- `code` TEXT NOT NULL (e.g., "SIZE", "COLOR", "FINISH", "HARDWARE")
- `label` TEXT NOT NULL (display name: "Size", "Color", "Finish", "Hardware Package")
- `type` TEXT NOT NULL CHECK (type IN ('select', 'number', 'text', 'boolean'))
- `required` BOOLEAN NOT NULL DEFAULT false (must be specified when ordering)
- `default_value` TEXT (default if not specified)
- `sort_order` INTEGER NOT NULL DEFAULT 0 (display order)
- `constraints_json` JSONB (e.g., {"min": 24, "max": 96} for size in inches)
- `price_delta_type` TEXT CHECK (price_delta_type IN ('flat', 'percent', 'none'))
- `price_delta_value` NUMERIC(10, 2) (amount to add/subtract)
- `active` BOOLEAN NOT NULL DEFAULT true
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()

**Indexes:**
- idx_item_options_catalog_item_id
- idx_item_options_code
- idx_item_options_active

**Constraints:**
- UNIQUE(catalog_item_id, code) - one SIZE option per product

### 2. Option Values Table (for select type)
Create table: `public.option_values`

**Purpose:** Predefined values for select-type options

**Columns:**
- `id` UUID PRIMARY KEY
- `item_option_id` UUID REFERENCES item_options(id) ON DELETE CASCADE
- `value` TEXT NOT NULL (internal value: "white", "black", "primed")
- `label` TEXT NOT NULL (display: "White", "Black", "Primed")
- `price_delta` NUMERIC(10, 2) DEFAULT 0 (price adjustment for this specific value)
- `sku_suffix` TEXT (optional SKU modifier: "-WHT", "-BLK", "-PRM")
- `sort_order` INTEGER NOT NULL DEFAULT 0
- `active` BOOLEAN NOT NULL DEFAULT true
- `created_at` TIMESTAMPTZ DEFAULT NOW()

**Indexes:**
- idx_option_values_item_option_id
- idx_option_values_active

**Constraints:**
- UNIQUE(item_option_id, value) - no duplicate values per option

### 3. Example Data Structure

**Product:** Commercial Steel Door (SKU: DR-3080-20G)

**item_options:**
```sql
{
  id: uuid1,
  catalog_item_id: door_id,
  code: 'SIZE',
  label: 'Door Size',
  type: 'select',
  required: true,
  constraints_json: {"allowed_sizes": ["30x80", "36x80", "36x84"]},
  price_delta_type: 'none'
}
```

**option_values:**
```sql
{value: '30x80', label: '30" x 80"', price_delta: 0.00}
{value: '36x80', label: '36" x 80"', price_delta: 25.00}
{value: '36x84', label: '36" x 84"', price_delta: 50.00}
```

### 4. Update Quote Lines to Store Selected Options

**Modify existing quote_lines table** (already has options_json column):
- `options_json` stores selected options like:
  ```json
  {
    "SIZE": "36x80",
    "COLOR": "white",
    "FINISH": "primed",
    "HARDWARE": "lever_satin"
  }
  ```

No schema change needed - just document the structure.

### 5. Row Level Security

**item_options:**
- SALES/ADMIN can SELECT all options
- ADMIN can INSERT/UPDATE/DELETE options
- Service role full access

**option_values:**
- SALES/ADMIN can SELECT all values
- ADMIN can INSERT/UPDATE/DELETE values
- Service role full access

### 6. Triggers

**Auto-update updated_at:**
- Trigger on item_options BEFORE UPDATE → set updated_at = NOW()

### 7. Helper Functions

**Validate options for a product:**
```sql
CREATE OR REPLACE FUNCTION validate_product_options(
  p_catalog_item_id UUID,
  p_options_json JSONB
) RETURNS TABLE(is_valid BOOLEAN, errors TEXT[])
```

This function checks:
- All required options are provided
- Values are in allowed set (for select types)
- Numbers are within min/max constraints
- Returns validation errors if any

## Files to Modify
- `pricing-tool/supabase-schema.sql` - Append new schema

## Testing Requirements
1. Create sample product with options (door with size, color)
2. Create option values for select types
3. Test constraints (unique, check)
4. Test triggers (updated_at)
5. Test RLS policies
6. Test validation function

## Acceptance Criteria
- [ ] item_options table created with all columns and constraints
- [ ] option_values table created with foreign keys
- [ ] Indexes created for performance
- [ ] RLS policies prevent unauthorized access
- [ ] Triggers update timestamps
- [ ] Validation function works correctly
- [ ] Schema is idempotent
- [ ] Sample data can be inserted

## Dependencies
- Task 01 (quotes schema must exist)
- products table exists

## Estimated Effort
3-4 hours

## Review Checklist
- [ ] Column types appropriate for use cases
- [ ] Constraints prevent invalid data
- [ ] Indexes on foreign keys and frequently queried columns
- [ ] RLS policies secure
- [ ] JSONB structure documented
- [ ] Validation function handles edge cases
- [ ] Schema compatible with pricing engine needs
