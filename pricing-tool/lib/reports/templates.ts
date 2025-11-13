/**
 * Report Templates
 * Defines standard report configurations with metrics, recipients, and schedules
 */

export interface ReportTemplate {
  id: string
  name: string
  description: string
  schedule: 'daily' | 'weekly' | 'monthly' | 'manual'
  metrics: string[]
  recipients: string[]
  includeCharts: boolean
  format: 'pdf' | 'csv' | 'html'
}

export interface DateRange {
  start: Date
  end: Date
}

export const reportTemplates: Record<string, ReportTemplate> = {
  daily_summary: {
    id: 'daily_summary',
    name: 'Daily Summary',
    description: 'Daily summary of quotes, conversions, and revenue',
    schedule: 'daily',
    metrics: [
      'quotes_created',
      'quotes_sent',
      'quotes_accepted',
      'revenue_generated',
      'conversion_rate'
    ],
    recipients: ['sales@company.com'],
    includeCharts: false,
    format: 'pdf'
  },

  weekly_performance: {
    id: 'weekly_performance',
    name: 'Weekly Performance',
    description: 'Weekly performance analysis with trends and margins',
    schedule: 'weekly',
    metrics: [
      'conversion_rate',
      'avg_quote_value',
      'total_revenue',
      'margin_analysis',
      'revenue_trend',
      'top_products'
    ],
    recipients: ['management@company.com'],
    includeCharts: true,
    format: 'pdf'
  },

  monthly_financial: {
    id: 'monthly_financial',
    name: 'Monthly Financial Report',
    description: 'Comprehensive monthly financial and operational report',
    schedule: 'monthly',
    metrics: [
      'total_quotes',
      'total_revenue',
      'total_margin',
      'avg_quote_value',
      'conversion_funnel',
      'margin_by_product',
      'top_customers',
      'ocr_accuracy'
    ],
    recipients: ['finance@company.com', 'ceo@company.com'],
    includeCharts: true,
    format: 'pdf'
  },

  sales_pipeline: {
    id: 'sales_pipeline',
    name: 'Sales Pipeline Report',
    description: 'Sales pipeline status and conversion metrics',
    schedule: 'weekly',
    metrics: [
      'quotes_by_status',
      'conversion_funnel',
      'average_days_to_conversion',
      'revenue_pipeline',
      'top_opportunities'
    ],
    recipients: ['sales@company.com'],
    includeCharts: true,
    format: 'pdf'
  },

  ocr_performance: {
    id: 'ocr_performance',
    name: 'OCR Performance Report',
    description: 'Document processing and OCR accuracy metrics',
    schedule: 'weekly',
    metrics: [
      'total_documents_processed',
      'ocr_accuracy',
      'extraction_confidence',
      'processing_time_avg',
      'error_rate'
    ],
    recipients: ['operations@company.com'],
    includeCharts: true,
    format: 'pdf'
  }
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): ReportTemplate | null {
  return reportTemplates[id] || null
}

/**
 * Get all templates
 */
export function getAllTemplates(): ReportTemplate[] {
  return Object.values(reportTemplates)
}

/**
 * Get templates by schedule
 */
export function getTemplatesBySchedule(
  schedule: 'daily' | 'weekly' | 'monthly' | 'manual'
): ReportTemplate[] {
  return Object.values(reportTemplates).filter(
    (template) => template.schedule === schedule
  )
}

/**
 * Get available metrics for report builder
 */
export const availableMetrics = [
  { id: 'quotes_created', label: 'Quotes Created', category: 'Sales' },
  { id: 'quotes_sent', label: 'Quotes Sent', category: 'Sales' },
  { id: 'quotes_accepted', label: 'Quotes Accepted', category: 'Sales' },
  { id: 'quotes_declined', label: 'Quotes Declined', category: 'Sales' },
  { id: 'quotes_expired', label: 'Quotes Expired', category: 'Sales' },
  {
    id: 'conversion_rate',
    label: 'Conversion Rate',
    category: 'Performance'
  },
  {
    id: 'average_quote_value',
    label: 'Average Quote Value',
    category: 'Performance'
  },
  { id: 'total_revenue', label: 'Total Revenue', category: 'Financial' },
  { id: 'total_margin', label: 'Total Margin', category: 'Financial' },
  {
    id: 'margin_by_product',
    label: 'Margin by Product',
    category: 'Financial'
  },
  {
    id: 'revenue_trend',
    label: 'Revenue Trend',
    category: 'Financial'
  },
  { id: 'ocr_accuracy', label: 'OCR Accuracy', category: 'Operations' },
  {
    id: 'total_documents_processed',
    label: 'Documents Processed',
    category: 'Operations'
  },
  {
    id: 'extraction_confidence',
    label: 'Extraction Confidence',
    category: 'Operations'
  },
  { id: 'top_products', label: 'Top Products', category: 'Products' },
  { id: 'top_customers', label: 'Top Customers', category: 'Customers' },
  {
    id: 'quotes_by_status',
    label: 'Quotes by Status',
    category: 'Sales'
  },
  {
    id: 'conversion_funnel',
    label: 'Conversion Funnel',
    category: 'Sales'
  }
]

/**
 * Calculate date range for scheduled reports
 */
export function getDateRangeForSchedule(
  schedule: 'daily' | 'weekly' | 'monthly'
): DateRange {
  const end = new Date()
  const start = new Date()

  switch (schedule) {
    case 'daily':
      // Yesterday
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
      break

    case 'weekly':
      // Last week (Monday to Sunday)
      const lastMonday = new Date(end)
      lastMonday.setDate(lastMonday.getDate() - lastMonday.getDay() - 6)
      lastMonday.setHours(0, 0, 0, 0)

      const lastSunday = new Date(lastMonday)
      lastSunday.setDate(lastSunday.getDate() + 6)
      lastSunday.setHours(23, 59, 59, 999)

      return { start: lastMonday, end: lastSunday }

    case 'monthly':
      // Last month
      start.setMonth(start.getMonth() - 1)
      start.setDate(1)
      start.setHours(0, 0, 0, 0)

      end.setDate(0) // Last day of previous month
      end.setHours(23, 59, 59, 999)
      break
  }

  return { start, end }
}
