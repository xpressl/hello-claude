"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import SearchBox from "@/components/SearchBox"
import { pullProducts, getLocalProductCount } from "@/lib/sync"

export default function CatalogPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [productCount, setProductCount] = useState(0)

  // Initial sync and load
  useEffect(() => {
    const init = async () => {
      try {
        const count = await getLocalProductCount()
        setProductCount(count)

        if (count === 0) {
          setIsSyncing(true)
          await pullProducts()
          const newCount = await getLocalProductCount()
          setProductCount(newCount)
        }
      } catch (err) {
        console.error("Failed to load products:", err)
      } finally {
        setIsLoading(false)
        setIsSyncing(false)
      }
    }

    init()
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const count = await pullProducts()
      const newCount = await getLocalProductCount()
      setProductCount(newCount)
      alert(`Synced ${count} products`)
    } catch (err) {
      console.error("Sync failed:", err)
      alert("Sync failed. Please try again.")
    } finally {
      setIsSyncing(false)
    }
  }

  const handlePick = (id: string) => {
    router.push(`/item/${id}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-gray-600 mt-2">
            {productCount} product{productCount !== 1 ? "s" : ""} available offline
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Search Products</h2>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors"
            >
              {isSyncing ? "Syncing..." : "Sync"}
            </button>
          </div>

          <SearchBox onPick={handlePick} />
        </div>
      </div>
    </div>
  )
}
