import Fuse from 'fuse.js'

export interface Product {
  id: string
  sku: string
  name: string
  description?: string
  tags?: string[]
}

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
