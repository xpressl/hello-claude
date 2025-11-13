import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: items, error } = await supabase
    .from('quote_lines')
    .select('*')
    .eq('quote_id', id)
    .in('source', ['ocr', 'asr', 'spreadsheet', 'paste'])
    .order('line_number')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items })
}

export async function PATCH(
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
  const { itemId, updates } = body

  const { data, error } = await supabase
    .from('quote_lines')
    .update(updates)
    .eq('id', itemId)
    .eq('quote_id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If SKU or description was corrected, learn the mapping
  if (updates.sku || updates.description) {
    await learnMapping(updates, data.catalog_item_id)
  }

  return NextResponse.json({ item: data })
}

async function learnMapping(updates: any, catalogItemId: string | null) {
  if (!catalogItemId) return

  // Learn SKU mapping
  if (updates.sku) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/mappings/learn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sku',
        customerValue: updates.sku,
        catalogProductId: catalogItemId
      })
    }).catch(console.error)
  }

  // Learn description mapping
  if (updates.description) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/mappings/learn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'description',
        customerValue: updates.description,
        catalogProductId: catalogItemId
      })
    }).catch(console.error)
  }
}
