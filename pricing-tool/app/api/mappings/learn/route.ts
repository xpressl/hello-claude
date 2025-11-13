import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { learnSKUMapping } from '@/lib/mapping/sku-resolver'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get user from session
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { type, customerValue, catalogProductId } = body

  try {
    if (type === 'sku') {
      await learnSKUMapping(customerValue, catalogProductId, user.id)
    } else if (type === 'description') {
      await supabase.from('description_mappings').upsert({
        customer_description: customerValue,
        catalog_product_id: catalogProductId,
        created_by: user.id
      })
    } else if (type === 'size') {
      await supabase.from('size_variations').upsert({
        variant: customerValue,
        normalized: body.normalizedValue
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to learn mapping:', error)
    return NextResponse.json(
      { error: 'Failed to learn mapping' },
      { status: 500 }
    )
  }
}
