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

// Validation schema for updating an option value
const UpdateOptionValueSchema = z.object({
  value: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(100).optional(),
  price_delta: z.number().optional(),
  sku_suffix: z.string().max(20).nullable().optional(),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional(),
})

// PATCH /api/options/values/[valueId] - Update an option value
export async function PATCH(
  request: NextRequest,
  { params }: { params: { valueId: string } }
) {
  // Require ADMIN role for updating option values
  const authResult = await requireRole(request, ['ADMIN'])
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { valueId } = params

  // Parse and validate request body
  const bodyResult = await parseJsonBody(request, UpdateOptionValueSchema)
  if ('error' in bodyResult) {
    return bodyResult.error
  }

  const updateData = bodyResult.data

  try {
    // Verify option value exists
    const { data: existingValue, error: fetchError } = await supabase
      .from('option_values')
      .select('*')
      .eq('id', valueId)
      .single()

    if (fetchError || !existingValue) {
      return errorResponse('Option value not found', 404)
    }

    // If updating value, check for duplicates
    if (updateData.value && updateData.value !== existingValue.value) {
      const { data: duplicate, error: checkError } = await supabase
        .from('option_values')
        .select('id')
        .eq('item_option_id', existingValue.item_option_id)
        .eq('value', updateData.value)
        .single()

      if (duplicate) {
        return errorResponse('Value already exists for this option', 409, {
          field: 'value',
          message: 'A value with this name already exists',
        })
      }
    }

    // Update the option value
    const { data: value, error } = await supabase
      .from('option_values')
      .update(updateData)
      .eq('id', valueId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to update option value', 500, {
        message: error.message,
      })
    }

    return successResponse({ value })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return errorResponse('Internal server error', 500, {
      message: error.message,
    })
  }
}

// DELETE /api/options/values/[valueId] - Delete an option value
export async function DELETE(
  request: NextRequest,
  { params }: { params: { valueId: string } }
) {
  // Require ADMIN role for deleting option values
  const authResult = await requireRole(request, ['ADMIN'])
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { valueId } = params

  try {
    // Verify option value exists
    const { data: existingValue, error: fetchError } = await supabase
      .from('option_values')
      .select('id')
      .eq('id', valueId)
      .single()

    if (fetchError || !existingValue) {
      return errorResponse('Option value not found', 404)
    }

    // Delete the option value
    const { error } = await supabase
      .from('option_values')
      .delete()
      .eq('id', valueId)

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to delete option value', 500, {
        message: error.message,
      })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return errorResponse('Internal server error', 500, {
      message: error.message,
    })
  }
}
