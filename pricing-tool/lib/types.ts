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
  options_json?: Record<string, any>
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
  line_count?: number
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

/**
 * Item Options Types
 * Used for configurable product options with price impacts
 */

export type OptionType = 'select' | 'number' | 'text' | 'boolean'
export type PriceDeltaType = 'flat' | 'percent' | 'none'

export interface OptionConstraints {
  min?: number
  max?: number
  step?: number
  max_length?: number
  pattern?: string
  allowed_sizes?: string[]
  [key: string]: any
}

export interface ItemOption {
  id: string
  catalog_item_id: string
  code: string
  label: string
  type: OptionType
  required: boolean
  default_value: string | null
  sort_order: number
  constraints_json: OptionConstraints | null
  price_delta_type: PriceDeltaType | null
  price_delta_value: number | null
  active: boolean
  created_at: string
  updated_at: string
  values?: OptionValue[]  // Joined option values for select type
}

export interface OptionValue {
  id: string
  item_option_id: string
  value: string
  label: string
  price_delta: number
  sku_suffix: string | null
  sort_order: number
  active: boolean
  created_at: string
}

export interface OptionSelection {
  code: string
  value: any
  label: string
  price_impact: number
}

export interface OptionsPriceCalculation {
  total_impact: number
  breakdown: OptionSelection[]
}

/**
 * Pricing Engine Types
 * Used for calculating prices with options and generating audit traces
 */

export interface PricingContext {
  catalogItem: {
    id: string
    sku: string
    name: string
    unit_price: number
  }
  options: Record<string, any>
  quantity: number
}

export interface PricingResult {
  unit_price: number
  extended_price: number
  price_breakdown: PriceComponent[]
  trace: PriceTrace[]
}

export interface PriceComponent {
  label: string
  amount: number
  type: 'base' | 'option_flat' | 'option_percent'
}

export interface PriceTrace {
  step: number
  description: string
  calculation: string
  result: number
}
