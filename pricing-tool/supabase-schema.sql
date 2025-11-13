-- Pricing Tool Database Schema for Supabase (Postgres 15)
-- This script is idempotent and can be run multiple times safely

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Maps Supabase auth users to application roles
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SALES')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('EA', 'LF', 'SF', 'BOX', 'PKG', 'SET')),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price > 0),
  aliases TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_aliases ON public.products USING GIN(aliases);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON public.products(updated_at DESC);

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.products;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: USERS TABLE
-- ============================================================================

-- Policy: Users can read their own record
DROP POLICY IF EXISTS "Users can read their own record" ON public.users;
CREATE POLICY "Users can read their own record"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Service role has full access to users
DROP POLICY IF EXISTS "Service role full access to users" ON public.users;
CREATE POLICY "Service role full access to users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES: PRODUCTS TABLE
-- ============================================================================

-- Policy: SALES role can SELECT products
DROP POLICY IF EXISTS "SALES can view products" ON public.products;
CREATE POLICY "SALES can view products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Policy: ADMIN role can SELECT products
DROP POLICY IF EXISTS "ADMIN can view products" ON public.products;
CREATE POLICY "ADMIN can view products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: ADMIN role can INSERT products
DROP POLICY IF EXISTS "ADMIN can insert products" ON public.products;
CREATE POLICY "ADMIN can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: ADMIN role can UPDATE products
DROP POLICY IF EXISTS "ADMIN can update products" ON public.products;
CREATE POLICY "ADMIN can update products"
  ON public.products
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

-- Policy: ADMIN role can DELETE products
DROP POLICY IF EXISTS "ADMIN can delete products" ON public.products;
CREATE POLICY "ADMIN can delete products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Service role has full access to products
DROP POLICY IF EXISTS "Service role full access to products" ON public.products;
CREATE POLICY "Service role full access to products"
  ON public.products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTION: Get current user's role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- SAMPLE DATA (Optional - comment out if not needed)
-- ============================================================================

-- Insert sample products (will be skipped if SKU already exists)
INSERT INTO public.products (sku, name, unit_type, unit_price, aliases)
VALUES
  ('STD-20G-8FT', '20 Gauge Steel Stud 8ft', 'EA', 3.50, ARRAY['stud', '20ga stud', 'metal stud']),
  ('STD-20G-10FT', '20 Gauge Steel Stud 10ft', 'EA', 4.25, ARRAY['stud', '20ga stud', 'metal stud']),
  ('TRK-20G-10FT', '20 Gauge Steel Track 10ft', 'EA', 4.75, ARRAY['track', '20ga track', 'metal track']),
  ('DRY-SHEETROCK-4X8', 'Drywall Sheetrock 4x8 1/2"', 'EA', 12.00, ARRAY['drywall', 'sheetrock', 'gypsum']),
  ('SCREW-DRYWALL-1000', 'Drywall Screws 1-1/4" (1000ct)', 'BOX', 8.50, ARRAY['screws', 'fasteners'])
ON CONFLICT (sku) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify setup)
-- ============================================================================

-- To verify tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'products');

-- To verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'products');

-- To verify policies exist:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- To see sample products:
-- SELECT id, sku, name, unit_type, unit_price FROM products ORDER BY name;

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================
-- Main table for customer quotes - supports both authenticated and anonymous quote creation
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT,                                    -- Nullable for drafts
  customer_email TEXT,                                   -- Nullable for drafts
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'sent', 'accepted', 'declined', 'expired')),
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,           -- Auto-calculated via trigger
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,              -- Auto-calculated via trigger
  margin_percent NUMERIC(5, 2),                          -- Optional profit margin tracking
  metadata_json JSONB,                                   -- For source, IP, user_agent, etc.
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- Nullable for anonymous quotes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,                              -- When quote was submitted by customer
  sent_at TIMESTAMPTZ,                                   -- When quote was sent to customer
  expires_at TIMESTAMPTZ,                                -- Expiration date (default 14 days after sent)
  version INTEGER NOT NULL DEFAULT 1                     -- For optimistic locking
);

-- Indexes for quotes table
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_email ON public.quotes(customer_email);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON public.quotes(created_by);

-- ============================================================================
-- QUOTE LINES TABLE
-- ============================================================================
-- Line items for quotes - supports catalog items and custom items
CREATE TABLE IF NOT EXISTS public.quote_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,                          -- Auto-incremented via trigger if not provided
  catalog_item_id UUID REFERENCES public.products(id) ON DELETE SET NULL,  -- Nullable for custom items
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'EA',
  options_json JSONB,                                    -- Product options like {"size": "30x80", "color": "white"}
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  extended_price NUMERIC(12, 2) NOT NULL,                -- quantity * unit_price, calculated on insert/update
  source TEXT CHECK (source IN ('manual', 'ocr', 'asr', 'paste', 'spreadsheet', 'voice')),
  confidence_score NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),  -- AI confidence
  mapping_warnings_json JSONB,                           -- Warnings like {"low_confidence": true, "fuzzy_match": true}
  notes TEXT,                                            -- Additional notes for this line
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(quote_id, line_number)                          -- Ensure line numbers are unique per quote
);

