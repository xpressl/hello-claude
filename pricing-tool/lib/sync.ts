'use client'

import { db, type LocalProduct } from './dexie'
import type { Product } from './supabase'

const LAST_SYNC_KEY = 'pricing_last_sync_at'

/**
 * Get the timestamp of the last successful sync
 * @returns ISO timestamp string or null if never synced
 */
export function getLastSyncAt(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LAST_SYNC_KEY)
}

/**
 * Set the timestamp of the last successful sync
 * @param timestamp ISO timestamp string
 */
export function setLastSyncAt(timestamp: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LAST_SYNC_KEY, timestamp)
}

/**
 * Pull products from Supabase and store in Dexie
 * Fetches products updated since the last sync timestamp
 * @param since Optional ISO timestamp to fetch products updated after this time
 * @returns Number of products synced
 */
export async function pullProducts(since?: string): Promise<number> {
  const timestamp = since || getLastSyncAt()

  // Fetch from API route which proxies to Supabase
  const url = timestamp
    ? `/api/sync?since=${encodeURIComponent(timestamp)}`
    : '/api/sync'

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.statusText}`)
  }

  const products: Product[] = await response.json()

  // Convert to LocalProduct format and store in Dexie
  const localProducts: LocalProduct[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit_type: p.unit_type,
    unit_price: Number(p.unit_price),
    aliases: p.aliases || [],
    updated_at: p.updated_at || new Date().toISOString(),
  }))

  // Bulk upsert into Dexie
  await db.products.bulkPut(localProducts)

  // Update last sync timestamp
  setLastSyncAt(new Date().toISOString())

  return localProducts.length
}

/**
 * Search products in local Dexie database
 * Searches by name, SKU, and aliases
 * @param query Search query string
 * @returns Array of matching products
 */
export async function searchLocalProducts(query: string): Promise<LocalProduct[]> {
  if (!query.trim()) {
    // Return all products if no query
    return await db.products.orderBy('name').toArray()
  }

  const searchTerm = query.toLowerCase().trim()

  // Search across name, SKU, and aliases
  const results = await db.products
    .filter((product) => {
      const nameMatch = product.name.toLowerCase().includes(searchTerm)
      const skuMatch = product.sku.toLowerCase().includes(searchTerm)
      const aliasMatch = product.aliases.some((alias) =>
        alias.toLowerCase().includes(searchTerm)
      )
      return nameMatch || skuMatch || aliasMatch
    })
    .toArray()

  return results
}

/**
 * Get a single product from local Dexie database by ID
 * @param id Product UUID
 * @returns Product or undefined if not found
 */
export async function getLocalProduct(id: string): Promise<LocalProduct | undefined> {
  return await db.products.get(id)
}

/**
 * Get product count from local database
 * @returns Total number of products in local DB
 */
export async function getLocalProductCount(): Promise<number> {
  return await db.products.count()
}

/**
 * Clear all products from local database
 * Useful for debugging or forcing a full resync
 */
export async function clearLocalProducts(): Promise<void> {
  await db.products.clear()
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LAST_SYNC_KEY)
  }
}
