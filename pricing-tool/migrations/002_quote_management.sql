-- Migration: Quote Management System
-- Adds customers, quotes, quote_items tables and markup hierarchy
-- Run this after the base schema (supabase-schema.sql)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ALTER PRODUCTS TABLE: Add default markup column
-- ============================================================================
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS default_markup NUMERIC(5, 2) CHECK (default_markup >= 0 AND default_markup <= 100);

COMMENT ON COLUMN public.products.default_markup IS 'Default markup percentage for this product (0-100). Overrides global default.';

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  default_markup NUMERIC(5, 2) CHECK (default_markup >= 0 AND default_markup <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at DESC);

COMMENT ON TABLE public.customers IS 'Customer contact information and pricing preferences';
COMMENT ON COLUMN public.customers.default_markup IS 'Customer-specific markup percentage. Takes precedence over product and global defaults.';

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT, -- Denormalized for quick quotes without customer record
  customer_phone TEXT,
  customer_email TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON public.quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes(created_at DESC);

COMMENT ON TABLE public.quotes IS 'Quote headers with customer and status information';
COMMENT ON COLUMN public.quotes.quote_number IS 'Auto-generated quote number (e.g., Q-2024-001)';
COMMENT ON COLUMN public.quotes.customer_name IS 'Customer name, either from customers table or entered directly';

-- ============================================================================
-- QUOTE_ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_sku TEXT NOT NULL, -- Snapshot for history
  product_name TEXT NOT NULL, -- Snapshot for history
  unit_type TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0), -- Snapshot at quote time
  markup_pct NUMERIC(5, 2) NOT NULL CHECK (markup_pct >= 0),
  cost NUMERIC(10, 2) NOT NULL, -- quantity × unit_price
  price NUMERIC(10, 2) NOT NULL, -- cost × (1 + markup_pct/100)
  profit NUMERIC(10, 2) NOT NULL, -- price - cost
  line_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON public.quote_items(product_id);

COMMENT ON TABLE public.quote_items IS 'Individual line items within a quote';
COMMENT ON COLUMN public.quote_items.unit_price IS 'Unit price snapshot at time of quote';
COMMENT ON COLUMN public.quote_items.markup_pct IS 'Markup percentage applied to this line item';

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================
DROP TRIGGER IF EXISTS set_updated_at_customers ON public.customers;
CREATE TRIGGER set_updated_at_customers
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_quotes ON public.quotes;
CREATE TRIGGER set_updated_at_quotes
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FUNCTION: Generate next quote number
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  next_seq INTEGER;
  new_number TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  -- Get the highest sequence number for current year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(quote_number FROM 'Q-' || year_part || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM public.quotes
  WHERE quote_number LIKE 'Q-' || year_part || '-%';

  -- Format as Q-YYYY-NNN (zero-padded to 3 digits)
  new_number := 'Q-' || year_part || '-' || LPAD(next_seq::TEXT, 3, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_quote_number() IS 'Generates sequential quote numbers like Q-2024-001';

-- ============================================================================
-- TRIGGER: Auto-generate quote number if not provided
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := public.generate_quote_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_quote_number ON public.quotes;
CREATE TRIGGER set_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_quote_number();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: CUSTOMERS TABLE
-- ============================================================================

-- Policy: SALES and ADMIN can view all customers
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
CREATE POLICY "Authenticated users can view customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Policy: SALES and ADMIN can insert customers
DROP POLICY IF EXISTS "Authenticated users can create customers" ON public.customers;
CREATE POLICY "Authenticated users can create customers"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Policy: SALES and ADMIN can update customers
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
CREATE POLICY "Authenticated users can update customers"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Policy: ADMIN can delete customers
DROP POLICY IF EXISTS "ADMIN can delete customers" ON public.customers;
CREATE POLICY "ADMIN can delete customers"
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- ============================================================================
-- RLS POLICIES: QUOTES TABLE
-- ============================================================================

-- Policy: Users can view their own quotes, ADMINs can view all
DROP POLICY IF EXISTS "Users can view own quotes, ADMIN views all" ON public.quotes;
CREATE POLICY "Users can view own quotes, ADMIN views all"
  ON public.quotes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Authenticated users can create quotes
DROP POLICY IF EXISTS "Authenticated users can create quotes" ON public.quotes;
CREATE POLICY "Authenticated users can create quotes"
  ON public.quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Policy: Users can update their own quotes, ADMINs can update all
DROP POLICY IF EXISTS "Users can update own quotes, ADMIN updates all" ON public.quotes;
CREATE POLICY "Users can update own quotes, ADMIN updates all"
  ON public.quotes
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Users can delete their own DRAFT quotes, ADMINs can delete any
DROP POLICY IF EXISTS "Users can delete own drafts, ADMIN deletes any" ON public.quotes;
CREATE POLICY "Users can delete own drafts, ADMIN deletes any"
  ON public.quotes
  FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'DRAFT')
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- ============================================================================
-- RLS POLICIES: QUOTE_ITEMS TABLE
-- ============================================================================

-- Policy: Users can view items from quotes they can see
DROP POLICY IF EXISTS "Users can view quote items they own" ON public.quote_items;
CREATE POLICY "Users can view quote items they own"
  ON public.quote_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_items.quote_id
      AND (
        quotes.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role = 'ADMIN'
        )
      )
    )
  );

