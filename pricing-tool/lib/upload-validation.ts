/**
 * File Upload Validation
 * Validates file size, type, extension, and filename sanitization
 */

export interface ValidationResult {
  valid: boolean
  error?: string
  file_type?: 'pdf' | 'image' | 'spreadsheet' | 'audio' | 'text'
}

// Maximum file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024

// Minimum file size: 10 bytes (prevent empty files)
const MIN_FILE_SIZE = 10

// Allowed MIME types mapped to file types
const ALLOWED_MIME_TYPES: Record<string, 'pdf' | 'image' | 'spreadsheet' | 'audio' | 'text'> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'application/vnd.ms-excel': 'spreadsheet',
  'text/csv': 'spreadsheet',
  'text/plain': 'text',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/wav': 'audio',
}

// Valid file extensions for each file type
const VALID_EXTENSIONS: Record<string, string[]> = {
  pdf: ['pdf'],
  image: ['jpg', 'jpeg', 'png', 'webp'],
  spreadsheet: ['xlsx', 'xls', 'csv'],
  text: ['txt'],
  audio: ['mp3', 'm4a', 'wav'],
}

/**
 * Validate uploaded file
 * Checks file size, MIME type, extension, and filename safety
 */
export function validateFile(file: File): ValidationResult {
  // 1. Check file size (max 100MB)
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2)
    return {
      valid: false,
      error: `File too large. Maximum size is 100MB, got ${sizeMB}MB`,
    }
  }

  // 2. Check minimum size (prevent empty files)
  if (file.size < MIN_FILE_SIZE) {
    return {
      valid: false,
      error: 'File is too small or empty',
    }
  }

  // 3. Validate MIME type
  const fileType = ALLOWED_MIME_TYPES[file.type]
  if (!fileType) {
    return {
      valid: false,
      error: `File type not allowed: ${file.type}. Allowed types: PDF, images (JPEG, PNG, WebP), spreadsheets (XLSX, XLS, CSV), audio (MP3, M4A, WAV), text files.`,
    }
  }

  // 4. Validate file extension matches MIME type
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !VALID_EXTENSIONS[fileType]?.includes(extension)) {
    return {
      valid: false,
      error: `File extension .${extension} does not match MIME type ${file.type}`,
    }
  }

  // 5. Validate filename (prevent path traversal)
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid filename: path traversal characters not allowed',
    }
  }

  // 6. Check for null bytes in filename (security)
  if (file.name.includes('\0')) {
    return {
      valid: false,
      error: 'Invalid filename: null bytes not allowed',
    }
  }

  return {
    valid: true,
    file_type: fileType,
  }
}

/**
 * Sanitize filename for safe storage
 * Removes special characters, keeps alphanumeric, dash, underscore, dot
 */
export function sanitizeFilename(filename: string): string {
  // Replace special characters with underscore
  // Keep: a-z, A-Z, 0-9, dot, dash, underscore
  let sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')

  // Replace multiple consecutive underscores with single underscore
  sanitized = sanitized.replace(/_{2,}/g, '_')

  // Remove leading/trailing underscores and dots
  sanitized = sanitized.replace(/^[._-]+|[._-]+$/g, '')

  // Ensure filename is not empty after sanitization
  if (!sanitized) {
    sanitized = 'unnamed_file'
  }

  // Limit filename length (max 255 characters)
  if (sanitized.length > 255) {
    const extension = sanitized.split('.').pop()
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'))
    const maxNameLength = 255 - (extension ? extension.length + 1 : 0)
    sanitized = nameWithoutExt.substring(0, maxNameLength) + (extension ? `.${extension}` : '')
  }

  return sanitized
}

/**
 * Check if quote has reached upload limits
 * Max 10 files per quote, 100MB total
 */
export interface QuoteUploadStats {
  file_count: number
  total_size_bytes: number
}

export function validateQuoteUploadLimits(
  stats: QuoteUploadStats,
  newFileSize: number
): ValidationResult {
  const MAX_FILES_PER_QUOTE = 10
  const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 100MB total

  // Check file count limit
  if (stats.file_count >= MAX_FILES_PER_QUOTE) {
    return {
      valid: false,
      error: `Maximum ${MAX_FILES_PER_QUOTE} files per quote reached`,
    }
  }

  // Check total size limit
  const newTotalSize = stats.total_size_bytes + newFileSize
  if (newTotalSize > MAX_TOTAL_SIZE) {
    const currentSizeMB = (stats.total_size_bytes / 1024 / 1024).toFixed(2)
    const newFileSizeMB = (newFileSize / 1024 / 1024).toFixed(2)
    const limitMB = (MAX_TOTAL_SIZE / 1024 / 1024).toFixed(0)
    return {
      valid: false,
      error: `Total file size limit exceeded. Current: ${currentSizeMB}MB, New file: ${newFileSizeMB}MB, Limit: ${limitMB}MB`,
    }
  }

  return {
    valid: true,
  }
}

/**
 * Generate storage path for upload
 * Format: quotes/{quote_id}/{timestamp}_{sanitized_filename}
 */
export function generateStoragePath(quoteId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitized = sanitizeFilename(filename)
  return `quotes/${quoteId}/${timestamp}_${sanitized}`
}
