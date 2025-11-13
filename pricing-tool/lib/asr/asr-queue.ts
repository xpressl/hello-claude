import { createClient } from '@supabase/supabase-js'
import { transcribeAudioBuffer } from './whisper-asr'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function processAudioUpload(uploadId: string) {
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

    // 3. Download audio file from storage
    const { data: fileData } = await supabase.storage
      .from('quote-uploads')
      .download(upload.storage_path)

    if (!fileData) {
      throw new Error('Failed to download file')
    }

    // 4. Convert to buffer
    const audioBuffer = Buffer.from(await fileData.arrayBuffer())

    // 5. Transcribe
    const startTime = Date.now()
    const result = await transcribeAudioBuffer(
      audioBuffer,
      upload.original_name,
      {
        language: 'en',
        prompt: 'Construction materials order including doors, windows, frames, hardware, and quantities.'
      }
    )
    const processingTime = Date.now() - startTime

    // 6. Calculate confidence
    const avgConfidence = result.segments
      ? result.segments.reduce((sum, seg) => sum + (seg.confidence || 0), 0) / result.segments.length
      : 0.8  // Default if no segments

    // 7. Store results
    await supabase
      .from('uploads')
      .update({
        status: 'completed',
        parsed_payload_json: {
          text: result.text,
          language: result.language,
          duration: result.duration,
          segments: result.segments,
          processingTime
        },
        confidence_score: avgConfidence,
        processed_at: new Date().toISOString()
      })
      .eq('id', uploadId)

    // 8. Extract line items from transcription
    await extractLineItemsFromTranscript(uploadId, result.text)

    return { success: true, uploadId, result }
  } catch (error) {
    console.error('ASR processing error:', error)

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

async function extractLineItemsFromTranscript(
  uploadId: string,
  text: string
) {
  // Reuse text parser from Task 11
  const { parseTextToLineItems } = await import('@/lib/parsers/text-parser')

  const items = parseTextToLineItems(text)

  // Get quote ID from upload
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
        source: 'asr',
        confidence_score: item.confidence,
        mapping_warnings_json: { warnings: item.warnings || [] },
        options_json: item.size ? { SIZE: item.size } : {},
        notes: `Transcribed from audio: "${item.raw_text || text.substring(0, 100)}"`,
        line_number: 0  // Will be updated by trigger
      })
    }
  }
}
