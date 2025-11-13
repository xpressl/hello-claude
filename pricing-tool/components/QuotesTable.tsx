/**
 * QuotesTable Component
 * Main table component for displaying and managing quotes
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Quote, QuotesListResponse } from '@/lib/types'
import StatusBadge from './StatusBadge'
import QuoteFilters from './QuoteFilters'
import ConfirmDialog from './ConfirmDialog'
import {
  formatQuoteId,
  formatCurrency,
  formatRelativeTime,
  formatFullTimestamp,
  truncate,
} from '@/lib/format'
import { exportQuotesToCSV } from '@/lib/export'

interface QuotesTableProps {
  initialQuotes: Quote[]
  initialTotal: number
  userRole?: 'ADMIN' | 'SALES'
}

export default function QuotesTable({
  initialQuotes,
  initialTotal,
  userRole = 'SALES',
}: QuotesTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes)
  const [total, setTotal] = useState(initialTotal)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pagination
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)

  // Delete confirmation
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null)

  // Get initial filters from URL
  const getInitialFilters = useCallback(() => {
    return {
      status: searchParams.get('status') || 'all',
      search: searchParams.get('search') || '',
      from: searchParams.get('from') || '',
      to: searchParams.get('to') || '',
    }
  }, [searchParams])

  const [filters, setFilters] = useState(getInitialFilters())

  // Fetch quotes from API
  const fetchQuotes = useCallback(
    async (newFilters = filters, newOffset = offset, newLimit = limit) => {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (newFilters.status && newFilters.status !== 'all') {
          params.set('status', newFilters.status)
        }
        if (newFilters.search) {
          params.set('search', newFilters.search)
        }
        if (newFilters.from) {
          params.set('from', newFilters.from)
        }
        if (newFilters.to) {
          params.set('to', newFilters.to)
        }
        params.set('limit', String(newLimit))
        params.set('offset', String(newOffset))

        const response = await fetch(`/api/quotes?${params.toString()}`)

        if (!response.ok) {
          throw new Error('Failed to fetch quotes')
        }

        const data: QuotesListResponse = await response.json()
        setQuotes(data.quotes)
        setTotal(data.total)
        setOffset(newOffset)
        setLimit(newLimit)
      } catch (err) {
        console.error('Error fetching quotes:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch quotes')
      } finally {
        setIsLoading(false)
      }
    },
    [filters, offset, limit]
  )

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: typeof filters) => {
      setFilters(newFilters)
      setOffset(0) // Reset to first page

      // Update URL
      const params = new URLSearchParams()
      if (newFilters.status && newFilters.status !== 'all') {
        params.set('status', newFilters.status)
      }
      if (newFilters.search) {
        params.set('search', newFilters.search)
      }
      if (newFilters.from) {
        params.set('from', newFilters.from)
      }
      if (newFilters.to) {
        params.set('to', newFilters.to)
      }

      const query = params.toString()
      router.push(`/admin/quotes${query ? `?${query}` : ''}`, { scroll: false })

      // Fetch with new filters
      fetchQuotes(newFilters, 0, limit)
    },
    [router, limit, fetchQuotes]
  )

  // Handle sync
  const handleSync = useCallback(async () => {
    setIsSyncing(true)
    await fetchQuotes()
    setIsSyncing(false)
  }, [fetchQuotes])

  // Handle export
  const handleExport = useCallback(() => {
    exportQuotesToCSV(quotes)
  }, [quotes])

  // Handle delete
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteQuoteId) return

    try {
      const response = await fetch(`/api/quotes/${deleteQuoteId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete quote')
      }

      // Remove from local state
      setQuotes((prev) => prev.filter((q) => q.id !== deleteQuoteId))
      setTotal((prev) => prev - 1)
      setDeleteQuoteId(null)
    } catch (err) {
      console.error('Error deleting quote:', err)
      alert('Failed to delete quote. Please try again.')
    }
  }, [deleteQuoteId])

  // Pagination helpers
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)
  const startItem = total === 0 ? 0 : offset + 1
  const endItem = Math.min(offset + limit, total)

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit
    setOffset(newOffset)
    fetchQuotes(filters, newOffset, limit)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setOffset(0)
    fetchQuotes(filters, 0, newLimit)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Quotes Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage and review all customer quotes
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={isSyncing || isLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <svg
              className={`-ml-1 mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Sync
          </button>
          <button
            onClick={handleExport}
            disabled={quotes.length === 0}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <svg
              className="-ml-1 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <QuoteFilters
        onFilterChange={handleFilterChange}
        initialStatus={filters.status}
        initialSearch={filters.search}
        initialFrom={filters.from}
        initialTo={filters.to}
      />

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quote ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lines
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading && quotes.length === 0 ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-6 py-4">
                      <div className="animate-pulse flex space-x-4">
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : quotes.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No quotes found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Try adjusting your filters or create a new quote.
                    </p>
                  </td>
                </tr>
              ) : (
                // Quote rows
                quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/quotes/${quote.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {formatQuoteId(quote.id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {truncate(quote.customer_name, 30)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {truncate(quote.customer_email, 30)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        0
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(quote.total, quote.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={quote.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span title={formatFullTimestamp(quote.created_at)}>
                        {formatRelativeTime(quote.created_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => router.push(`/admin/quotes/${quote.id}`)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View"
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
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>
                        {userRole === 'ADMIN' && quote.status === 'draft' && (
                          <button
                            onClick={() => setDeleteQuoteId(quote.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
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
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div className="flex gap-4 items-center">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startItem}</span> to{' '}
                  <span className="font-medium">{endItem}</span> of{' '}
                  <span className="font-medium">{total}</span> quotes
                </p>
                <select
                  value={limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                  className="border border-gray-300 rounded-md text-sm px-2 py-1"
                >
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === pageNum
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteQuoteId !== null}
        title="Delete Quote"
        message="Are you sure you want to delete this quote? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteQuoteId(null)}
      />
    </div>
  )
}
