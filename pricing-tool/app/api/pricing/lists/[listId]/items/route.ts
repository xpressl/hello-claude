/**
 * API: Price list items
 * GET /api/pricing/lists/[listId]/items - Get items for a price list
 * POST /api/pricing/lists/[listId]/items - Add item to price list
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface RouteParams {
  params: {
    listId: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: items, error } = await supabase
      .from('price_list_items')
      .select(`
        id,
        product_id,
        unit_price,
        min_quantity,
        max_quantity,
        product:products(name)
      `)
      .eq('price_list_id', params.listId)
      .order('min_quantity', { ascending: true })

    if (error) {
      throw error
    }

    // Flatten product name
    const flatItems = (items || []).map(item => ({
      ...item,
      product_name: item.product?.name
    }))

    return NextResponse.json({ items: flatItems })
  } catch (error) {
    console.error('Error fetching price list items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Create new item
    const { data: item, error } = await supabase
      .from('price_list_items')
      .insert([{
        ...body,
        price_list_id: params.listId
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error creating price list item:', error)
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    )
  }
}
