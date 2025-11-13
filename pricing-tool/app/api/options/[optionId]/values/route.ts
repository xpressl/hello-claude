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

// Validation schema for creating an option value
const CreateOptionValueSchema = z.object({
  value: z.string().min(1, 'Value is required').max(100),
  label: z.string().min(1, 'Label is required').max(100),
  price_delta: z.number().default(0),
  sku_suffix: z.string().max(20).nullable().optional(),
  sort_order: z.number().int().default(0),
  active: z.boolean().default(true),
})

// GET /api/options/[optionId]/values - Get all values for an option
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
) {
  // Require SALES or ADMIN role
  const authResult = await requireRole(request, ['SALES', 'ADMIN'])
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { optionId } = await params

  try {
    // Verify option exists
    const { data: option, error: optionError } = await supabase
      .from('item_options')
      .select('id, type')
      .eq('id', optionId)
      .single()

    if (optionError || !option) {
      return errorResponse('Option not found', 404)
    }

    // Fetch all values for the option
    const { data: values, error } = await supabase
      .from('option_values')
      .select('*')
      .eq('item_option_id', optionId)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to fetch option values', 500, {
        message: error.message,
      })
    }

    return successResponse({
      values: values || [],
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return errorResponse('Internal server error', 500, {
      message: error.message,
    })
  }
}

// POST /api/options/[optionId]/values - Create a new option value
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ optionId: string }> }
) {
  // Require ADMIN role for creating option values
  const authResult = await requireRole(request, ['ADMIN'])
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { optionId } = await params

  // Parse and validate request body
  const bodyResult = await parseJsonBody(request, CreateOptionValueSchema)
  if ('error' in bodyResult) {
    return bodyResult.error
  }

  const valueData = bodyResult.data

  try {
    // Verify option exists and is of type 'select'
    const { data: option, error: optionError } = await supabase
      .from('item_options')
      .select('id, type')
      .eq('id', optionId)
      .single()

    if (optionError || !option) {
      return errorResponse('Option not found', 404)
    }

    if (option.type !== 'select') {
      return errorResponse('Option values can only be added to select-type options', 400)
    }

    // Check if value already exists for this option
    const { data: existingValue, error: checkError } = await supabase
      .from('option_values')
      .select('id')
      .eq('item_option_id', optionId)
      .eq('value', valueData.value)
      .single()

    if (existingValue) {
      return errorResponse('Value already exists for this option', 409, {
        field: 'value',
        message: 'A value with this name already exists',
      })
    }

    // Create the option value
    const { data: value, error } = await supabase
      .from('option_values')
      .insert({
        item_option_id: optionId,
        value: valueData.value,
        label: valueData.label,
        price_delta: valueData.price_delta,
        sku_suffix: valueData.sku_suffix,
        sort_order: valueData.sort_order,
        active: valueData.active,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to create option value', 500, {
        message: error.message,
      })
    }

    return successResponse({ value }, 201)
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return errorResponse('Internal server error', 500, {
      message: error.message,
    })
  }
}
