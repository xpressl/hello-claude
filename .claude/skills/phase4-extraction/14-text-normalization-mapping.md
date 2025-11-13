# Task 14: Text Normalization and Intelligent Mapping

## Objective
Implement intelligent text normalization and catalog mapping for extracted line items, including size code standardization, SKU alias resolution, fuzzy matching, and confidence scoring.

## Context
- Extracted text (from OCR/ASR/parsers) is messy and inconsistent
- Size formats vary: "30x80", "30 x 80", "3'0\" x 6'8\""
- SKUs have aliases: "DR-3080" might be same as "DOOR-3080-STD"
- Need fuzzy matching to handle typos and variations
- Confidence scores guide manual review workflow
- Learning system: corrections become mapping rules

## Requirements

### 1. Size Code Normalizer

**File:** `pricing-tool/lib/mapping/size-normalizer.ts`

```typescript
export interface SizeNormalizationResult {
  original: string
  normalized: string
  width: number  // In inches
  height: number  // In inches
  format: 'inches' | 'feet-inches' | 'metric'
  confidence: number
}

export function normalizeSize(input: string): SizeNormalizationResult | null {
  // Remove all whitespace
  const cleaned = input.replace(/\s+/g, '')

  // Pattern 1: "30x80" (inches)
  const inchPattern = /^(\d{2,3})x(\d{2,3})$/i
  const inchMatch = cleaned.match(inchPattern)
  if (inchMatch) {
    const width = parseInt(inchMatch[1])
    const height = parseInt(inchMatch[2])

    // Validate reasonable sizes (12-144 inches)
    if (width >= 12 && width <= 144 && height >= 12 && height <= 144) {
      return {
        original: input,
        normalized: `${width}x${height}`,
        width,
        height,
        format: 'inches',
        confidence: 0.95
      }
    }
  }

  // Pattern 2: "3'0\" x 6'8\"" (feet-inches)
  const feetPattern = /^(\d)'(\d{1,2})"?x(\d)'(\d{1,2})"?$/i
  const feetMatch = cleaned.match(feetPattern)
  if (feetMatch) {
    const width = parseInt(feetMatch[1]) * 12 + parseInt(feetMatch[2])
    const height = parseInt(feetMatch[3]) * 12 + parseInt(feetMatch[4])

    if (width >= 12 && width <= 144 && height >= 12 && height <= 144) {
      return {
        original: input,
        normalized: `${width}x${height}`,
        width,
        height,
        format: 'feet-inches',
        confidence: 0.9
      }
    }
  }

  // Pattern 3: "762x2032" (millimeters - convert to inches)
  const mmPattern = /^(\d{3,4})x(\d{3,4})$/
  const mmMatch = cleaned.match(mmPattern)
  if (mmMatch) {
    const widthMm = parseInt(mmMatch[1])
    const heightMm = parseInt(mmMatch[2])

    // Check if values are reasonable for mm (300-3000mm)
    if (widthMm >= 300 && widthMm <= 3000 && heightMm >= 300 && heightMm <= 3000) {
      const width = Math.round(widthMm / 25.4)  // Convert mm to inches
      const height = Math.round(heightMm / 25.4)

      return {
        original: input,
        normalized: `${width}x${height}`,
        width,
        height,
        format: 'metric',
        confidence: 0.85
      }
    }
  }

  return null
}

export function generateSizeVariations(size: string): string[] {
  const normalized = normalizeSize(size)
  if (!normalized) return [size]

  const { width, height } = normalized

  return [
    `${width}x${height}`,           // 30x80
    `${width} x ${height}`,         // 30 x 80
    `${width}X${height}`,           // 30X80
    `${Math.floor(width/12)}'${width%12}" x ${Math.floor(height/12)}'${height%12}"`,  // 3'0" x 6'8"
    `${width}\"x${height}\"`        // 30"x80"
  ]
}
```

### 2. SKU Alias Resolver

**File:** `pricing-tool/lib/mapping/sku-resolver.ts`

**Purpose:** Map customer SKUs to catalog SKUs

```typescript
import { createClient } from '@supabase/supabase-js'

export interface SKUMapping {
  customer_sku: string
  catalog_sku: string
  confidence: number
  source: 'exact' | 'alias' | 'fuzzy' | 'learned'
}

