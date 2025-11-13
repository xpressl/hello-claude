'use client'

import { useState, useEffect } from 'react'

interface OCRResultsViewerProps {
  uploadId: string
}

export function OCRResultsViewer({ uploadId }: OCRResultsViewerProps) {
  const [status, setStatus] = useState<'loading' | 'processing' | 'completed' | 'failed'>('loading')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    const checkStatus = async () => {
      const res = await fetch(`/api/uploads/${uploadId}/process`)
      const data = await res.json()

      setStatus(data.status)

      if (data.status === 'completed' && data.parsed_payload_json) {
        setResult(data.parsed_payload_json)
      }

      // Poll if still processing
      if (data.status === 'processing') {
        setTimeout(checkStatus, 2000)
      }
    }

    checkStatus()
  }, [uploadId])

  if (status === 'loading' || status === 'processing') {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
        <span className="text-sm text-gray-600">Processing OCR...</span>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
        OCR processing failed. Please try again or contact support.
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">OCR Results</h3>
        <span className={`text-sm px-2 py-1 rounded ${
          result.confidence > 80 ? 'bg-green-100 text-green-800' :
          result.confidence > 50 ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {result.confidence.toFixed(1)}% confidence
        </span>
      </div>

      <div className="bg-gray-50 border rounded p-4 max-h-96 overflow-auto">
        <pre className="text-sm whitespace-pre-wrap font-mono">
          {result.text}
        </pre>
      </div>

      <div className="text-xs text-gray-500">
        Processed in {(result.processingTime / 1000).toFixed(2)}s
        {result.method && ` • Method: ${result.method}`}
      </div>
    </div>
  )
}
