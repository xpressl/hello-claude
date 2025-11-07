'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { upsertProducts, type ProductInsert } from '@/lib/supabase'

interface CsvRow {
  sku: string
  name: string
  unit_type: string
  unit_price: string
  aliases?: string
}

export default function UploadCsv() {
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const processFile = useCallback(async (file: File) => {
    setIsUploading(true)
    setMessage(null)

    try {
      const text = await file.text()

      Papa.parse<CsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            // Validate and transform CSV data
            const products: ProductInsert[] = results.data
              .filter((row) => row.sku && row.name && row.unit_type && row.unit_price)
              .map((row) => ({
                sku: row.sku.trim(),
                name: row.name.trim(),
                unit_type: row.unit_type.trim().toUpperCase() as any,
                unit_price: parseFloat(row.unit_price),
                aliases: row.aliases
                  ? row.aliases.split(',').map((a) => a.trim()).filter(Boolean)
                  : [],
              }))

            if (products.length === 0) {
              throw new Error('No valid products found in CSV')
            }

            // Upload to Supabase
            await upsertProducts(products)

            setMessage({
              type: 'success',
              text: `Successfully uploaded ${products.length} product${products.length > 1 ? 's' : ''}`,
            })
          } catch (err) {
            setMessage({
              type: 'error',
              text: err instanceof Error ? err.message : 'Failed to upload products',
            })
          } finally {
            setIsUploading(false)
          }
        },
        error: (err) => {
          setMessage({
            type: 'error',
            text: `CSV parsing error: ${err.message}`,
          })
          setIsUploading(false)
        },
      })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to read file',
      })
      setIsUploading(false)
    }
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0])
      }
    },
    [processFile]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0])
      }
    },
    [processFile]
  )

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          disabled={isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Upload CSV file"
        />

        <div className="space-y-4">
          <div className="flex justify-center">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <div>
            <p className="text-lg font-medium text-gray-900">
              {isUploading ? 'Uploading...' : 'Drop CSV file here'}
            </p>
            <p className="text-sm text-gray-500 mt-1">or click to browse</p>
          </div>

          <div className="text-xs text-gray-500">
            <p>CSV format: sku, name, unit_type, unit_price, aliases (optional)</p>
            <p>Unit types: EA, LF, SF, BOX, PKG, SET</p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
          role="alert"
        >
          <p className="font-medium">
            {message.type === 'success' ? 'Success!' : 'Error'}
          </p>
          <p className="text-sm mt-1">{message.text}</p>
        </div>
      )}
    </div>
  )
}
