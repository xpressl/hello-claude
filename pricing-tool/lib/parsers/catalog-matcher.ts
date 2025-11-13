import { Product } from '@/lib/dexie'
import { ExtractedLineItem } from './text-parser'
import Fuse from 'fuse.js'

export interface CatalogMatch {
  product: Product
  score: number  // 0-1, higher is better
  matchType: 'exact_sku' | 'fuzzy_sku' | 'fuzzy_name' | 'none'
}

export async function findCatalogMatch(
  item: ExtractedLineItem,
  catalog: Product[]
): Promise<CatalogMatch | null> {
  // 1. Try exact SKU match
  if (item.sku) {
    const exactMatch = catalog.find(p =>
      p.sku.toLowerCase() === item.sku!.toLowerCase()
    )
    if (exactMatch) {
      return {
        product: exactMatch,
        score: 1.0,
        matchType: 'exact_sku'
      }
    }
  }

  // 2. Try fuzzy SKU match
  if (item.sku) {
    const fuse = new Fuse(catalog, {
      keys: ['sku'],
      threshold: 0.3,
      includeScore: true
    })
    const results = fuse.search(item.sku)
    if (results.length > 0 && results[0].score! < 0.3) {
      return {
        product: results[0].item,
        score: 1 - results[0].score!,
        matchType: 'fuzzy_sku'
      }
    }
  }

  // 3. Try fuzzy description match
  if (item.description) {
    const fuse = new Fuse(catalog, {
      keys: ['name'],
      threshold: 0.4,
      includeScore: true
    })
    const results = fuse.search(item.description)
    if (results.length > 0 && results[0].score! < 0.4) {
      return {
        product: results[0].item,
        score: 1 - results[0].score!,
        matchType: 'fuzzy_name'
      }
    }
  }

  return null
}
