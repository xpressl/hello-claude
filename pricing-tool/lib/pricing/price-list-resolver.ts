/**
 * Price List Resolver
 *
 * Determines which price list to use based on:
 * - Customer type (retail, contractor, wholesale)
 * - Priority order
 * - Valid date range
 * - Active status
 */

import { createClient } from '@supabase/supabase-js'

interface PriceList {
  id: string
  name: string
  type: string
  priority: number
  is_active: boolean
  valid_from?: string
  valid_to?: string
}

/**
 * Resolve the active price list for a customer
 * Returns the highest priority list that:
 * - Is active
 * - Is within valid date range
 * - Matches customer type (if specified)
 */
export async function resolveActivePriceList(
  customerType?: string,
  date: Date = new Date()
): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Query for active price lists sorted by priority
    const { data: priceLists, error } = await supabase
      .from('price_lists')
      .select('id, name, type, priority, is_active, valid_from, valid_to')
      .eq('is_active', true)
      .lte('valid_from', date.toISOString())
      .gte('valid_to', date.toISOString())
      .order('priority', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error resolving price list:', error)
      return null
    }

    if (!priceLists || priceLists.length === 0) {
      return null
    }

    // Filter by valid date range manually (since complex date queries may not work as expected)
    const validLists = priceLists.filter(pl => {
      const isAfterStart = !pl.valid_from || new Date(pl.valid_from) <= date
      const isBeforeEnd = !pl.valid_to || new Date(pl.valid_to) >= date
      return isAfterStart && isBeforeEnd
    })

    if (validLists.length === 0) {
      return null
    }

    // Match by customer type if specified
    if (customerType) {
      const typeMap: Record<string, string[]> = {
        'contractor': ['contractor', 'customer_segment'],
        'wholesale': ['wholesale', 'customer_segment'],
        'retail': ['base', 'retail']
      }

      const preferredTypes = typeMap[customerType] || ['base']

      for (const type of preferredTypes) {
        const match = validLists.find(pl => pl.type === type)
        if (match) {
          return match.id
        }
      }
    }

    // Return highest priority list
    return validLists[0]?.id || null
  } catch (error) {
    console.error('Error in resolveActivePriceList:', error)
    return null
  }
}

/**
 * Get price for a product from a specific price list
 * Finds the applicable quantity tier
 */
export async function getPriceFromList(
  priceListId: string,
  productId: string,
  quantity: number
): Promise<number | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find matching quantity tier (highest min_quantity that doesn't exceed qty)
    const { data: items, error } = await supabase
      .from('price_list_items')
      .select('unit_price, min_quantity, max_quantity')
      .eq('price_list_id', priceListId)
      .eq('product_id', productId)
      .lte('min_quantity', quantity)
      .order('min_quantity', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching price from list:', error)
      return null
    }

    // Find the first item where max_quantity allows this quantity
    const item = items?.find(i =>
      i.min_quantity <= quantity &&
      (!i.max_quantity || i.max_quantity >= quantity)
    )

    return item?.unit_price || null
  } catch (error) {
    console.error('Error in getPriceFromList:', error)
    return null
  }
}

/**
 * Get all active price lists
 * Useful for admin UI to show available lists
 */
export async function getActivePriceLists(): Promise<PriceList[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date()

    const { data: lists, error } = await supabase
      .from('price_lists')
      .select('id, name, type, priority, is_active, valid_from, valid_to')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (error) {
      console.error('Error fetching price lists:', error)
      return []
    }

    // Filter by valid date range
    return (lists || []).filter(pl => {
      const isAfterStart = !pl.valid_from || new Date(pl.valid_from) <= now
      const isBeforeEnd = !pl.valid_to || new Date(pl.valid_to) >= now
      return isAfterStart && isBeforeEnd
    })
  } catch (error) {
    console.error('Error in getActivePriceLists:', error)
    return []
  }
}
