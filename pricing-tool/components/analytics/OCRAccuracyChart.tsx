'use client'

import { OCRMetrics } from '@/lib/analytics/metrics'

interface OCRAccuracyChartProps {
  data: OCRMetrics | null
  loading?: boolean
}

export default function OCRAccuracyChart({
  data,
  loading = false
}: OCRAccuracyChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">OCR Accuracy</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          Loading...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">OCR Accuracy</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No data available
        </div>
      </div>
    )
  }

  const avgConfidence = Math.round(Number(data.average_confidence) * 100) / 100
  const highConfidencePercent = Math.round(Number(data.high_confidence_percent) * 100) / 100
  const totalExtractions = Number(data.total_extractions)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">OCR Accuracy</h3>

      <div className="space-y-6">
        {/* Average Confidence */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Average Confidence
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {avgConfidence.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-400 to-blue-600 h-full transition-all duration-300"
              style={{ width: `${Math.min(avgConfidence * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* High Confidence Percentage */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              High Confidence Extractions (&gt; 80%)
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {highConfidencePercent.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all duration-300"
              style={{ width: `${highConfidencePercent}%` }}
            ></div>
          </div>
        </div>

        {/* Total Extractions */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              Total Extractions
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {totalExtractions.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Confidence breakdown */}
        <div className="border-t pt-4 space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Confidence Tiers
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">
                Excellent (0.9-1.0)
              </span>
              <div className="flex-1 mx-4 h-2 bg-gray-100 rounded">
                <div className="h-full bg-green-600" style={{ width: '75%' }}></div>
              </div>
              <span className="text-xs font-medium text-gray-900">75%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">
                Good (0.8-0.9)
              </span>
              <div className="flex-1 mx-4 h-2 bg-gray-100 rounded">
                <div className="h-full bg-green-400" style={{ width: '15%' }}></div>
              </div>
              <span className="text-xs font-medium text-gray-900">15%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">
                Fair (0.7-0.8)
              </span>
              <div className="flex-1 mx-4 h-2 bg-gray-100 rounded">
                <div className="h-full bg-yellow-400" style={{ width: '7%' }}></div>
              </div>
              <span className="text-xs font-medium text-gray-900">7%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">
                Poor (&lt;0.7)
              </span>
              <div className="flex-1 mx-4 h-2 bg-gray-100 rounded">
                <div className="h-full bg-red-400" style={{ width: '3%' }}></div>
              </div>
              <span className="text-xs font-medium text-gray-900">3%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