-- Policy: Users can insert items to their own quotes
DROP POLICY IF EXISTS "Users can add items to own quotes" ON public.quote_items;
CREATE POLICY "Users can add items to own quotes"
  ON public.quote_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

-- Policy: Users can update items in their own quotes
DROP POLICY IF EXISTS "Users can update items in own quotes" ON public.quote_items;
CREATE POLICY "Users can update items in own quotes"
  ON public.quote_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_items.quote_id
      AND (
        quotes.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role = 'ADMIN'
        )
      )
    )
  );

-- Policy: Users can delete items from their own quotes
DROP POLICY IF EXISTS "Users can delete items from own quotes" ON public.quote_items;
CREATE POLICY "Users can delete items from own quotes"
  ON public.quote_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_items.quote_id
      AND (
        quotes.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role = 'ADMIN'
        )
      )
    )
  );

-- ============================================================================
-- SERVICE ROLE POLICIES (Full Access)
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access to customers" ON public.customers;
CREATE POLICY "Service role full access to customers"
  ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to quotes" ON public.quotes;
CREATE POLICY "Service role full access to quotes"
  ON public.quotes FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to quote_items" ON public.quote_items;
CREATE POLICY "Service role full access to quote_items"
  ON public.quote_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Quote summary with customer and item count
CREATE OR REPLACE VIEW public.quote_summary AS
SELECT
  q.id,
  q.quote_number,
  q.status,
  COALESCE(c.name, q.customer_name) AS customer_name,
  COALESCE(c.company, '') AS customer_company,
  q.subtotal,
  q.total,
  COUNT(qi.id) AS item_count,
  q.created_at,
  q.updated_at,
  q.expires_at,
  u.email AS created_by_email
FROM public.quotes q
LEFT JOIN public.customers c ON q.customer_id = c.id
LEFT JOIN public.quote_items qi ON q.id = qi.quote_id
LEFT JOIN auth.users u ON q.user_id = u.id
GROUP BY q.id, q.quote_number, q.status, c.name, c.company, q.customer_name,
         q.subtotal, q.total, q.created_at, q.updated_at, q.expires_at, u.email;

COMMENT ON VIEW public.quote_summary IS 'Convenient view of quotes with customer info and item counts';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check that tables were created:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('customers', 'quotes', 'quote_items');

-- Check that RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('customers', 'quotes', 'quote_items');

-- Check policies:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Test quote number generation:
-- SELECT public.generate_quote_number();
