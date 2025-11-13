/**
 * Report Generation
 * Generates reports in various formats (HTML, PDF, CSV)
 */

import {
  ReportTemplate,
  DateRange,
  getDateRangeForSchedule,
  availableMetrics
} from './templates'
import {
  getQuoteFunnel,
  getRevenueMetrics,
  getOCRMetrics,
  getTotalQuotes,
  getConversionRate,
  getRevenueTrend,
  getQuotesByStatus,
  getMarginByProduct
} from '@/lib/analytics/metrics'

export interface GeneratedReport {
  templateId: string
  templateName: string
  dateRange: DateRange
  data: Record<string, any>
  html: string
  generatedAt: Date
}

/**
 * Fetch data for a specific metric
 */
async function fetchMetricData(
  metricId: string,
  dateRange: DateRange
): Promise<any> {
  const startDate = dateRange.start.toISOString()
  const endDate = dateRange.end.toISOString()

  switch (metricId) {
    case 'quotes_created':
      return { count: await getTotalQuotes(startDate, endDate) }

    case 'conversion_rate':
      return { rate: await getConversionRate(startDate, endDate) }

    case 'average_quote_value':
    case 'total_revenue':
    case 'total_margin':
      const revenue = await getRevenueMetrics(startDate, endDate)
      if (metricId === 'average_quote_value')
        return { value: revenue.average_quote_value }
      if (metricId === 'total_revenue')
        return { value: revenue.total_revenue }
      if (metricId === 'total_margin') return { value: revenue.total_margin }

    case 'conversion_funnel':
      return { funnel: await getQuoteFunnel(startDate, endDate) }

    case 'revenue_trend':
      return { trend: await getRevenueTrend(startDate, endDate) }

    case 'quotes_by_status':
      return { statuses: await getQuotesByStatus(startDate, endDate) }

    case 'margin_by_product':
      return { products: await getMarginByProduct(startDate, endDate) }

    case 'ocr_accuracy':
      return await getOCRMetrics()

    default:
      return {}
  }
}

/**
 * Fetch all data for a report
 */
export async function fetchReportData(
  metrics: string[],
  dateRange: DateRange
): Promise<Record<string, any>> {
  const data: Record<string, any> = {}

  for (const metric of metrics) {
    try {
      data[metric] = await fetchMetricData(metric, dateRange)
    } catch (error) {
      console.error(`Error fetching metric ${metric}:`, error)
      data[metric] = null
    }
  }

  return data
}

/**
 * Generate HTML for a report section
 */
function generateSectionHTML(
  title: string,
  data: any
): string {
  if (!data || Object.keys(data).length === 0) {
    return ''
  }

  let html = `<div style="page-break-inside: avoid; margin-bottom: 30px;">
    <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">${title}</h2>`

  // Handle different data types
  if (Array.isArray(data)) {
    html += generateTableHTML(data)
  } else if (typeof data === 'object') {
    html += generateTableHTML([data])
  } else {
    html += `<p style="color: #374151; font-size: 16px;">${data}</p>`
  }

  html += '</div>'
  return html
}

/**
 * Generate table HTML from data
 */
