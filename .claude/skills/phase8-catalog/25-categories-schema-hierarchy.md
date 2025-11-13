# Task 25: Categories Schema and Hierarchy

## Objective
Design and implement hierarchical category system with tree structure, many-to-many product relationships, images, and drag-drop ordering.

## Context
- Products organized into categories (Doors > Entry Doors > Commercial)
- Tree structure with unlimited depth
- Products can belong to multiple categories
- Each category has image, description, settings
- Sort order for display

## Requirements

### 1. Categories Table

```sql
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  image_url TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_sort ON categories(sort_order);

-- Example data
INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
  ('Doors', 'doors', NULL, 1),
  ('Windows', 'windows', NULL, 2),
  ('Hardware', 'hardware', NULL, 3),
  ('Entry Doors', 'entry-doors', (SELECT id FROM categories WHERE slug = 'doors'), 1),
  ('Interior Doors', 'interior-doors', (SELECT id FROM categories WHERE slug = 'doors'), 2);
```

### 2. Product Categories Join Table

```sql
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, category_id)
);

CREATE INDEX idx_product_categories_product ON product_categories(product_id);
CREATE INDEX idx_product_categories_category ON product_categories(category_id);
```

### 3. Recursive Category Query

```sql
CREATE OR REPLACE FUNCTION get_category_tree(p_parent_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  parent_id UUID,
  level INTEGER,
  path TEXT[],
  product_count BIGINT
) AS $$
  WITH RECURSIVE category_tree AS (
    -- Base case
    SELECT
      c.id,
      c.name,
      c.slug,
      c.parent_id,
      0 as level,
      ARRAY[c.name] as path
    FROM categories c
    WHERE c.parent_id IS NULL OR c.parent_id = p_parent_id

    UNION ALL

    -- Recursive case
    SELECT
      c.id,
      c.name,
      c.slug,
      c.parent_id,
      ct.level + 1,
      ct.path || c.name
    FROM categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.id
  )
  SELECT
    ct.*,
    COUNT(pc.product_id) as product_count
  FROM category_tree ct
  LEFT JOIN product_categories pc ON pc.category_id = ct.id
  GROUP BY ct.id, ct.name, ct.slug, ct.parent_id, ct.level, ct.path
  ORDER BY ct.level, ct.name;
$$ LANGUAGE SQL;
```

### 4. Update Products Table

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_category_id UUID REFERENCES categories(id);
CREATE INDEX idx_products_primary_category ON products(primary_category_id);
```

## Files to Modify
- `pricing-tool/supabase-schema.sql`

## Testing Requirements
1. Create parent and child categories
2. Assign products to multiple categories
3. Query category tree
4. Test cascade delete
5. Verify product counts

## Acceptance Criteria
- [ ] Categories table with parent_id for hierarchy
- [ ] Many-to-many product_categories join table
- [ ] Recursive query returns tree
- [ ] Product counts accurate
- [ ] Cascade deletes work
- [ ] Sort order respected

## Dependencies
- Task 01 (products table exists)

## Estimated Effort
3-4 hours

## Review Checklist
- [ ] Tree structure supports unlimited depth
- [ ] Circular references prevented
- [ ] Performance acceptable for large trees
- [ ] Indexes on foreign keys
- [ ] RLS policies defined
- [ ] Slug uniqueness enforced
