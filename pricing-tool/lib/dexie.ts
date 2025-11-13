import Dexie, { Table } from "dexie"
import { QuoteDraft } from "./types"

export interface Product {
  id: string
  sku: string
  name: string
  unit_type: "EA" | "LF" | "SF" | "BF" | "BOX" | "CASE"
  unit_price: number
  aliases: string[]
  updated_at: string
}

class PricingDB extends Dexie {
  products!: Table<Product, string>
  quoteDrafts!: Table<QuoteDraft, string>

  constructor() {
    super("pricingDB")
    this.version(1).stores({ products: "id, sku, name, unit_type, updated_at" })
    this.version(2).stores({
      products: "id, sku, name, unit_type, updated_at",
      quoteDrafts: "id, customer_email, updated_at"
    })
  }
}

export const db = new PricingDB()
