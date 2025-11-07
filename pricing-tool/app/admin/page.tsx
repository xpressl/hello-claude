'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import UploadCsv from '@/components/UploadCsv'
import { getCurrentUserRole } from '@/lib/supabase'

export default function AdminPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const role = await getCurrentUserRole()
        if (role === 'ADMIN') {
          setIsAuthorized(true)
        } else {
          setIsAuthorized(false)
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        setIsAuthorized(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <svg
            className="mx-auto h-16 w-16 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Access Denied</h1>
          <p className="text-gray-600 mt-2">
            You need ADMIN privileges to access this page.
          </p>
          <button
            onClick={() => router.push('/catalog')}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors"
          >
            Go to Catalog
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-2">Manage product catalog</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Upload Product CSV
          </h2>
          <p className="text-gray-600 mb-6">
            Upload a CSV file to add or update products in bulk. Existing products with
            matching SKUs will be updated.
          </p>
          <UploadCsv />
        </div>

        {/* CSV Format Guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            CSV Format Guide
          </h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>Required columns:</strong> sku, name, unit_type, unit_price
            </p>
            <p>
              <strong>Optional columns:</strong> aliases (comma-separated)
            </p>
            <p>
              <strong>Valid unit types:</strong> EA, LF, SF, BOX, PKG, SET
            </p>
          </div>

          <div className="mt-4 bg-white rounded border border-blue-300 p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">Example CSV:</p>
            <pre className="text-xs text-gray-800 overflow-x-auto">
{`sku,name,unit_type,unit_price,aliases
STD-20G-8FT,20 Gauge Steel Stud 8ft,EA,3.50,"stud,20ga stud,metal stud"
TRK-20G-10FT,20 Gauge Steel Track 10ft,EA,4.75,"track,20ga track"
DRY-SHEET-4X8,Drywall Sheetrock 4x8 1/2",EA,12.00,drywall`}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={() => router.push('/catalog')}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md transition-colors"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    </div>
  )
}