// Database table for learned mappings
// CREATE TABLE sku_aliases (
//   id UUID PRIMARY KEY,
//   customer_sku TEXT NOT NULL,
//   catalog_product_id UUID REFERENCES products(id),
//   created_by UUID REFERENCES users(id),
//   created_at TIMESTAMPTZ DEFAULT NOW(),
//   UNIQUE(customer_sku, catalog_product_id)
// )

export async function resolveSKU(
  customerSKU: string
): Promise<SKUMapping | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const normalizedSKU = customerSKU.toUpperCase().trim()

  // 1. Exact match in catalog
  const { data: exactMatch } = await supabase
    .from('products')
    .select('sku')
    .eq('sku', normalizedSKU)
    .single()

  if (exactMatch) {
    return {
      customer_sku: customerSKU,
      catalog_sku: exactMatch.sku,
      confidence: 1.0,
      source: 'exact'
    }
  }

  // 2. Check learned aliases
  const { data: aliasMatch } = await supabase
    .from('sku_aliases')
    .select('catalog_product_id, products!inner(sku)')
    .eq('customer_sku', normalizedSKU)
    .single()

  if (aliasMatch) {
    return {
      customer_sku: customerSKU,
      catalog_sku: (aliasMatch as any).products.sku,
      confidence: 0.95,
      source: 'alias'
    }
  }

  // 3. Fuzzy match (edit distance)
  const { data: allProducts } = await supabase
    .from('products')
    .select('sku')
    .limit(1000)

  if (allProducts) {
    const fuzzyMatch = findFuzzyMatch(normalizedSKU, allProducts.map(p => p.sku))
    if (fuzzyMatch) {
      return {
        customer_sku: customerSKU,
        catalog_sku: fuzzyMatch.sku,
        confidence: fuzzyMatch.confidence,
        source: 'fuzzy'
      }
    }
  }

  return null
}

function findFuzzyMatch(
  target: string,
  candidates: string[]
): { sku: string; confidence: number } | null {
  let bestMatch: { sku: string; confidence: number } | null = null
  let bestScore = 0

  for (const candidate of candidates) {
    const score = calculateSimilarity(target, candidate)

    // Require at least 70% similarity
    if (score > 0.7 && score > bestScore) {
      bestScore = score
      bestMatch = {
        sku: candidate,
        confidence: score
      }
    }
  }

  return bestMatch
}

function calculateSimilarity(str1: string, str2: string): number {
  // Levenshtein distance
  const len1 = str1.length
  const len2 = str2.length

  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0))

  for (let i = 0; i <= len1; i++) matrix[i][0] = i
  for (let j = 0; j <= len2; j++) matrix[0][j] = j

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = matrix[len1][len2]
  const maxLen = Math.max(len1, len2)

  return 1 - distance / maxLen
}

export async function learnSKUMapping(
  customerSKU: string,
  catalogProductId: string,
  userId: string
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await supabase.from('sku_aliases').upsert({
    customer_sku: customerSKU.toUpperCase().trim(),
    catalog_product_id: catalogProductId,
    created_by: userId
  })
}
```

### 3. Description Matcher

**File:** `pricing-tool/lib/mapping/description-matcher.ts`

```typescript
import Fuse from 'fuse.js'
import { Product } from '@/lib/types'

export interface DescriptionMatch {
  product: Product
  score: number
  matchedFields: string[]
  confidence: number
}

export async function findProductByDescription(
  description: string,
  catalog: Product[],
  options?: {
    threshold?: number
    limit?: number
  }
): Promise<DescriptionMatch[]> {
  const threshold = options?.threshold || 0.4
  const limit = options?.limit || 5

  const fuse = new Fuse(catalog, {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'description', weight: 1.5 },
      { name: 'sku', weight: 1 },
      { name: 'tags', weight: 0.5 }
    ],
    threshold,
    includeScore: true,
    includeMatches: true
  })

  const results = fuse.search(description, { limit })

  return results.map(result => ({
    product: result.item,
    score: result.score || 0,
    matchedFields: result.matches?.map(m => m.key as string) || [],
    confidence: 1 - (result.score || 0)
  }))
}

export function extractKeywords(description: string): string[] {
  // Remove common stop words
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']

  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))

  // Remove duplicates
  return [...new Set(words)]
}

