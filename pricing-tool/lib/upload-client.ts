/**
 * Client-side file upload utilities with progress tracking
 * Uses XMLHttpRequest for upload progress (fetch doesn't support progress events)
 */

export type UploadStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type FileType = 'pdf' | 'image' | 'spreadsheet' | 'audio' | 'text'

export interface Upload {
  id: string
  quote_id: string
  file_type: FileType
  original_name: string
  storage_path: string
  size_bytes: number
  mime_type: string
  status: UploadStatus
  parsed_payload_json?: Record<string, any>
  confidence_score?: number
  error_message?: string
  created_at: string
  processed_at?: string
}

export interface UploadOptions {
  quoteId: string
  file: File
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/**
 * Upload a single file with progress tracking
 * Uses XMLHttpRequest for progress events (fetch doesn't support this)
 */
export async function uploadFile({
  quoteId,
  file,
  onProgress,
  signal
}: UploadOptions): Promise<Upload> {
  const formData = new FormData()
  formData.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Progress tracking
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100)
        onProgress(percent)
      }
    })

    // Completion
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve(response.upload)
        } catch (error) {
          reject(new Error('Invalid response from server'))
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText)
          reject(new Error(error.error || 'Upload failed'))
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }
    })

    // Error
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    // Abort
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'))
    })

    // Set up abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort()
      })
    }

    // Start upload
    xhr.open('POST', `/api/quotes/${quoteId}/uploads`)
    xhr.send(formData)
  })
}

/**
 * Upload multiple files sequentially
 * Sequential uploads prevent overwhelming the server and allow better progress tracking
 */
export async function uploadMultipleFiles(
  quoteId: string,
  files: File[],
  onProgress?: (file: File, percent: number) => void,
  onComplete?: (file: File, upload: Upload) => void,
  onError?: (file: File, error: Error) => void
): Promise<Upload[]> {
  const uploads: Upload[] = []

  // Upload sequentially to avoid overwhelming server
  for (const file of files) {
    try {
      const upload = await uploadFile({
        quoteId,
        file,
        onProgress: (percent) => onProgress?.(file, percent)
      })
      uploads.push(upload)
      onComplete?.(file, upload)
    } catch (error) {
      onError?.(file, error as Error)
    }
  }

  return uploads
}

/**
 * Validate file before upload
 */
export interface FileValidation {
  valid: boolean
  error?: string
}

export function validateFile(file: File): FileValidation {
  // File type validation
  const allowedTypes = [
    // PDFs
    'application/pdf',
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    // Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/m4a',
    'audio/wav',
    'audio/x-m4a',
    // Text
    'text/plain',
  ]

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not supported`
    }
  }

  // File size validation (10MB per file)
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds 10MB limit`
    }
  }

  return { valid: true }
}

/**
 * Get file type category from MIME type
 */
export function getFileType(mimeType: string): FileType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.includes('pdf')) return 'pdf'
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  ) return 'spreadsheet'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'text'
}
