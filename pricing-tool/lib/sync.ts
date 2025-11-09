"use client"

import { db, type Product } from "./dexie"
import type { Product as SupabaseProduct } from "./supabase"

const LAST_SYNC_KEY = "pricing_last_sync_at"

export function getLastSyncAt(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(LAST_SYNC_KEY)
}

export function setLastSyncAt(timestamp: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LAST_SYNC_KEY, timestamp)
}

export async function pullProducts(since?: string): Promise<number> {
  const timestamp = since || getLastSyncAt()
  const url = timestamp ? `/api/sync?since=${encodeURIComponent(timestamp)}` : "/api/sync"

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Sync failed: ${response.statusText}`)

  const products: SupabaseProduct[] = await response.json()

  const localProducts: Product[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit_type: p.unit_type as any,
    unit_price: Number(p.unit_price),
    aliases: p.aliases || [],
    updated_at: p.updated_at || new Date().toISOString(),
  }))

  await db.products.bulkPut(localProducts)
  setLastSyncAt(new Date().toISOString())

  return localProducts.length
}

export async function searchLocalProducts(query: string): Promise<Product[]> {
  if (!query.trim()) {
    return await db.products.orderBy("name").toArray()
  }

  const searchTerm = query.toLowerCase().trim()

  const results = await db.products
    .filter((product) => {
      const nameMatch = product.name.toLowerCase().includes(searchTerm)
      const skuMatch = product.sku.toLowerCase().includes(searchTerm)
      const aliasMatch = product.aliases.some((alias) => alias.toLowerCase().includes(searchTerm))
      return nameMatch || skuMatch || aliasMatch
    })
    .toArray()

  return results
}

export async function getLocalProduct(id: string): Promise<Product | undefined> {
  return await db.products.get(id)
}

export async function getLocalProductCount(): Promise<number> {
  return await db.products.count()
}

export async function clearLocalProducts(): Promise<void> {
  await db.products.clear()
  if (typeof window !== "undefined") {
    localStorage.removeItem(LAST_SYNC_KEY)
  }
}
