"use client"

import { useState, useCallback, useEffect } from "react"
import { debounce } from "@/lib/utils"

interface SearchResult {
  product_id: string
  name: string
  sku: string
  description: string | null
  unit_price: number
  unit_type: string
  rank: number
  category_id: string | null
  is_primary: boolean | null
}

interface ProductSearchProps {
  onSelect?: (product: SearchResult) => void
  categoryId?: string
  showFilters?: boolean
}

export function ProductSearch({
  onSelect,
  categoryId,
  showFilters = true,
}: ProductSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    unit: "",
    category: categoryId || "",
  })

  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length === 0) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          limit: "20",
        })

        if (filters.category) {
          params.append("category", filters.category)
        }
        if (filters.minPrice) {
          params.append("minPrice", filters.minPrice)
        }
        if (filters.maxPrice) {
          params.append("maxPrice", filters.maxPrice)
        }
        if (filters.unit) {
          params.append("unit", filters.unit)
        }

        const response = await fetch(`/api/search?${params}`)
        const data = await response.json()

        if (data.results) {
          setResults(data.results)
        }
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setLoading(false)
      }
    }, 300),
    [filters]
  )

  useEffect(() => {
    performSearch(query)
  }, [query, filters, performSearch])

  return (
    <div className="w-full max-w-2xl">
      <div className="space-y-4">
        {/* Search Input */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium mb-2">
            Search Products
          </label>
          <input
            id="search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SKU, or description..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="minPrice" className="block text-sm font-medium mb-1">
                Min Price
              </label>
              <input
                id="minPrice"
                type="number"
                value={filters.minPrice}
                onChange={(e) =>
                  setFilters({ ...filters, minPrice: e.target.value })
                }
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="maxPrice" className="block text-sm font-medium mb-1">
                Max Price
              </label>
              <input
                id="maxPrice"
                type="number"
                value={filters.maxPrice}
                onChange={(e) =>
                  setFilters({ ...filters, maxPrice: e.target.value })
                }
                placeholder="9999"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="unit" className="block text-sm font-medium mb-1">
                Unit Type
              </label>
              <select
                id="unit"
                value={filters.unit}
                onChange={(e) =>
                  setFilters({ ...filters, unit: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Units</option>
                <option value="EA">Each (EA)</option>
                <option value="LF">Linear Foot (LF)</option>
                <option value="SF">Square Foot (SF)</option>
                <option value="BOX">Box (BOX)</option>
                <option value="PKG">Package (PKG)</option>
                <option value="SET">Set (SET)</option>
              </select>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="mt-6">
          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-500">Searching...</p>
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No products found</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-4">
                Found {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-2">
                {results.map((product) => (
                  <div
                    key={`${product.product_id}-${product.category_id}`}
                    onClick={() => onSelect?.(product)}
                    className={`p-3 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition ${
                      onSelect ? "hover:border-blue-400" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {product.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          SKU: {product.sku}
                        </p>
                        {product.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                      </div>
                      <div className="ml-4 text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900">
                          ${product.unit_price.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">
                          per {product.unit_type}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
