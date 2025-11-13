import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Get all categories using the recursive function
    const { data, error } = await supabase.rpc("get_category_tree")

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      categories: data || [],
      count: (data || []).length,
    })
  } catch (err) {
    console.error("Get categories error:", err)
    return NextResponse.json(
      { error: "Failed to get categories" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, description, parent_id, image_url, is_active } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase
      .from("categories")
      .insert([
        {
          name,
          slug,
          description,
          parent_id: parent_id || null,
          image_url,
          is_active: is_active !== false,
        },
      ])
      .select()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { category: data?.[0], message: "Category created" },
      { status: 201 }
    )
  } catch (err) {
    console.error("Create category error:", err)
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    )
  }
}
