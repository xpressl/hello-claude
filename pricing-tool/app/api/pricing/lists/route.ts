/**
 * API: Get price lists
 * GET /api/pricing/lists - Get all price lists with item count
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all price lists
    const { data: lists, error } = await supabase
      .from('price_lists')
      .select('*')
      .order('priority', { ascending: false })

    if (error) {
      throw error
    }

    // Get item counts for each list
    const { data: itemCounts } = await supabase
      .from('price_list_items')
      .select('price_list_id, count(*)', { count: 'exact' })
      .group_by('price_list_id')

    // Merge counts into lists
    const listsWithCounts = (lists || []).map(list => ({
      ...list,
      item_count: itemCounts?.find(ic => ic.price_list_id === list.id)?._count || 0
    }))

    return NextResponse.json({ lists: listsWithCounts })
  } catch (error) {
    console.error('Error fetching price lists:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price lists' },
      { status: 500 }
    )
  }
}
