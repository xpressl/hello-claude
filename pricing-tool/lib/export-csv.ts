/**
 * CSV Export Utility
 * Handles conversion of data to CSV format and triggering browser download
 */

/**
 * Convert array of objects to CSV string
 */
function convertToCSV(data: any[]): string {
  if (data.length === 0) return ''

  // Get all unique keys from all objects
  const keys = Array.from(
    new Set(data.flatMap((obj) => Object.keys(obj)))
  )

  // Create header row
  const headers = keys.join(',')

  // Create data rows
  const rows = data.map((obj) =>
    keys
      .map((key) => {
        const value = obj[key]

        // Handle null/undefined
        if (value === null || value === undefined) {
          return ''
        }

        // Convert objects/arrays to JSON string
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`
        }

        // Quote strings that contain commas, quotes, or newlines
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }

        return stringValue
      })
      .join(',')
  )

  return [headers, ...rows].join('\n')
}

/**
 * Export data to CSV file
 */
export function exportToCSV(data: any[], filename: string) {
  const csv = convertToCSV(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
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

/**
 * Export metrics data to CSV
 */
export function exportMetricsToCSV(
  funnel: any[],
  revenue: any,
  dateRange: { start: string; end: string }
) {
  const timestamp = new Date().toISOString().split('T')[0]

  // Create a structured report
  const report = [
    ['Analytics Report'],
    [`Generated: ${new Date().toLocaleString()}`],
    [`Date Range: ${dateRange.start} to ${dateRange.end}`],
    [],
    ['Quote Conversion Funnel'],
    ...funnel.map((f) => [f.stage, f.count, `${f.conversion_rate}%`]),
    [],
    ['Revenue Metrics'],
    ['Total Revenue', revenue.total_revenue],
    ['Average Quote Value', revenue.average_quote_value],
    ['Accepted Quotes', revenue.accepted_quotes],
    ['Total Margin', revenue.total_margin]
  ]

  const csv = report.map((row) => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `analytics-report-${timestamp}.csv`)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Export table data to CSV
 */
export function exportTableToCSV(
  tableId: string,
  filename: string = 'export.csv'
) {
  const table = document.getElementById(tableId) as HTMLTableElement
  if (!table) {
    console.error(`Table with id "${tableId}" not found`)
    return
  }

  const rows = Array.from(table.querySelectorAll('tr'))
  const csv = rows
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'))
        .map((cell) => {
          const text = cell.textContent?.trim() || ''
          // Quote if contains comma, quote, or newline
          if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`
          }
          return text
        })
        .join(',')
    )
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
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