-- Indexes for quote_lines table
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote_id ON public.quote_lines(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_catalog_item_id ON public.quote_lines(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_source ON public.quote_lines(source);

-- ============================================================================
-- UPLOADS TABLE
-- ============================================================================
-- Tracks file uploads for quote extraction (PDFs, images, audio, spreadsheets)
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image', 'spreadsheet', 'audio', 'text')),
  original_name TEXT NOT NULL,                           -- Original filename from upload
  storage_path TEXT NOT NULL,                            -- Supabase Storage path
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  parsed_payload_json JSONB,                             -- Extracted data from file processing
  confidence_score NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  error_message TEXT,                                    -- Error details if processing failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ                               -- When processing completed/failed
);

-- Indexes for uploads table
CREATE INDEX IF NOT EXISTS idx_uploads_quote_id ON public.uploads(quote_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON public.uploads(status);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON public.uploads(created_at DESC);

-- ============================================================================
-- EVENTS TABLE (Audit Trail)
-- ============================================================================
-- Comprehensive audit log for all quote-related events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- Nullable for anonymous events
  event_type TEXT NOT NULL,                              -- e.g., 'created', 'viewed', 'edited', 'submitted'
  payload_json JSONB,                                    -- Event-specific data
  ip_address INET,                                       -- Client IP address
  user_agent TEXT,                                       -- Browser/client user agent
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_quote_id ON public.events(quote_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Function to auto-calculate extended_price for quote lines
-- Sets extended_price = quantity * unit_price before insert/update
CREATE OR REPLACE FUNCTION public.calculate_line_extended_price()
RETURNS TRIGGER AS $$
BEGIN
  NEW.extended_price = NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-increment line_number if not provided
-- Sets line_number to MAX(line_number) + 1 for the quote
CREATE OR REPLACE FUNCTION public.auto_increment_line_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.line_number IS NULL THEN
    SELECT COALESCE(MAX(line_number), 0) + 1
    INTO NEW.line_number
    FROM public.quote_lines
    WHERE quote_id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate quote totals when lines change
-- Updates quotes.subtotal and quotes.total based on sum of line extended_prices
CREATE OR REPLACE FUNCTION public.update_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  quote_uuid UUID;
BEGIN
  -- Get the quote_id from the operation
  IF TG_OP = 'DELETE' THEN
    quote_uuid := OLD.quote_id;
  ELSE
    quote_uuid := NEW.quote_id;
  END IF;

  -- Recalculate subtotal and total for the quote
  UPDATE public.quotes
  SET
    subtotal = COALESCE((
      SELECT SUM(extended_price)
      FROM public.quote_lines
      WHERE quote_id = quote_uuid
    ), 0),
    total = COALESCE((
      SELECT SUM(extended_price)
      FROM public.quote_lines
      WHERE quote_id = quote_uuid
    ), 0) + tax
  WHERE id = quote_uuid;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to set timestamps when quote status changes
-- Sets submitted_at when status changes to 'submitted'
-- Sets sent_at and expires_at when status changes to 'sent'
CREATE OR REPLACE FUNCTION public.set_quote_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set submitted_at when status changes to 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    NEW.submitted_at = NOW();
  END IF;

  -- Set sent_at and expires_at when status changes to 'sent'
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    NEW.sent_at = NOW();
    IF NEW.expires_at IS NULL THEN
      NEW.expires_at = NOW() + INTERVAL '14 days';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Auto-calculate extended_price for quote lines
DROP TRIGGER IF EXISTS calculate_extended_price ON public.quote_lines;
CREATE TRIGGER calculate_extended_price
  BEFORE INSERT OR UPDATE ON public.quote_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_line_extended_price();

-- Trigger: Auto-increment line_number if not provided
DROP TRIGGER IF EXISTS auto_line_number ON public.quote_lines;
CREATE TRIGGER auto_line_number
  BEFORE INSERT ON public.quote_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_increment_line_number();

-- Trigger: Update quote totals when lines are inserted/updated/deleted
DROP TRIGGER IF EXISTS update_quote_totals_on_line_insert ON public.quote_lines;
CREATE TRIGGER update_quote_totals_on_line_insert
  AFTER INSERT ON public.quote_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_quote_totals();

DROP TRIGGER IF EXISTS update_quote_totals_on_line_update ON public.quote_lines;
CREATE TRIGGER update_quote_totals_on_line_update
  AFTER UPDATE ON public.quote_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_quote_totals();

DROP TRIGGER IF EXISTS update_quote_totals_on_line_delete ON public.quote_lines;
CREATE TRIGGER update_quote_totals_on_line_delete
  AFTER DELETE ON public.quote_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_quote_totals();

-- Trigger: Set timestamps when quote status changes
DROP TRIGGER IF EXISTS set_expiration_on_send ON public.quotes;
CREATE TRIGGER set_quote_status_timestamps
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_quote_timestamps();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - QUOTES
-- ============================================================================

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Policy: Anonymous users can INSERT quotes (for public quote creation)
DROP POLICY IF EXISTS "Anonymous can create quotes" ON public.quotes;
CREATE POLICY "Anonymous can create quotes"
  ON public.quotes
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Authenticated users can INSERT quotes
DROP POLICY IF EXISTS "Authenticated can create quotes" ON public.quotes;
CREATE POLICY "Authenticated can create quotes"
  ON public.quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: SALES and ADMIN can view all quotes
DROP POLICY IF EXISTS "SALES and ADMIN can view all quotes" ON public.quotes;
CREATE POLICY "SALES and ADMIN can view all quotes"
  ON public.quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Policy: Users can view their own quotes
DROP POLICY IF EXISTS "Users can view their own quotes" ON public.quotes;
CREATE POLICY "Users can view their own quotes"
  ON public.quotes
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Policy: Only ADMIN can UPDATE quotes
DROP POLICY IF EXISTS "ADMIN can update quotes" ON public.quotes;
CREATE POLICY "ADMIN can update quotes"
  ON public.quotes
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

-- Policy: Only ADMIN can DELETE quotes
DROP POLICY IF EXISTS "ADMIN can delete quotes" ON public.quotes;
CREATE POLICY "ADMIN can delete quotes"
  ON public.quotes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Service role has full access to quotes
DROP POLICY IF EXISTS "Service role full access to quotes" ON public.quotes;
CREATE POLICY "Service role full access to quotes"
  ON public.quotes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - QUOTE LINES
-- ============================================================================

ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone who can see the quote can see its lines
DROP POLICY IF EXISTS "Users can view quote lines" ON public.quote_lines;
CREATE POLICY "Users can view quote lines"
  ON public.quote_lines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_id
      AND (
        -- SALES/ADMIN can see all quotes
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role IN ('SALES', 'ADMIN')
        )
        -- Or user is the creator
        OR quotes.created_by = auth.uid()
      )
    )
  );

