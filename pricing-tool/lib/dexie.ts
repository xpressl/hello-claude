import Dexie, { type EntityTable } from 'dexie'

// Database schema interface
export interface LocalProduct {
  id: string
  sku: string
  name: string
  unit_type: 'EA' | 'LF' | 'SF' | 'BOX' | 'PKG' | 'SET'
  unit_price: number
  aliases: string[]
  updated_at: string
}

// Dexie database class
export class PricingDatabase extends Dexie {
  products!: EntityTable<LocalProduct, 'id'>

  constructor() {
    super('pricingDB')

    // Define schema version 1
    this.version(1).stores({
      products: 'id, sku, name, *aliases, updated_at',
    })
  }
}

// Export singleton instance
export const db = new PricingDatabase()
