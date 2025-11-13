/**
 * Export utilities for CSV generation
 */

import type { Quote } from './types'
import { formatCurrency, formatQuoteId } from './format'

/**
 * Convert quotes to CSV and download
 */
export function exportQuotesToCSV(quotes: Quote[]): void {
  // Create CSV headers
  const headers = [
    'Quote ID',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Lines',
    'Subtotal',
    'Tax',
    'Total',
    'Status',
    'Created At',
    'Submitted At',
  ]

  // Create CSV rows
  const rows = quotes.map((quote) => {
    return [
      formatQuoteId(quote.id),
      quote.customer_name || '--',
      quote.customer_email || '--',
      quote.customer_phone || '--',
      '0', // Line count placeholder - would need to be passed or fetched
      formatCurrency(quote.subtotal, quote.currency),
      formatCurrency(quote.tax, quote.currency),
      formatCurrency(quote.total, quote.currency),
      quote.status,
      new Date(quote.created_at).toLocaleString(),
      quote.submitted_at ? new Date(quote.submitted_at).toLocaleString() : '--',
    ]
  })

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
  ].join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  const timestamp = new Date().toISOString().split('T')[0]
  link.setAttribute('href', url)
  link.setAttribute('download', `quotes-export-${timestamp}.csv`)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up the URL
  URL.revokeObjectURL(url)
}

/**
 * Escape a CSV cell value
 * - Wraps in quotes if it contains comma, quote, or newline
 * - Escapes quotes by doubling them
 */
function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Convert an array of objects to CSV
 * Generic version for any data type
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columnMapping?: Record<keyof T, string>
): void {
  if (data.length === 0) {
    console.warn('No data to export')
    return
  }

  // Get headers from first object
  const keys = Object.keys(data[0]) as (keyof T)[]
  const headers = keys.map((key) => (columnMapping?.[key] || String(key)))

  // Create CSV rows
  const rows = data.map((item) => {
    return keys.map((key) => {
      const value = item[key]
      if (value === null || value === undefined) return '--'
      return String(value)
    })
  })

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
  ].join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
