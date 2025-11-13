/**
 * QuoteFilters Component
 * Filter controls for the quotes table
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import type { QuoteStatus } from '@/lib/types'

interface QuoteFiltersProps {
  onFilterChange: (filters: {
    status: string
    search: string
    from: string
    to: string
  }) => void
  initialStatus?: string
  initialSearch?: string
  initialFrom?: string
  initialTo?: string
}

const statusOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
]

export default function QuoteFilters({
  onFilterChange,
  initialStatus = 'all',
  initialSearch = '',
  initialFrom = '',
  initialTo = '',
}: QuoteFiltersProps) {
  const [status, setStatus] = useState(initialStatus)
  const [search, setSearch] = useState(initialSearch)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(
    null
  )

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value)

      // Clear existing timer
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
      }

      // Set new timer for 300ms debounce
      const timer = setTimeout(() => {
        onFilterChange({ status, search: value, from, to })
      }, 300)

      setSearchDebounceTimer(timer)
    },
    [status, from, to, searchDebounceTimer, onFilterChange]
  )

  // Immediate filter change handlers
  const handleStatusChange = (value: string) => {
    setStatus(value)
    onFilterChange({ status: value, search, from, to })
  }

  const handleFromChange = (value: string) => {
    setFrom(value)
    onFilterChange({ status, search, from: value, to })
  }

  const handleToChange = (value: string) => {
    setTo(value)
    onFilterChange({ status, search, from, to: value })
  }

  const handleClearFilters = () => {
    setStatus('all')
    setSearch('')
    setFrom('')
    setTo('')
    onFilterChange({ status: 'all', search: '', from: '', to: '' })
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
      }
    }
  }, [searchDebounceTimer])

  const hasActiveFilters = status !== 'all' || search || from || to

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label
            htmlFor="status-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search Filter */}
        <div className="md:col-span-2">
          <label
            htmlFor="search-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search
          </label>
          <input
            id="search-filter"
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Customer name, email, or quote ID..."
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        {/* Clear Filters */}
        <div className="flex items-end">
          <button
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Date Range Filter - Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <div>
          <label
            htmlFor="from-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            From Date
          </label>
          <input
            id="from-date"
            type="date"
            value={from}
            onChange={(e) => handleFromChange(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="to-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            To Date
          </label>
          <input
            id="to-date"
            type="date"
            value={to}
            onChange={(e) => handleToChange(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
      </div>
    </div>
  )
}
