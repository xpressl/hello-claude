import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  errorResponse,
  successResponse,
  requireAuth,
  createEvent,
} from '@/lib/api-utils'
import {
  validateFile,
  validateQuoteUploadLimits,
  generateStoragePath,
  type QuoteUploadStats,
} from '@/lib/upload-validation'
import { deleteFile } from '@/lib/storage'

/**
 * Create Supabase client
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey)
}

/**
 * POST /api/quotes/[id]/uploads - Upload file to quote
 *
 * Accepts multipart/form-data with:
 * - file: File (required)
 * - file_type: string (optional hint)
 *
 * Process:
 * 1. Verify quote exists and user has access
 * 2. Check upload limits (max 10 files, 100MB total per quote)
 * 3. Validate file (size, type, extension)
 * 4. Generate storage path with timestamp
 * 5. Upload to Supabase Storage
 * 6. Create database record in uploads table
 * 7. Rollback storage upload if database insert fails
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireAuth(request)
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id: quoteId } = await params

  try {
    // 1. Verify quote exists and user has access
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, created_by, status')
      .eq('id', quoteId)
      .single()

    if (quoteError) {
      if (quoteError.code === 'PGRST116') {
        return errorResponse('Quote not found', 404)
      }
      console.error('Database error fetching quote:', quoteError)
      return errorResponse('Failed to fetch quote', 500, {
        message: quoteError.message,
      })
    }

    // Check if user has permission (owner or ADMIN/SALES role)
    const isOwner = quote.created_by === authResult.auth.userId
    const hasRole = ['ADMIN', 'SALES'].includes(authResult.auth.role)
    if (!isOwner && !hasRole) {
      return errorResponse(
        'You do not have permission to upload files to this quote',
        403
      )
    }

    // 2. Check current upload stats for this quote
    const { data: existingUploads, error: uploadsError } = await supabase
      .from('uploads')
      .select('size_bytes')
      .eq('quote_id', quoteId)

    if (uploadsError) {
      console.error('Database error fetching uploads:', uploadsError)
      return errorResponse('Failed to check upload limits', 500, {
        message: uploadsError.message,
      })
    }

    const uploadStats: QuoteUploadStats = {
      file_count: existingUploads?.length || 0,
      total_size_bytes: existingUploads?.reduce(
        (sum, u) => sum + Number(u.size_bytes),
        0
      ) || 0,
    }

    // 3. Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return errorResponse('No file provided', 400)
    }

    // 4. Validate upload limits
    const limitsValidation = validateQuoteUploadLimits(uploadStats, file.size)
    if (!limitsValidation.valid) {
      return errorResponse(limitsValidation.error || 'Upload limit exceeded', 400)
    }

    // 5. Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return errorResponse(validation.error || 'Invalid file', 400)
    }

    // 6. Generate storage path with timestamp
    const storagePath = generateStoragePath(quoteId, file.name)

    // 7. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('quote-uploads')
      .upload(storagePath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return errorResponse('Upload failed', 500, {
        message: uploadError.message,
      })
    }

    // 8. Create upload record in database
    const { data: uploadRecord, error: dbError } = await supabase
      .from('uploads')
      .insert({
        quote_id: quoteId,
        file_type: validation.file_type,
        original_name: file.name,
        storage_path: storagePath,
        size_bytes: file.size,
        mime_type: file.type,
        status: 'pending',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)

      // Rollback: Delete the uploaded file from storage
      await deleteFile(storagePath)

      return errorResponse('Database error', 500, {
        message: dbError.message,
      })
    }

    // 9. Create event for audit trail
    await createEvent(
      quoteId,
      'file_uploaded',
      {
        upload_id: uploadRecord.id,
        file_name: file.name,
        file_type: validation.file_type,
        file_size: file.size,
      },
      authResult.auth.userId,
      request
    )

    // 10. Return success response
    return successResponse(
      {
        success: true,
        upload: uploadRecord,
        message: 'File uploaded successfully',
      },
      201
    )
  } catch (error: any) {
    console.error('Unexpected error in upload:', error)
    return errorResponse('Internal server error', 500, {
      message: error.message,
    })
  }
}

/**
 * GET /api/quotes/[id]/uploads - List all uploads for a quote
 *
 * Returns all uploads with their metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireAuth(request)
  if ('error' in authResult) {
    return authResult.error
  }

  const supabase = getSupabaseClient()
  const { id: quoteId } = await params

  try {
    // 1. Verify quote exists and user has access
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, created_by')
      .eq('id', quoteId)
      .single()

    if (quoteError) {
      if (quoteError.code === 'PGRST116') {
        return errorResponse('Quote not found', 404)
      }
      console.error('Database error fetching quote:', quoteError)
      return errorResponse('Failed to fetch quote', 500, {
        message: quoteError.message,
      })
    }

    // Check if user has permission (owner or ADMIN/SALES role)
    const isOwner = quote.created_by === authResult.auth.userId
    const hasRole = ['ADMIN', 'SALES'].includes(authResult.auth.role)
    if (!isOwner && !hasRole) {
      return errorResponse(
        'You do not have permission to view uploads for this quote',
        403
      )
    }

    // 2. Get all uploads for this quote
    const { data: uploads, error: uploadsError } = await supabase
      .from('uploads')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false })

    if (uploadsError) {
      console.error('Database error fetching uploads:', uploadsError)
      return errorResponse('Failed to fetch uploads', 500, {
        message: uploadsError.message,
      })
    }

    // 3. Calculate stats
    const stats: QuoteUploadStats = {
      file_count: uploads?.length || 0,
      total_size_bytes: uploads?.reduce(
        (sum, u) => sum + Number(u.size_bytes),
        0
      ) || 0,
    }

    return successResponse({
      uploads: uploads || [],
      stats,
    })
  } catch (error: any) {
    console.error('Unexpected error fetching uploads:', error)
    return errorResponse('Internal server error', 500, {
      message: error.message,
    })
  }
}
