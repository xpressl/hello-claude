# Task 26: Advanced Search Engine

## Objective
Implement full-text search with PostgreSQL Full-Text Search, fuzzy matching, category filters, price ranges, and ranked results.

## Context
- Search across products: name, SKU, description, tags
- Fuzzy matching for typos
- Filter by category, price range, unit type
- Ranked results by relevance
- Fast performance on large catalogs

## Requirements

### 1. Full-Text Search Setup

```sql
-- Add tsvector column
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index
CREATE INDEX idx_products_search ON products USING GIN(search_vector);

-- Update function
CREATE OR REPLACE FUNCTION products_search_vector_update()
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

-- Trigger
CREATE TRIGGER trg_products_search_vector
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION products_search_vector_update();

-- Update existing rows
UPDATE products SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(sku, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C');
```

### 2. Fuzzy Matching with pg_trgm

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);
CREATE INDEX idx_products_sku_trgm ON products USING GIN(sku gin_trgm_ops);
```

### 3. Search Function

```sql
CREATE OR REPLACE FUNCTION search_products(
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
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.sku,
    ts_rank(p.search_vector, plainto_tsquery('english', p_query)) as rank
  FROM products p
  LEFT JOIN product_categories pc ON pc.product_id = p.id
  WHERE
    p.search_vector @@ plainto_tsquery('english', p_query)
    AND (p_category_id IS NULL OR pc.category_id = p_category_id)
    AND (p_min_price IS NULL OR p.unit_price >= p_min_price)
    AND (p_max_price IS NULL OR p.unit_price <= p_max_price)
    AND (p_unit IS NULL OR p.unit = p_unit)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

### 4. Search API

**File:** `pricing-tool/app/api/search/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const category = searchParams.get('category')
  const minPrice = searchParams.get('minPrice')
  const maxPrice = searchParams.get('maxPrice')

  const { data } = await supabase.rpc('search_products', {
    p_query: query,
    p_category_id: category,
    p_min_price: minPrice ? parseFloat(minPrice) : null,
    p_max_price: maxPrice ? parseFloat(maxPrice) : null
  })

  return NextResponse.json({ results: data })
}
```

### 5. Search Component

**File:** `pricing-tool/components/ProductSearch.tsx`

```typescript
export function ProductSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [filters, setFilters] = useState({ category: null, minPrice: null, maxPrice: null })

  const search = useDebouncedCallback(async (q: string) => {
    const res = await fetch(`/api/search?q=${q}&category=${filters.category || ''}`)
    const data = await res.json()
    setResults(data.results)
  }, 300)

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          search(e.target.value)
        }}
        placeholder="Search products..."
        className="input"
      />
      {/* Filters */}
      {/* Results */}
    </div>
  )
}
```

## Files to Create
- Update `pricing-tool/supabase-schema.sql`
- `pricing-tool/app/api/search/route.ts`
- `pricing-tool/components/ProductSearch.tsx`

## Testing Requirements
1. Search by product name
2. Search by SKU
3. Fuzzy search with typos
4. Filter by category
5. Filter by price range
6. Verify ranking order

## Acceptance Criteria
- [ ] Full-text search works
- [ ] Fuzzy matching finds close matches
- [ ] Filters apply correctly
- [ ] Results ranked by relevance
- [ ] Performance < 100ms for typical queries
- [ ] Autocomplete suggestions work

## Dependencies
- Task 01 (products table)
- Task 25 (categories)

## Estimated Effort
4-5 hours

## Review Checklist
- [ ] Indexes improve performance
- [ ] Search handles special characters
- [ ] Empty query returns all products
- [ ] Pagination implemented
- [ ] Debounce prevents excessive queries
- [ ] Mobile search UI functional
