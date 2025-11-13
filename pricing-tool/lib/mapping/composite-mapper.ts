import { Product } from './description-matcher'
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
