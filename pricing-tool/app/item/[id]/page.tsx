'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Calculator from '@/components/Calculator'
import VoiceButton from '@/components/VoiceButton'
import { getLocalProduct } from '@/lib/sync'
import { parseVoiceQuery } from '@/lib/voice'
import { formatMoney } from '@/lib/pricing'
import type { LocalProduct } from '@/lib/dexie'

export default function ItemPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [product, setProduct] = useState<LocalProduct | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [defaultQty, setDefaultQty] = useState(1)
  const [defaultMarkup, setDefaultMarkup] = useState(0)

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const result = await getLocalProduct(id)
        if (result) {
          setProduct(result)
        }
      } catch (err) {
        console.error('Failed to load product:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadProduct()
  }, [id])

  const handleVoiceTranscript = useCallback((text: string) => {
    const parsed = parseVoiceQuery(text)

    if (parsed.qty) {
      setDefaultQty(parsed.qty)
    }
    if (parsed.markupPct) {
      setDefaultMarkup(parsed.markupPct)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading product...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Product not found</h1>
          <p className="text-gray-600 mt-2">The product you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/catalog')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span>Back</span>
        </button>

        {/* Product Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
              <p className="text-gray-600 mt-2">
                SKU: <span className="font-mono font-semibold">{product.sku}</span>
              </p>
              {product.aliases && product.aliases.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="text-sm text-gray-600">Also known as:</span>
                  {product.aliases.map((alias, i) => (
                    <span
                      key={i}
                      className="inline-block text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full"
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-4xl font-bold text-blue-600">
                {formatMoney(product.unit_price)}
              </div>
              <div className="text-gray-500 mt-1">per {product.unit_type}</div>
            </div>
          </div>
        </div>

        {/* Voice Input */}
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium">
                  Try voice input for quick calculations
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Example: "12 pieces markup 20"
                </p>
              </div>
              <VoiceButton onTranscript={handleVoiceTranscript} />
            </div>
          </div>
        </div>

        {/* Calculator */}
        <Calculator
          unitPrice={product.unit_price}
          unitType={product.unit_type}
          defaultQty={defaultQty}
          defaultMarkup={defaultMarkup}
        />
      </div>
    </div>
  )
}
