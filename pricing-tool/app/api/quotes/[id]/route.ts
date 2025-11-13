import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { UpdateQuoteSchema } from "@/lib/validations"
import {
  errorResponse,
  successResponse,
  requireRole,
  parseJsonBody,
  createEvent,
} from "@/lib/api-utils"
import { isQuoteLocked, isQuoteDeletable } from "@/lib/validations"

// Create Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

// GET /api/quotes/[id] - Get single quote with lines and uploads
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication with SALES or ADMIN role
  const authResult = await requireRole(request, ["SALES", "ADMIN"])
  if ("error" in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id } = await params

  try {
    // Get quote with lines and uploads
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", id)
      .single()

    if (quoteError) {
      if (quoteError.code === "PGRST116") {
        return errorResponse("Quote not found", 404)
      }
      console.error("Database error:", quoteError)
      return errorResponse("Failed to fetch quote", 500, {
        message: quoteError.message,
      })
    }

    // Get quote lines
    const { data: lines, error: linesError } = await supabase
      .from("quote_lines")
      .select("*")
      .eq("quote_id", id)
      .order("line_number", { ascending: true })

    if (linesError) {
      console.error("Database error:", linesError)
      return errorResponse("Failed to fetch quote lines", 500, {
        message: linesError.message,
      })
    }

    // Get uploads
    const { data: uploads, error: uploadsError } = await supabase
      .from("uploads")
      .select("*")
      .eq("quote_id", id)
      .order("created_at", { ascending: false })

    if (uploadsError) {
      console.error("Database error:", uploadsError)
      return errorResponse("Failed to fetch uploads", 500, {
        message: uploadsError.message,
      })
    }

    // Create 'viewed' event
    await createEvent(
      id,
      "viewed",
      { quote },
      authResult.auth.userId,
      request
    )

    return successResponse({
      quote: {
        ...quote,
        lines: lines || [],
        uploads: uploads || [],
      },
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return errorResponse("Internal server error", 500, {
      message: error.message,
    })
  }
}

// PATCH /api/quotes/[id] - Update quote (ADMIN only, cannot update locked quotes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require ADMIN role
  const authResult = await requireRole(request, ["ADMIN"])
  if ("error" in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id } = await params

  // Parse and validate request body
  const bodyResult = await parseJsonBody(request, UpdateQuoteSchema)
  if ("error" in bodyResult) {
    return bodyResult.error
  }

  try {
    // Get current quote to check status
    const { data: currentQuote, error: fetchError } = await supabase
      .from("quotes")
      .select("status")
      .eq("id", id)
      .single()

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return errorResponse("Quote not found", 404)
      }
      console.error("Database error:", fetchError)
      return errorResponse("Failed to fetch quote", 500, {
        message: fetchError.message,
      })
    }

    // Check if quote is locked
    if (isQuoteLocked(currentQuote.status)) {
      return errorResponse(
        `Cannot update quote with status '${currentQuote.status}'`,
        409
      )
    }

    // If changing status, validate it's not being changed to locked status
    if (bodyResult.data.status && isQuoteLocked(bodyResult.data.status)) {
      return errorResponse(
        "Cannot change status to locked state via update. Use specific actions instead.",
        400
      )
    }

    // Update quote
    const { data: quote, error: updateError } = await supabase
      .from("quotes")
      .update(bodyResult.data)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("Database error:", updateError)
      return errorResponse("Failed to update quote", 500, {
        message: updateError.message,
      })
    }

    // Create 'edited' event
    await createEvent(
      id,
      "edited",
      { changes: bodyResult.data, quote },
      authResult.auth.userId,
      request
    )

    return successResponse({ quote })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return errorResponse("Internal server error", 500, {
      message: error.message,
    })
  }
}

// DELETE /api/quotes/[id] - Delete quote (ADMIN only, only draft quotes)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require ADMIN role
  const authResult = await requireRole(request, ["ADMIN"])
  if ("error" in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id } = await params

  try {
    // Get current quote to check status
    const { data: currentQuote, error: fetchError } = await supabase
      .from("quotes")
      .select("status")
      .eq("id", id)
      .single()

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return errorResponse("Quote not found", 404)
      }
      console.error("Database error:", fetchError)
      return errorResponse("Failed to fetch quote", 500, {
        message: fetchError.message,
      })
    }

    // Check if quote can be deleted
    if (!isQuoteDeletable(currentQuote.status)) {
      return errorResponse(
        `Cannot delete quote with status '${currentQuote.status}'. Only draft quotes can be deleted.`,
        409
      )
    }

    // Delete quote (cascade will delete lines, uploads, and events)
    const { error: deleteError } = await supabase
      .from("quotes")
      .delete()
      .eq("id", id)

    if (deleteError) {
      console.error("Database error:", deleteError)
      return errorResponse("Failed to delete quote", 500, {
        message: deleteError.message,
      })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return errorResponse("Internal server error", 500, {
      message: error.message,
    })
  }
}
