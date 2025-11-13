-- Phase 5: Advanced Pricing Rules - Database Schema
-- Tasks 16-18: Price Lists, Rules, and Admin UI

-- ============================================================================
-- PRODUCTS TABLE EXTENSIONS
-- ============================================================================
-- Add price floor/ceiling and cost basis for margin calculations
ALTER TABLE IF EXISTS public.products
ADD COLUMN IF NOT EXISTS price_floor NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS price_ceiling NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS cost_basis NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_products_price_bounds
ON public.products(price_floor, price_ceiling);

-- ============================================================================
-- PRICE_LISTS TABLE
-- Different price sets for different customer segments and promotions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.price_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'base' CHECK (type IN ('base', 'customer_segment', 'promotional', 'seasonal')),
  priority INTEGER NOT NULL DEFAULT 0,  -- Higher number = higher priority
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'USD',
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_lists_active ON public.price_lists(is_active);
CREATE INDEX IF NOT EXISTS idx_price_lists_valid_dates ON public.price_lists(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_price_lists_priority ON public.price_lists(priority DESC);
CREATE INDEX IF NOT EXISTS idx_price_lists_type ON public.price_lists(type);

-- ============================================================================
-- PRICE_LIST_ITEMS TABLE
-- Product-specific prices within a price list with quantity tiers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.price_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  min_quantity NUMERIC(10, 2) DEFAULT 1,
  max_quantity NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(price_list_id, product_id, min_quantity)
);

CREATE INDEX IF NOT EXISTS idx_price_list_items_list ON public.price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_product ON public.price_list_items(product_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_quantity ON public.price_list_items(min_quantity, max_quantity);

-- ============================================================================
-- PRICE_RULES TABLE
-- Dynamic pricing rules with percentage adjustments and conditions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.price_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price_list_id UUID REFERENCES public.price_lists(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percentage', 'fixed_amount', 'fixed_price')),
  adjustment_value NUMERIC(10, 2) NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'category', 'product', 'tag')),
  scope_value TEXT,
  conditions_json JSONB DEFAULT '{}'::jsonb,
  min_quantity NUMERIC(10, 2),
  max_quantity NUMERIC(10, 2),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_rules_active ON public.price_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_price_rules_priority ON public.price_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_price_rules_scope ON public.price_rules(scope, scope_value);
CREATE INDEX IF NOT EXISTS idx_price_rules_valid_dates ON public.price_rules(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_price_rules_list ON public.price_rules(price_list_id);

-- ============================================================================
-- PRICE_OVERRIDES TABLE
-- Quote-specific manual price adjustments with approval workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.price_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  quote_line_id UUID REFERENCES public.quote_lines(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('line_item', 'quote_total', 'category')),
  original_price NUMERIC(10, 2) NOT NULL,
  override_price NUMERIC(10, 2) NOT NULL,
  discount_percent NUMERIC(5, 2),
  reason TEXT NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(quote_id, quote_line_id)
);

CREATE INDEX IF NOT EXISTS idx_price_overrides_quote ON public.price_overrides(quote_id);
CREATE INDEX IF NOT EXISTS idx_price_overrides_status ON public.price_overrides(approval_status);
CREATE INDEX IF NOT EXISTS idx_price_overrides_created_by ON public.price_overrides(created_by);
CREATE INDEX IF NOT EXISTS idx_price_overrides_created_at ON public.price_overrides(created_at DESC);

-- ============================================================================
-- FUNCTION: Calculate override discount percentage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_override_discount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.discount_percent := ROUND(
    ((NEW.original_price - NEW.override_price) / NULLIF(NEW.original_price, 0)) * 100,
    2
  );

  -- Auto-set requires_approval if discount > 10%
  IF ABS(COALESCE(NEW.discount_percent, 0)) > 10 THEN
    NEW.requires_approval := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_override_discount ON public.price_overrides;
CREATE TRIGGER trg_calculate_override_discount
  BEFORE INSERT OR UPDATE ON public.price_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_override_discount();

-- ============================================================================
-- APPROVAL_THRESHOLDS TABLE
-- Define when approvals are required based on discount amounts/percentages
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approval_thresholds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  threshold_type TEXT NOT NULL CHECK (threshold_type IN ('discount_percent', 'discount_amount', 'quote_total')),
  threshold_value NUMERIC(10, 2) NOT NULL,
  approver_role TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_thresholds_active ON public.approval_thresholds(is_active);
CREATE INDEX IF NOT EXISTS idx_approval_thresholds_type ON public.approval_thresholds(threshold_type);

