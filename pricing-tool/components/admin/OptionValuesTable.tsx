'use client'

import { useState, useEffect } from 'react'
import { ItemOption, OptionValue } from '@/lib/types'
import ConfirmDialog from '@/components/ConfirmDialog'

interface OptionValuesTableProps {
  option: ItemOption
  userRole: 'ADMIN' | 'SALES'
}

export default function OptionValuesTable({ option, userRole }: OptionValuesTableProps) {
  const [values, setValues] = useState<OptionValue[]>(option.values || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<OptionValue | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<OptionValue | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Form state for add/edit
  const [formData, setFormData] = useState({
    value: '',
    label: '',
    price_delta: 0,
    sku_suffix: '',
    sort_order: 0,
    active: true,
  })

  // Fetch values
  const fetchValues = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/options/${option.id}/values`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch values')
      }

      const data = await response.json()
      setValues(data.values || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching values:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (option.values) {
      setValues(option.values)
    } else {
      fetchValues()
    }
  }, [option])

  // Reset form
  const resetForm = () => {
    setFormData({
      value: '',
      label: '',
      price_delta: 0,
      sku_suffix: '',
      sort_order: values.length,
      active: true,
    })
    setEditingValue(null)
    setShowAddForm(false)
  }

  // Handle add/edit submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingValue
        ? `/api/options/values/${editingValue.id}`
        : `/api/options/${option.id}/values`

      const method = editingValue ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save value')
      }

      resetForm()
      fetchValues()
    } catch (err: any) {
      console.error('Error saving value:', err)
      alert('Failed to save value: ' + err.message)
    }
  }

  // Handle delete
  const handleDelete = async (value: OptionValue) => {
    try {
      const response = await fetch(`/api/options/values/${value.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete value')
      }

      setShowDeleteConfirm(null)
      fetchValues()
    } catch (err: any) {
      console.error('Error deleting value:', err)
      alert('Failed to delete value: ' + err.message)
    }
  }

  // Handle edit click
  const handleEditClick = (value: OptionValue) => {
    setFormData({
      value: value.value,
      label: value.label,
      price_delta: value.price_delta,
      sku_suffix: value.sku_suffix || '',
      sort_order: value.sort_order,
      active: value.active,
    })
    setEditingValue(value)
    setShowAddForm(true)
  }

  // Toggle active
  const handleToggleActive = async (value: OptionValue) => {
    try {
      const response = await fetch(`/api/options/values/${value.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          active: !value.active,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update value')
      }

      fetchValues()
    } catch (err: any) {
      console.error('Error updating value:', err)
      alert('Failed to update value: ' + err.message)
    }
  }

  if (loading && values.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Option Values</h4>
        {userRole === 'ADMIN' && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Value
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Add/Edit form */}
      {showAddForm && userRole === 'ADMIN' && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Value</label>
              <input
                type="text"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                required
                className="mt-1 block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Label</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                required
                className="mt-1 block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="White"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Price Delta ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.price_delta}
                onChange={(e) =>
                  setFormData({ ...formData, price_delta: parseFloat(e.target.value) || 0 })
                }
                className="mt-1 block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">SKU Suffix</label>
              <input
                type="text"
                value={formData.sku_suffix}
                onChange={(e) => setFormData({ ...formData, sku_suffix: e.target.value })}
                className="mt-1 block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="-WHT"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Sort Order</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) =>
                  setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                }
                className="mt-1 block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Active</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {editingValue ? 'Update' : 'Add'} Value
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Values table */}
      {values.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No values defined. {userRole === 'ADMIN' && 'Click "Add Value" to create one.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Label
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price Delta
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU Suffix
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active
                </th>
                {userRole === 'ADMIN' && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {values.map((value) => (
                <tr key={value.id} className={!value.active ? 'opacity-50' : ''}>
                  <td className="px-3 py-2 text-sm font-mono text-gray-900">{value.value}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{value.label}</td>
                  <td className="px-3 py-2 text-sm text-right text-gray-900">
                    {value.price_delta === 0
                      ? '—'
                      : value.price_delta > 0
                      ? `+$${value.price_delta.toFixed(2)}`
                      : `−$${Math.abs(value.price_delta).toFixed(2)}`}
                  </td>
                  <td className="px-3 py-2 text-sm font-mono text-gray-500">
                    {value.sku_suffix || '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {userRole === 'ADMIN' ? (
                      <button
                        onClick={() => handleToggleActive(value)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {value.active ? (
                          <svg
                            className="h-5 w-5 text-green-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-5 w-5 text-gray-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    ) : value.active ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-400">✗</span>
                    )}
                  </td>
                  {userRole === 'ADMIN' && (
                    <td className="px-3 py-2 text-right text-sm">
                      <button
                        onClick={() => handleEditClick(value)}
                        className="text-blue-600 hover:text-blue-700 mr-3"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(value)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Value"
          message={`Are you sure you want to delete "${showDeleteConfirm.label}"? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={() => handleDelete(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
