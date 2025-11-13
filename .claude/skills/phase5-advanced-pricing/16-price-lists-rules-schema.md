# Task 16: Price Lists and Rules Schema

## Objective
Design and implement database schema for flexible pricing system including price lists, pricing rules, overrides, and approval workflows.

## Context
- Extend Phase 2 pricing engine with advanced capabilities
- Support multiple price lists (retail, wholesale, contractor, special events)
- Pricing rules: quantity tiers, category discounts, promotional pricing
- Manual overrides with approval workflow for large discounts
- Price history and audit trail
- Time-based pricing (valid from/to dates)

## Requirements

### 1. Price Lists Table

**Purpose:** Different price sets for different customer segments

```sql
CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('base', 'customer_segment', 'promotional', 'seasonal')),
  priority INTEGER NOT NULL DEFAULT 0,  -- Higher number = higher priority
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'USD',
  metadata_json JSONB DEFAULT '{}'::jsonb,  -- For custom fields
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_lists_active ON price_lists(is_active);
CREATE INDEX idx_price_lists_valid_dates ON price_lists(valid_from, valid_to);
CREATE INDEX idx_price_lists_priority ON price_lists(priority DESC);

-- Example data
INSERT INTO price_lists (name, type, priority, description) VALUES
  ('Standard Retail', 'base', 10, 'Default retail pricing'),
  ('Contractor', 'customer_segment', 20, '10% discount for contractors'),
  ('Wholesale', 'customer_segment', 30, '20% discount for wholesale customers'),
  ('Black Friday 2024', 'promotional', 50, 'Special Black Friday pricing'),
  ('Summer Clearance', 'seasonal', 40, 'Summer inventory clearance');
```

### 2. Price List Items Table

**Purpose:** Product-specific prices within a price list

```sql
CREATE TABLE IF NOT EXISTS price_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  min_quantity NUMERIC(10, 2) DEFAULT 1,  -- Quantity tier threshold
  max_quantity NUMERIC(10, 2),  -- NULL = no upper limit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(price_list_id, product_id, min_quantity)
);

CREATE INDEX idx_price_list_items_price_list ON price_list_items(price_list_id);
CREATE INDEX idx_price_list_items_product ON price_list_items(product_id);
CREATE INDEX idx_price_list_items_quantity ON price_list_items(min_quantity, max_quantity);

-- Example: Quantity tier pricing
-- Product X: 1-9 units = $100, 10-49 = $90, 50+ = $80
INSERT INTO price_list_items (price_list_id, product_id, unit_price, min_quantity, max_quantity) VALUES
  ('list_id', 'product_x_id', 100.00, 1, 9),
  ('list_id', 'product_x_id', 90.00, 10, 49),
  ('list_id', 'product_x_id', 80.00, 50, NULL);
```

### 3. Price Rules Table

**Purpose:** Dynamic pricing rules (percentage adjustments, conditions)

```sql
CREATE TABLE IF NOT EXISTS price_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price_list_id UUID REFERENCES price_lists(id) ON DELETE CASCADE,  -- NULL = applies to all lists
  priority INTEGER NOT NULL DEFAULT 0,  -- Execution order
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percentage', 'fixed_amount', 'fixed_price')),
  adjustment_value NUMERIC(10, 2) NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('all', 'category', 'product', 'tag')),
  scope_value TEXT,  -- category_id, product_id, or tag name
  conditions_json JSONB DEFAULT '{}'::jsonb,  -- Advanced conditions
  min_quantity NUMERIC(10, 2),
  max_quantity NUMERIC(10, 2),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_rules_active ON price_rules(is_active);
CREATE INDEX idx_price_rules_priority ON price_rules(priority DESC);
CREATE INDEX idx_price_rules_scope ON price_rules(scope, scope_value);
CREATE INDEX idx_price_rules_valid_dates ON price_rules(valid_from, valid_to);

-- Example rules
INSERT INTO price_rules (name, rule_type, adjustment_value, scope, scope_value, description) VALUES
  -- 10% off all doors category
  ('Door Category Discount', 'percentage', -10, 'category', 'doors_category_id', '10% discount on all doors'),

  -- Bulk discount: 5% off orders > 100 units
  ('Bulk Order Discount', 'percentage', -5, 'all', NULL, '5% off for quantities > 100'),

  -- Fixed markup on specific product
  ('Special Product Markup', 'percentage', 15, 'product', 'product_xyz_id', '15% markup on special item');
```

