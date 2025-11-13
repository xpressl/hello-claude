'use client'

import { useEffect, useState } from 'react'
import { getMarginByProduct } from '@/lib/analytics/metrics'

interface MarginData {
  productName: string
  totalRevenue: number
  totalMargin: number
  marginPercent: number
}

interface MarginByCategoryChartProps {
  dateRange?: {
    start: Date
    end: Date
  }
}

export default function MarginByCategoryChart({
  dateRange
}: MarginByCategoryChartProps) {
  const [data, setData] = useState<MarginData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        if (dateRange) {
          const startDate = dateRange.start.toISOString()
          const endDate = dateRange.end.toISOString()
          const margins = await getMarginByProduct(startDate, endDate)
          setData(margins.slice(0, 5)) // Top 5 products
        }
      } catch (error) {
        console.error('Error fetching margin data:', error)
        setData([])
      }
      setLoading(false)
    }

    fetchData()
  }, [dateRange])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Margin by Product</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          Loading...
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Margin by Product</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No data available
        </div>
      </div>
    )
  }

  // Calculate max margin for scaling
  const maxMargin = Math.max(...data.map((d) => d.totalMargin || 0))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Margin by Product</h3>

      <div className="space-y-4">
        {/* Horizontal bar chart */}
        {data.map((product, index) => {
          const percentage = (product.totalMargin / maxMargin) * 100
          const marginColor =
            product.marginPercent >= 30
              ? 'from-green-400 to-green-600'
              : product.marginPercent >= 20
              ? 'from-blue-400 to-blue-600'
              : 'from-orange-400 to-orange-600'

          return (
            <div key={index}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 truncate">
                  {product.productName}
                </span>
                <span className="text-sm font-semibold text-gray-900 ml-2">
                  {product.marginPercent.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded h-6 overflow-hidden">
                <div
                  className={`bg-gradient-to-r ${marginColor} h-full flex items-center px-2 transition-all duration-300 hover:shadow-md`}
                  style={{ width: `${percentage}%` }}
                >
                  {percentage > 10 && (
                    <span className="text-xs font-bold text-white">
                      ${product.totalMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Summary table */}
        <div className="border-t pt-4 mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold text-gray-700">
                  Product
                </th>
                <th className="text-right py-2 font-semibold text-gray-700">
                  Revenue
                </th>
                <th className="text-right py-2 font-semibold text-gray-700">
                  Margin
                </th>
                <th className="text-right py-2 font-semibold text-gray-700">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((product, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-2 text-gray-700 truncate">
                    {product.productName}
                  </td>
                  <td className="py-2 text-right text-gray-900 font-medium">
                    ${product.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 text-right text-gray-900 font-medium">
                    ${product.totalMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 text-right text-gray-900 font-medium">
                    {product.marginPercent.toFixed(1)}%
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
