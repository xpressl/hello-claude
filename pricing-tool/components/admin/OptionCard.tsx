'use client'

import { useState } from 'react'
import { ItemOption } from '@/lib/types'
import OptionValuesTable from './OptionValuesTable'
import ConfirmDialog from '@/components/ConfirmDialog'

interface OptionCardProps {
  option: ItemOption
  catalogItemId: string
  userRole: 'ADMIN' | 'SALES'
  onEdit: () => void
  onDeleted: () => void
}

export default function OptionCard({
  option,
  catalogItemId,
  userRole,
  onEdit,
  onDeleted,
}: OptionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle delete
  const handleDelete = async () => {
    try {
      setDeleting(true)
      setError(null)
      const response = await fetch(
        `/api/catalog/${catalogItemId}/options/${option.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to delete option')
      }

      onDeleted()
    } catch (err: any) {
      console.error('Error deleting option:', err)
      setError('Failed to delete option: ' + err.message)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Toggle active status
  const handleToggleActive = async () => {
    try {
      setError(null)
      const response = await fetch(
        `/api/catalog/${catalogItemId}/options/${option.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({
            active: !option.active,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update option')
      }

      onDeleted() // Refresh the list
    } catch (err: any) {
      console.error('Error updating option:', err)
      setError('Failed to update option: ' + err.message)
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 p-3">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-red-400 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
        {/* Option header */}
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                {userRole === 'ADMIN' && (
                  <div className="flex items-center text-gray-400 cursor-move">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8h16M4 16h16"
                      />
                    </svg>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{option.label}</h3>
                  <p className="text-sm text-gray-500">Code: {option.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {option.type}
                  </span>
                  {option.required && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Required
                    </span>
                  )}
                  {!option.active && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Option details */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Price Impact:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {option.price_delta_type === 'none' && 'None'}
                    {option.price_delta_type === 'flat' &&
                      `$${option.price_delta_value?.toFixed(2) || '0.00'}`}
                    {option.price_delta_type === 'percent' &&
                      `${option.price_delta_value || 0}%`}
                  </span>
                </div>
                {option.default_value && (
                  <div>
                    <span className="text-gray-500">Default:</span>{' '}
                    <span className="font-medium text-gray-900">{option.default_value}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Sort Order:</span>{' '}
                  <span className="font-medium text-gray-900">{option.sort_order}</span>
                </div>
              </div>

              {/* Constraints summary */}
              {option.constraints_json && Object.keys(option.constraints_json).length > 0 && (
                <div className="mt-3 text-sm">
                  <span className="text-gray-500">Constraints:</span>{' '}
                  <span className="font-mono text-xs text-gray-700">
                    {JSON.stringify(option.constraints_json)}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4">
              {option.type === 'select' && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title={expanded ? 'Collapse' : 'Expand values'}
                >
                  <svg
                    className={`h-5 w-5 transform transition-transform ${
                      expanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              )}
              {userRole === 'ADMIN' && (
                <>
                  <button
                    onClick={handleToggleActive}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title={option.active ? 'Deactivate' : 'Activate'}
                  >
                    {option.active ? (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={onEdit}
                    className="p-2 text-blue-600 hover:text-blue-700"
                    title="Edit option"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 text-red-600 hover:text-red-700"
                    title="Delete option"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Option values table (for select type) */}
        {option.type === 'select' && expanded && (
          <div className="border-t border-gray-200 bg-gray-50 p-4 sm:p-6">
            <OptionValuesTable option={option} userRole={userRole} />
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Option"
        message={`Are you sure you want to delete the "${option.label}" option? This will also delete all associated values. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
