'use client'

// Check if Web Speech API is available
const isSpeechRecognitionSupported = (): boolean => {
  return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
}

const isSpeechSynthesisSupported = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Get SpeechRecognition constructor
const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
}

export interface RecognitionCallbacks {
  onText: (text: string) => void
  onEnd?: () => void
  onError?: (error: string) => void
}

let recognition: any = null

/**
 * Start speech recognition
 * @param callbacks Object with onText, onEnd, and onError callbacks
 * @returns Cleanup function to stop recognition
 */
export function startRecognition(callbacks: RecognitionCallbacks): () => void {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError?.('Speech recognition is not supported in this browser')
    return () => {}
  }

  const SpeechRecognition = getSpeechRecognition()
  if (!SpeechRecognition) {
    callbacks.onError?.('Speech recognition is not available')
    return () => {}
  }

  // Stop existing recognition if any
  if (recognition) {
    recognition.stop()
  }

  recognition = new SpeechRecognition()
  recognition.continuous = false // Stop after one result
  recognition.interimResults = false // No interim results
  recognition.lang = 'en-US'
  recognition.maxAlternatives = 1

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript
    callbacks.onText(transcript)
  }

  recognition.onerror = (event: any) => {
    let errorMessage = 'Speech recognition error'

    switch (event.error) {
      case 'no-speech':
        errorMessage = 'No speech detected. Please try again.'
        break
      case 'audio-capture':
        errorMessage = 'Microphone not available'
        break
      case 'not-allowed':
        errorMessage = 'Microphone permission denied'
        break
      case 'network':
        errorMessage = 'Network error occurred'
        break
      default:
        errorMessage = `Recognition error: ${event.error}`
    }

    callbacks.onError?.(errorMessage)
  }

  recognition.onend = () => {
    callbacks.onEnd?.()
  }

  try {
    recognition.start()
  } catch (error) {
    callbacks.onError?.('Failed to start recognition')
  }

  // Return cleanup function
  return () => {
    if (recognition) {
      recognition.stop()
      recognition = null
    }
  }
}

/**
 * Speak text using speech synthesis
 * @param text Text to speak
 */
export function speak(text: string): void {
  if (!isSpeechSynthesisSupported()) {
    console.warn('Speech synthesis is not supported in this browser')
    return
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 1.0
  utterance.pitch = 1.0
  utterance.volume = 1.0

  window.speechSynthesis.speak(utterance)
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel()
  }
}

export interface VoiceQuery {
  search: string
  qty?: number
  unit?: string
  markupPct?: number
}

/**
 * Parse voice command into structured query
 * Example: "12 foot 20 gauge stud markup 20"
 * Returns: {search: "20 gauge stud", qty: 12, unit: "LF", markupPct: 20}
 *
 * @param input Voice command text
 * @returns Parsed query object
 */
export function parseVoiceQuery(input: string): VoiceQuery {
  const text = input.toLowerCase().trim()
  const result: VoiceQuery = { search: '' }

  // Extract quantity (first number in the string)
  const qtyMatch = text.match(/^(\d+(?:\.\d+)?)\s/)
  if (qtyMatch) {
    result.qty = parseFloat(qtyMatch[1])
  }

  // Extract unit type
  const unitMap: Record<string, string> = {
    'foot': 'LF',
    'feet': 'LF',
    'ft': 'LF',
    'square foot': 'SF',
    'square feet': 'SF',
    'sf': 'SF',
    'each': 'EA',
    'ea': 'EA',
    'box': 'BOX',
    'boxes': 'BOX',
    'package': 'PKG',
    'packages': 'PKG',
    'pkg': 'PKG',
    'set': 'SET',
    'sets': 'SET',
  }

  for (const [keyword, unit] of Object.entries(unitMap)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    if (regex.test(text)) {
      result.unit = unit
      break
    }
  }

  // Extract markup percentage
  const markupMatch = text.match(/markup\s+(\d+(?:\.\d+)?)/i)
  if (markupMatch) {
    result.markupPct = parseFloat(markupMatch[1])
  }

  // Extract search term (remove qty, unit, and markup)
  let searchText = text

  // Remove quantity
  if (qtyMatch) {
    searchText = searchText.replace(qtyMatch[0], '').trim()
  }

  // Remove unit keywords
  for (const keyword of Object.keys(unitMap)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    searchText = searchText.replace(regex, '').trim()
  }

  // Remove markup phrase
  if (markupMatch) {
    searchText = searchText.replace(/markup\s+\d+(?:\.\d+)?/gi, '').trim()
  }

  // Clean up extra spaces
  result.search = searchText.replace(/\s+/g, ' ').trim()

  return result
}

/**
 * Check if speech recognition is supported
 */
export function isRecognitionSupported(): boolean {
  return isSpeechRecognitionSupported()
}

/**
 * Check if speech synthesis is supported
 */
export function isSynthesisSupported(): boolean {
  return isSpeechSynthesisSupported()
}
