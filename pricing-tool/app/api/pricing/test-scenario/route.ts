/**
 * API: Test pricing scenarios
 * POST /api/pricing/test-scenario - Calculate price for a scenario
 *
 * Used by admin UI to preview pricing before applying changes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculatePriceV2 } from '@/lib/pricing/pricing-engine-v2'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      product_id,
      quantity,
      price_list_id,
      customer_type,
      quote_date,
      options = {}
    } = body

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Calculate price
    const result = await calculatePriceV2({
      catalogItem: product,
      options,
      quantity,
      priceListId: price_list_id,
      customerType: customer_type,
      quoteDate: quote_date ? new Date(quote_date) : new Date(),
      applyRules: true
    })

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Error testing pricing scenario:', error)
    return NextResponse.json(
      { error: 'Failed to calculate price' },
      { status: 500 }
    )
  }
}
