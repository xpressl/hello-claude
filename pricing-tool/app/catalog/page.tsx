"use client"

import { useEffect } from "react"
import SearchBox from "@/components/SearchBox"
import VoiceButton from "@/components/VoiceButton"
import { useRouter } from "next/navigation"
import { pullProducts } from "@/lib/sync"

export default function CatalogPage() {
  const r = useRouter()

  useEffect(() => {
    pullProducts().catch(() => {})
  }, [])

  return (
    <main className="p-4 max-w-xl mx-auto space-y-3">
      <h1 className="text-xl font-semibold">Catalog</h1>
      <div className="flex items-center gap-2">
        <VoiceButton
          onText={(t) => {
            /* naive route: treat voice as search */
            r.push("/catalog?voice=" + encodeURIComponent(t))
          }}
        />
        <span className="text-sm text-slate-600">Use voice then tap result</span>
      </div>
      <SearchBox onPick={(id) => r.push(`/item/${id}`)} />
    </main>
  )
}
