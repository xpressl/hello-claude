# Task 13: ASR (Audio Transcription) Pipeline

## Objective
Integrate Automatic Speech Recognition (ASR) to transcribe audio uploads (voice notes, phone orders) into text for line item extraction.

## Context
- Sales teams often record phone orders or voice notes
- Audio files (MP3, M4A, WAV) need transcription
- Extracted text feeds into same pipeline as OCR
- Choose between OpenAI Whisper API (best accuracy) or Web Speech API (free, browser-only)
- Recommendation: OpenAI Whisper API for production quality

## Requirements

### 1. ASR Service Selection

**Option A: OpenAI Whisper API (Recommended)**
- Pros: Excellent accuracy, handles multiple languages, speaker diarization, timestamps
- Cons: API costs ($0.006 per minute)
- Best for: Production, critical accuracy needed

**Option B: Web Speech API**
- Pros: Free, browser-based, real-time
- Cons: Chrome-only, requires internet, lower accuracy
- Best for: MVP, demo, quick testing

**Option C: AssemblyAI**
- Pros: Good accuracy, speaker labels, custom vocabulary
- Cons: API costs, requires account
- Best for: Alternative to Whisper

**Decision for this task:** Implement OpenAI Whisper API with fallback to Web Speech API.

### 2. OpenAI Whisper Integration

**Install dependency:**
```bash
npm install openai
```

**File:** `pricing-tool/lib/asr/whisper-asr.ts`

```typescript
import OpenAI from 'openai'
import fs from 'fs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export interface TranscriptionResult {
  text: string
  language: string
  duration: number
  segments?: TranscriptionSegment[]
  confidence?: number
}

export interface TranscriptionSegment {
  id: number
  start: number
  end: number
  text: string
  confidence?: number
}

export async function transcribeAudio(
  audioPath: string,
  options: {
    language?: string  // 'en', 'es', etc.
    prompt?: string  // Hint for domain-specific terms
    temperature?: number  // 0-1, lower = more conservative
  } = {}
): Promise<TranscriptionResult> {
  try {
    // Whisper API accepts file stream
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: options.language,
      prompt: options.prompt || 'This is a customer order for construction materials including doors, windows, and hardware.',
      temperature: options.temperature || 0.2,
      response_format: 'verbose_json'  // Get detailed response with timestamps
    })

    return {
      text: transcription.text,
      language: transcription.language || 'en',
      duration: transcription.duration || 0,
      segments: transcription.segments?.map(seg => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text,
        confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : undefined
      }))
    }
  } catch (error) {
    console.error('Whisper transcription error:', error)
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  filename: string,
  options: {
    language?: string
    prompt?: string
  } = {}
): Promise<TranscriptionResult> {
  // Write buffer to temp file (Whisper API needs file path)
  const tmpPath = `/tmp/${Date.now()}_${filename}`
  fs.writeFileSync(tmpPath, audioBuffer)

  try {
    const result = await transcribeAudio(tmpPath, options)
    return result
  } finally {
    // Clean up temp file
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath)
    }
  }
}
```

### 3. Audio Format Conversion

**Install dependency:**
```bash
npm install fluent-ffmpeg
npm install --save-dev @types/fluent-ffmpeg
```

**File:** `pricing-tool/lib/asr/audio-converter.ts`

**Purpose:** Convert various audio formats to format Whisper accepts

```typescript
import ffmpeg from 'fluent-ffmpeg'
import { promisify } from 'util'
import fs from 'fs'

export async function convertToMP3(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .audioCodec('libmp3lame')
      .audioChannels(1)  // Mono is fine for speech
      .audioFrequency(16000)  // 16kHz sufficient for speech
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath)
  })
}

export async function getAudioDuration(
  audioPath: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err)
      } else {
        resolve(metadata.format.duration || 0)
      }
    })
  })
}

export function isAudioFile(mimeType: string): boolean {
  return mimeType.startsWith('audio/')
}

export function getSupportedAudioFormats(): string[] {
  return [
    'audio/mpeg',      // MP3
    'audio/mp4',       // M4A
    'audio/wav',       // WAV
    'audio/x-wav',
    'audio/webm',      // WebM
    'audio/ogg',       // OGG
    'audio/flac'       // FLAC
  ]
}
```

