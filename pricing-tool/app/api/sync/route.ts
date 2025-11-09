import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  let query = supabase
    .from("products")
    .select("id,sku,name,unit_type,unit_price,aliases,updated_at")
    .order("updated_at", { ascending: false })
    .limit(1000)
  if (since) {
    query = query.gte("updated_at", since)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
