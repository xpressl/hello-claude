# Task 10: Upload UI Components

## Objective
Create user-friendly file upload components with drag-and-drop, multi-file support, progress tracking, preview capabilities, and cancel functionality.

## Context
- Next.js 16 with React Server Components and Client Components
- Tailwind CSS for styling
- Support up to 10 files per quote, 100MB total
- Multiple file types: PDF, images, spreadsheets, audio
- Mobile-first responsive design
- Accessibility is critical

## Requirements

### 1. File Upload Zone Component

**File:** `pricing-tool/components/FileUploadZone.tsx`

**Features:**
- Drag-and-drop area
- Click to browse files
- Visual feedback on drag-over
- Multiple file selection
- File type and size validation
- Disabled state during upload

**Component Structure:**
```typescript
'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, FileText, Image, FileSpreadsheet, Music } from 'lucide-react'

interface FileUploadZoneProps {
  quoteId: string
  onUploadComplete: (uploads: Upload[]) => void
  maxFiles?: number
  maxTotalSize?: number  // In bytes
  disabled?: boolean
}

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
  const inputRef = useRef<HTMLInputElement>(null)

  // Implementation details below...
}
```

**Drag-and-drop handlers:**
```typescript
const handleDragEnter = useCallback((e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragging(true)
}, [])

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

  const droppedFiles = Array.from(e.dataTransfer.files)
  addFiles(droppedFiles)
}, [])

const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const selectedFiles = Array.from(e.target.files || [])
  addFiles(selectedFiles)
}, [])
```

**File validation:**
```typescript
function addFiles(newFiles: File[]) {
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

  setFiles(prev => [...prev, ...validFiles])
  setErrors(newErrors)
}
```

**UI Layout:**
```tsx
return (
  <div className="space-y-4">
    {/* Drop zone */}
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
        isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <p className="text-lg font-medium text-gray-700 mb-2">
        Drag and drop files here
      </p>
      <p className="text-sm text-gray-500 mb-4">
        or click to browse
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="btn btn-secondary"
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
        disabled={disabled}
      />
      <p className="text-xs text-gray-400 mt-4">
        Supported: PDF, Images, Spreadsheets, Audio • Max {maxFiles} files, {maxTotalSize / 1024 / 1024}MB total
      </p>
    </div>

    {/* Error messages */}
    {Object.entries(errors).length > 0 && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        {Object.entries(errors).map(([key, message]) => (
          <p key={key} className="text-sm text-red-700">• {message}</p>
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
        disabled={disabled}
      />
    )}
  </div>
)
```

### 2. File List Component

**File:** `pricing-tool/components/FileList.tsx`

**Features:**
- Display each file with icon, name, size
- Progress bar during upload
- Remove button (before upload)
- Cancel button (during upload)
- Upload all button

**Component:**
```typescript
interface FileListProps {
  files: File[]
  uploadProgress: Record<string, number>
  onRemove: (index: number) => void
  onUpload: () => void
  disabled?: boolean
}

export function FileList({
  files,
  uploadProgress,
  onRemove,
  onUpload,
  disabled
}: FileListProps) {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  const isUploading = Object.keys(uploadProgress).length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          Files ({files.length})
        </h3>
        <p className="text-sm text-gray-500">
          Total: {formatFileSize(totalSize)}
        </p>
      </div>

      {/* Desktop: Table view */}
      <div className="hidden md:block overflow-hidden border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">File</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Size</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {files.map((file, index) => (
              <FileListItem
                key={`${file.name}-${index}`}
                file={file}
                progress={uploadProgress[file.name]}
                onRemove={() => onRemove(index)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Card view */}
      <div className="md:hidden space-y-2">
        {files.map((file, index) => (
          <FileCard
            key={`${file.name}-${index}`}
            file={file}
            progress={uploadProgress[file.name]}
            onRemove={() => onRemove(index)}
          />
        ))}
      </div>

      {/* Upload button */}
      <button
        onClick={onUpload}
        disabled={disabled || isUploading || files.length === 0}
        className="btn btn-primary w-full"
      >
        {isUploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
```

### 3. File List Item Component

**File:** `pricing-tool/components/FileListItem.tsx`

**Features:**
- File type icon
- File name and size
- Progress bar
- Status indicator
- Remove/Cancel button

```typescript
interface FileListItemProps {
  file: File
  progress?: number
  onRemove: () => void
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.includes('pdf')) return FileText
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return FileSpreadsheet
  if (mimeType.startsWith('audio/')) return Music
  return FileText
}

export function FileListItem({ file, progress, onRemove }: FileListItemProps) {
  const Icon = getFileIcon(file.type)
  const isUploading = progress !== undefined && progress < 100
  const isComplete = progress === 100

  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {file.name}
            </p>
            {isUploading && (
              <div className="mt-1">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatFileSize(file.size)}
      </td>
      <td className="px-4 py-3">
        {isComplete ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Complete
          </span>
        ) : isUploading ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {progress}%
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Pending
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onRemove}
          disabled={isUploading}
          className="text-red-600 hover:text-red-900 disabled:opacity-50"
          aria-label="Remove file"
        >
          <X className="h-5 w-5" />
        </button>
      </td>
    </tr>
  )
}
```

### 4. Image Preview Component

**File:** `pricing-tool/components/ImagePreview.tsx`

**Purpose:** Show thumbnail preview for image files

