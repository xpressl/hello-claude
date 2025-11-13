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
