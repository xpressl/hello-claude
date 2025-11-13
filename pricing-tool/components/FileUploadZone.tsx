'use client'

import { useState, useCallback, useRef } from 'react'
import { FileList } from './FileList'
import { uploadMultipleFiles, validateFile, Upload } from '@/lib/upload-client'

interface FileUploadZoneProps {
  quoteId: string
  onUploadComplete: (uploads: Upload[]) => void
  maxFiles?: number
  maxTotalSize?: number  // In bytes
  disabled?: boolean
}

/**
 * Upload icon component
 */
function UploadIcon() {
  return (
    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  )
}

/**
 * Main file upload zone component with drag-and-drop support
 * Handles file validation, upload progress, and error display
 */
export function FileUploadZone({
  quoteId,
  onUploadComplete,
  maxFiles = 10,
  maxTotalSize = 100 * 1024 * 1024,  // 100MB
  disabled = false
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Drag-and-drop event handlers
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isUploading) {
      setIsDragging(true)
    }
  }, [disabled, isUploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled || isUploading) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [disabled, isUploading])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    addFiles(selectedFiles)
    // Reset input value so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [])

  /**
   * Add files with validation
   */
  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles: File[] = []
    const newErrors: Record<string, string> = {}

    // Check total file count
    if (files.length + newFiles.length > maxFiles) {
      newErrors['count'] = `Maximum ${maxFiles} files allowed`
      setErrors(newErrors)
      return
    }

    // Check total size
    const currentSize = files.reduce((sum, f) => sum + f.size, 0)
    const newSize = newFiles.reduce((sum, f) => sum + f.size, 0)
    if (currentSize + newSize > maxTotalSize) {
      newErrors['size'] = `Total size exceeds ${maxTotalSize / 1024 / 1024}MB limit`
      setErrors(newErrors)
      return
    }

    // Validate each file
    for (const file of newFiles) {
      const validation = validateFile(file)
      if (validation.valid) {
        validFiles.push(file)
      } else {
        newErrors[file.name] = validation.error || 'Invalid file'
      }
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
    } else {
      setErrors({})
    }
  }, [files, maxFiles, maxTotalSize])

  /**
   * Remove a file from the list
   */
  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setErrors({})
  }, [])

  /**
   * Upload all files
   */
  const uploadFiles = useCallback(async () => {
    if (files.length === 0 || isUploading) return

    setIsUploading(true)
    setErrors({})

    try {
      const uploads = await uploadMultipleFiles(
        quoteId,
        files,
        // Progress callback
        (file, percent) => {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: percent
          }))
        },
        // Complete callback
        (file, upload) => {
          console.log(`Upload complete: ${file.name}`, upload)
        },
        // Error callback
        (file, error) => {
          setErrors(prev => ({
            ...prev,
            [file.name]: error.message
          }))
        }
      )

      // Call parent callback with successful uploads
      if (uploads.length > 0) {
        onUploadComplete(uploads)
      }

      // Clear files after successful upload
      setFiles([])
      setUploadProgress({})
    } catch (error) {
      console.error('Upload error:', error)
      setErrors({
        general: 'Upload failed. Please try again.'
      })
    } finally {
      setIsUploading(false)
    }
  }, [files, isUploading, quoteId, onUploadComplete])

  const isDisabled = disabled || isUploading

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !isDisabled && inputRef.current?.click()}
      >
        <UploadIcon />
        <p className="text-lg font-medium text-gray-700 mb-2">
          Drag and drop files here
        </p>
        <p className="text-sm text-gray-500 mb-4">
          or click to browse
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            inputRef.current?.click()
          }}
          disabled={isDisabled}
          className={`py-2 px-4 rounded-lg font-medium transition-colors ${
            isDisabled
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Select Files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.txt,.mp3,.m4a,.wav"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isDisabled}
        />
        <p className="text-xs text-gray-400 mt-4">
          Supported: PDF, Images, Spreadsheets, Audio • Max {maxFiles} files, {maxTotalSize / 1024 / 1024}MB total
        </p>
      </div>

      {/* Error messages */}
      {Object.entries(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          {Object.entries(errors).map(([key, message]) => (
            <p key={key} className="text-sm text-red-700">
              • {message}
            </p>
          ))}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <FileList
          files={files}
          uploadProgress={uploadProgress}
          onRemove={removeFile}
          onUpload={uploadFiles}
          disabled={isDisabled}
        />
      )}
    </div>
  )
}
