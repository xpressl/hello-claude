'use client'

import { useState, useEffect } from 'react'
import { startRecognition, isRecognitionSupported } from '@/lib/voice'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  className?: string
}

export default function VoiceButton({ onTranscript, className = '' }: VoiceButtonProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsSupported(isRecognitionSupported())
  }, [])

  const handleToggle = () => {
    if (isListening) {
      setIsListening(false)
      return
    }

    setError(null)
    setIsListening(true)

    const cleanup = startRecognition({
      onText: (text) => {
        onTranscript(text)
        setIsListening(false)
      },
      onEnd: () => {
        setIsListening(false)
      },
      onError: (err) => {
        setError(err)
        setIsListening(false)
      },
    })

    // Return cleanup function
    return cleanup
  }

  if (!isSupported) {
    return (
      <div className="text-sm text-gray-500 text-center p-2">
        Voice input not supported in this browser
      </div>
    )
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleToggle}
        className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          isListening
            ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 animate-pulse'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 focus:ring-gray-500'
        }`}
        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        aria-pressed={isListening}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        <span>{isListening ? 'Listening...' : 'Voice Input'}</span>
      </button>

      {error && (
        <div
          className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  )
}