-- ============================================================================
-- PRICE_HISTORY TABLE
-- Audit trail of all price changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_list_id UUID REFERENCES public.price_lists(id) ON DELETE SET NULL,
  old_price NUMERIC(10, 2),
  new_price NUMERIC(10, 2) NOT NULL,
  change_percent NUMERIC(5, 2),
  reason TEXT,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON public.price_history(product_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_changed_at ON public.price_history(changed_at DESC);

-- ============================================================================
-- FUNCTION: Log price changes in price_list_items
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.unit_price IS DISTINCT FROM NEW.unit_price THEN
    INSERT INTO public.price_history (
      product_id,
      price_list_id,
      old_price,
      new_price,
      change_percent,
      changed_by
    ) VALUES (
      NEW.product_id,
      NEW.price_list_id,
      OLD.unit_price,
      NEW.unit_price,
      CASE
        WHEN OLD.unit_price IS NOT NULL AND OLD.unit_price > 0
        THEN ROUND(((NEW.unit_price - OLD.unit_price) / OLD.unit_price) * 100, 2)
        ELSE NULL
      END,
      NULL  -- Will be set by application context
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_price_change ON public.price_list_items;
CREATE TRIGGER trg_log_price_change
  AFTER UPDATE OF unit_price ON public.price_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_price_change();

-- ============================================================================
-- FUNCTION: Enforce price bounds on price_list_items
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_price_bounds()
RETURNS TRIGGER AS $$
DECLARE
  v_floor NUMERIC(10, 2);
  v_ceiling NUMERIC(10, 2);
BEGIN
  -- Get product constraints
  SELECT price_floor, price_ceiling INTO v_floor, v_ceiling
  FROM public.products
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_price_bounds ON public.price_list_items;
CREATE TRIGGER trg_enforce_price_bounds
  BEFORE INSERT OR UPDATE ON public.price_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_price_bounds();

-- ============================================================================
-- FUNCTION: Get current price for product with quantity tier
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_current_price(
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
    FROM public.price_lists
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
  FROM public.price_list_items
  WHERE price_list_id = v_list_id
    AND product_id = p_product_id
    AND min_quantity <= p_quantity
    AND (max_quantity IS NULL OR max_quantity >= p_quantity)
  ORDER BY min_quantity DESC
  LIMIT 1;

  -- Fallback to base product price
  IF v_price IS NULL THEN
    SELECT unit_price INTO v_price
    FROM public.products
    WHERE id = p_product_id;
  END IF;

  RETURN v_price;
END;
$$ LANGUAGE plpgsql STRICT;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Price lists: Everyone authenticated can read, only ADMIN can modify
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view price lists" ON public.price_lists;
CREATE POLICY "Anyone can view price lists"
  ON public.price_lists
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only ADMIN can modify price lists" ON public.price_lists;
CREATE POLICY "Only ADMIN can modify price lists"
  ON public.price_lists
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Price list items: Everyone can read, only ADMIN can modify
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view price list items" ON public.price_list_items;
CREATE POLICY "Anyone can view price list items"
  ON public.price_list_items
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only ADMIN can modify price list items" ON public.price_list_items;
CREATE POLICY "Only ADMIN can modify price list items"
  ON public.price_list_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Price rules: Everyone can read, only ADMIN can modify
ALTER TABLE public.price_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view price rules" ON public.price_rules;
CREATE POLICY "Anyone can view price rules"
  ON public.price_rules
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only ADMIN can modify price rules" ON public.price_rules;
CREATE POLICY "Only ADMIN can modify price rules"
  ON public.price_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Price overrides: Users can view their own, ADMIN/MANAGER can see all
ALTER TABLE public.price_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their overrides" ON public.price_overrides;
CREATE POLICY "Users can view their overrides"
  ON public.price_overrides
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN')
    )
  );

DROP POLICY IF EXISTS "Users can create overrides" ON public.price_overrides;
CREATE POLICY "Users can create overrides"
  ON public.price_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "ADMIN can update overrides" ON public.price_overrides;
CREATE POLICY "ADMIN can update overrides"
  ON public.price_overrides
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- ============================================================================
-- INSERT SEED DATA
-- ============================================================================

-- Example price lists
INSERT INTO public.price_lists (name, type, priority, description)
VALUES
  ('Standard Retail', 'base', 10, 'Default retail pricing'),
  ('Contractor', 'customer_segment', 20, '10% discount for contractors'),
  ('Wholesale', 'customer_segment', 30, '20% discount for wholesale customers')
ON CONFLICT (name) DO NOTHING;

-- Example approval thresholds
INSERT INTO public.approval_thresholds (name, threshold_type, threshold_value, approver_role, description)
VALUES
  ('Manager Approval - 10%', 'discount_percent', 10, 'ADMIN', 'Discounts over 10% require admin approval'),
  ('Admin Approval - 20%', 'discount_percent', 20, 'ADMIN', 'Discounts over 20% require admin approval'),
  ('VP Approval - $5000', 'discount_amount', 5000, 'ADMIN', 'Discounts over $5000 require admin approval')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_overrides TO authenticated;
GRANT SELECT ON public.price_history TO authenticated;
GRANT SELECT ON public.approval_thresholds TO authenticated;

-- Grant service role full access for application use
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
