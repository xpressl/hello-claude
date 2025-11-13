import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  CreateQuoteSchema,
  ListQuotesQuerySchema,
} from "@/lib/validations"
import {
  errorResponse,
  successResponse,
  requireRole,
  parseJsonBody,
  getClientIP,
  getUserAgent,
  createEvent,
} from "@/lib/api-utils"

// Create Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

// POST /api/quotes - Create new quote (anonymous allowed)
export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient()

  // Parse and validate request body
  const bodyResult = await parseJsonBody(request, CreateQuoteSchema)
  if ("error" in bodyResult) {
    return bodyResult.error
  }

  const { customer_name, customer_email, customer_phone, metadata } =
    bodyResult.data

  try {
    // Capture IP and user agent
    const ip = getClientIP(request)
    const userAgent = getUserAgent(request)

    // Build metadata JSON
    const metadataJson = {
      ...metadata,
      ip_address: ip,
      user_agent: userAgent,
    }

    // Create quote
    const { data: quote, error } = await supabase
      .from("quotes")
      .insert({
        customer_name: customer_name || null,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        status: "draft",
        metadata_json: metadataJson,
      })
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return errorResponse("Failed to create quote", 500, {
        message: error.message,
      })
    }

    // Create 'created' event
    await createEvent(quote.id, "created", { quote }, undefined, request)

    return successResponse(quote, 201)
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return errorResponse("Internal server error", 500, {
      message: error.message,
    })
  }
}

// GET /api/quotes - List quotes (requires SALES or ADMIN role)
export async function GET(request: NextRequest) {
  // Require authentication with SALES or ADMIN role
  const authResult = await requireRole(request, ["SALES", "ADMIN"])
  if ("error" in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
      sort: searchParams.get("sort") || "created_at",
      order: searchParams.get("order") || "desc",
    }

    const validationResult = ListQuotesQuerySchema.safeParse(queryParams)
    if (!validationResult.success) {
      return errorResponse("Invalid query parameters", 400, {
        validation_errors: validationResult.error.issues || [],
      })
    }

    const { status, search, limit, offset, sort, order } = validationResult.data

    // Build query with line count
    let query = supabase
      .from("quotes")
      .select(`
        *,
        line_count:quote_lines(count)
      `, { count: "exact" })
      .order(sort || "created_at", { ascending: order === "asc" })

    // Apply filters
    if (status) {
      query = query.eq("status", status)
    }

    if (search) {
      // Search in customer_name and customer_email
      query = query.or(
        `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`
      )
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data: quotes, error, count } = await query

    if (error) {
      console.error("Database error:", error)
      return errorResponse("Failed to fetch quotes", 500, {
        message: error.message,
      })
    }

    return successResponse({
      quotes: quotes || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return errorResponse("Internal server error", 500, {
      message: error.message,
    })
  }
}
