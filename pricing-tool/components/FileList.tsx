'use client'

import { formatFileSize } from '@/lib/format'
import { FileListItem } from './FileListItem'
import { FileCard } from './FileCard'

interface FileListProps {
  files: File[]
  uploadProgress: Record<string, number>
  onRemove: (index: number) => void
  onUpload: () => void
  disabled?: boolean
}

/**
 * File list component that displays files in table view (desktop) or card view (mobile)
 * Includes an "Upload All" button and shows total file size
 */
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
      <div className="hidden md:block overflow-hidden border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                File
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
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
        className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
          disabled || isUploading || files.length === 0
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isUploading ? 'Uploading...' : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
