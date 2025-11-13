'use client'

/**
 * PriceTraceViewer Component
 *
 * Displays detailed price calculation traces for admin audit purposes.
 * Shows each step of the pricing calculation with formulas and results.
 */

import React from 'react'
import { PriceTrace } from '@/lib/types'

interface PriceTraceViewerProps {
  trace: PriceTrace[]
  title?: string
  className?: string
  compact?: boolean
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Format calculation string with currency symbols
 */
function formatCalculation(calculation: string): string {
  // Replace numbers with currency formatting where appropriate
  return calculation.replace(/(\d+\.?\d*)/g, (match) => {
    const num = parseFloat(match)
    if (!isNaN(num) && num >= 0.01) {
      return formatCurrency(num)
    }
    return match
  })
}

/**
 * PriceTraceViewer - Display price calculation audit trail
 */
export default function PriceTraceViewer({
  trace,
  title = 'Price Calculation Trace',
  className = '',
  compact = false
}: PriceTraceViewerProps) {
  if (!trace || trace.length === 0) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${className}`}>
        <p className="text-sm text-gray-500">No price trace available</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="p-3 space-y-1">
          {trace.map((step) => (
            <div key={step.step} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{step.description}</span>
              <span className="font-mono font-semibold text-gray-900">
                {formatCurrency(step.result)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border border-gray-300 bg-white shadow-sm ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">
          Detailed audit trail showing how the price was calculated
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {trace.map((step, index) => {
            const isFirst = index === 0
            const isLast = index === trace.length - 1

            return (
              <div
                key={step.step}
                className={`border-l-4 pl-4 ${
                  isFirst
                    ? 'border-blue-500'
                    : isLast
                    ? 'border-green-500'
                    : 'border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                          isFirst
                            ? 'bg-blue-100 text-blue-800'
                            : isLast
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {step.step}
                      </span>
                      <h4 className="text-sm font-semibold text-gray-900">
                        {step.description}
                      </h4>
                    </div>

                    <div className="mt-2 ml-9">
                      <code className="block px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono text-gray-800 overflow-x-auto">
                        {step.calculation}
                      </code>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <div
                      className={`text-right px-3 py-1 rounded ${
                        isFirst
                          ? 'bg-blue-50'
                          : isLast
                          ? 'bg-green-50'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="text-xs text-gray-600 font-medium">Result</div>
                      <div
                        className={`text-lg font-semibold font-mono ${
                          isFirst
                            ? 'text-blue-900'
                            : isLast
                            ? 'text-green-900'
                            : 'text-gray-900'
                        }`}
                      >
                        {formatCurrency(step.result)}
                      </div>
                    </div>
                  </div>
                </div>

                {!isLast && (
                  <div className="ml-9 mt-3 flex items-center gap-2 text-gray-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                    <span className="text-xs">Next step</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total calculation steps: {trace.length}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Final Price:</span>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(trace[trace.length - 1].result)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline compact version for embedding in tables or cards
 */
export function PriceTraceCompact({ trace }: { trace: PriceTrace[] }) {
  return <PriceTraceViewer trace={trace} compact={true} className="w-full" />
}

/**
 * Price trace summary - just shows first and last step
 */
export function PriceTraceSummary({ trace }: { trace: PriceTrace[] }) {
  if (!trace || trace.length === 0) {
    return null
  }

  const firstStep = trace[0]
  const lastStep = trace[trace.length - 1]

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-600">Base:</span>
        <span className="font-mono font-semibold text-gray-900">
          {formatCurrency(firstStep.result)}
        </span>
      </div>
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7l5 5m0 0l-5 5m5-5H6"
        />
      </svg>
      <div className="flex items-center gap-2">
        <span className="text-gray-600">Final:</span>
        <span className="font-mono font-semibold text-green-600">
          {formatCurrency(lastStep.result)}
        </span>
      </div>
      {trace.length > 2 && (
        <span className="text-xs text-gray-500">({trace.length - 2} adjustments)</span>
      )}
    </div>
  )
}
