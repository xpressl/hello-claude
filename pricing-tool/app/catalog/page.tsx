'use client'

import { useState, useEffect, useCallback } from 'react'
import SearchBox from '@/components/SearchBox'
import ProductCard from '@/components/ProductCard'
import VoiceButton from '@/components/VoiceButton'
import { searchLocalProducts, pullProducts, getLocalProductCount } from '@/lib/sync'
import { parseVoiceQuery } from '@/lib/voice'
import type { LocalProduct } from '@/lib/dexie'

export default function CatalogPage() {
  const [products, setProducts] = useState<LocalProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [productCount, setProductCount] = useState(0)

  // Initial sync and load
  useEffect(() => {
    const init = async () => {
      try {
        // Check if we have local data
        const count = await getLocalProductCount()
        setProductCount(count)

        if (count === 0) {
          // First time - sync from Supabase
          setIsSyncing(true)
          await pullProducts()
          const newCount = await getLocalProductCount()
          setProductCount(newCount)
        }

        // Load products
        const results = await searchLocalProducts('')
        setProducts(results)
      } catch (err) {
        console.error('Failed to load products:', err)
      } finally {
        setIsLoading(false)
        setIsSyncing(false)
      }
    }

    init()
  }, [])

  // Search products
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    try {
      const results = await searchLocalProducts(query)
      setProducts(results)
    } catch (err) {
      console.error('Search failed:', err)
    }
  }, [])

  // Handle voice input
  const handleVoiceTranscript = useCallback((text: string) => {
    const parsed = parseVoiceQuery(text)
    if (parsed.search) {
      setSearchQuery(parsed.search)
      handleSearch(parsed.search)
    }
  }, [handleSearch])

  // Manual sync
  const handleSync = useCallback(async () => {
    setIsSyncing(true)
    try {
      const count = await pullProducts()
      const results = await searchLocalProducts(searchQuery)
      setProducts(results)
      const newCount = await getLocalProductCount()
      setProductCount(newCount)
      alert(`Synced ${count} products`)
    } catch (err) {
      console.error('Sync failed:', err)
      alert('Sync failed. Please try again.')
    } finally {
      setIsSyncing(false)
    }
  }, [searchQuery])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-gray-600 mt-2">
            {productCount} product{productCount !== 1 ? 's' : ''} available offline
          </p>
        </div>

        {/* Search and Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 space-y-4">
          <div className="flex gap-4 flex-col sm:flex-row">
            <div className="flex-1">
              <SearchBox
                onSearch={handleSearch}
                defaultValue={searchQuery}
              />
            </div>
            <VoiceButton onTranscript={handleVoiceTranscript} />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {products.length} result{products.length !== 1 ? 's' : ''}
              {searchQuery && ` for "${searchQuery}"`}
            </p>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Sync products"
            >
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No products found</h3>
            <p className="mt-1 text-gray-500">
              {searchQuery
                ? 'Try a different search term'
                : 'Click "Sync" to load products from the server'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                sku={product.sku}
                name={product.name}
                unitType={product.unit_type}
                unitPrice={product.unit_price}
                aliases={product.aliases}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