-- Policy: Authenticated users can INSERT lines for quotes they can access
DROP POLICY IF EXISTS "Users can insert quote lines" ON public.quote_lines;
CREATE POLICY "Users can insert quote lines"
  ON public.quote_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_id
      AND (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role IN ('SALES', 'ADMIN')
        )
        OR quotes.created_by = auth.uid()
      )
    )
  );

-- Policy: SALES and ADMIN can UPDATE quote lines
DROP POLICY IF EXISTS "ADMIN can update quote lines" ON public.quote_lines;
CREATE POLICY "SALES and ADMIN can update quote lines"
  ON public.quote_lines
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

-- Policy: SALES and ADMIN can DELETE quote lines
DROP POLICY IF EXISTS "ADMIN can delete quote lines" ON public.quote_lines;
CREATE POLICY "SALES and ADMIN can delete quote lines"
  ON public.quote_lines
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Policy: Service role has full access to quote lines
DROP POLICY IF EXISTS "Service role full access to quote_lines" ON public.quote_lines;
CREATE POLICY "Service role full access to quote_lines"
  ON public.quote_lines
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - UPLOADS
-- ============================================================================

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone who can see the quote can see its uploads
DROP POLICY IF EXISTS "Users can view uploads" ON public.uploads;
CREATE POLICY "Users can view uploads"
  ON public.uploads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_id
      AND (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role IN ('SALES', 'ADMIN')
        )
        OR quotes.created_by = auth.uid()
      )
    )
  );

-- Policy: Authenticated users can INSERT uploads for quotes they can access
DROP POLICY IF EXISTS "Users can insert uploads" ON public.uploads;
CREATE POLICY "Users can insert uploads"
  ON public.uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_id
      AND (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role IN ('SALES', 'ADMIN')
        )
        OR quotes.created_by = auth.uid()
      )
    )
  );

-- Policy: Service role can update uploads (for processing)
DROP POLICY IF EXISTS "Service role can update uploads" ON public.uploads;
CREATE POLICY "Service role can update uploads"
  ON public.uploads
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Service role has full access to uploads
DROP POLICY IF EXISTS "Service role full access to uploads" ON public.uploads;
CREATE POLICY "Service role full access to uploads"
  ON public.uploads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - EVENTS
-- ============================================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can INSERT events (for tracking)
DROP POLICY IF EXISTS "Anyone can create events" ON public.events;
CREATE POLICY "Anyone can create events"
  ON public.events
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Policy: Only ADMIN can view events
DROP POLICY IF EXISTS "ADMIN can view events" ON public.events;
CREATE POLICY "ADMIN can view events"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Service role has full access to events
DROP POLICY IF EXISTS "Service role full access to events" ON public.events;
CREATE POLICY "Service role full access to events"
  ON public.events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION QUERIES FOR QUOTE SYSTEM
-- ============================================================================

-- To verify all quote system tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('quotes', 'quote_lines', 'uploads', 'events');

-- To verify RLS is enabled on quote tables:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('quotes', 'quote_lines', 'uploads', 'events');

-- To verify all policies exist:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('quotes', 'quote_lines', 'uploads', 'events') ORDER BY tablename, policyname;

-- To verify triggers exist:
-- SELECT trigger_name, event_manipulation, event_object_table FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table IN ('quotes', 'quote_lines');

-- To verify indexes exist:
-- SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('quotes', 'quote_lines', 'uploads', 'events') ORDER BY tablename, indexname;

-- ============================================================================
-- ITEM OPTIONS TABLE (Phase 2 - Configurable Product Options)
-- ============================================================================
-- Defines available options for each product (e.g., size, color, finish, hardware)
-- Each product can have multiple options, each with its own pricing impact
CREATE TABLE IF NOT EXISTS public.item_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  catalog_item_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                                    -- e.g., "SIZE", "COLOR", "FINISH", "HARDWARE"
  label TEXT NOT NULL,                                   -- Display name: "Size", "Color", "Finish", "Hardware Package"
  type TEXT NOT NULL CHECK (type IN ('select', 'number', 'text', 'boolean')),
  required BOOLEAN NOT NULL DEFAULT false,               -- Must be specified when ordering
  default_value TEXT,                                    -- Default value if not specified
  sort_order INTEGER NOT NULL DEFAULT 0,                 -- Display order in UI
  constraints_json JSONB,                                -- e.g., {"min": 24, "max": 96} for size constraints
  price_delta_type TEXT CHECK (price_delta_type IN ('flat', 'percent', 'none')),
  price_delta_value NUMERIC(10, 2),                      -- Amount to add/subtract (for option-level pricing)
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(catalog_item_id, code)                          -- One SIZE option per product
);

-- Indexes for item_options
CREATE INDEX IF NOT EXISTS idx_item_options_catalog_item_id ON public.item_options(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_item_options_code ON public.item_options(code);
CREATE INDEX IF NOT EXISTS idx_item_options_active ON public.item_options(active);

-- ============================================================================
-- OPTION VALUES TABLE (for select-type options)
-- ============================================================================
-- Predefined values for select-type options with individual price deltas
-- Example: For COLOR option → "White" (+$0), "Black" (+$15), "Custom" (+$50)
CREATE TABLE IF NOT EXISTS public.option_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_option_id UUID NOT NULL REFERENCES public.item_options(id) ON DELETE CASCADE,
  value TEXT NOT NULL,                                   -- Internal value: "white", "black", "primed"
  label TEXT NOT NULL,                                   -- Display name: "White", "Black", "Primed"
  price_delta NUMERIC(10, 2) DEFAULT 0,                  -- Price adjustment for this specific value
  sku_suffix TEXT,                                       -- Optional SKU modifier: "-WHT", "-BLK", "-PRM"
  sort_order INTEGER NOT NULL DEFAULT 0,                 -- Display order in dropdown
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_option_id, value)                          -- No duplicate values per option
);

