'use client'

import { useState } from 'react'
import { PricingResultV2 } from '@/lib/pricing/pricing-context-v2'

interface Scenario {
  product_id: string
  quantity: number
  price_list_id?: string
  customer_type?: string
  quote_date?: string
}

export function ScenarioTester() {
  const [scenario, setScenario] = useState<Scenario>({
    product_id: '',
    quantity: 1,
    customer_type: 'retail'
  })

  const [result, setResult] = useState<PricingResultV2 | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function testScenario() {
    if (!scenario.product_id) {
      setError('Please enter a product ID')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/pricing/test-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario)
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to calculate price')
      }

      const data = await res.json()
      setResult(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error calculating price')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Test Pricing Scenario</h3>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product ID
          </label>
          <input
            type="text"
            value={scenario.product_id}
            onChange={(e) => setScenario({ ...scenario, product_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Product ID or SKU"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            type="number"
            value={scenario.quantity}
            onChange={(e) => setScenario({ ...scenario, quantity: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer Type
          </label>
          <select
            value={scenario.customer_type || 'retail'}
            onChange={(e) => setScenario({ ...scenario, customer_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="retail">Retail</option>
            <option value="contractor">Contractor</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price List (optional)
          </label>
          <input
            type="text"
            value={scenario.price_list_id || ''}
            onChange={(e) => setScenario({ ...scenario, price_list_id: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Leave empty for auto-select"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={testScenario}
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
      >
        {loading ? 'Calculating...' : 'Calculate Price'}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Unit Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${result.unit_price.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Extended Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${result.extended_price.toFixed(2)}
                </p>
              </div>
            </div>

            {result.cost_basis && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-600">Margin Amount</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ${result.margin_amount?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Margin %</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {result.margin_percent?.toFixed(1) || '0'}%
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Rules Applied */}
          {result.rules_applied && result.rules_applied.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Applied Rules</h4>
              <div className="space-y-2">
                {result.rules_applied.map((rule) => (
                  <div key={rule.rule_id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{rule.rule_name}</span>
                    <span className="font-mono text-gray-600">
                      {rule.rule_type === 'percentage' ? '+' : ''}
                      {rule.adjustment > 0 ? '+' : ''}
                      {rule.rule_type === 'percentage'
                        ? `${(rule.adjustment / result.list_price * 100).toFixed(1)}%`
                        : `$${rule.adjustment.toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
              <h4 className="font-medium text-yellow-900 mb-2">Warnings</h4>
              <ul className="space-y-1">
                {result.warnings.map((warning, i) => (
                  <li key={i} className="text-sm text-yellow-800">• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Price Trace */}
          <details className="border rounded-lg p-4">
            <summary className="cursor-pointer font-medium text-gray-900">
              View Calculation Details
            </summary>
            <div className="mt-3 space-y-2">
              {result.trace.map((step) => (
                <div key={step.step} className="text-sm text-gray-600">
                  <div className="font-mono">
                    Step {step.step}: {step.description}
                  </div>
                  <div className="text-gray-500">
                    {step.calculation}
                  </div>
                  <div className="font-semibold text-gray-900">
                    Result: ${step.result.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
