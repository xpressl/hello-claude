import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  errorResponse,
  successResponse,
  requireRole,
  createEvent,
} from "@/lib/api-utils"

// Create Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

// POST /api/quotes/[id]/submit - Submit quote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication with SALES or ADMIN role
  const authResult = await requireRole(request, ["SALES", "ADMIN"])
  if ("error" in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id: quoteId } = await params

  try {
    // Get quote with lines
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, status, customer_email")
      .eq("id", quoteId)
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

    // Validate: must be in draft status
    if (quote.status !== "draft") {
      return errorResponse(
        `Cannot submit quote with status '${quote.status}'. Only draft quotes can be submitted.`,
        409
      )
    }

    // Validate: must have customer email
    if (!quote.customer_email) {
      return errorResponse(
        "Cannot submit quote without customer email",
        400
      )
    }

    // Validate: must have at least one line
    const { data: lines, error: linesError } = await supabase
      .from("quote_lines")
      .select("id")
      .eq("quote_id", quoteId)
      .limit(1)

    if (linesError) {
      console.error("Database error:", linesError)
      return errorResponse("Failed to fetch quote lines", 500, {
        message: linesError.message,
      })
    }

    if (!lines || lines.length === 0) {
      return errorResponse(
        "Cannot submit quote without at least one line item",
        400
      )
    }

    // Update quote status to submitted
    const { data: updatedQuote, error: updateError } = await supabase
      .from("quotes")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .select()
      .single()

    if (updateError) {
      console.error("Database error:", updateError)
      return errorResponse("Failed to submit quote", 500, {
        message: updateError.message,
      })
    }

    // Create 'submitted' event
    await createEvent(
      quoteId,
      "submitted",
      { quote: updatedQuote },
      authResult.auth.userId,
      request
    )

    return successResponse({ quote: updatedQuote })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return errorResponse("Internal server error", 500, {
      message: error.message,
    })
  }
}
