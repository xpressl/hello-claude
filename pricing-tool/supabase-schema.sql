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