```typescript
interface ImagePreviewProps {
  file: File
  className?: string
}

export function ImagePreview({ file, className }: ImagePreviewProps) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [file])

  if (!preview) return null

  return (
    <div className={cn("relative group", className)}>
      <img
        src={preview}
        alt={file.name}
        className="w-full h-32 object-cover rounded-lg"
      />
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg" />
    </div>
  )
}
```

### 5. Upload Logic with Progress

**File:** `pricing-tool/lib/upload-client.ts`

```typescript
export interface UploadOptions {
  quoteId: string
  file: File
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

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
        const response = JSON.parse(xhr.responseText)
        resolve(response.upload)
      } else {
        const error = JSON.parse(xhr.responseText)
        reject(new Error(error.error || 'Upload failed'))
      }
    })

    // Error
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    // Abort
    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort()
        reject(new Error('Upload cancelled'))
      })
    }

    xhr.open('POST', `/api/quotes/${quoteId}/uploads`)
    xhr.send(formData)
  })
}

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
```

### 6. File Size Formatter Utility

**File:** `pricing-tool/lib/format.ts`

```typescript
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}
```

### 7. Integration with Quote Page

**Update:** `pricing-tool/app/quote/new/page.tsx`

```typescript
import { FileUploadZone } from '@/components/FileUploadZone'

export default function NewQuotePage() {
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Upload[]>([])

  const handleUploadComplete = (newUploads: Upload[]) => {
    setUploads(prev => [...prev, ...newUploads])
    toast.success(`${newUploads.length} file(s) uploaded successfully`)
  }

  return (
    <div>
      {/* ... existing quote form ... */}

      {/* Upload section */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4">
          Attach Documents (Optional)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Upload orders, drawings, audio notes, or spreadsheets to help us generate your quote
        </p>

        {quoteId && (
          <FileUploadZone
            quoteId={quoteId}
            onUploadComplete={handleUploadComplete}
          />
        )}

        {uploads.length > 0 && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Uploaded Files</h3>
            <ul className="space-y-2">
              {uploads.map(upload => (
                <li key={upload.id} className="text-sm text-gray-700">
                  {upload.original_name} • {upload.status}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
```

### 8. Accessibility Features

- Keyboard navigation (Tab, Enter, Escape)
- ARIA labels on buttons and inputs
- Screen reader announcements for upload progress
- Focus management during upload
- Error messages announced
- High contrast mode support

### 9. Mobile Optimizations

- Touch-friendly drop zone (larger target)
- Simplified card layout on mobile
- Bottom sheet for file picker on iOS
- Reduced animations for low-power mode
- Network-aware uploads (pause on offline)

## Files to Create

**Components:**
- `pricing-tool/components/FileUploadZone.tsx`
- `pricing-tool/components/FileList.tsx`
- `pricing-tool/components/FileListItem.tsx`
- `pricing-tool/components/FileCard.tsx` (mobile version)
- `pricing-tool/components/ImagePreview.tsx`

**Utilities:**
- `pricing-tool/lib/upload-client.ts`
- `pricing-tool/lib/format.ts` (formatFileSize)

**Modified:**
- `pricing-tool/app/quote/new/page.tsx` (integrate upload zone)

## Testing Requirements

1. **Manual Testing:**
   - Drag and drop single file
   - Drag and drop multiple files
   - Click to browse and select files
   - Upload progress displays correctly
   - Remove file before upload
   - Cancel upload in progress
   - Upload completes successfully
   - Error handling for failed uploads
   - Preview images before upload
   - Test on mobile device

2. **Edge Cases:**
   - Upload 11 files (should prevent)
   - Upload files totaling > 100MB (should prevent)
   - Upload unsupported file type (should show error)
   - Slow network (progress should update smoothly)
   - Network disconnect during upload
   - Multiple concurrent uploads
   - Browser refresh during upload

3. **Accessibility Testing:**
   - Keyboard-only navigation
   - Screen reader compatibility
   - Focus indicators visible
   - Error messages announced

## Acceptance Criteria

- [ ] Drag-and-drop zone works on desktop
- [ ] Click to browse works on all devices
- [ ] Multiple file selection supported
- [ ] File validation before upload
- [ ] Progress bar shows accurate percentage
- [ ] Cancel upload functionality works
- [ ] Remove file before upload works
- [ ] Image previews display correctly
- [ ] Mobile responsive (card layout)
- [ ] Error messages clear and helpful
- [ ] Success feedback after upload
- [ ] Maximum file limits enforced (10 files, 100MB total)
- [ ] File type icons display correctly
- [ ] Keyboard navigation works
- [ ] Screen reader accessible

## Dependencies

- Task 09 (upload API must exist)
- lucide-react for icons
- Toast notification system (Task 03)

## Estimated Effort

5-6 hours

## Review Checklist

- [ ] TypeScript types are correct
- [ ] No console.log statements
- [ ] Error boundaries in place
- [ ] Loading states prevent duplicate uploads
- [ ] File objects cleaned up (no memory leaks)
- [ ] XHR used for progress (fetch doesn't support progress)
- [ ] Abort controller works for cancellation
- [ ] Mobile touch events work
- [ ] File size formatter accurate
- [ ] ARIA labels present
- [ ] Color contrast meets WCAG AA
- [ ] Sequential uploads prevent server overload
- [ ] Success/error callbacks called appropriately