-- Indexes for option_values
CREATE INDEX IF NOT EXISTS idx_option_values_item_option_id ON public.option_values(item_option_id);
CREATE INDEX IF NOT EXISTS idx_option_values_active ON public.option_values(active);

-- ============================================================================
-- TRIGGER: Auto-update updated_at on item_options
-- ============================================================================
-- Reuses the update_updated_at_column() function already defined
DROP TRIGGER IF EXISTS set_item_options_updated_at ON public.item_options;
CREATE TRIGGER set_item_options_updated_at
  BEFORE UPDATE ON public.item_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- VALIDATION FUNCTION: Validate product options
-- ============================================================================
-- Validates that options_json for a quote line item meets all requirements
-- Returns is_valid (boolean) and array of error messages if invalid
--
-- Example usage:
-- SELECT * FROM validate_product_options(
--   '123e4567-e89b-12d3-a456-426614174000'::uuid,
--   '{"SIZE": "36x80", "COLOR": "white"}'::jsonb
-- );
CREATE OR REPLACE FUNCTION public.validate_product_options(
  p_catalog_item_id UUID,
  p_options_json JSONB
)
RETURNS TABLE(is_valid BOOLEAN, errors TEXT[]) AS $$
DECLARE
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_option RECORD;
  v_option_value TEXT;
  v_number_value NUMERIC;
  v_min_value NUMERIC;
  v_max_value NUMERIC;
  v_value_exists BOOLEAN;
BEGIN
  -- Loop through all options defined for this product
  FOR v_option IN
    SELECT id, code, label, type, required, constraints_json
    FROM public.item_options
    WHERE catalog_item_id = p_catalog_item_id
    AND active = true
  LOOP
    -- Get the value from options_json
    v_option_value := p_options_json ->> v_option.code;

    -- Check if required option is missing
    IF v_option.required AND v_option_value IS NULL THEN
      v_errors := array_append(v_errors, format('Required option "%s" is missing', v_option.label));
      CONTINUE;
    END IF;

    -- Skip further validation if option is not provided and not required
    IF v_option_value IS NULL THEN
      CONTINUE;
    END IF;

    -- Validate based on option type
    CASE v_option.type
      WHEN 'select' THEN
        -- Check if value exists in option_values for this option
        SELECT EXISTS(
          SELECT 1 FROM public.option_values
          WHERE item_option_id = v_option.id
          AND value = v_option_value
          AND active = true
        ) INTO v_value_exists;

        IF NOT v_value_exists THEN
          v_errors := array_append(v_errors, format('Invalid value "%s" for option "%s"', v_option_value, v_option.label));
        END IF;

      WHEN 'number' THEN
        -- Validate number constraints (min/max)
        BEGIN
          v_number_value := v_option_value::NUMERIC;

          IF v_option.constraints_json ? 'min' THEN
            v_min_value := (v_option.constraints_json->>'min')::NUMERIC;
            IF v_number_value < v_min_value THEN
              v_errors := array_append(v_errors, format('Value %s for "%s" is below minimum %s', v_option_value, v_option.label, v_min_value));
            END IF;
          END IF;

          IF v_option.constraints_json ? 'max' THEN
            v_max_value := (v_option.constraints_json->>'max')::NUMERIC;
            IF v_number_value > v_max_value THEN
              v_errors := array_append(v_errors, format('Value %s for "%s" is above maximum %s', v_option_value, v_option.label, v_max_value));
            END IF;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          v_errors := array_append(v_errors, format('Invalid number value "%s" for option "%s"', v_option_value, v_option.label));
        END;

      WHEN 'boolean' THEN
        -- Validate boolean values
        IF v_option_value NOT IN ('true', 'false', 't', 'f', '1', '0', 'yes', 'no') THEN
          v_errors := array_append(v_errors, format('Invalid boolean value "%s" for option "%s"', v_option_value, v_option.label));
        END IF;

      WHEN 'text' THEN
        -- For text, just check if constraints specify max length
        IF v_option.constraints_json ? 'max_length' THEN
          IF length(v_option_value) > (v_option.constraints_json->>'max_length')::INTEGER THEN
            v_errors := array_append(v_errors, format('Text value for "%s" exceeds maximum length', v_option.label));
          END IF;
        END IF;
    END CASE;
  END LOOP;

  -- Return validation result
  RETURN QUERY SELECT (array_length(v_errors, 1) IS NULL), v_errors;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - ITEM OPTIONS
-- ============================================================================

ALTER TABLE public.item_options ENABLE ROW LEVEL SECURITY;

-- Policy: SALES and ADMIN can SELECT item_options
DROP POLICY IF EXISTS "SALES and ADMIN can view item_options" ON public.item_options;
CREATE POLICY "SALES and ADMIN can view item_options"
  ON public.item_options
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Policy: ADMIN can INSERT item_options
DROP POLICY IF EXISTS "ADMIN can insert item_options" ON public.item_options;
CREATE POLICY "ADMIN can insert item_options"
  ON public.item_options
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: ADMIN can UPDATE item_options
DROP POLICY IF EXISTS "ADMIN can update item_options" ON public.item_options;
CREATE POLICY "ADMIN can update item_options"
  ON public.item_options
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

-- Policy: ADMIN can DELETE item_options
DROP POLICY IF EXISTS "ADMIN can delete item_options" ON public.item_options;
CREATE POLICY "ADMIN can delete item_options"
  ON public.item_options
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Service role has full access to item_options
DROP POLICY IF EXISTS "Service role full access to item_options" ON public.item_options;
CREATE POLICY "Service role full access to item_options"
  ON public.item_options
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - OPTION VALUES
-- ============================================================================

ALTER TABLE public.option_values ENABLE ROW LEVEL SECURITY;

