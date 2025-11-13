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

// Validation schema for reordering options
const ReorderSchema = z.object({
  options: z.array(
    z.object({
      id: z.string().uuid(),
      sort_order: z.number().int().min(0),
    })
  ),
})

// PATCH /api/catalog/[id]/options/reorder - Reorder options
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require ADMIN role for reordering options
  const authResult = await requireRole(request, ['ADMIN'])
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id } = await params
  const catalogItemId = id

  // Parse and validate request body
  const bodyResult = await parseJsonBody(request, ReorderSchema)
  if ('error' in bodyResult) {
    return bodyResult.error
  }

  const { options } = bodyResult.data

  try {
    // Verify all options belong to this catalog item
    const { data: existingOptions, error: fetchError } = await supabase
      .from('item_options')
      .select('id')
      .eq('catalog_item_id', catalogItemId)
      .in(
        'id',
        options.map((o) => o.id)
      )

    if (fetchError) {
      console.error('Database error:', fetchError)
      return errorResponse('Failed to verify options', 500, {
        message: fetchError.message,
      })
    }

    if (!existingOptions || existingOptions.length !== options.length) {
      return errorResponse('One or more options not found', 404)
    }

    // Update sort_order for each option
    const updatePromises = options.map((option) =>
      supabase
        .from('item_options')
        .update({
          sort_order: option.sort_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', option.id)
        .eq('catalog_item_id', catalogItemId)
    )

    const results = await Promise.all(updatePromises)

    // Check for errors
    const errors = results.filter((result) => result.error)
    if (errors.length > 0) {
      console.error('Database errors:', errors)
      return errorResponse('Failed to reorder options', 500, {
        message: 'Some options could not be reordered',
      })
    }

    return successResponse({ success: true })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return errorResponse('Internal server error', 500, {
      message: error.message,
    })
  }
}
