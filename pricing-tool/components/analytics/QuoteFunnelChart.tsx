'use client'

import { QuoteFunnelData } from '@/lib/analytics/metrics'

interface QuoteFunnelChartProps {
  data: QuoteFunnelData[] | null
  loading?: boolean
}

export default function QuoteFunnelChart({
  data,
  loading = false
}: QuoteFunnelChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Quote Conversion Funnel</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          Loading...
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Quote Conversion Funnel</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No data available
        </div>
      </div>
    )
  }

  // Calculate max count for scaling
  const maxCount = Math.max(...data.map((d) => d.count || 0))
  const barWidth = 100 / data.length - 2

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Quote Conversion Funnel</h3>

      <div className="space-y-6">
        {/* Bar chart */}
        <div className="space-y-4">
          {data.map((stage, index) => {
            const percentage = (stage.count / maxCount) * 100
            return (
              <div key={index}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {stage.stage}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {stage.count}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-400 to-blue-600 h-full flex items-center justify-end pr-2 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  >
                    {percentage > 15 && (
                      <span className="text-xs font-bold text-white">
                        {stage.conversion_rate}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary table */}
        <div className="border-t pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold text-gray-700">
                  Stage
                </th>
                <th className="text-right py-2 font-semibold text-gray-700">
                  Count
                </th>
                <th className="text-right py-2 font-semibold text-gray-700">
                  Conversion Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((stage, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-2 text-gray-700">{stage.stage}</td>
                  <td className="py-2 text-right text-gray-900 font-medium">
                    {stage.count}
                  </td>
                  <td className="py-2 text-right text-gray-900 font-medium">
                    {stage.conversion_rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