-- Policy: SALES and ADMIN can SELECT option_values
DROP POLICY IF EXISTS "SALES and ADMIN can view option_values" ON public.option_values;
CREATE POLICY "SALES and ADMIN can view option_values"
  ON public.option_values
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Policy: ADMIN can INSERT option_values
DROP POLICY IF EXISTS "ADMIN can insert option_values" ON public.option_values;
CREATE POLICY "ADMIN can insert option_values"
  ON public.option_values
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: ADMIN can UPDATE option_values
DROP POLICY IF EXISTS "ADMIN can update option_values" ON public.option_values;
CREATE POLICY "ADMIN can update option_values"
  ON public.option_values
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

-- Policy: ADMIN can DELETE option_values
DROP POLICY IF EXISTS "ADMIN can delete option_values" ON public.option_values;
CREATE POLICY "ADMIN can delete option_values"
  ON public.option_values
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Service role has full access to option_values
DROP POLICY IF EXISTS "Service role full access to option_values" ON public.option_values;
CREATE POLICY "Service role full access to option_values"
  ON public.option_values
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- SAMPLE DATA: Product with Options (Commercial Steel Door)
-- ============================================================================
-- This demonstrates the complete options system with a real-world example

DO $$
DECLARE
  v_door_id UUID;
  v_size_option_id UUID;
  v_color_option_id UUID;
  v_finish_option_id UUID;
  v_hardware_option_id UUID;
BEGIN
  -- Insert a commercial steel door product (if it doesn't exist)
  INSERT INTO public.products (sku, name, unit_type, unit_price, aliases)
  VALUES ('DR-3080-20G', 'Commercial Steel Door 20-Gauge', 'EA', 425.00, ARRAY['door', 'steel door', 'commercial door'])
  ON CONFLICT (sku) DO UPDATE SET sku = EXCLUDED.sku
  RETURNING id INTO v_door_id;

  -- Create SIZE option (select type, required)
  INSERT INTO public.item_options (catalog_item_id, code, label, type, required, sort_order, price_delta_type)
  VALUES (v_door_id, 'SIZE', 'Door Size', 'select', true, 1, 'none')
  ON CONFLICT (catalog_item_id, code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_size_option_id;

  -- Add size values
  INSERT INTO public.option_values (item_option_id, value, label, price_delta, sku_suffix, sort_order)
  VALUES
    (v_size_option_id, '30x80', '30" x 80" (Standard)', 0.00, '-3080', 1),
    (v_size_option_id, '36x80', '36" x 80"', 25.00, '-3680', 2),
    (v_size_option_id, '36x84', '36" x 84"', 50.00, '-3684', 3),
    (v_size_option_id, '42x84', '42" x 84" (Oversize)', 85.00, '-4284', 4)
  ON CONFLICT (item_option_id, value) DO NOTHING;

  -- Create COLOR option (select type, required)
  INSERT INTO public.item_options (catalog_item_id, code, label, type, required, sort_order, price_delta_type)
  VALUES (v_door_id, 'COLOR', 'Color', 'select', true, 2, 'none')
  ON CONFLICT (catalog_item_id, code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_color_option_id;

  -- Add color values
  INSERT INTO public.option_values (item_option_id, value, label, price_delta, sku_suffix, sort_order)
  VALUES
    (v_color_option_id, 'white', 'White', 0.00, '-WHT', 1),
    (v_color_option_id, 'black', 'Black', 15.00, '-BLK', 2),
    (v_color_option_id, 'gray', 'Gray', 15.00, '-GRY', 3),
    (v_color_option_id, 'custom', 'Custom Color', 75.00, '-CUS', 4)
  ON CONFLICT (item_option_id, value) DO NOTHING;

  -- Create FINISH option (select type, optional)
  INSERT INTO public.item_options (catalog_item_id, code, label, type, required, default_value, sort_order, price_delta_type)
  VALUES (v_door_id, 'FINISH', 'Finish', 'select', false, 'primed', 3, 'none')
  ON CONFLICT (catalog_item_id, code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_finish_option_id;

  -- Add finish values
  INSERT INTO public.option_values (item_option_id, value, label, price_delta, sku_suffix, sort_order)
  VALUES
    (v_finish_option_id, 'primed', 'Primed (Paint Ready)', 0.00, '-PRM', 1),
    (v_finish_option_id, 'powder_coat', 'Powder Coated', 45.00, '-PWD', 2),
    (v_finish_option_id, 'galvanized', 'Galvanized', 35.00, '-GAL', 3)
  ON CONFLICT (item_option_id, value) DO NOTHING;

  -- Create HARDWARE option (select type, required)
  INSERT INTO public.item_options (catalog_item_id, code, label, type, required, sort_order, price_delta_type)
  VALUES (v_door_id, 'HARDWARE', 'Hardware Package', 'select', true, 4, 'none')
  ON CONFLICT (catalog_item_id, code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_hardware_option_id;

  -- Add hardware package values
  INSERT INTO public.option_values (item_option_id, value, label, price_delta, sku_suffix, sort_order)
  VALUES
    (v_hardware_option_id, 'lever_satin', 'Lever Handle (Satin Nickel)', 45.00, '-LVSAT', 1),
    (v_hardware_option_id, 'lever_bronze', 'Lever Handle (Oil-Rubbed Bronze)', 55.00, '-LVBRZ', 2),
    (v_hardware_option_id, 'knob_satin', 'Knob (Satin Nickel)', 35.00, '-KNSAT', 3),
    (v_hardware_option_id, 'panic_bar', 'Panic Bar (Exit Device)', 185.00, '-PANIC', 4),
    (v_hardware_option_id, 'none', 'No Hardware (Prep Only)', 0.00, '-PREP', 5)
  ON CONFLICT (item_option_id, value) DO NOTHING;

  RAISE NOTICE 'Sample door product with options created successfully';
END $$;

-- ============================================================================
-- DOCUMENTATION: options_json Structure in quote_lines
-- ============================================================================
-- The quote_lines.options_json column stores selected product options as JSONB
--
-- Structure:
-- {
--   "SIZE": "36x80",              -- Selected size option value
--   "COLOR": "white",             -- Selected color option value
--   "FINISH": "primed",           -- Selected finish option value
--   "HARDWARE": "lever_satin"     -- Selected hardware package value
-- }
--
-- The keys match item_options.code and values match option_values.value
-- When pricing a quote line, the system should:
-- 1. Start with products.unit_price
-- 2. Look up each option in options_json
-- 3. Find the corresponding option_value and add its price_delta
-- 4. Apply any option-level price_delta_value if price_delta_type is not 'none'
-- 5. Calculate final unit_price = base_price + sum(all price deltas)
--
-- Example calculation for door with options {"SIZE": "36x80", "COLOR": "black", "FINISH": "powder_coat", "HARDWARE": "lever_satin"}:
-- Base price: $425.00
-- + SIZE 36x80: $25.00
-- + COLOR black: $15.00
-- + FINISH powder_coat: $45.00
-- + HARDWARE lever_satin: $45.00
-- = Total unit_price: $555.00

-- ============================================================================
-- VERIFICATION QUERIES FOR OPTIONS SYSTEM
-- ============================================================================

-- To verify options tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('item_options', 'option_values');

-- To verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('item_options', 'option_values');

-- To verify policies exist:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('item_options', 'option_values') ORDER BY tablename, policyname;

-- To see sample door product with all options:
-- SELECT
--   p.sku, p.name,
--   io.code as option_code, io.label as option_label, io.type, io.required,
--   ov.value, ov.label as value_label, ov.price_delta
-- FROM products p
-- JOIN item_options io ON io.catalog_item_id = p.id
-- LEFT JOIN option_values ov ON ov.item_option_id = io.id
-- WHERE p.sku = 'DR-3080-20G'
-- ORDER BY io.sort_order, ov.sort_order;

-- To test the validation function:
-- SELECT * FROM validate_product_options(
--   (SELECT id FROM products WHERE sku = 'DR-3080-20G'),
--   '{"SIZE": "36x80", "COLOR": "white", "HARDWARE": "lever_satin"}'::jsonb
-- );

-- ============================================================================
-- SUPABASE STORAGE: quote-uploads BUCKET
-- ============================================================================
-- This bucket must be created in Supabase Dashboard: Storage > Create Bucket
-- Configuration:
--   - Name: quote-uploads
--   - Public: false (private bucket, requires authentication)
--   - File size limit: 104857600 (100MB)
--   - Allowed MIME types: See list below
--
-- Allowed MIME types:
--   - application/pdf
--   - image/jpeg, image/png, image/webp
--   - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (XLSX)
--   - application/vnd.ms-excel (XLS)
--   - text/csv, text/plain
--   - audio/mpeg (MP3), audio/mp4 (M4A), audio/wav

-- ============================================================================
-- STORAGE RLS POLICIES: quote-uploads bucket
-- ============================================================================

-- Policy: Users can upload to their own quotes
-- Allows authenticated users to upload files to quotes they own or have access to
DROP POLICY IF EXISTS "Users can upload to their quotes" ON storage.objects;
CREATE POLICY "Users can upload to their quotes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quote-uploads' AND
  (storage.foldername(name))[1] = 'quotes' AND
  EXISTS (
    SELECT 1 FROM quotes
    WHERE id::text = (storage.foldername(name))[2]
    AND (created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('ADMIN', 'SALES')
    ))
  )
);

-- Policy: Users can read their uploaded files
-- Allows users to download files from quotes they have access to
DROP POLICY IF EXISTS "Users can read their uploads" ON storage.objects;
CREATE POLICY "Users can read their uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'quote-uploads' AND
  EXISTS (
    SELECT 1 FROM uploads
    WHERE storage_path = name
    AND quote_id IN (
      SELECT id FROM quotes
      WHERE created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('ADMIN', 'SALES')
      )
    )
  )
);

-- Policy: ADMIN can delete files
-- Only administrators can delete uploaded files
DROP POLICY IF EXISTS "Admins can delete uploads" ON storage.objects;
CREATE POLICY "Admins can delete uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'quote-uploads' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'ADMIN'
  )
);

