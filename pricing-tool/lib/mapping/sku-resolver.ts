import { createClient } from '@supabase/supabase-js'

export interface SKUMapping {
  customer_sku: string
  catalog_sku: string
  confidence: number
  source: 'exact' | 'alias' | 'fuzzy' | 'learned'
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function resolveSKU(
  customerSKU: string
): Promise<SKUMapping | null> {
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
  await supabase.from('sku_aliases').upsert({
    customer_sku: customerSKU.toUpperCase().trim(),
    catalog_product_id: catalogProductId,
    created_by: userId
  })
}
