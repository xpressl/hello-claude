'use client'

import { useState, useEffect } from 'react'
import { computeTotal, applyMarkup, formatMoney } from '@/lib/pricing'

interface CalculatorProps {
  unitPrice: number
  unitType: string
  defaultQty?: number
  defaultMarkup?: number
}

export default function Calculator({
  unitPrice,
  unitType,
  defaultQty = 1,
  defaultMarkup = 0,
}: CalculatorProps) {
  const [qty, setQty] = useState(defaultQty)
  const [markupPct, setMarkupPct] = useState(defaultMarkup)
  const [copied, setCopied] = useState(false)

  // Calculate values
  const cost = computeTotal(unitPrice, qty)
  const { price: sellingPrice, profit, marginPct } = applyMarkup(cost, markupPct)

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopy = async () => {
    const text = `Quantity: ${qty} ${unitType}
Unit Price: ${formatMoney(unitPrice)}
Cost: ${formatMoney(cost)}
Markup: ${markupPct}%
Selling Price: ${formatMoney(sellingPrice)}
Profit: ${formatMoney(profit)}
Margin: ${marginPct}%`

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Price Calculator</h3>

      {/* Quantity Input */}
      <div>
        <label htmlFor="qty-input" className="block text-sm font-medium text-gray-700 mb-1">
          Quantity ({unitType})
        </label>
        <input
          id="qty-input"
          type="number"
          min="0"
          step="0.01"
          value={qty}
          onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Quantity"
        />
      </div>

      {/* Markup Input */}
      <div>
        <label htmlFor="markup-input" className="block text-sm font-medium text-gray-700 mb-1">
          Markup (%)
        </label>
        <input
          id="markup-input"
          type="number"
          min="0"
          max="1000"
          step="0.1"
          value={markupPct}
          onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Markup percentage"
        />
      </div>

      {/* Results */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Unit Price:</span>
          <span className="font-medium text-gray-900">{formatMoney(unitPrice)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Cost:</span>
          <span className="font-semibold text-lg text-gray-900">{formatMoney(cost)}</span>
        </div>

        <div className="flex justify-between items-center text-blue-600">
          <span className="text-sm font-medium">Selling Price:</span>
          <span className="font-bold text-2xl">{formatMoney(sellingPrice)}</span>
        </div>

        <div className="flex justify-between items-center text-green-600">
          <span className="text-sm">Profit:</span>
          <span className="font-semibold">{formatMoney(profit)}</span>
        </div>

        <div className="flex justify-between items-center text-green-600">
          <span className="text-sm">Margin:</span>
          <span className="font-semibold">{marginPct}%</span>
        </div>
      </div>

      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="Copy pricing details"
      >
        {copied ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Copied!
          </span>
        ) : (
          'Copy Details'
        )}
      </button>
    </div>
  )
}
