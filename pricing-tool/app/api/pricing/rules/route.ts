/**
 * API: Pricing rules CRUD
 * GET /api/pricing/rules - Get all pricing rules
 * POST /api/pricing/rules - Create new rule
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: rules, error } = await supabase
      .from('price_rules')
      .select('*')
      .order('priority', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ rules: rules || [] })
  } catch (error) {
    console.error('Error fetching pricing rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pricing rules' },
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

    // Create new rule
    const { data: rule, error } = await supabase
      .from('price_rules')
      .insert([{
        ...body,
        created_by: user.id
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Error creating pricing rule:', error)
    return NextResponse.json(
      { error: 'Failed to create pricing rule' },
      { status: 500 }
    )
  }
}
