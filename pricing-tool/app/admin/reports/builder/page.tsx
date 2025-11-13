'use client'

import { useState } from 'react'
import DateRangePicker, { DateRange } from '@/components/DateRangePicker'
import { availableMetrics, getAllTemplates } from '@/lib/reports/templates'
import { generateReport, reportToCSV } from '@/lib/reports/generate-report'
import { exportToCSV } from '@/lib/export-csv'

// Force dynamic rendering - this page uses Supabase
export const dynamic = 'force-dynamic'

export default function ReportBuilderPage() {
  const [selectedTemplate, setSelectedTemplate] = useState('daily_summary')
  const [customMetrics, setCustomMetrics] = useState<string[]>(['quotes_created', 'conversion_rate', 'total_revenue'])
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  })
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [reportName, setReportName] = useState('Custom Report')
  const [preview, setPreview] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [useTemplate, setUseTemplate] = useState(true)

  const templates = getAllTemplates()

  const toggleMetric = (metricId: string) => {
    setCustomMetrics((prev) =>
      prev.includes(metricId)
        ? prev.filter((m) => m !== metricId)
        : [...prev, metricId]
    )
  }

  const handleGenerateReport = async () => {
    setLoading(true)
    try {
      // Find template if using template, otherwise create custom template
      const template = useTemplate
        ? templates.find((t) => t.id === selectedTemplate)
        : {
          id: 'custom',
          name: reportName,
          description: 'Custom Report',
          schedule: 'manual' as const,
          metrics: customMetrics,
          recipients: [],
          includeCharts: false,
          format: 'html' as const
        }

      if (template) {
        const report = await generateReport(template, dateRange)
        setPreview(report.html)
      }
    } catch (error) {
      console.error('Error generating report:', error)
      setPreview('<div>Error generating report</div>')
    }
    setLoading(false)
  }

  const handleExportCSV = async () => {
    try {
      const template = useTemplate
        ? templates.find((t) => t.id === selectedTemplate)
        : {
          id: 'custom',
          name: reportName,
          description: 'Custom Report',
          schedule: 'manual' as const,
          metrics: customMetrics,
          recipients: [],
          includeCharts: false,
          format: 'csv' as const
        }

      if (template) {
        const report = await generateReport(template, dateRange)
        const csv = reportToCSV(report)
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${reportName}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error exporting CSV:', error)
    }
  }

  const handleExportPDF = async () => {
    if (!preview) {
      alert('Please generate a report first')
      return
    }

    try {
      // For MVP, we'll open the print dialog
      // In production, you'd use a library like html2pdf or puppeteer
      const printWindow = window.open('', '', 'width=800,height=600')
      if (printWindow) {
        printWindow.document.write(preview)
        printWindow.document.close()
        printWindow.print()
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
    }
  }

  const getMetricsByCategory = () => {
    const categories: Record<string, typeof availableMetrics> = {}
    availableMetrics.forEach((metric) => {
      if (!categories[metric.category]) {
        categories[metric.category] = []
      }
      categories[metric.category].push(metric)
    })
    return categories
  }

  const metricsByCategory = getMetricsByCategory()

  return (
    <main className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Report Builder</h1>
          <p className="text-gray-600 text-sm mt-1">
            Create and customize your analytics reports
          </p>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="lg:col-span-1 space-y-6">
            {/* Template Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4 flex items-center">
                <input
                  type="radio"
                  checked={useTemplate}
                  onChange={() => setUseTemplate(true)}
                  className="mr-2"
                />
                Use Template
              </h3>

              {useTemplate && (
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Custom Configuration */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4 flex items-center">
                <input
                  type="radio"
                  checked={!useTemplate}
                  onChange={() => setUseTemplate(false)}
                  className="mr-2"
                />
                Custom Report
              </h3>

              {!useTemplate && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Report Name
                    </label>
                    <input
                      type="text"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="My Custom Report"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Date Range
              </label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            {/* Group By */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Group By
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleGenerateReport}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </button>

              {preview && (
                <>
                  <button
                    onClick={handleExportPDF}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                  >
                    Export PDF
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    Export CSV
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: Metrics Selection & Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metrics Selection */}
            {!useTemplate && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">Select Metrics</h3>

                <div className="space-y-4">
                  {Object.entries(metricsByCategory).map(([category, metrics]) => (
                    <div key={category}>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {metrics.map((metric) => (
                          <label
                            key={metric.id}
                            className="flex items-center p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={customMetrics.includes(metric.id)}
                              onChange={() => toggleMetric(metric.id)}
                              className="rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">
                              {metric.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">Preview</h3>
                <div className="border border-gray-200 rounded-lg p-4 h-96 overflow-auto bg-gray-50">
                  <iframe
                    srcDoc={preview}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="Report Preview"
                  />
                </div>
              </div>
            )}

            {!preview && (
              <div className="bg-white rounded-lg shadow p-6 h-96 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">No report generated</p>
                  <p className="text-sm">
                    Configure your report and click "Generate Report" to see a preview
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
