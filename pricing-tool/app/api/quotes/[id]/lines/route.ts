import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { CreateLineSchema } from "@/lib/validations"
import {
  errorResponse,
  successResponse,
  optionalAuth,
  parseJsonBody,
  getNextLineNumber,
  recalculateQuoteTotals,
  createEvent,
} from "@/lib/api-utils"
import { isQuoteLocked } from "@/lib/validations"
import { calculatePrice } from "@/lib/pricing-engine"

// Create Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

// POST /api/quotes/[id]/lines - Add line to quote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Optional authentication - allows anonymous users
  const authResult = await optionalAuth(request)
  const userRole = authResult?.role || null
  const userId = authResult?.userId || null

  const supabase = getSupabaseClient()
  const { id: quoteId } = await params

  // Parse and validate request body
  const bodyResult = await parseJsonBody(request, CreateLineSchema)
  if ("error" in bodyResult) {
    return bodyResult.error
  }

  const {
    catalog_item_id,
    description,
    quantity,
    unit,
    options,
    unit_price,
    source,
    confidence_score,
    mapping_warnings,
    notes,
  } = bodyResult.data

  try {
    // Check if quote exists and is not locked
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, status, created_by")
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

    // Check permissions: SALES/ADMIN can access any quote, others can only access their own
    const isSalesOrAdmin = userRole && ["SALES", "ADMIN"].includes(userRole)
    const isQuoteOwner = quote.created_by === null || quote.created_by === userId

    if (!isSalesOrAdmin && !isQuoteOwner) {
      return errorResponse("Forbidden", 403)
    }

    if (isQuoteLocked(quote.status)) {
      return errorResponse(
        `Cannot add lines to quote with status '${quote.status}'`,
        409
      )
    }

    // Validate catalog_item_id if provided and calculate price
    let calculatedUnitPrice = unit_price
    let calculatedExtendedPrice = quantity * unit_price
    let priceTrace = null

    if (catalog_item_id) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id, sku, name, unit_price")
        .eq("id", catalog_item_id)
        .single()

      if (productError || !product) {
        return errorResponse(
          `Product with id '${catalog_item_id}' not found`,
          400
        )
      }

      // Use pricing engine to calculate price if options are provided
      if (options && Object.keys(options).length > 0) {
        try {
          const pricingResult = await calculatePrice({
            catalogItem: {
              id: product.id,
              sku: product.sku,
              name: product.name,
              unit_price: product.unit_price
            },
            options: options,
            quantity: quantity
          })

          calculatedUnitPrice = pricingResult.unit_price
          calculatedExtendedPrice = pricingResult.extended_price
          priceTrace = pricingResult.trace
        } catch (error: any) {
          console.error("Pricing engine error:", error)
          return errorResponse("Failed to calculate price", 500, {
            message: error.message
          })
        }
      } else {
        // No options, use product base price
        calculatedUnitPrice = product.unit_price
        calculatedExtendedPrice = quantity * product.unit_price
      }
    }

    // Get next line number
    const lineNumber = await getNextLineNumber(quoteId)

    // Create line with calculated prices
    const lineData: any = {
      quote_id: quoteId,
      line_number: lineNumber,
      description,
      quantity,
      unit: unit || "EA",
      unit_price: calculatedUnitPrice,
      extended_price: calculatedExtendedPrice,
      source: source || "manual",
    }

    if (catalog_item_id) lineData.catalog_item_id = catalog_item_id
    if (options) lineData.options_json = options
    if (confidence_score !== undefined)
      lineData.confidence_score = confidence_score

    // Store price trace in mapping_warnings_json for audit trail
    // Note: In production, consider adding a dedicated metadata_json column to quote_lines
    if (priceTrace) {
      lineData.mapping_warnings_json = {
        ...mapping_warnings,
        price_trace: priceTrace
      }
    } else if (mapping_warnings) {
      lineData.mapping_warnings_json = mapping_warnings
    }

    if (notes) lineData.notes = notes

    const { data: line, error: lineError } = await supabase
      .from("quote_lines")
      .insert(lineData)
      .select()
      .single()

    if (lineError) {
      console.error("Database error:", lineError)
      return errorResponse("Failed to create line", 500, {
        message: lineError.message,
      })
    }

    // Recalculate quote totals
    const totals = await recalculateQuoteTotals(quoteId)

    // Create 'line_added' event
    await createEvent(
      quoteId,
      "line_added",
      { line },
      userId || undefined,
      request
    )

    return successResponse(
      {
        line,
        quote: {
          id: quoteId,
          subtotal: totals.subtotal,
          total: totals.total,
        },
      },
      201
    )
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return errorResponse("Internal server error", 500, {
      message: error.message,
    })
  }
}
