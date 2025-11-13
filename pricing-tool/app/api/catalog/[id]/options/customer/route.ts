import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { errorResponse, successResponse } from "@/lib/api-utils"

// Create Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

/**
 * GET /api/catalog/[id]/options/customer
 *
 * Fetch active options for a catalog item
 * This is a customer-facing endpoint (no authentication required)
 * Returns only active options and values, sorted by sort_order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabaseClient()

  try {
    // Await params as per Next.js 15 requirements
    const { id } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return errorResponse("Invalid catalog item ID", 400)
    }

    // Fetch active options for the catalog item
    const { data: options, error: optionsError } = await supabase
      .from("item_options")
      .select("*")
      .eq("catalog_item_id", id)
      .eq("active", true)
      .order("sort_order", { ascending: true })

    if (optionsError) {
      console.error("Database error fetching options:", optionsError)
      return errorResponse("Failed to fetch options", 500, {
        message: optionsError.message,
      })
    }

    // If no options found, return empty array
    if (!options || options.length === 0) {
      return successResponse({ options: [] })
    }

    // Fetch option values for select-type options
    const optionIds = options
      .filter(opt => opt.type === 'select')
      .map(opt => opt.id)

    let optionValuesMap: Record<string, any[]> = {}

    if (optionIds.length > 0) {
      const { data: optionValues, error: valuesError } = await supabase
        .from("option_values")
        .select("*")
        .in("item_option_id", optionIds)
        .eq("active", true)
        .order("sort_order", { ascending: true })

      if (valuesError) {
        console.error("Database error fetching option values:", valuesError)
        return errorResponse("Failed to fetch option values", 500, {
          message: valuesError.message,
        })
      }

      // Group values by option ID
      if (optionValues) {
        optionValuesMap = optionValues.reduce((acc, val) => {
          if (!acc[val.item_option_id]) {
            acc[val.item_option_id] = []
          }
          acc[val.item_option_id].push(val)
          return acc
        }, {} as Record<string, any[]>)
      }
    }

    // Attach values to select-type options
    const optionsWithValues = options.map(option => {
      if (option.type === 'select') {
        return {
          ...option,
          values: optionValuesMap[option.id] || []
        }
      }
      return option
    })

    return successResponse({ options: optionsWithValues })
  } catch (error: any) {
    console.error("Unexpected error:", error)
    return errorResponse("Internal server error", 500, {
      message: error.message,
    })
  }
}
