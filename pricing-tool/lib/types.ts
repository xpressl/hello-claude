// Database types for Pricing Tool

export type UserRole = "ADMIN" | "SALES"

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED"

export type UnitType = "EA" | "LF" | "SF" | "BOX" | "PKG" | "SET"

// ============================================================================
// User
// ============================================================================
export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
}

// ============================================================================
// Product
// ============================================================================
export interface Product {
  id: string
  sku: string
  name: string
  unit_type: UnitType
  unit_price: number
  aliases: string[]
  default_markup?: number // Per-product markup override
  created_at: string
  updated_at: string
}

// ============================================================================
// Customer
// ============================================================================
export interface Customer {
  id: string
  name: string
  company?: string
  phone?: string
  email?: string
  default_markup?: number // Customer-specific markup
  notes?: string
  created_at: string
  updated_at: string
}

export interface CustomerInsert {
  name: string
  company?: string
  phone?: string
  email?: string
  default_markup?: number
  notes?: string
}

export interface CustomerUpdate extends Partial<CustomerInsert> {
  id: string
}

// ============================================================================
// Quote
// ============================================================================
export interface Quote {
  id: string
  quote_number: string // Auto-generated: Q-2024-001
  customer_id?: string
  customer_name?: string // Denormalized for quick quotes
  customer_phone?: string
  customer_email?: string
  user_id: string
  status: QuoteStatus
  subtotal: number
  total: number
  notes?: string
  created_at: string
  updated_at: string
  expires_at?: string
}

export interface QuoteInsert {
  quote_number?: string // Auto-generated if not provided
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  user_id: string
  status?: QuoteStatus
  subtotal?: number
  total?: number
  notes?: string
  expires_at?: string
}

export interface QuoteUpdate extends Partial<QuoteInsert> {
  id: string
}

// ============================================================================
// Quote Item
// ============================================================================
export interface QuoteItem {
  id: string
  quote_id: string
  product_id?: string
  product_sku: string // Snapshot for history
  product_name: string // Snapshot for history
  unit_type: UnitType
  quantity: number
  unit_price: number // Snapshot at quote time
  markup_pct: number
  cost: number // quantity × unit_price
  price: number // cost × (1 + markup_pct/100)
  profit: number // price - cost
  line_notes?: string
  created_at: string
}

export interface QuoteItemInsert {
  quote_id: string
  product_id?: string
  product_sku: string
  product_name: string
  unit_type: UnitType
  quantity: number
  unit_price: number
  markup_pct: number
  cost: number
  price: number
  profit: number
  line_notes?: string
}

export interface QuoteItemUpdate extends Partial<Omit<QuoteItemInsert, "quote_id">> {
  id: string
}

// ============================================================================
// View Types (for joined queries)
// ============================================================================
export interface QuoteSummary {
  id: string
  quote_number: string
  status: QuoteStatus
  customer_name?: string
  customer_company?: string
  subtotal: number
  total: number
  item_count: number
  created_at: string
  updated_at: string
  expires_at?: string
  created_by_email: string
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[]
  customer?: Customer
}

// ============================================================================
// UI State Types
// ============================================================================
export interface QuoteBuilderItem {
  product: Product
  quantity: number
  markup_pct: number
  cost: number
  price: number
  profit: number
  line_notes?: string
}

export interface QuoteFormData {
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  status: QuoteStatus
  notes?: string
  expires_at?: string
  items: QuoteBuilderItem[]
}

// ============================================================================
// Markup Hierarchy Types
// ============================================================================
export interface MarkupHierarchy {
  globalDefault: number
  productDefault?: number
  customerDefault?: number
  effectiveMarkup: number // The one that will be used
  source: "global" | "product" | "customer" | "custom"
}
