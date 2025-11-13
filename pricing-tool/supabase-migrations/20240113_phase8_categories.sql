-- ============================================================================
-- PHASE 8: ADVANCED CATALOG FEATURES
-- ============================================================================
-- Migration: Create categories, product-categories join table, and search functionality
-- Created: 2024-11-13

-- ============================================================================
-- TASK 25: CATEGORIES SCHEMA AND HIERARCHY
-- ============================================================================

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Categories table with parent-child tree structure
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  image_url TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for categories table
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON public.categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(is_active);

-- Product-Categories join table for many-to-many relationships
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, category_id)
);

-- Indexes for product_categories table
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON public.product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON public.product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_primary ON public.product_categories(is_primary);

-- Add primary_category_id to products table (if not already there)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS primary_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_primary_category ON public.products(primary_category_id);

-- Update trigger for categories updated_at
DROP TRIGGER IF EXISTS set_updated_at_categories ON public.categories;
CREATE TRIGGER set_updated_at_categories
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Recursive function to get category tree with product counts
CREATE OR REPLACE FUNCTION public.get_category_tree(p_parent_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  parent_id UUID,
  level INTEGER,
  path TEXT[],
  product_count BIGINT,
  is_active BOOLEAN,
  sort_order INTEGER
) AS $$
  WITH RECURSIVE category_tree AS (
    -- Base case: root categories or specified parent
    SELECT
      c.id,
      c.name,
      c.slug,
      c.parent_id,
      0 as level,
      ARRAY[c.name] as path,
      c.is_active,
      c.sort_order
    FROM public.categories c
    WHERE (p_parent_id IS NULL AND c.parent_id IS NULL) OR c.parent_id = p_parent_id

    UNION ALL

    -- Recursive case: child categories
    SELECT
      c.id,
      c.name,
      c.slug,
      c.parent_id,
      ct.level + 1,
      ct.path || c.name,
      c.is_active,
      c.sort_order
    FROM public.categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.id
  )
  SELECT
    ct.id,
    ct.name,
    ct.slug,
    ct.parent_id,
    ct.level,
    ct.path,
    COUNT(pc.product_id) as product_count,
    ct.is_active,
    ct.sort_order
  FROM category_tree ct
  LEFT JOIN public.product_categories pc ON pc.category_id = ct.id
  GROUP BY ct.id, ct.name, ct.slug, ct.parent_id, ct.level, ct.path, ct.is_active, ct.sort_order
  ORDER BY ct.level, ct.sort_order, ct.name;
$$ LANGUAGE SQL;

-- Get all children of a category (recursive)
CREATE OR REPLACE FUNCTION public.get_category_children(p_category_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  parent_id UUID,
  level INTEGER
) AS $$
  WITH RECURSIVE children AS (
    -- Direct children
    SELECT
      c.id,
      c.name,
      c.slug,
      c.parent_id,
      0 as level
    FROM public.categories c
    WHERE c.parent_id = p_category_id

    UNION ALL

    -- Descendants
    SELECT
      c.id,
      c.name,
      c.slug,
      c.parent_id,
      ch.level + 1
    FROM public.categories c
    INNER JOIN children ch ON c.parent_id = ch.id
  )
  SELECT * FROM children
  ORDER BY level, name;
$$ LANGUAGE SQL;

-- Get category breadcrumb path
CREATE OR REPLACE FUNCTION public.get_category_breadcrumb(p_category_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  level INTEGER
) AS $$
  WITH RECURSIVE breadcrumb AS (
    -- Start with the given category
    SELECT
      c.id,
      c.name,
      c.slug,
      c.parent_id,
      0 as level
    FROM public.categories c
    WHERE c.id = p_category_id

    UNION ALL

    -- Traverse up to parent
    SELECT
      c.id,
      c.name,
      c.slug,
      c.parent_id,
      br.level + 1
    FROM public.categories c
    INNER JOIN breadcrumb br ON c.id = br.parent_id
  )
  SELECT
    id,
    name,
    slug,
    (COUNT(*) OVER () - 1 - level) as level
  FROM breadcrumb
  WHERE parent_id IS NOT NULL OR id = p_category_id
  ORDER BY level DESC;