-- Policy: Service role has full access to storage
DROP POLICY IF EXISTS "Service role full access to storage" ON storage.objects;
CREATE POLICY "Service role full access to storage"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'quote-uploads')
WITH CHECK (bucket_id = 'quote-uploads');

-- ============================================================================
-- LIFECYCLE CLEANUP FUNCTION
-- ============================================================================
-- Auto-delete processed uploads after 90 days to manage storage costs
-- This function should be scheduled to run daily (e.g., via pg_cron)

CREATE OR REPLACE FUNCTION public.delete_old_uploads()
RETURNS TABLE(deleted_count INTEGER, errors_count INTEGER) AS $$
DECLARE
  old_upload RECORD;
  v_deleted_count INTEGER := 0;
  v_errors_count INTEGER := 0;
BEGIN
  -- Find uploads that are completed and older than 90 days
  FOR old_upload IN
    SELECT id, storage_path
    FROM public.uploads
    WHERE processed_at < NOW() - INTERVAL '90 days'
    AND status = 'completed'
    AND storage_path IS NOT NULL
  LOOP
    BEGIN
      -- Note: Actual file deletion from storage must be done via Supabase API
      -- This function only updates the database record
      -- A separate background job should handle physical file deletion

      -- Update database record to mark as archived
      UPDATE public.uploads
      SET
        status = 'archived',
        storage_path = NULL,
        parsed_payload_json = NULL  -- Clear large JSON data to save space
      WHERE id = old_upload.id;

      v_deleted_count := v_deleted_count + 1;

      RAISE NOTICE 'Archived upload % (storage_path: %)', old_upload.id, old_upload.storage_path;
    EXCEPTION WHEN OTHERS THEN
      v_errors_count := v_errors_count + 1;
      RAISE WARNING 'Failed to archive upload %: %', old_upload.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_deleted_count, v_errors_count;
END;
$$ LANGUAGE plpgsql;

