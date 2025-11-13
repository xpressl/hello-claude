import { NextRequest, NextResponse } from 'next/server'
import { processAudioUpload } from '@/lib/asr/asr-queue'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60  // Allow up to 60s for long audio files

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: uploadId } = await params

  // Trigger async processing
  processAudioUpload(uploadId).catch(error => {
    console.error('Background ASR processing failed:', error)
  })

  return NextResponse.json({
    success: true,
    message: 'Transcription started',
    uploadId
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Check processing status
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: upload } = await supabase
    .from('uploads')
    .select('id, status, confidence_score, error_message, processed_at, parsed_payload_json')
    .eq('id', id)
    .single()

  return NextResponse.json(upload)
}
