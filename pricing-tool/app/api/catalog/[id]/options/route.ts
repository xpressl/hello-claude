import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  errorResponse,
  successResponse,
  requireRole,
  parseJsonBody,
} from '@/lib/api-utils'
import { z } from 'zod'

// Create Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

// Validation schema for creating an option
const CreateOptionSchema = z.object({
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(50, 'Code must be less than 50 characters')
    .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase letters, numbers, and underscores only'),
  label: z.string().min(1, 'Label is required').max(100, 'Label must be less than 100 characters'),
  type: z.enum(['select', 'number', 'text', 'boolean']),
  required: z.boolean().default(false),
  default_value: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  constraints_json: z.record(z.any()).nullable().optional(),
  price_delta_type: z.enum(['flat', 'percent', 'none']).default('none'),
  price_delta_value: z.number().nullable().optional(),
  active: z.boolean().default(true),
})

// GET /api/catalog/[id]/options - Get all options for a product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require SALES or ADMIN role
  const authResult = await requireRole(request, ['SALES', 'ADMIN'])
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id } = await params
  const catalogItemId = id

  try {
    // Fetch all options for the catalog item with their values
    const { data: options, error } = await supabase
      .from('item_options')
      .select(`
        *,
        values:option_values(*)
      `)
      .eq('catalog_item_id', catalogItemId)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to fetch options', 500, {
        message: error.message,
      })
    }

    // Sort values within each option by sort_order
    const optionsWithSortedValues = options?.map((option) => ({
      ...option,
      values: option.values?.sort((a: any, b: any) => a.sort_order - b.sort_order) || [],
    }))

    return successResponse({
      options: optionsWithSortedValues || [],
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return errorResponse('Internal server error', 500, {
      message: error.message,
    })
  }
}

// POST /api/catalog/[id]/options - Create a new option
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require ADMIN role for creating options
  const authResult = await requireRole(request, ['ADMIN'])
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id } = await params
  const catalogItemId = id

  // Parse and validate request body
  const bodyResult = await parseJsonBody(request, CreateOptionSchema)
  if ('error' in bodyResult) {
    return bodyResult.error
  }

  const optionData = bodyResult.data

  try {
    // Verify catalog item exists
    const { data: catalogItem, error: catalogError } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('id', catalogItemId)
      .single()

    if (catalogError || !catalogItem) {
      return errorResponse('Catalog item not found', 404)
    }

    // Check if option code already exists for this product
    const { data: existingOption, error: checkError } = await supabase
      .from('item_options')
      .select('id')
      .eq('catalog_item_id', catalogItemId)
      .eq('code', optionData.code)
      .single()

    if (existingOption) {
      return errorResponse('Option code already exists for this product', 409, {
        field: 'code',
        message: 'An option with this code already exists',
      })
    }

    // Create the option
    const { data: option, error } = await supabase
      .from('item_options')
      .insert({
        catalog_item_id: catalogItemId,
        code: optionData.code,
        label: optionData.label,
        type: optionData.type,
        required: optionData.required,
        default_value: optionData.default_value,
        sort_order: optionData.sort_order,
        constraints_json: optionData.constraints_json,
        price_delta_type: optionData.price_delta_type,
        price_delta_value: optionData.price_delta_value,
        active: optionData.active,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to create option', 500, {
        message: error.message,
      })
    }

    return successResponse({ option }, 201)
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return errorResponse('Internal server error', 500, {
      message: error.message,
    })
  }
}
