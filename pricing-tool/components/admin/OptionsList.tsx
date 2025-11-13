'use client'

import { useState, useEffect } from 'react'
import { ItemOption } from '@/lib/types'
import OptionCard from './OptionCard'
import OptionForm from './OptionForm'
import OptionTemplateSelector from './OptionTemplateSelector'

interface OptionsListProps {
  catalogItemId: string
  userRole: 'ADMIN' | 'SALES'
}

export default function OptionsList({ catalogItemId, userRole }: OptionsListProps) {
  const [options, setOptions] = useState<ItemOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showOptionForm, setShowOptionForm] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [editingOption, setEditingOption] = useState<ItemOption | null>(null)
  const [draggedOption, setDraggedOption] = useState<ItemOption | null>(null)

  // Fetch options
  const fetchOptions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/catalog/${catalogItemId}/options`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch options')
      }

      const data = await response.json()
      setOptions(data.options || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching options:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOptions()
  }, [catalogItemId])

  // Handle option created/updated
  const handleOptionSaved = () => {
    setShowOptionForm(false)
    setShowTemplateSelector(false)
    setEditingOption(null)
    fetchOptions()
  }

  // Handle option deleted
  const handleOptionDeleted = () => {
    fetchOptions()
  }

  // Handle drag start
  const handleDragStart = (option: ItemOption) => {
    setDraggedOption(option)
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Handle drop
  const handleDrop = async (targetOption: ItemOption) => {
    if (!draggedOption || draggedOption.id === targetOption.id) {
      setDraggedOption(null)
      return
    }

    // Reorder options array
    const newOptions = [...options]
    const draggedIndex = newOptions.findIndex((o) => o.id === draggedOption.id)
    const targetIndex = newOptions.findIndex((o) => o.id === targetOption.id)

    newOptions.splice(draggedIndex, 1)
    newOptions.splice(targetIndex, 0, draggedOption)

    // Update sort_order for all options
    const updatedOptions = newOptions.map((option, index) => ({
      ...option,
      sort_order: index,
    }))

    setOptions(updatedOptions)
    setDraggedOption(null)

    // Save new order to backend
    try {
      const response = await fetch(`/api/catalog/${catalogItemId}/options/reorder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          options: updatedOptions.map((o) => ({ id: o.id, sort_order: o.sort_order })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to reorder options')
      }
    } catch (err: any) {
      console.error('Error reordering options:', err)
      setError('Failed to save new order')
      fetchOptions() // Revert to original order
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Options</h2>
          <p className="mt-1 text-sm text-gray-600">
            Configure options and their values for this product
          </p>
        </div>
        {userRole === 'ADMIN' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowTemplateSelector(true)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Use Template
            </button>
            <button
              onClick={() => setShowOptionForm(true)}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add Option
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Options list */}
      {options.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No options configured</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new option or using a template.
          </p>
          {userRole === 'ADMIN' && (
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setShowTemplateSelector(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Use Template
              </button>
              <button
                onClick={() => setShowOptionForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Add Option
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {options.map((option) => (
            <div
              key={option.id}
              draggable={userRole === 'ADMIN'}
              onDragStart={() => handleDragStart(option)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(option)}
              className={userRole === 'ADMIN' ? 'cursor-move' : ''}
            >
              <OptionCard
                option={option}
                catalogItemId={catalogItemId}
                userRole={userRole}
                onEdit={() => {
                  setEditingOption(option)
                  setShowOptionForm(true)
                }}
                onDeleted={handleOptionDeleted}
              />
            </div>
          ))}
        </div>
      )}

      {/* Option form modal */}
      {showOptionForm && (
        <OptionForm
          catalogItemId={catalogItemId}
          option={editingOption}
          onSaved={handleOptionSaved}
          onClose={() => {
            setShowOptionForm(false)
            setEditingOption(null)
          }}
        />
      )}

      {/* Template selector modal */}
      {showTemplateSelector && (
        <OptionTemplateSelector
          catalogItemId={catalogItemId}
          onSelected={handleOptionSaved}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  )
}
