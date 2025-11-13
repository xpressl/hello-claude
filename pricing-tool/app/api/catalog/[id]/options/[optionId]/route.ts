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

// Validation schema for updating an option
const UpdateOptionSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_]+$/)
    .optional(),
  label: z.string().min(1).max(100).optional(),
  type: z.enum(['select', 'number', 'text', 'boolean']).optional(),
  required: z.boolean().optional(),
  default_value: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  constraints_json: z.record(z.string(), z.any()).nullable().optional(),
  price_delta_type: z.enum(['flat', 'percent', 'none']).optional(),
  price_delta_value: z.number().nullable().optional(),
  active: z.boolean().optional(),
})

// PATCH /api/catalog/[id]/options/[optionId] - Update an option
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  // Require ADMIN role for updating options
  const authResult = await requireRole(request, ['ADMIN'])
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id: catalogItemId, optionId } = await params

  // Parse and validate request body
  const bodyResult = await parseJsonBody(request, UpdateOptionSchema)
  if ('error' in bodyResult) {
    return bodyResult.error
  }

  const updateData = bodyResult.data

  try {
    // Verify option exists and belongs to the catalog item
    const { data: existingOption, error: fetchError } = await supabase
      .from('item_options')
      .select('*')
      .eq('id', optionId)
      .eq('catalog_item_id', catalogItemId)
      .single()

    if (fetchError || !existingOption) {
      return errorResponse('Option not found', 404)
    }

    // If updating code, check for duplicates
    if (updateData.code && updateData.code !== existingOption.code) {
      const { data: duplicate, error: checkError } = await supabase
        .from('item_options')
        .select('id')
        .eq('catalog_item_id', catalogItemId)
        .eq('code', updateData.code)
        .single()

      if (duplicate) {
        return errorResponse('Option code already exists for this product', 409, {
          field: 'code',
          message: 'An option with this code already exists',
        })
      }
    }

    // Update the option
    const { data: option, error } = await supabase
      .from('item_options')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', optionId)
      .eq('catalog_item_id', catalogItemId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to update option', 500, {
        message: error.message,
      })
    }

    return successResponse({ option })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return errorResponse('Internal server error', 500, {
      message: error.message,
    })
  }
}

// DELETE /api/catalog/[id]/options/[optionId] - Delete an option
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  // Require ADMIN role for deleting options
  const authResult = await requireRole(request, ['ADMIN'])
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id: catalogItemId, optionId } = await params

  try {
    // Verify option exists and belongs to the catalog item
    const { data: existingOption, error: fetchError } = await supabase
      .from('item_options')
      .select('id')
      .eq('id', optionId)
      .eq('catalog_item_id', catalogItemId)
      .single()

    if (fetchError || !existingOption) {
      return errorResponse('Option not found', 404)
    }

    // Delete the option (CASCADE will delete associated option_values)
    const { error } = await supabase
      .from('item_options')
      .delete()
      .eq('id', optionId)
      .eq('catalog_item_id', catalogItemId)

    if (error) {
      console.error('Database error:', error)
      return errorResponse('Failed to delete option', 500, {
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
