/**
 * API route for handling approval actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action, notes } = body

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Get override details
  const { data: override, error: fetchError } = await supabase
    .from('price_overrides')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchError || !override) {
    return NextResponse.json({ error: 'Override not found' }, { status: 404 })
  }

  // Check if user has permission to approve
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['ADMIN', 'MANAGER'].includes(userProfile?.role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Update override
  const { error: updateError } = await supabase
    .from('price_overrides')
    .update({
      approval_status: action === 'approve' ? 'approved' : 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: notes
    })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Log event
  await supabase.from('events').insert({
    quote_id: override.quote_id,
    user_id: user.id,
    event_type: action === 'approve' ? 'override_approved' : 'override_rejected',
    payload_json: {
      override_id: params.id,
      discount_percent: override.discount_percent,
      notes
    }
  })

  return NextResponse.json({ success: true })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: override, error } = await supabase
    .from('price_overrides')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ override })
}