-- Example: Schedule daily cleanup at 2 AM (requires pg_cron extension)
-- First, enable pg_cron extension (run as superuser):
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- Then schedule the job:
-- SELECT cron.schedule(
--   'cleanup-old-uploads',
--   '0 2 * * *',  -- At 2:00 AM every day
--   'SELECT public.delete_old_uploads();'
-- );
--
-- To manually run the cleanup:
-- SELECT * FROM public.delete_old_uploads();

-- ============================================================================
-- HELPER FUNCTION: Get upload statistics for a quote
-- ============================================================================
-- Returns file count and total size for all uploads in a quote
-- Useful for enforcing upload limits

CREATE OR REPLACE FUNCTION public.get_quote_upload_stats(p_quote_id UUID)
RETURNS TABLE(file_count BIGINT, total_size_bytes BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as file_count,
    COALESCE(SUM(size_bytes), 0)::BIGINT as total_size_bytes
  FROM public.uploads
  WHERE quote_id = p_quote_id
  AND status != 'archived';
END;
$$ LANGUAGE plpgsql STABLE;

-- Example usage:
-- SELECT * FROM get_quote_upload_stats('550e8400-e29b-41d4-a716-446655440000'::uuid);

-- ============================================================================
-- VERIFICATION QUERIES FOR STORAGE POLICIES
-- ============================================================================

-- To verify storage policies exist:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
-- ORDER BY policyname;

-- To test upload stats function:
-- SELECT * FROM get_quote_upload_stats((SELECT id FROM quotes LIMIT 1));

-- To test lifecycle cleanup (dry run):
-- SELECT id, original_name, status, processed_at,
--        NOW() - processed_at as age
-- FROM uploads
-- WHERE processed_at < NOW() - INTERVAL '90 days'
-- AND status = 'completed';

-- ============================================================================
-- NOTES ON STORAGE BUCKET SETUP
-- ============================================================================
--
-- The 'quote-uploads' bucket must be created manually in Supabase Dashboard:
-- 1. Go to Storage section in Supabase Dashboard
-- 2. Click "Create Bucket"
-- 3. Set name to: quote-uploads
-- 4. Set public to: false (private)
-- 5. Set file size limit to: 104857600 (100MB)
-- 6. Configure allowed MIME types (optional, can be enforced in application)
--
-- Storage path structure: quotes/{quote_id}/{timestamp}_{filename}
-- Example: quotes/550e8400-e29b-41d4-a716-446655440000/1699564800000_order.pdf
--
-- Benefits of this structure:
-- - Easy to find all files for a quote
-- - Timestamp prevents filename conflicts
-- - Original filename preserved for user reference
-- - Hierarchical structure supports folder operations
--
-- Security considerations:
-- - All files require authentication (private bucket)
-- - RLS policies enforce quote-level access control
-- - Filename sanitization prevents path traversal
-- - MIME type validation prevents malicious uploads
-- - File size limits prevent storage abuse
-- - Lifecycle policies manage storage costs
--
-- For production:
-- - Consider implementing virus scanning (ClamAV or cloud service)
-- - Set up monitoring for storage usage
-- - Configure backup policies for important uploads
-- - Implement rate limiting to prevent abuse
-- - Consider CDN for frequently accessed files

-- ============================================================================
-- PHASE 6: QUOTE WORKFLOW & APPROVAL SYSTEM
-- ============================================================================

-- Price Overrides Table (for tracking discounts/markups)
CREATE TABLE IF NOT EXISTS public.price_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  quote_line_id UUID REFERENCES public.quote_lines(id) ON DELETE CASCADE,
  original_price NUMERIC(10, 2) NOT NULL,
  override_price NUMERIC(10, 2) NOT NULL,
  discount_percent NUMERIC(5, 2),
  reason TEXT,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_requested_at TIMESTAMPTZ,
  approval_expires_at TIMESTAMPTZ,
  approver_notified_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_overrides_quote_id ON public.price_overrides(quote_id);
CREATE INDEX IF NOT EXISTS idx_price_overrides_approval_status ON public.price_overrides(approval_status);
CREATE INDEX IF NOT EXISTS idx_price_overrides_created_at ON public.price_overrides(created_at DESC);

-- Approval Thresholds Table
CREATE TABLE IF NOT EXISTS public.approval_thresholds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  threshold_type TEXT NOT NULL CHECK (threshold_type IN ('discount_percent', 'discount_amount')),
  threshold_value NUMERIC(10, 2) NOT NULL,
  approver_role TEXT NOT NULL CHECK (approver_role IN ('ADMIN', 'MANAGER', 'SALES')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.approval_thresholds (threshold_type, threshold_value, approver_role, is_active)
VALUES
  ('discount_percent', 10, 'MANAGER', true),
  ('discount_percent', 25, 'ADMIN', true),
  ('discount_amount', 500, 'MANAGER', true),
  ('discount_amount', 1000, 'ADMIN', true)
ON CONFLICT DO NOTHING;

-- Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('approval_required', 'approval_approved', 'approval_rejected', 'quote_sent', 'quote_accepted')),
  title TEXT NOT NULL,
  message TEXT,
  link_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Internal Notes Table
CREATE TABLE IF NOT EXISTS public.internal_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_notes_quote_id ON public.internal_notes(quote_id);
CREATE INDEX IF NOT EXISTS idx_internal_notes_created_at ON public.internal_notes(created_at DESC);

-- ============================================================================
-- STATUS VALIDATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_quote_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_valid_transitions TEXT[];
BEGIN
  -- Define valid transitions as array
  v_valid_transitions := ARRAY[
    'draft:submitted',
    'submitted:reviewed',
    'submitted:draft',
    'reviewed:sent',
    'reviewed:draft',
    'sent:accepted',
    'sent:declined',
    'sent:expired',
    'sent:reviewed',
    'sent:draft'
  ];

  -- Check if transition is valid
  IF OLD.status IS DISTINCT FROM NEW.status AND
     NOT ((OLD.status || ':' || NEW.status) = ANY(v_valid_transitions)) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_quote_status ON public.quotes;
CREATE TRIGGER trg_validate_quote_status
BEFORE UPDATE OF status ON public.quotes
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.validate_quote_status_transition();

-- ============================================================================
-- AUTO-EXPIRE QUOTES FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_old_quotes()
RETURNS void AS $$
BEGIN
  UPDATE public.quotes
  SET status = 'expired'
  WHERE status = 'sent'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- METRICS TABLE (Phase 9: Analytics & Reporting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON public.metrics(metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_dimensions ON public.metrics USING GIN(dimensions);

-- ============================================================================
-- REPORT ARCHIVE TABLE (Phase 9: Analytics & Reporting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id TEXT NOT NULL,
  date_range_start TIMESTAMPTZ NOT NULL,
  date_range_end TIMESTAMPTZ NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_archive_template ON public.report_archive(template_id, created_at DESC);

-- ============================================================================
-- METRICS FUNCTIONS (Phase 9: Analytics & Reporting)
-- ============================================================================

-- Quote conversion funnel
CREATE OR REPLACE FUNCTION public.get_quote_funnel(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  stage TEXT,
  count BIGINT,
  conversion_rate NUMERIC
) AS $$
WITH funnel AS (
  SELECT
    'Created' as stage,
    COUNT(*) as count,
    1 as order_num
  FROM public.quotes WHERE created_at BETWEEN p_start_date AND p_end_date

  UNION ALL

  SELECT 'Submitted', COUNT(*), 2
  FROM public.quotes WHERE submitted_at BETWEEN p_start_date AND p_end_date

  UNION ALL

  SELECT 'Sent', COUNT(*), 3
  FROM public.quotes WHERE sent_at BETWEEN p_start_date AND p_end_date

  UNION ALL

  SELECT 'Accepted', COUNT(*), 4
  FROM public.quotes WHERE status = 'accepted' AND created_at BETWEEN p_start_date AND p_end_date
)
SELECT
  stage,
  count,
  ROUND(count::NUMERIC / FIRST_VALUE(count) OVER (ORDER BY order_num) * 100, 2) as conversion_rate
FROM funnel
ORDER BY order_num;
$$ LANGUAGE SQL;

-- Revenue metrics
CREATE OR REPLACE FUNCTION public.get_revenue_metrics(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_revenue NUMERIC,
  average_quote_value NUMERIC,
  accepted_quotes BIGINT,
  total_margin NUMERIC
) AS $$
  SELECT
    COALESCE(SUM(total), 0) as total_revenue,
    COALESCE(AVG(total), 0) as average_quote_value,
    COUNT(*) as accepted_quotes,
    COALESCE(SUM(total * (COALESCE(margin_percent, 0) / 100)), 0) as total_margin
  FROM public.quotes
  WHERE status = 'accepted'
    AND created_at BETWEEN p_start_date AND p_end_date;
$$ LANGUAGE SQL;

-- OCR accuracy tracking
CREATE OR REPLACE FUNCTION public.track_ocr_accuracy()
RETURNS TABLE (
  average_confidence NUMERIC,
  total_extractions BIGINT,
  high_confidence_percent NUMERIC
) AS $$
  SELECT
    COALESCE(AVG(confidence_score), 0) as average_confidence,
    COUNT(*) as total_extractions,
    ROUND(COUNT(*) FILTER (WHERE confidence_score > 0.8)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) as high_confidence_percent
  FROM public.uploads
  WHERE file_type IN ('pdf', 'image')
    AND status = 'completed';
$$ LANGUAGE SQL;

-- ============================================================================
-- PHASE 10: NOTIFICATIONS & ALERTS SYSTEM
-- ============================================================================

-- Notification Preferences Table
-- Stores user preferences for different notification types
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON public.notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_type ON public.notification_preferences(notification_type);

-- Notification Queue Table
-- Queues notifications for sending with retry logic
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  retry_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON public.notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created_at ON public.notification_queue(created_at DESC);

-- Slack Configuration Table
-- Stores Slack webhook URLs and event configuration
CREATE TABLE IF NOT EXISTS public.slack_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL UNIQUE,
  webhook_url TEXT NOT NULL,
  channel TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slack_configs_event_type ON public.slack_configs(event_type);
CREATE INDEX IF NOT EXISTS idx_slack_configs_enabled ON public.slack_configs(enabled);

-- Webhooks Table
-- Stores customer-registered webhooks for external integrations
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  event_types TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON public.webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON public.webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON public.webhooks(created_at DESC);

-- Webhook Deliveries Table
-- Tracks all webhook delivery attempts for debugging and audit
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  retry_count INTEGER DEFAULT 0,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON public.webhook_deliveries(delivered_at);

-- Enable RLS for notification tables
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view and update their own notification preferences
DROP POLICY IF EXISTS "Users can manage their notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can manage their notification preferences"
  ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Service role has full access to notification preferences
DROP POLICY IF EXISTS "Service role full access to notification_preferences" ON public.notification_preferences;
CREATE POLICY "Service role full access to notification_preferences"
  ON public.notification_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Users can view and manage their own webhooks
DROP POLICY IF EXISTS "Users can manage their webhooks" ON public.webhooks;
CREATE POLICY "Users can manage their webhooks"
  ON public.webhooks
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Service role has full access to webhooks
DROP POLICY IF EXISTS "Service role full access to webhooks" ON public.webhooks;
CREATE POLICY "Service role full access to webhooks"
  ON public.webhooks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Service role has full access to notification_queue
DROP POLICY IF EXISTS "Service role full access to notification_queue" ON public.notification_queue;
CREATE POLICY "Service role full access to notification_queue"
  ON public.notification_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: ADMIN can view all slack configs
DROP POLICY IF EXISTS "ADMIN can manage slack configs" ON public.slack_configs;
CREATE POLICY "ADMIN can manage slack configs"
  ON public.slack_configs
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

-- RLS Policy: Service role has full access to slack_configs
DROP POLICY IF EXISTS "Service role full access to slack_configs" ON public.slack_configs;
CREATE POLICY "Service role full access to slack_configs"
  ON public.slack_configs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
