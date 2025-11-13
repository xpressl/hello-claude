import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""
    const categoryId = searchParams.get("category")
    const minPrice = searchParams.get("minPrice")
    const maxPrice = searchParams.get("maxPrice")
    const unitType = searchParams.get("unit")
    const limit = parseInt(searchParams.get("limit") || "20", 10)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Call the search_products function
    const { data, error } = await supabase.rpc("search_products", {
      p_query: query,
      p_category_id: categoryId || null,
      p_min_price: minPrice ? parseFloat(minPrice) : null,
      p_max_price: maxPrice ? parseFloat(maxPrice) : null,
      p_unit: unitType || null,
      p_limit: limit,
    })

    if (error) {
      console.error("Search error:", error)
      return NextResponse.json(
        { error: error.message || "Search failed" },
        { status: 500 }
      )
    }

    // Deduplicate results by product_id (keep first occurrence)
    const uniqueResults = Array.from(
      new Map(
        (data || []).map((item: any) => [item.product_id, item])
      ).values()
    )

    return NextResponse.json({
      results: uniqueResults,
      count: uniqueResults.length,
    })
  } catch (err) {
    console.error("Search API error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