function generateTableHTML(data: any[]): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '<p style="color: #6b7280;">No data available</p>'
  }

  const headers = Object.keys(data[0])

  let html = `<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
    <thead>
      <tr style="background-color: #f3f4f6;">`

  headers.forEach((header) => {
    html += `<th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600; color: #1f2937;">${header}</th>`
  })

  html += '</tr></thead><tbody>'

  data.forEach((row, rowIndex) => {
    html += `<tr style="background-color: ${rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'}">`
    headers.forEach((header) => {
      let value = row[header]
      if (typeof value === 'number') {
        if (header.toLowerCase().includes('rate') || header.toLowerCase().includes('percent')) {
          value = `${value.toFixed(2)}%`
        } else if (header.toLowerCase().includes('revenue') || header.toLowerCase().includes('margin')) {
          value = `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        }
      }
      html += `<td style="padding: 10px; border: 1px solid #e5e7eb; color: #374151;">${value}</td>`
    })
    html += '</tr>'
  })

  html += '</tbody></table>'
  return html
}

/**
 * Generate report HTML
 */
export async function generateReportHTML(
  template: ReportTemplate,
  data: Record<string, any>
): Promise<string> {
  const metricLabels = availableMetrics.reduce(
    (acc, metric) => {
      acc[metric.id] = metric.label
      return acc
    },
    {} as Record<string, string>
  )

  let html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${template.name}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
        color: #1f2937;
        line-height: 1.6;
        padding: 40px;
        background-color: #f9fafb;
      }
      .container { max-width: 900px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
      .header {
        border-bottom: 3px solid #3b82f6;
        margin-bottom: 40px;
        padding-bottom: 20px;
      }
      .header h1 { color: #1f2937; font-size: 32px; margin-bottom: 10px; }
      .header p { color: #6b7280; font-size: 14px; }
      .meta {
        background-color: #f3f4f6;
        padding: 15px;
        border-radius: 4px;
        margin-bottom: 30px;
        font-size: 13px;
        color: #4b5563;
      }
      .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
      .meta-row:last-child { margin-bottom: 0; }
      .content { margin-bottom: 40px; }
      .footer {
        margin-top: 50px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 12px;
        text-align: center;
      }
      @media print {
        body { background-color: white; }
        .container { box-shadow: none; padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${template.name}</h1>
        <p>${template.description}</p>
      </div>

      <div class="meta">
        <div class="meta-row">
          <span><strong>Generated:</strong> ${new Date().toLocaleString()}</span>
          <span><strong>Period:</strong> ${new Date(template.schedule === 'daily' ? Date.now() - 24 * 60 * 60 * 1000 : Date.now()).toLocaleDateString()} - ${new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div class="content">`

  // Generate sections for each metric
  for (const metricId of template.metrics) {
    const metricData = data[metricId]
    const metricLabel = metricLabels[metricId] || metricId

    if (metricData) {
      html += generateSectionHTML(metricLabel, metricData)
    }
  }

  html += `
      </div>

      <div class="footer">
        <p>This is an automated report generated by the Pricing Tool Analytics System</p>
      </div>
    </div>
  </body>
</html>`

  return html
}

/**
 * Generate full report
 */
export async function generateReport(
  template: ReportTemplate,
  dateRange?: DateRange
): Promise<GeneratedReport> {
  // Use provided date range or calculate from schedule
  const actualDateRange = dateRange || getDateRangeForSchedule(template.schedule)

  // Fetch data
  const reportData = await fetchReportData(template.metrics, actualDateRange)

  // Generate HTML
  const html = await generateReportHTML(template, reportData)

  return {
    templateId: template.id,
    templateName: template.name,
    dateRange: actualDateRange,
    data: reportData,
    html,
    generatedAt: new Date()
  }
}

/**
 * Export report to CSV
 */
export function reportToCSV(report: GeneratedReport): string {
  const lines: string[] = [
    `Report: ${report.templateName}`,
    `Generated: ${report.generatedAt.toLocaleString()}`,
    `Period: ${report.dateRange.start.toLocaleDateString()} - ${report.dateRange.end.toLocaleDateString()}`,
    ''
  ]

  for (const [metricId, metricData] of Object.entries(report.data)) {
    if (!metricData) continue

    lines.push(`${metricId}:`)

    if (Array.isArray(metricData)) {
      if (metricData.length > 0 && typeof metricData[0] === 'object') {
        const headers = Object.keys(metricData[0])
        lines.push(headers.join(','))
        metricData.forEach((row) => {
          lines.push(headers.map((h) => row[h]).join(','))
        })
      }
    } else if (typeof metricData === 'object') {
      const entries = Object.entries(metricData)
      entries.forEach(([key, value]) => {
        lines.push(`${key},${value}`)
      })
    }

    lines.push('')
  }

  return lines.join('\n')
}