**Conditions JSON Examples:**
```json
{
  "min_order_value": 1000,
  "customer_type": "contractor",
  "day_of_week": ["monday", "tuesday"],
  "exclude_products": ["product_id_1", "product_id_2"]
}
```

### 4. Price Overrides Table

**Purpose:** Quote-specific manual price adjustments with approval

```sql
CREATE TABLE IF NOT EXISTS price_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  quote_line_id UUID REFERENCES quote_lines(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('line_item', 'quote_total', 'category')),
  original_price NUMERIC(10, 2) NOT NULL,
  override_price NUMERIC(10, 2) NOT NULL,
  discount_percent NUMERIC(5, 2),  -- Calculated for reporting
  reason TEXT NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quote_id, quote_line_id)
);

CREATE INDEX idx_price_overrides_quote ON price_overrides(quote_id);
CREATE INDEX idx_price_overrides_approval_status ON price_overrides(approval_status);
CREATE INDEX idx_price_overrides_created_by ON price_overrides(created_by);

-- Trigger to calculate discount_percent
CREATE OR REPLACE FUNCTION calculate_override_discount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.discount_percent := ((NEW.original_price - NEW.override_price) / NEW.original_price * 100);

  -- Auto-set requires_approval if discount > 10%
  IF ABS(NEW.discount_percent) > 10 THEN
    NEW.requires_approval := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_override_discount
BEFORE INSERT OR UPDATE ON price_overrides
FOR EACH ROW
EXECUTE FUNCTION calculate_override_discount();
```

### 5. Approval Thresholds Configuration

**Purpose:** Define when approvals are required

```sql
CREATE TABLE IF NOT EXISTS approval_thresholds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  threshold_type TEXT NOT NULL CHECK (threshold_type IN ('discount_percent', 'discount_amount', 'quote_total')),
  threshold_value NUMERIC(10, 2) NOT NULL,
  approver_role TEXT NOT NULL,  -- 'MANAGER', 'ADMIN', 'VP'
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example thresholds
INSERT INTO approval_thresholds (name, threshold_type, threshold_value, approver_role, description) VALUES
  ('Manager Approval - 10%', 'discount_percent', 10, 'MANAGER', 'Discounts over 10% require manager approval'),
  ('Admin Approval - 20%', 'discount_percent', 20, 'ADMIN', 'Discounts over 20% require admin approval'),
  ('VP Approval - $5000', 'discount_amount', 5000, 'VP', 'Discounts over $5000 require VP approval');
```

### 6. Price History Table

**Purpose:** Audit trail of all price changes

```sql
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL,
  old_price NUMERIC(10, 2),
  new_price NUMERIC(10, 2) NOT NULL,
  change_percent NUMERIC(5, 2),
  reason TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_history_product ON price_history(product_id, changed_at DESC);
CREATE INDEX idx_price_history_changed_at ON price_history(changed_at DESC);

-- Trigger to log price changes
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO price_history (product_id, price_list_id, old_price, new_price, changed_by)
  VALUES (NEW.product_id, NEW.price_list_id, OLD.unit_price, NEW.unit_price, current_setting('app.current_user_id', true)::UUID);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_price_change
AFTER UPDATE OF unit_price ON price_list_items
FOR EACH ROW
WHEN (OLD.unit_price IS DISTINCT FROM NEW.unit_price)
EXECUTE FUNCTION log_price_change();
```

### 7. Price Floor/Ceiling Constraints