### 4. ASR Processing Queue

**File:** `pricing-tool/lib/asr/asr-queue.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { transcribeAudioBuffer } from './whisper-asr'
import { convertToMP3, getAudioDuration } from './audio-converter'
import fs from 'fs'

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
        mapping_warnings_json: { warnings: item.warnings },
        options_json: item.size ? { SIZE: item.size } : {},
        notes: `Transcribed from audio: "${item.raw_text}"`
      })
    }
  }
}
```

### 5. API Route for ASR Processing

**File:** `pricing-tool/app/api/uploads/[id]/transcribe/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { processAudioUpload } from '@/lib/asr/asr-queue'

export const maxDuration = 60  // Allow up to 60s for long audio files

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const uploadId = params.id

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
  { params }: { params: { id: string } }
) {
  // Check processing status
  const { createClient } = await import('@supabase/supabase-js')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: upload } = await supabase
    .from('uploads')
    .select('id, status, confidence_score, error_message, processed_at, parsed_payload_json')
    .eq('id', params.id)
    .single()

  return NextResponse.json(upload)
}
```

### 6. Auto-Trigger ASR After Audio Upload

**Modify:** `pricing-tool/app/api/quotes/[id]/uploads/route.ts`

```typescript
// After successful upload...
if (uploadRecord && validation.file_type === 'audio') {
  // Trigger ASR processing asynchronously
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/uploads/${uploadRecord.id}/transcribe`, {
    method: 'POST'
  }).catch(console.error)
}
```

### 7. Transcription Viewer Component

**File:** `pricing-tool/components/admin/TranscriptionViewer.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'

interface TranscriptionViewerProps {
  uploadId: string
}

