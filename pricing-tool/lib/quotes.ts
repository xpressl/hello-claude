// Quote and Customer management functions
import { createClient } from "@/lib/supabase"
import type {
  Customer,
  CustomerInsert,
  CustomerUpdate,
  Quote,
  QuoteInsert,
  QuoteUpdate,
  QuoteItem,
  QuoteItemInsert,
  QuoteItemUpdate,
  QuoteSummary,
  QuoteWithItems,
} from "./types"

// ============================================================================
// CUSTOMERS
// ============================================================================

export async function getCustomers(): Promise<Customer[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("name", { ascending: true })

  if (error) throw error
  return data || []
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw error
  return data
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .or(`name.ilike.%${query}%,company.ilike.%${query}%,email.ilike.%${query}%`)
    .order("name", { ascending: true })
    .limit(20)

  if (error) throw error
  return data || []
}

export async function createCustomer(customer: CustomerInsert): Promise<Customer> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("customers")
    .insert(customer)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCustomer(customer: CustomerUpdate): Promise<Customer> {
  const supabase = createClient()
  const { id, ...updates } = customer
  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("customers").delete().eq("id", id)
  if (error) throw error
}

// ============================================================================
// QUOTES
// ============================================================================

export async function getQuotes(): Promise<Quote[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function getQuoteById(id: string): Promise<QuoteWithItems | null> {
  const supabase = createClient()

  // Get quote with customer
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(`
      *,
      customer:customers(*)
    `)
    .eq("id", id)
    .single()

  if (quoteError) throw quoteError

  // Get quote items
  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", id)
    .order("created_at", { ascending: true })

  if (itemsError) throw itemsError

  return {
    ...quote,
    items: items || [],
    customer: Array.isArray(quote.customer) ? quote.customer[0] : quote.customer,
  }
}

export async function getQuotesByCustomer(customerId: string): Promise<Quote[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function searchQuotes(query: string): Promise<Quote[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .or(`quote_number.ilike.%${query}%,customer_name.ilike.%${query}%,notes.ilike.%${query}%`)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw error
  return data || []
}

export async function createQuote(quote: QuoteInsert): Promise<Quote> {
  const supabase = createClient()

  // Get current user ID
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("quotes")
    .insert({ ...quote, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateQuote(quote: QuoteUpdate): Promise<Quote> {
  const supabase = createClient()
  const { id, ...updates } = quote
  const { data, error } = await supabase
    .from("quotes")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteQuote(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("quotes").delete().eq("id", id)
  if (error) throw error
}

// ============================================================================
// QUOTE ITEMS
// ============================================================================

export async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data || []
}

export async function createQuoteItem(item: QuoteItemInsert): Promise<QuoteItem> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quote_items")
    .insert(item)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateQuoteItem(item: QuoteItemUpdate): Promise<QuoteItem> {
  const supabase = createClient()
  const { id, ...updates } = item
  const { data, error } = await supabase
    .from("quote_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteQuoteItem(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("quote_items").delete().eq("id", id)
  if (error) throw error
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Create a complete quote with multiple line items in a transaction
 */
export async function createQuoteWithItems(
  quote: QuoteInsert,
  items: Omit<QuoteItemInsert, "quote_id">[]
): Promise<QuoteWithItems> {
  const supabase = createClient()

  // Get current user ID
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Create the quote
  const { data: newQuote, error: quoteError } = await supabase
    .from("quotes")
    .insert({ ...quote, user_id: user.id })
    .select()
    .single()

  if (quoteError) throw quoteError

  // Create all line items
  const itemsWithQuoteId = items.map((item) => ({
    ...item,
    quote_id: newQuote.id,
  }))

  const { data: newItems, error: itemsError } = await supabase
    .from("quote_items")
    .insert(itemsWithQuoteId)
    .select()

  if (itemsError) {
    // Rollback: delete the quote if items fail
    await supabase.from("quotes").delete().eq("id", newQuote.id)
    throw itemsError
  }

  // Get customer if exists
  let customer: Customer | null = null
  if (newQuote.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", newQuote.customer_id)
      .single()
    customer = data
  }

  return {
    ...newQuote,
    items: newItems || [],
    customer,
  }
}

/**
 * Update quote totals based on line items
 */
export async function recalculateQuoteTotals(quoteId: string): Promise<Quote> {
  const supabase = createClient()

  // Get all line items
  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("cost, price")
    .eq("quote_id", quoteId)

  if (itemsError) throw itemsError

  // Calculate totals
  const subtotal = items?.reduce((sum, item) => sum + Number(item.cost), 0) || 0
  const total = items?.reduce((sum, item) => sum + Number(item.price), 0) || 0

  // Update quote
  const { data, error } = await supabase
    .from("quotes")
    .update({ subtotal, total })
    .eq("id", quoteId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================================================
// QUOTE SUMMARY VIEW
// ============================================================================

export async function getQuoteSummaries(): Promise<QuoteSummary[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quote_summary")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function getQuoteSummariesByCustomer(customerId: string): Promise<QuoteSummary[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("quote_summary")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}
