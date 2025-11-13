import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Get products in this category
    const { data, error } = await supabase
      .from("product_categories")
      .select(
        `
        id,
        product_id,
        is_primary,
        products:product_id (
          id,
          sku,
          name,
          unit_type,
          unit_price
        )
      `
      )
      .eq("category_id", params.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      products: data || [],
      count: (data || []).length,
    })
  } catch (err) {
    console.error("Get category products error:", err)
    return NextResponse.json(
      { error: "Failed to get category products" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { productIds = [], isPrimary = false } = body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "productIds array is required" },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Insert product-category relationships
    const assignments = productIds.map((productId) => ({
      product_id: productId,
      category_id: params.id,
      is_primary: isPrimary,
    }))

    const { data, error } = await supabase
      .from("product_categories")
      .upsert(assignments, { onConflict: "product_id,category_id" })
      .select()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      assigned: data || [],
      count: (data || []).length,
      message: `Assigned ${(data || []).length} product(s) to category`,
    })
  } catch (err) {
    console.error("Assign products error:", err)
    return NextResponse.json(
      { error: "Failed to assign products" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { productIds = [] } = body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "productIds array is required" },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Remove product-category relationships
    const { error } = await supabase
      .from("product_categories")
      .delete()
      .eq("category_id", params.id)
      .in("product_id", productIds)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: `Removed ${productIds.length} product(s) from category`,
    })
  } catch (err) {
    console.error("Remove products error:", err)
    return NextResponse.json(
      { error: "Failed to remove products" },
      { status: 500 }
    )
  }
}
