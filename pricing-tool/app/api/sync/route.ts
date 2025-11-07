import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

/**
 * GET /api/sync
 * Fetch products from Supabase, optionally filtered by update timestamp
 * Query params:
 *   - since: ISO timestamp to fetch products updated after this time
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const since = searchParams.get('since')

    const supabase = createSupabaseServerClient()

    let query = supabase
      .from('products')
      .select('*')
      .order('updated_at', { ascending: false })

    // Filter by timestamp if provided
    if (since) {
      query = query.gt('updated_at', since)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase sync error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch products', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Sync API error:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    )
  }
}