export function calculateSemanticSimilarity(
  desc1: string,
  desc2: string
): number {
  const keywords1 = new Set(extractKeywords(desc1))
  const keywords2 = new Set(extractKeywords(desc2))

  // Jaccard similarity
  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)))
  const union = new Set([...keywords1, ...keywords2])

  return intersection.size / union.size
}
```

### 4. Composite Mapper

**File:** `pricing-tool/lib/mapping/composite-mapper.ts`

**Purpose:** Combine all mapping strategies for best results

```typescript
import { Product } from '@/lib/types'
import { resolveSKU } from './sku-resolver'
import { normalizeSize } from './size-normalizer'
import { findProductByDescription } from './description-matcher'

export interface MappingResult {
  product: Product | null
  confidence: number
  method: 'sku_exact' | 'sku_alias' | 'sku_fuzzy' | 'description' | 'none'
  warnings: string[]
  suggestions: Product[]
}

export async function mapLineItemToCatalog(
  item: {
    sku?: string
    description?: string
    size?: string
  },
  catalog: Product[]
): Promise<MappingResult> {
  const warnings: string[] = []
  let product: Product | null = null
  let confidence = 0
  let method: MappingResult['method'] = 'none'

  // Strategy 1: SKU resolution (highest confidence)
  if (item.sku) {
    const skuMapping = await resolveSKU(item.sku)

    if (skuMapping) {
      product = catalog.find(p => p.sku === skuMapping.catalog_sku) || null
      confidence = skuMapping.confidence
      method = skuMapping.source === 'exact' ? 'sku_exact' :
               skuMapping.source === 'alias' ? 'sku_alias' : 'sku_fuzzy'

      if (skuMapping.source === 'fuzzy') {
        warnings.push(`SKU "${item.sku}" fuzzy-matched to "${skuMapping.catalog_sku}"`)
      }
    } else {
      warnings.push(`SKU "${item.sku}" not found in catalog`)
    }
  }

  // Strategy 2: Description matching (if SKU failed)
  if (!product && item.description) {
    const descMatches = await findProductByDescription(
      item.description,
      catalog,
      { threshold: 0.3, limit: 5 }
    )

    if (descMatches.length > 0) {
      product = descMatches[0].product
      confidence = descMatches[0].confidence
      method = 'description'

      if (confidence < 0.8) {
        warnings.push(`Description match has low confidence (${(confidence * 100).toFixed(0)}%)`)
      }
    }
  }

  // Normalize size if provided
  if (item.size) {
    const sizeNormalization = normalizeSize(item.size)

    if (!sizeNormalization) {
      warnings.push(`Could not normalize size "${item.size}"`)
    } else if (sizeNormalization.confidence < 0.9) {
      warnings.push(`Size "${item.size}" normalized to "${sizeNormalization.normalized}" with ${(sizeNormalization.confidence * 100).toFixed(0)}% confidence`)
    }
  }

  // Get suggestions (top 3 matches)
  const suggestions = item.description
    ? (await findProductByDescription(item.description, catalog, { limit: 3 }))
        .map(m => m.product)
    : []

  return {
    product,
    confidence,
    method,
    warnings,
    suggestions
  }
}
```

### 5. Confidence Scoring System

**File:** `pricing-tool/lib/mapping/confidence-scorer.ts`

```typescript
export interface ConfidenceFactors {
  skuMatch: number         // 0-1
  descriptionMatch: number // 0-1
  sizeMatch: number       // 0-1
  quantityValid: number   // 0-1
  priceReasonable: number // 0-1
}

export function calculateOverallConfidence(
  factors: Partial<ConfidenceFactors>
): number {
  const weights = {
    skuMatch: 0.4,
    descriptionMatch: 0.3,
    sizeMatch: 0.15,
    quantityValid: 0.1,
    priceReasonable: 0.05
  }

  let totalScore = 0
  let totalWeight = 0

  for (const [factor, weight] of Object.entries(weights)) {
    const value = factors[factor as keyof ConfidenceFactors]
    if (value !== undefined) {
      totalScore += value * weight
      totalWeight += weight
    }
  }

  // Normalize by actual weight used
  return totalWeight > 0 ? totalScore / totalWeight : 0
}

