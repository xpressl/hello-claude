'use client'

import { useEffect, useState } from 'react'
import DateRangePicker, { DateRange } from '@/components/DateRangePicker'
import MetricCard from '@/components/analytics/MetricCard'
import QuoteFunnelChart from '@/components/analytics/QuoteFunnelChart'
import RevenueTrendChart from '@/components/analytics/RevenueTrendChart'
import OCRAccuracyChart from '@/components/analytics/OCRAccuracyChart'
import MarginByCategoryChart from '@/components/analytics/MarginByCategoryChart'
import { exportMetricsToCSV } from '@/lib/export-csv'
import { AnalyticsMetrics } from '@/lib/analytics/metrics'

// Force dynamic rendering - this page uses Supabase
export const dynamic = 'force-dynamic'

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  })

  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/metrics?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`
        )
        const result = await response.json()

        if (result.success) {
          setMetrics(result.data)
        }
      } catch (error) {
        console.error('Error fetching metrics:', error)
      }
      setLoading(false)
    }

    fetchMetrics()
  }, [dateRange])

  const handleExportCSV = () => {
    if (metrics) {
      exportMetricsToCSV(metrics.funnel, metrics.revenue, {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString()
      })
    }
  }

  return (
    <main className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 text-sm mt-1">
              Track your business metrics and performance
            </p>
          </div>

          <div className="flex gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <button
              onClick={handleExportCSV}
              disabled={!metrics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-600">Loading metrics...</div>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Total Quotes"
                value={metrics?.totalQuotes || 0}
                trend={{ value: 12, isPositive: true }}
              />
              <MetricCard
                title="Conversion Rate"
                value={`${metrics?.conversionRate || 0}%`}
                trend={{ value: 5, isPositive: true }}
              />
              <MetricCard
                title="Total Revenue"
                value={`$${(metrics?.revenue?.total_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                trend={{ value: 18, isPositive: true }}
              />
              <MetricCard
                title="Avg Quote Value"
                value={`$${(metrics?.revenue?.average_quote_value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                trend={{ value: 3, isPositive: false }}
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <QuoteFunnelChart data={metrics?.funnel || null} />
              <RevenueTrendChart dateRange={dateRange} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OCRAccuracyChart data={metrics?.ocr || null} />
              <MarginByCategoryChart dateRange={dateRange} />
            </div>
          </>
        )}
      </div>
    </main>
  )
}
