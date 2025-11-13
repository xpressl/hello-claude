import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await request.json()
  const { itemIds, action } = body

  if (!['approve', 'reject', 'delete'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (action === 'approve') {
    const { error } = await supabase
      .from('quote_lines')
      .update({
        status: 'approved',
        mapping_warnings_json: null  // Clear warnings on approval
      })
      .in('id', itemIds)
      .eq('quote_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (action === 'reject') {
    // Soft delete: mark as rejected instead of deleting
    const { error } = await supabase
      .from('quote_lines')
      .update({ status: 'rejected' })
      .in('id', itemIds)
      .eq('quote_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (action === 'delete') {
    // Hard delete rejected items
    const { error } = await supabase
      .from('quote_lines')
      .delete()
      .in('id', itemIds)
      .eq('quote_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, affected: itemIds.length })
}
