/**
 * Pricing Cache
 *
 * In-memory cache for frequently accessed prices
 * Improves performance by avoiding repeated database queries
 * Automatically expires entries after TTL
 */

const priceCache = new Map<string, { price: number; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

/**
 * Get cached price if available and not expired
 */
export function getCachedPrice(key: string): number | null {
  const cached = priceCache.get(key)

  if (!cached) {
    return null
  }

  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    priceCache.delete(key)
    return null
  }

  return cached.price
}

/**
 * Store price in cache with timestamp
 */
export function setCachedPrice(key: string, price: number): void {
  priceCache.set(key, {
    price,
    timestamp: Date.now()
  })
}

/**
 * Generate cache key from pricing parameters
 * Creates deterministic key from product, quantity, price list, and options
 */
export function generateCacheKey(
  productId: string,
  quantity: number,
  priceListId?: string,
  options?: Record<string, any>,
  customerType?: string
): string {
  const optionsStr = options ? JSON.stringify(options) : '{}'
  const listId = priceListId || 'default'
  const customer = customerType || 'retail'

  return `pricing:${productId}:${quantity}:${listId}:${customer}:${optionsStr}`
}

/**
 * Clear all cached prices
 * Useful after price list updates
 */
export function clearPriceCache(): void {
  priceCache.clear()
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats() {
  let validCount = 0
  let expiredCount = 0

  priceCache.forEach((value) => {
    if (Date.now() - value.timestamp > CACHE_TTL) {
      expiredCount++
    } else {
      validCount++
    }
  })

  return {
    total: priceCache.size,
    valid: validCount,
    expired: expiredCount,
    ttl_ms: CACHE_TTL
  }
}

/**
 * Cleanup expired entries from cache
 * Call periodically to free memory
 */
export function cleanupExpiredCache(): void {
  const now = Date.now()
  let cleaned = 0
  const keysToDelete: string[] = []

  priceCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key)
      cleaned++
    }
  })

  keysToDelete.forEach(key => priceCache.delete(key))

  if (cleaned > 0) {
    console.debug(`Cleaned up ${cleaned} expired cache entries`)
  }
}
