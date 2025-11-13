'use client'

import { useEffect, useState } from 'react'
import { getRevenueTrend } from '@/lib/analytics/metrics'

interface RevenueTrendChartProps {
  dateRange: {
    start: Date
    end: Date
  }
}

interface TrendData {
  date: string
  revenue: number
  quotes: number
}

export default function RevenueTrendChart({
  dateRange
}: RevenueTrendChartProps) {
  const [data, setData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const startDate = dateRange.start.toISOString()
        const endDate = dateRange.end.toISOString()
        const trend = await getRevenueTrend(startDate, endDate)
        setData(trend)
      } catch (error) {
        console.error('Error fetching revenue trend:', error)
        setData([])
      }
      setLoading(false)
    }

    fetchData()
  }, [dateRange])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          Loading...
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No data available
        </div>
      </div>
    )
  }

  // Calculate max revenue for scaling
  const maxRevenue = Math.max(...data.map((d) => d.revenue || 0))
  const containerHeight = 250

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>

      <div className="space-y-4">
        {/* Chart area */}
        <div className="relative" style={{ height: `${containerHeight}px` }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-400 pr-2">
            <span>${(maxRevenue / 1000).toFixed(0)}k</span>
            <span>${(maxRevenue / 2 / 1000).toFixed(0)}k</span>
            <span>$0</span>
          </div>

          {/* Grid lines */}
          <div className="absolute left-12 right-0 top-0 h-full flex flex-col justify-between border-l border-gray-200">
            <div className="w-full border-t border-gray-100"></div>
            <div className="w-full border-t border-gray-100"></div>
            <div className="w-full border-t border-gray-200"></div>
          </div>

          {/* Bars */}
          <div className="absolute left-12 right-0 h-full flex items-end justify-around gap-1 px-2">
            {data.map((point, index) => {
              const height = (point.revenue / maxRevenue) * 100
              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center relative group"
                >
                  <div
                    className="w-full bg-gradient-to-t from-green-400 to-green-600 rounded-t transition-all hover:from-green-500 hover:to-green-700 cursor-pointer"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      ${point.revenue.toLocaleString()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="ml-12 flex justify-around gap-1 text-xs text-gray-500 mt-2">
          {data.map((point, index) => (
            <div key={index} className="flex-1 text-center truncate">
              {point.date}
            </div>
          ))}
        </div>

        {/* Summary stats */}
        <div className="border-t pt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Revenue</p>
            <p className="text-lg font-semibold text-gray-900">
              ${data.reduce((sum, d) => sum + d.revenue, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg. Daily Revenue</p>
            <p className="text-lg font-semibold text-gray-900">
              ${(data.reduce((sum, d) => sum + d.revenue, 0) / data.length).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Quotes</p>
            <p className="text-lg font-semibold text-gray-900">
              {data.reduce((sum, d) => sum + d.quotes, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
