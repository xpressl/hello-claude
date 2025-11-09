import { db } from "./dexie"

export async function pullProducts(since?: string) {
  const url = since ? `/api/sync?since=${encodeURIComponent(since)}` : `/api/sync`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error("sync failed")
  const rows = await res.json()
  if (Array.isArray(rows) && rows.length) {
    await db.products.bulkPut(rows)
    localStorage.setItem("lastSyncAt", new Date().toISOString())
  }
  return rows.length || 0
}

export function lastSyncAt() {
  return localStorage.getItem("lastSyncAt") || ""
}

export async function searchLocalProducts(q: string) {
  const key = q.toLowerCase()
  const all = await db.products.toArray()
  return all
    .filter((p) => {
      if (p.name.toLowerCase().includes(key)) return true
      if (p.sku.toLowerCase().includes(key)) return true
      if ((p.aliases || []).some((a) => a.toLowerCase().includes(key))) return true
      return false
    })
    .slice(0, 50)
}

export async function getLocalProduct(id: string) {
  return db.products.get(id)
}
