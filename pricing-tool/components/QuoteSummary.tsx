"use client"

import { QuoteDraft, ValidationErrors } from "@/lib/types"
import { formatMoney } from "@/lib/pricing"

interface QuoteSummaryProps {
  quote: QuoteDraft
  onSaveDraft: () => void
  onSubmit: () => void
  isSubmitting: boolean
  errors: ValidationErrors
  isSaving?: boolean
}

export default function QuoteSummary({
  quote,
  onSaveDraft,
  onSubmit,
  isSubmitting,
  errors,
  isSaving = false
}: QuoteSummaryProps) {
  const lineCount = quote.lines.length
  const subtotal = quote.lines.reduce((sum, line) => sum + line.extended_price, 0)

  // Collect validation warnings
  const warnings: string[] = []
  if (!quote.customer_name || quote.customer_name.length < 2) {
    warnings.push('Customer name is required')
  }
  if (!quote.customer_email || !isValidEmail(quote.customer_email)) {
    warnings.push('Valid customer email is required')
  }
  if (lineCount === 0) {
    warnings.push('At least one line item is required')
  }
  if (quote.lines.some(line => line.quantity <= 0)) {
    warnings.push('All quantities must be greater than 0')
  }
  if (quote.lines.some(line => line.unit_price < 0)) {
    warnings.push('Unit prices cannot be negative')
  }

  const canSubmit = warnings.length === 0 && !isSubmitting

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
      <h2 className="text-xl font-bold mb-4">Quote Summary</h2>

      {/* Stats */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Line Items:</span>
          <span className="font-semibold">{lineCount}</span>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
          <span className="text-lg font-semibold">Subtotal:</span>
          <span className="text-xl font-bold text-green-700">{formatMoney(subtotal)}</span>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                Validation Issues ({warnings.length})
              </h3>
              <ul className="text-xs text-yellow-700 space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={onSaveDraft}
          disabled={isSaving}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : (
            'Save Draft'
          )}
        </button>

        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 transition-colors"
          aria-label="Submit quote"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </span>
          ) : (
            'Submit Quote'
          )}
        </button>
      </div>

      {/* Help Text */}
      {canSubmit && (
        <p className="text-xs text-green-600 mt-3 text-center">
          Ready to submit
        </p>
      )}
    </div>
  )
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
