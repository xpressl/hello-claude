"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Decimal from "decimal.js"
import { QuoteDraft, QuoteLineDraft, ValidationErrors } from "@/lib/types"
import { saveDraftToIndexedDB, getMostRecentDraft } from "@/lib/quote-draft"
import { Product } from "@/lib/dexie"
import ContactForm from "@/components/ContactForm"
import ProductSearchAutocomplete from "@/components/ProductSearchAutocomplete"
import QuoteLineItem from "@/components/QuoteLineItem"
import QuoteSummary from "@/components/QuoteSummary"

export default function NewQuotePage() {
  const router = useRouter()
  const [quote, setQuote] = useState<QuoteDraft>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    lines: []
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showToast, setShowToast] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load most recent draft on mount
  useEffect(() => {
    async function loadDraft() {
      try {
        const recentDraft = await getMostRecentDraft()
        if (recentDraft) {
          setQuote(recentDraft)
        }
      } catch (error) {
        // Ignore errors, start with empty quote
      } finally {
        setIsLoading(false)
      }
    }
    loadDraft()
  }, [])

  // Auto-save to IndexedDB every 30 seconds
  useEffect(() => {
    if (isLoading) return

    const timer = setInterval(async () => {
      if (quote.lines.length > 0 || quote.customer_name || quote.customer_email) {
        try {
          await saveDraftToIndexedDB(quote)
        } catch (error) {
          // Silent fail for auto-save
        }
      }
    }, 30000)

    return () => clearInterval(timer)
  }, [quote, isLoading])

  // Show toast message
  const toast = (message: string) => {
    setShowToast(message)
    setTimeout(() => setShowToast(null), 3000)
  }

  // Handle contact form changes
  const handleContactChange = (field: 'customer_name' | 'customer_email' | 'customer_phone', value: string) => {
    setQuote(prev => ({ ...prev, [field]: value }))
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // Validate contact field on blur
  const handleContactBlur = (field: 'customer_name' | 'customer_email') => {
    const newErrors: ValidationErrors = { ...errors }

    if (field === 'customer_name') {
      if (!quote.customer_name || quote.customer_name.length < 2) {
        newErrors.customer_name = 'Name must be at least 2 characters'
      } else {
        delete newErrors.customer_name
      }
    }

    if (field === 'customer_email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!quote.customer_email) {
        newErrors.customer_email = 'Email is required'
      } else if (!emailRegex.test(quote.customer_email)) {
        newErrors.customer_email = 'Please enter a valid email address'
      } else {
        delete newErrors.customer_email
      }
    }

    setErrors(newErrors)
  }

  // Calculate extended price for a line
  const calculateExtendedPrice = (quantity: number, unitPrice: number): number => {
    return new Decimal(quantity).times(unitPrice).toDecimalPlaces(2).toNumber()
  }

  // Handle product selection from autocomplete
  const handleProductSelect = (product: Product) => {
    const newLine: QuoteLineDraft = {
      catalog_item_id: product.id,
      description: product.name,
      quantity: 1,
      unit: product.unit_type,
      unit_price: product.unit_price,
      extended_price: product.unit_price
    }
    setQuote(prev => ({ ...prev, lines: [...prev.lines, newLine] }))
    toast('Product added to quote')
  }

  // Handle adding manual line
  const handleAddManualLine = () => {
    const newLine: QuoteLineDraft = {
      description: '',
      quantity: 1,
      unit: 'EA',
      unit_price: 0,
      extended_price: 0
    }
    setQuote(prev => ({ ...prev, lines: [...prev.lines, newLine] }))
  }

  // Handle line change
  const handleLineChange = (index: number, field: keyof QuoteLineDraft, value: string | number) => {
    setQuote(prev => {
      const newLines = [...prev.lines]
      const line = { ...newLines[index] }

      if (field === 'quantity' || field === 'unit_price') {
        line[field] = typeof value === 'number' ? value : parseFloat(value as string) || 0
        line.extended_price = calculateExtendedPrice(line.quantity, line.unit_price)
      } else {
        // @ts-ignore - TypeScript doesn't handle this union well
        line[field] = value
      }

      newLines[index] = line
      return { ...prev, lines: newLines }
    })
  }

  // Handle duplicate line
  const handleDuplicateLine = (index: number) => {
    const lineToDuplicate = quote.lines[index]
    const duplicatedLine: QuoteLineDraft = {
      ...lineToDuplicate,
      id: undefined // Generate new ID
    }
    setQuote(prev => ({ ...prev, lines: [...prev.lines, duplicatedLine] }))
    toast('Line duplicated')
  }

  // Handle remove line
  const handleRemoveLine = (index: number) => {
    setQuote(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }))
    toast('Line removed')
  }

  // Handle save draft
  const handleSaveDraft = async () => {
    setIsSaving(true)
    try {
      const draftId = await saveDraftToIndexedDB(quote)
      toast('Draft saved successfully')
    } catch (error) {
      toast('Failed to save draft')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle submit quote
  const handleSubmit = async () => {
    // Validate
    const validationErrors: ValidationErrors = {}

    if (!quote.customer_name || quote.customer_name.length < 2) {
      validationErrors.customer_name = 'Name is required'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!quote.customer_email || !emailRegex.test(quote.customer_email)) {
      validationErrors.customer_email = 'Valid email is required'
    }

    if (quote.lines.length === 0) {
      toast('Please add at least one line item')
      return
    }

    if (quote.lines.some(line => line.quantity <= 0)) {
      toast('All quantities must be greater than 0')
      return
    }

    if (quote.lines.some(line => line.unit_price < 0)) {
      toast('Unit prices cannot be negative')
      return
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      toast('Please fix validation errors')
      return
    }

    setIsSubmitting(true)

    try {
      // Step 1: Create quote
      const quoteResponse = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: quote.customer_name,
          customer_email: quote.customer_email,
          customer_phone: quote.customer_phone || null
        })
      })

      if (!quoteResponse.ok) {
        throw new Error('Failed to create quote')
      }

      const createdQuote = await quoteResponse.json()
      const quoteId = createdQuote.id

      // Step 2: Add lines
      for (let i = 0; i < quote.lines.length; i++) {
        const line = quote.lines[i]
        const lineResponse = await fetch(`/api/quotes/${quoteId}/lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line_number: i + 1,
            catalog_item_id: line.catalog_item_id || null,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unit_price: line.unit_price,
            extended_price: line.extended_price,
            source: 'manual'
          })
        })

        if (!lineResponse.ok) {
          throw new Error(`Failed to add line ${i + 1}`)
        }
      }

      // Step 3: Submit quote
      const submitResponse = await fetch(`/api/quotes/${quoteId}/submit`, {
        method: 'POST'
      })

      if (!submitResponse.ok) {
        throw new Error('Failed to submit quote')
      }

      // Success! Redirect to success page
      router.push(`/quote/${quoteId}/success`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error. Please check your connection.'
      toast(errorMessage)
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Quote</h1>
              <p className="text-sm text-gray-600 mt-1">Build your custom quote line by line</p>
            </div>
            <a href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              ← Back to Home
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Contact & Lines */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <ContactForm
              name={quote.customer_name}
              email={quote.customer_email}
              phone={quote.customer_phone || ''}
              onChange={handleContactChange}
              errors={errors}
              onBlur={handleContactBlur}
            />

            {/* Product Search */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Add Products</h2>
              <ProductSearchAutocomplete onSelect={handleProductSelect} />
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Line Items</h2>
                <button
                  onClick={handleAddManualLine}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium"
                >
                  + Add Manual Line
                </button>
              </div>

              {quote.lines.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="font-medium">No line items yet</p>
                  <p className="text-sm mt-1">Search for products above or add a manual line</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit Price</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Extended</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.lines.map((line, index) => (
                          <QuoteLineItem
                            key={index}
                            line={line}
                            index={index}
                            onChange={handleLineChange}
                            onDuplicate={handleDuplicateLine}
                            onRemove={handleRemoveLine}
                            viewMode="table"
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {quote.lines.map((line, index) => (
                      <QuoteLineItem
                        key={index}
                        line={line}
                        index={index}
                        onChange={handleLineChange}
                        onDuplicate={handleDuplicateLine}
                        onRemove={handleRemoveLine}
                        viewMode="card"
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column - Summary (Sticky on desktop) */}
          <div className="lg:col-span-1">
            <QuoteSummary
              quote={quote}
              onSaveDraft={handleSaveDraft}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              errors={errors}
              isSaving={isSaving}
            />
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {showToast}
          </div>
        </div>
      )}
    </div>
  )
}
