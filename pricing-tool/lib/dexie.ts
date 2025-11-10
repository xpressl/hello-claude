import Dexie, { Table } from "dexie"

export interface Product {
  id: string
  sku: string
  name: string
  unit_type: "EACH" | "LF" | "SF" | "BF" | "BOX" | "CASE"
  unit_price: number
  aliases: string[]
  updated_at: string
}

class PricingDB extends Dexie {
  products!: Table<Product, string>
  constructor() {
    super("pricingDB")
    this.version(1).stores({ products: "id, sku, name, unit_type, updated_at" })
  }
}

export const db = new PricingDB()
