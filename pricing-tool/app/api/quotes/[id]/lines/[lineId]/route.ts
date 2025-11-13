import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { UpdateLineSchema } from "@/lib/validations"
import {
  errorResponse,
  successResponse,
  requireRole,
  parseJsonBody,
  recalculateQuoteTotals,
  createEvent,
} from "@/lib/api-utils"
import { isQuoteLocked } from "@/lib/validations"

// Create Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

// PATCH /api/quotes/[id]/lines/[lineId] - Update line
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  // Require authentication with SALES or ADMIN role
  const authResult = await requireRole(request, ["SALES", "ADMIN"])
  if ("error" in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id: quoteId, lineId } = await params

  // Parse and validate request body
  const bodyResult = await parseJsonBody(request, UpdateLineSchema)
  if ("error" in bodyResult) {
    return bodyResult.error
  }

  try {
    // Check if quote exists and is not locked
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, status")
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

    if (isQuoteLocked(quote.status)) {
      return errorResponse(
        `Cannot update lines for quote with status '${quote.status}'`,
        409
      )
    }

    // Get current line to calculate new extended price
    const { data: currentLine, error: lineError } = await supabase
      .from("quote_lines")
      .select("quantity, unit_price")
      .eq("id", lineId)
      .eq("quote_id", quoteId)
      .single()

    if (lineError) {
      if (lineError.code === "PGRST116") {
        return errorResponse("Line not found", 404)
      }
      console.error("Database error:", lineError)
      return errorResponse("Failed to fetch line", 500, {
        message: lineError.message,
      })
    }

    // Calculate new extended price if quantity or unit_price changed
    const updateData: any = { ...bodyResult.data }

    const newQuantity = bodyResult.data.quantity ?? currentLine.quantity
    const newUnitPrice = bodyResult.data.unit_price ?? currentLine.unit_price

    if (bodyResult.data.quantity || bodyResult.data.unit_price) {
      updateData.extended_price = newQuantity * newUnitPrice
    }

    // Update line
    const { data: line, error: updateError } = await supabase
      .from("quote_lines")
      .update(updateData)
      .eq("id", lineId)
      .eq("quote_id", quoteId)
      .select()
      .single()

    if (updateError) {
      console.error("Database error:", updateError)
      return errorResponse("Failed to update line", 500, {
        message: updateError.message,
      })
    }

    // Recalculate quote totals
    const totals = await recalculateQuoteTotals(quoteId)

    // Create 'line_updated' event
    await createEvent(
      quoteId,
      "line_updated",
      { line_id: lineId, changes: bodyResult.data },
      authResult.auth.userId,
      request
    )

    return successResponse({
      line,
      quote: {
        id: quoteId,
        subtotal: totals.subtotal,
        total: totals.total,
      },
    })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return errorResponse("Internal server error", 500, {
      message: error.message,
    })
  }
}

// DELETE /api/quotes/[id]/lines/[lineId] - Delete line
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  // Require authentication with SALES or ADMIN role
  const authResult = await requireRole(request, ["SALES", "ADMIN"])
  if ("error" in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id: quoteId, lineId } = await params

  try {
    // Check if quote exists and is not locked
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, status")
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

    if (isQuoteLocked(quote.status)) {
      return errorResponse(
        `Cannot delete lines from quote with status '${quote.status}'`,
        409
      )
    }

    // Get line to check it exists
    const { data: line, error: lineError } = await supabase
      .from("quote_lines")
      .select("id, line_number")
      .eq("id", lineId)
      .eq("quote_id", quoteId)
      .single()

    if (lineError) {
      if (lineError.code === "PGRST116") {
        return errorResponse("Line not found", 404)
      }
      console.error("Database error:", lineError)
      return errorResponse("Failed to fetch line", 500, {
        message: lineError.message,
      })
    }

    // Delete line
    const { error: deleteError } = await supabase
      .from("quote_lines")
      .delete()
      .eq("id", lineId)
      .eq("quote_id", quoteId)

    if (deleteError) {
      console.error("Database error:", deleteError)
      return errorResponse("Failed to delete line", 500, {
        message: deleteError.message,
      })
    }

    // Re-sequence remaining line numbers
    const { data: remainingLines, error: fetchError } = await supabase
      .from("quote_lines")
      .select("id, line_number")
      .eq("quote_id", quoteId)
      .order("line_number", { ascending: true })

    if (fetchError) {
      console.error("Database error:", fetchError)
      // Don't fail the request, just log the error
    } else if (remainingLines && remainingLines.length > 0) {
      // Re-number lines sequentially
      for (let i = 0; i < remainingLines.length; i++) {
        const newLineNumber = i + 1
        if (remainingLines[i].line_number !== newLineNumber) {
          await supabase
            .from("quote_lines")
            .update({ line_number: newLineNumber })
            .eq("id", remainingLines[i].id)
        }
      }
    }

    // Recalculate quote totals
    await recalculateQuoteTotals(quoteId)

    // Create 'line_deleted' event
    await createEvent(
      quoteId,
      "line_deleted",
      { line_id: lineId, line_number: line.line_number },
      authResult.auth.userId,
      request
    )

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return errorResponse("Internal server error", 500, {
      message: error.message,
    })
  }
}
