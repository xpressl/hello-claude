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