**Purpose:** Prevent prices outside acceptable ranges

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_floor NUMERIC(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_ceiling NUMERIC(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_basis NUMERIC(10, 2);  -- For margin calculation

-- Function to enforce price bounds
CREATE OR REPLACE FUNCTION enforce_price_bounds()
RETURNS TRIGGER AS $$
BEGIN
  -- Get product constraints
  DECLARE
    v_floor NUMERIC(10, 2);
    v_ceiling NUMERIC(10, 2);
  BEGIN
    SELECT price_floor, price_ceiling INTO v_floor, v_ceiling
    FROM products
    WHERE id = NEW.product_id;

    -- Check floor
    IF v_floor IS NOT NULL AND NEW.unit_price < v_floor THEN
      RAISE EXCEPTION 'Price %.2f is below floor of %.2f for this product', NEW.unit_price, v_floor;
    END IF;

    -- Check ceiling
    IF v_ceiling IS NOT NULL AND NEW.unit_price > v_ceiling THEN
      RAISE EXCEPTION 'Price %.2f exceeds ceiling of %.2f for this product', NEW.unit_price, v_ceiling;
    END IF;

    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_price_bounds
BEFORE INSERT OR UPDATE ON price_list_items
FOR EACH ROW
EXECUTE FUNCTION enforce_price_bounds();
```

### 8. Row Level Security Policies

```sql
-- Price lists: Everyone can read, only ADMIN can modify
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view price lists"
ON price_lists FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only ADMIN can modify price lists"
ON price_lists FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'ADMIN')
WITH CHECK (auth.jwt() ->> 'role' = 'ADMIN');

-- Price overrides: Users can view their own, ADMIN can see all
ALTER TABLE price_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their overrides"
ON price_overrides FOR SELECT
TO authenticated
USING (created_by = auth.uid() OR auth.jwt() ->> 'role' IN ('ADMIN', 'MANAGER'));

CREATE POLICY "Users can create overrides"
ON price_overrides FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Managers can approve overrides"
ON price_overrides FOR UPDATE
TO authenticated
USING (auth.jwt() ->> 'role' IN ('ADMIN', 'MANAGER'))
WITH CHECK (auth.jwt() ->> 'role' IN ('ADMIN', 'MANAGER'));
```

### 9. Helper Functions

**Get active price for product:**
```sql
CREATE OR REPLACE FUNCTION get_current_price(
  p_product_id UUID,
  p_quantity NUMERIC DEFAULT 1,
  p_price_list_id UUID DEFAULT NULL,
  p_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS NUMERIC AS $$
DECLARE
  v_price NUMERIC(10, 2);
  v_list_id UUID;
BEGIN
  -- Determine which price list to use
  IF p_price_list_id IS NULL THEN
    SELECT id INTO v_list_id
    FROM price_lists
    WHERE is_active = true
      AND (valid_from IS NULL OR valid_from <= p_date)
      AND (valid_to IS NULL OR valid_to >= p_date)
    ORDER BY priority DESC
    LIMIT 1;
  ELSE
    v_list_id := p_price_list_id;
  END IF;

  -- Get price from price list with quantity tier
  SELECT unit_price INTO v_price
  FROM price_list_items
  WHERE price_list_id = v_list_id
    AND product_id = p_product_id
    AND min_quantity <= p_quantity
    AND (max_quantity IS NULL OR max_quantity >= p_quantity)
  ORDER BY min_quantity DESC
  LIMIT 1;

  -- Fallback to base product price
  IF v_price IS NULL THEN
    SELECT unit_price INTO v_price
    FROM products
    WHERE id = p_product_id;
  END IF;

  RETURN v_price;
END;
$$ LANGUAGE plpgsql;
```

## Files to Modify

- `pricing-tool/supabase-schema.sql` - Add all new tables, triggers, functions

## Testing Requirements

1. **Schema Validation:**
   - Create price lists with different priorities
   - Add price list items with quantity tiers
   - Create price rules for categories and products
   - Test price floor/ceiling enforcement
   - Verify RLS policies

2. **Triggers:**
   - Update price → history logged
   - Create override > 10% → requires_approval = true
   - Update price below floor → error raised

3. **Functions:**
   - get_current_price returns correct price for quantity
   - Price list priority respected
   - Date-based pricing works

4. **Data Integrity:**
   - Cannot delete price list with active items
   - Cannot create circular dependencies
   - Unique constraints enforced

## Acceptance Criteria

- [ ] All tables created with correct columns
- [ ] Foreign keys and constraints in place
- [ ] Indexes on frequently queried columns
- [ ] Triggers working (discount calc, history logging, bounds)
- [ ] RLS policies prevent unauthorized access
- [ ] Helper functions return correct results
- [ ] Example data can be inserted
- [ ] Schema is idempotent (safe to re-run)
- [ ] Price history captures all changes
- [ ] Approval workflow schema complete

## Dependencies

- Task 01 (base schema)
- products table exists
- users table exists

## Estimated Effort

4-5 hours

## Review Checklist

- [ ] All CHECK constraints are logical
- [ ] Indexes cover common queries
- [ ] Triggers don't cause performance issues
- [ ] RLS policies are secure
- [ ] Cascading deletes appropriate
- [ ] Timestamps use TIMESTAMPTZ
- [ ] Numeric types have sufficient precision
- [ ] Unique constraints prevent duplicates
- [ ] Functions handle NULL inputs
- [ ] Comments explain complex logic
- [ ] Ready for pricing engine v2 (Task 17)
- [ ] Approval workflow complete
