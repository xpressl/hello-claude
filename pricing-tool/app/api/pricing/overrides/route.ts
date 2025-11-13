/**
 * API: Price overrides CRUD and approval
 * GET /api/pricing/overrides - Get price overrides (filter by status)
 * POST /api/pricing/overrides - Create new override
 * PATCH /api/pricing/overrides - Update override approval status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = supabase
      .from('price_overrides')
      .select(`
        *,
        created_by_user:users(email),
        approved_by_user:users(email)
      `)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('approval_status', status)
    }

    const { data: overrides, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ overrides: overrides || [] })
  } catch (error) {
    console.error('Error fetching price overrides:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price overrides' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    // Create new override
    const { data: override, error } = await supabase
      .from('price_overrides')
      .insert([{
        ...body,
        created_by: user.id
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ override })
  } catch (error) {
    console.error('Error creating price override:', error)
    return NextResponse.json(
      { error: 'Failed to create price override' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { overrideId, action, notes } = body

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

    // Update override approval status
    const { data: override, error } = await supabase
      .from('price_overrides')
      .update({
        approval_status: action,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        approval_notes: notes
      })
      .eq('id', overrideId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ override })
  } catch (error) {
    console.error('Error updating price override:', error)
    return NextResponse.json(
      { error: 'Failed to update price override' },
      { status: 500 }
    )
  }
}
