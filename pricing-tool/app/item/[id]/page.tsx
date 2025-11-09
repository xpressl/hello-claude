"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Calculator from "@/components/Calculator"
import VoiceButton from "@/components/VoiceButton"
import { getLocalProduct } from "@/lib/sync"
import { parseVoiceQuery } from "@/lib/voice"
import { formatMoney } from "@/lib/pricing"
import type { LocalProduct } from "@/lib/dexie"

export default function ItemPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [product, setProduct] = useState<LocalProduct | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const result = await getLocalProduct(id)
        if (result) {
          setProduct(result)
        }
      } catch (err) {
        console.error("Failed to load product:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadProduct()
  }, [id])

  const handleVoiceText = (text: string) => {
    const parsed = parseVoiceQuery(text)
    // Voice input could be used for search or other features
    console.log("Voice input:", parsed)
  }

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
            onClick={() => router.push("/catalog")}
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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
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
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-gray-600 mt-1">SKU: {product.sku}</p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-600">
              {formatMoney(product.unit_price)}
            </span>
            <span className="text-gray-500">per {product.unit_type}</span>
          </div>
          {product.aliases && product.aliases.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.aliases.map((alias, i) => (
                <span key={i} className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {alias}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Voice Input */}
        <div className="mb-6 flex gap-2">
          <VoiceButton onText={handleVoiceText} />
        </div>

        {/* Calculator */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Price Calculator</h2>
          <Calculator unitPrice={product.unit_price} unitLabel={product.unit_type} />
        </div>
      </div>
    </div>
  )
}