export function TranscriptionViewer({ uploadId }: TranscriptionViewerProps) {
  const [status, setStatus] = useState<'loading' | 'processing' | 'completed' | 'failed'>('loading')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    const checkStatus = async () => {
      const res = await fetch(`/api/uploads/${uploadId}/transcribe`)
      const data = await res.json()

      setStatus(data.status)

      if (data.status === 'completed' && data.parsed_payload_json) {
        setResult(data.parsed_payload_json)
      }

      // Poll if still processing
      if (data.status === 'processing') {
        setTimeout(checkStatus, 3000)
      }
    }

    checkStatus()
  }, [uploadId])

  if (status === 'loading' || status === 'processing') {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
        <span className="text-sm text-gray-600">Transcribing audio...</span>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
        Transcription failed. Please ensure the audio is clear and try again.
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Transcription</h3>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>Duration: {result.duration?.toFixed(1)}s</span>
          <span>Language: {result.language}</span>
        </div>
      </div>

      <div className="bg-gray-50 border rounded p-4">
        <p className="text-sm whitespace-pre-wrap">
          {result.text}
        </p>
      </div>

      {result.segments && result.segments.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
            View segments with timestamps
          </summary>
          <div className="mt-2 space-y-2">
            {result.segments.map((segment: any) => (
              <div key={segment.id} className="flex gap-3 border-l-2 border-gray-300 pl-3">
                <span className="text-gray-400 font-mono text-xs">
                  {formatTime(segment.start)} - {formatTime(segment.end)}
                </span>
                <span className="flex-1">{segment.text}</span>
                {segment.confidence && (
                  <span className="text-xs text-gray-500">
                    {(segment.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="text-xs text-gray-500">
        Processed in {(result.processingTime / 1000).toFixed(2)}s
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
```

### 8. Web Speech API Fallback (Client-Side)

**File:** `pricing-tool/lib/asr/web-speech-asr.ts`

**Purpose:** Browser-based ASR for demo/testing (no API costs)

```typescript
export function isSpeechRecognitionSupported(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

export async function transcribeAudioBlob(
  audioBlob: Blob
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isSpeechRecognitionSupported()) {
      reject(new Error('Speech recognition not supported in this browser'))
      return
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    let transcript = ''

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' '
        }
      }
    }

    recognition.onerror = (event: any) => {
      reject(new Error(`Speech recognition error: ${event.error}`))
    }

    recognition.onend = () => {
      resolve(transcript.trim())
    }

    // Create audio element to play blob
    const audio = new Audio(URL.createObjectURL(audioBlob))
    audio.play()
    recognition.start()

    audio.onended = () => {
      recognition.stop()
    }
  })
}
```

### 9. Cost Estimation

**Whisper API Pricing:**
- $0.006 per minute
- 5-minute audio = $0.03
- 100 uploads/month at 3 min avg = $1.80/month
- Very affordable for most use cases

**Cost tracking:**
```typescript
export function estimateWhisperCost(durationSeconds: number): number {
  const minutes = durationSeconds / 60
  return minutes * 0.006
}
```

## Files to Create

**ASR Engine:**
- `pricing-tool/lib/asr/whisper-asr.ts`
- `pricing-tool/lib/asr/audio-converter.ts`
- `pricing-tool/lib/asr/asr-queue.ts`
- `pricing-tool/lib/asr/web-speech-asr.ts`

**API:**
- `pricing-tool/app/api/uploads/[id]/transcribe/route.ts`

**Components:**
- `pricing-tool/components/admin/TranscriptionViewer.tsx`

**Modified:**
- `pricing-tool/app/api/quotes/[id]/uploads/route.ts` (auto-trigger ASR)

**Environment:**
- Add to `.env`: `OPENAI_API_KEY=sk-...`

## Testing Requirements

1. **Manual Testing:**
   - Upload MP3 file with clear speech
   - Upload M4A file
   - Upload WAV file
   - Verify transcription accuracy
   - Check confidence scores
   - Test with background noise
   - Test with multiple speakers

2. **Edge Cases:**
   - Very long audio (10+ minutes)
   - Poor audio quality
   - Multiple languages in one file
   - Silent audio
   - Music instead of speech

3. **Performance Testing:**
   - Measure processing time vs audio duration
   - Test concurrent transcriptions
   - Monitor API costs

## Acceptance Criteria

- [ ] OpenAI Whisper API integrated
- [ ] Audio files transcribed accurately
- [ ] Transcription stored in uploads.parsed_payload_json
- [ ] Segments with timestamps captured
- [ ] Confidence scores calculated
- [ ] Auto-trigger ASR after audio upload
- [ ] Line items extracted from transcript
- [ ] Admin can view transcription results
- [ ] Processing status tracked
- [ ] Error handling for failed transcription
- [ ] Temp files cleaned up after processing
- [ ] Works for MP3, M4A, WAV formats
- [ ] Processing completes within reasonable time

## Dependencies

- Task 01 (uploads table)
- Task 09 (upload API)
- Task 11 (text parser for extraction)
- OpenAI API account and key
- ffmpeg installed on server

## Estimated Effort

5-6 hours

## Review Checklist

- [ ] OpenAI API key secured (not in client code)
- [ ] Temp files cleaned up (no leaks)
- [ ] Audio format conversion works
- [ ] Error handling comprehensive
- [ ] Processing runs asynchronously
- [ ] Confidence scores meaningful
- [ ] Costs are reasonable for expected usage
- [ ] Web Speech API fallback optional
- [ ] TypeScript types accurate
- [ ] Prompt engineering optimized for domain
- [ ] Language detection works
- [ ] Segment timestamps preserved
- [ ] Status polling efficient
