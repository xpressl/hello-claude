'use client'

import { useState, useEffect } from 'react'

interface ImagePreviewProps {
  file: File
  className?: string
}

/**
 * Image preview component using FileReader API
 * Shows thumbnail preview for image files
 */
export function ImagePreview({ file, className = '' }: ImagePreviewProps) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    return () => {
      // Cleanup: revoke object URL to prevent memory leaks
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [file])

  if (!preview) return null

  return (
    <div className={`relative group ${className}`}>
      <img
        src={preview}
        alt={file.name}
        className="w-full h-32 object-cover rounded-lg"
      />
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg" />
    </div>
  )
}
