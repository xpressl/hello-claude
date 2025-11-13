/**
 * Browser-based ASR using Web Speech API
 * Free alternative to Whisper API for demo/testing
 * Only works in Chrome and other Chromium-based browsers
 */

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
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

/**
 * Live microphone transcription
 */
export function createLiveTranscription(
  onTranscript: (text: string, isFinal: boolean) => void,
  onError: (error: Error) => void
): {
  start: () => void
  stop: () => void
} {
  if (!isSpeechRecognitionSupported()) {
    throw new Error('Speech recognition not supported in this browser')
  }

  const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
  const recognition = new SpeechRecognition()

  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      const isFinal = event.results[i].isFinal
      onTranscript(transcript, isFinal)
    }
  }

  recognition.onerror = (event: any) => {
    onError(new Error(`Speech recognition error: ${event.error}`))
  }

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop()
  }
}
