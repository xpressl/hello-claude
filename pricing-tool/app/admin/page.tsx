"use client"

import UploadCsv from "@/components/UploadCsv"

export default function AdminPage() {
  // For MVP skip role gate; rely on Supabase policies to block writes
  return (
    <main className="p-4 max-w-xl mx-auto space-y-3">
      <h1 className="text-xl font-semibold">Admin • Import Prices</h1>
      <p className="text-sm text-slate-600">
        CSV headers: sku,name,unit_type,unit_price,aliases
      </p>
      <UploadCsv />
    </main>
  )
}
