"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"

interface Product {
  id: string
  sku: string
  name: string
  unit_price: number
  unit_type: string
}

interface BulkProductAssignmentProps {
  categoryId: string
  onComplete?: () => void
}

export function BulkProductAssignment({
  categoryId,
  onComplete,
}: BulkProductAssignmentProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Load all products initially
  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from("products")
        .select("id,sku,name,unit_price,unit_type")
        .order("name")
        .limit(100)

      if (err) {
        setError(err.message)
        return
      }

      setProducts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  // Search products
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      await loadProducts()
      return
    }

    try {
      setSearching(true)
      setError(null)
      const { data, error: err } = await supabase.rpc("search_products", {
        p_query: query,
        p_limit: 50,
      })

      if (err) {
        setError(err.message)
        return
      }

      // Map search results to product format
      const mapped = (data || []).map((item: any) => ({
        id: item.product_id,
        sku: item.sku,
        name: item.name,
        unit_price: item.unit_price,
        unit_type: item.unit_type,
      }))

      // Deduplicate
      const unique = Array.from(
        new Map(mapped.map((p: Product) => [p.id, p])).values()
      )

      setProducts(unique)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }

  const toggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
    setSuccess(false)
  }

  const selectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(products.map((p) => p.id)))
    }
    setSuccess(false)
  }

  const handleAssign = async () => {
    if (selectedProducts.size === 0) {
      setError("Please select at least one product")
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Insert product-category relationships
      const assignments = Array.from(selectedProducts).map((productId) => ({
        product_id: productId,
        category_id: categoryId,
        is_primary: false,
      }))

      const { error: err } = await supabase
        .from("product_categories")
        .upsert(assignments, { onConflict: "product_id,category_id" })

      if (err) {
        setError(err.message)
        return
      }

      setSuccess(true)
      setSelectedProducts(new Set())
      onComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign products")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Bulk Product Assignment</h3>

        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 mb-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            Successfully assigned {selectedProducts.size} product(s)!
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search products by name or SKU..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Select All */}
        <div className="flex items-center gap-2 mb-4">
          <input
            id="select-all"
            type="checkbox"
            checked={selectedProducts.size === products.length && products.length > 0}
            onChange={selectAll}
            className="w-4 h-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="select-all" className="text-sm font-medium">
            {selectedProducts.size === 0
              ? "Select All"
              : `Selected ${selectedProducts.size} product${
                  selectedProducts.size !== 1 ? "s" : ""
                }`}
          </label>
        </div>

        {/* Products List */}
        {loading || searching ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {loading ? "Loading products..." : "Searching..."}
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
            <div className="divide-y">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="p-3 hover:bg-gray-50 flex items-start gap-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.id)}
                    onChange={() => toggleProduct(product.id)}
                    className="mt-1 w-4 h-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-gray-900">
                      ${product.unit_price.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">{product.unit_type}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleAssign}
            disabled={saving || selectedProducts.size === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {saving
              ? "Assigning..."
              : `Assign ${selectedProducts.size} Product${
                  selectedProducts.size !== 1 ? "s" : ""
                }`}
          </button>
        </div>
      </div>
    </div>
  )
}