export function getConfidenceLabel(score: number): {
  label: string
  color: string
  requiresReview: boolean
} {
  if (score >= 0.9) {
    return {
      label: 'High',
      color: 'green',
      requiresReview: false
    }
  } else if (score >= 0.7) {
    return {
      label: 'Medium',
      color: 'yellow',
      requiresReview: false
    }
  } else if (score >= 0.5) {
    return {
      label: 'Low',
      color: 'orange',
      requiresReview: true
    }
  } else {
    return {
      label: 'Very Low',
      color: 'red',
      requiresReview: true
    }
  }
}
```

### 6. Mapping Corrections Storage

**Schema for learned mappings:**
```sql
-- SKU aliases (already defined)
CREATE TABLE IF NOT EXISTS sku_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_sku TEXT NOT NULL,
  catalog_product_id UUID REFERENCES products(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_sku, catalog_product_id)
);

-- Description mappings
CREATE TABLE IF NOT EXISTS description_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_description TEXT NOT NULL,
  catalog_product_id UUID REFERENCES products(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  times_used INTEGER DEFAULT 1,
  UNIQUE(customer_description, catalog_product_id)
);

-- Size variations
CREATE TABLE IF NOT EXISTS size_variations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant TEXT NOT NULL UNIQUE,
  normalized TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7. API Route for Learning Mappings

**File:** `pricing-tool/app/api/mappings/learn/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { learnSKUMapping } from '@/lib/mapping/sku-resolver'

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { type, customerValue, catalogProductId } = body

  try {
    if (type === 'sku') {
      await learnSKUMapping(customerValue, catalogProductId, user.id)
    } else if (type === 'description') {
      await supabase.from('description_mappings').upsert({
        customer_description: customerValue,
        catalog_product_id: catalogProductId,
        created_by: user.id
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to learn mapping' },
      { status: 500 }
    )
  }
}
```

## Files to Create

**Mapping Library:**
- `pricing-tool/lib/mapping/size-normalizer.ts`
- `pricing-tool/lib/mapping/sku-resolver.ts`
- `pricing-tool/lib/mapping/description-matcher.ts`
- `pricing-tool/lib/mapping/composite-mapper.ts`
- `pricing-tool/lib/mapping/confidence-scorer.ts`

**API:**
- `pricing-tool/app/api/mappings/learn/route.ts`

**Schema:**
- `pricing-tool/supabase-schema.sql` (add mapping tables)

**Tests:**
- `pricing-tool/lib/mapping/__tests__/size-normalizer.test.ts`
- `pricing-tool/lib/mapping/__tests__/sku-resolver.test.ts`

## Testing Requirements

1. **Size Normalization:**
   - "30x80" → "30x80" (exact)
   - "30 x 80" → "30x80" (spaces)
   - "3'0\" x 6'8\"" → "30x80" (feet-inches)
   - "762x2032" → "30x80" (millimeters)
   - Invalid sizes rejected

2. **SKU Resolution:**
   - Exact match: "DR-3080" → catalog SKU
   - Alias match: "DOOR-3080" → "DR-3080"
   - Fuzzy match: "DR-308O" (typo) → "DR-3080"
   - No match: "INVALID" → null

3. **Description Matching:**
   - "Steel Door 30x80" → finds door products
   - "Commercial Entry" → finds entry products
   - Partial matches ranked by score

4. **Confidence Scoring:**
   - High confidence (>0.9): exact SKU match
   - Medium confidence (0.7-0.9): alias or good description match
   - Low confidence (<0.7): fuzzy or weak matches

## Acceptance Criteria

- [ ] Size normalization handles common formats
- [ ] SKU resolution tries exact, alias, fuzzy in order
- [ ] Description matching uses fuzzy search
- [ ] Composite mapper combines all strategies
- [ ] Confidence scores are meaningful
- [ ] Warnings generated for low-confidence matches
- [ ] Learned mappings stored in database
- [ ] Future lookups use learned mappings
- [ ] Admin can review and approve mappings
- [ ] Test coverage > 85%

## Dependencies

- Task 01 (products table)
- Task 11 (parser extraction)
- Fuse.js for fuzzy search

## Estimated Effort

6-8 hours

## Review Checklist

- [ ] Normalization is idempotent
- [ ] Fuzzy matching has reasonable threshold
- [ ] Performance acceptable for large catalogs
- [ ] Levenshtein distance implemented correctly
- [ ] Confidence scores calibrated
- [ ] Learned mappings don't create duplicates
- [ ] Size conversions accurate (mm to inches)
- [ ] Keywords extraction removes stop words
- [ ] TypeScript types accurate
- [ ] Edge cases handled (null, empty strings)
- [ ] Database queries optimized
- [ ] Mapping suggestions useful