$$ LANGUAGE SQL;

-- ============================================================================
-- TASK 26: ADVANCED SEARCH ENGINE
-- ============================================================================

-- Add full-text search vector to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products USING GIN(search_vector);

-- Create trigram indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON public.products USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON public.products USING GIN(sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN(tags);

-- Update function for search vector
CREATE OR REPLACE FUNCTION public.products_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.sku, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS trg_products_search_vector ON public.products;
CREATE TRIGGER trg_products_search_vector
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_search_vector_update();

-- Update existing products search vectors
UPDATE public.products SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(sku, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'D')
WHERE search_vector IS NULL;

-- Search products function with category, price, and unit filters
CREATE OR REPLACE FUNCTION public.search_products(
  p_query TEXT,
  p_category_id UUID DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_unit TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  product_id UUID,
  name TEXT,
  sku TEXT,
  description TEXT,
  unit_price NUMERIC,
  unit_type TEXT,
  rank REAL,
  category_id UUID,
  is_primary BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.sku,
    p.description,
    p.unit_price,
    p.unit_type,
    ts_rank(p.search_vector, plainto_tsquery('english', p_query)) as rank,
    pc.category_id,
    pc.is_primary
  FROM public.products p
  LEFT JOIN public.product_categories pc ON pc.product_id = p.id
  WHERE
    (p_query = '' OR p.search_vector @@ plainto_tsquery('english', p_query))
    AND (p_category_id IS NULL OR pc.category_id = p_category_id OR p.primary_category_id = p_category_id)
    AND (p_min_price IS NULL OR p.unit_price >= p_min_price)
    AND (p_max_price IS NULL OR p.unit_price <= p_max_price)
    AND (p_unit IS NULL OR p.unit_type = p_unit)
  ORDER BY rank DESC, p.name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY FOR PHASE 8
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Categories: SALES and ADMIN can view active categories
DROP POLICY IF EXISTS "SALES can view active categories" ON public.categories;
CREATE POLICY "SALES can view active categories"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Categories: ADMIN can manage all categories
DROP POLICY IF EXISTS "ADMIN can manage categories" ON public.categories;
CREATE POLICY "ADMIN can manage categories"
  ON public.categories
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

-- Service role full access to categories
DROP POLICY IF EXISTS "Service role full access to categories" ON public.categories;
CREATE POLICY "Service role full access to categories"
  ON public.categories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Product Categories: SALES and ADMIN can view
DROP POLICY IF EXISTS "SALES can view product categories" ON public.product_categories;
CREATE POLICY "SALES can view product categories"
  ON public.product_categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('SALES', 'ADMIN')
    )
  );

-- Product Categories: ADMIN can manage
DROP POLICY IF EXISTS "ADMIN can manage product categories" ON public.product_categories;
CREATE POLICY "ADMIN can manage product categories"
  ON public.product_categories
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

-- Service role full access to product_categories
DROP POLICY IF EXISTS "Service role full access to product categories" ON public.product_categories;
CREATE POLICY "Service role full access to product categories"
  ON public.product_categories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Sample data for categories (if not already inserted)
INSERT INTO public.categories (name, slug, description, sort_order)
VALUES
  ('Doors', 'doors', 'Door products and accessories', 1),
  ('Windows', 'windows', 'Window products and accessories', 2),
  ('Hardware', 'hardware', 'Hardware and fasteners', 3)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (name, slug, description, parent_id, sort_order)
SELECT 'Entry Doors', 'entry-doors', 'Entry door products', c.id, 1
FROM public.categories c
WHERE c.slug = 'doors'
AND NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'entry-doors')
LIMIT 1;

INSERT INTO public.categories (name, slug, description, parent_id, sort_order)
SELECT 'Interior Doors', 'interior-doors', 'Interior door products', c.id, 2
FROM public.categories c
WHERE c.slug = 'doors'
AND NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'interior-doors')
LIMIT 1;
