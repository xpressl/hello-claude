import { createClient } from '@supabase/supabase-js'
import { extractTextFromImage, OCRResult } from './tesseract-ocr'
import { extractTextFromPDF, PDFProcessResult } from './pdf-processor'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function processUpload(uploadId: string) {
  try {
    // 1. Get upload record
    const { data: upload, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single()

    if (error || !upload) {
      throw new Error('Upload not found')
    }

    // 2. Update status to processing
    await supabase
      .from('uploads')
      .update({ status: 'processing' })
      .eq('id', uploadId)

    // 3. Download file from storage
    const { data: fileData } = await supabase.storage
      .from('quote-uploads')
      .download(upload.storage_path)

    if (!fileData) {
      throw new Error('Failed to download file')
    }

    // 4. Process based on file type
    let result: OCRResult | PDFProcessResult

    if (upload.file_type === 'pdf') {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      result = await extractTextFromPDF(buffer)
    } else if (upload.file_type === 'image') {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      result = await extractTextFromImage(buffer)
    } else {
      throw new Error(`OCR not supported for file type: ${upload.file_type}`)
    }

    // 5. Store results
    const { error: updateError } = await supabase
      .from('uploads')
      .update({
        status: 'completed',
        parsed_payload_json: {
          text: result.text,
          confidence: result.confidence,
          words: 'words' in result ? result.words : undefined,
          method: 'method' in result ? result.method : 'ocr',
          processingTime: result.processingTime
        },
        confidence_score: result.confidence / 100,  // Normalize to 0-1
        processed_at: new Date().toISOString()
      })
      .eq('id', uploadId)

    if (updateError) {
      throw updateError
    }

    // 6. Trigger line item extraction
    await extractLineItemsFromText(uploadId, result.text)

    return { success: true, uploadId }
  } catch (error) {
    console.error('OCR processing error:', error)

    // Update upload with error
    await supabase
      .from('uploads')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', uploadId)

    return { success: false, error }
  }
}

async function extractLineItemsFromText(uploadId: string, text: string) {
  // Import text parser from Task 11
  const { parseTextToLineItems } = await import('@/lib/parsers/text-parser')

  const items = parseTextToLineItems(text)

  // Store extracted items linked to upload
  const { data: upload } = await supabase
    .from('uploads')
    .select('quote_id')
    .eq('id', uploadId)
    .single()

  if (upload?.quote_id) {
    for (const item of items) {
      await supabase.from('quote_lines').insert({
        quote_id: upload.quote_id,
        description: item.description || 'Unknown item',
        quantity: item.quantity || 1,
        unit: item.unit || 'EA',
        source: 'ocr',
        confidence_score: item.confidence,
        mapping_warnings_json: { warnings: item.warnings || [] },
        options_json: item.size ? { SIZE: item.size } : {},
        line_number: 0  // Will be updated by trigger
      })
    }
  }
}
