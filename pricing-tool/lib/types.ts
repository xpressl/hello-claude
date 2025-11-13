/**
 * Quote Draft Types
 * Used for customer-facing quote creation with IndexedDB persistence
 */

export interface QuoteDraft {
  id?: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  lines: QuoteLineDraft[]
  created_at?: string
  updated_at?: string
}

export interface QuoteLineDraft {
  id?: string
  catalog_item_id?: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  extended_price: number
}

/**
 * Form validation errors
 */
export interface ValidationErrors {
  [key: string]: string
}

/**
 * Admin Quote Types
 * Used for admin dashboard and backend operations
 */

export type QuoteStatus =
  | 'draft'
  | 'submitted'
  | 'reviewed'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired'

export type LineSource =
  | 'manual'
  | 'ocr'
  | 'asr'
  | 'paste'
  | 'spreadsheet'
  | 'voice'

export type UnitType =
  | 'EA'
  | 'LF'
  | 'SF'
  | 'BF'
  | 'BOX'
  | 'CASE'
  | 'PKG'
  | 'SET'

export interface Quote {
  id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  status: QuoteStatus
  currency: string
  subtotal: number
  tax: number
  total: number
  margin_percent: number | null
  metadata_json: Record<string, any> | null
  created_by: string | null
  created_at: string
  submitted_at: string | null
  sent_at: string | null
  expires_at: string | null
  version: number
}

export interface QuoteLine {
  id: string
  quote_id: string
  line_number: number
  catalog_item_id: string | null
  description: string
  quantity: number
  unit: string
  options_json: Record<string, any> | null
  unit_price: number
  extended_price: number
  source: LineSource
  confidence_score: number | null
  mapping_warnings_json: Record<string, any> | null
  notes: string | null
  created_at: string
}

export interface QuoteWithLines extends Quote {
  lines: QuoteLine[]
  line_count?: number
}

export interface QuotesListResponse {
  quotes: Quote[]
  total: number
  limit: number
  offset: number
}

export interface QuoteFilters {
  status?: QuoteStatus | 'all'
  search?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface User {
  id: string
  email: string
  role: 'ADMIN' | 'SALES'
  created_at: string
}
