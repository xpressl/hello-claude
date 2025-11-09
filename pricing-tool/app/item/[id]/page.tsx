"use client"

import { useEffect, useState } from "react"
import { getLocalProduct } from "@/lib/sync"
import Calculator from "@/components/Calculator"
import VoiceButton from "@/components/VoiceButton"
import { parseVoiceQuery } from "@/lib/voice"

export default function ItemPage({ params }: { params: { id: string } }) {
  const [p, setP] = useState<any>(null)
  const [qty, setQty] = useState<number | undefined>(undefined)
  const [markup, setMarkup] = useState<number | undefined>(undefined)

  useEffect(() => {
    getLocalProduct(params.id).then(setP)
  }, [params.id])

  if (!p) return <main className="p-4">Loading…</main>

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{p.name}</h1>
        <VoiceButton
          onText={(t) => {
            const parsed = parseVoiceQuery(t)
            if (parsed.qty) setQty(parsed.qty)
            if (parsed.markupPct) setMarkup(parsed.markupPct)
          }}
        />
      </div>
      <div className="text-slate-600">
        {p.sku} • {p.unit_type} • ${p.unit_price}/
        {p.unit_type === "LF" ? "ft" : "unit"}
      </div>
      <Calculator
        unitPrice={Number(p.unit_price)}
        unitLabel={p.unit_type === "LF" ? "ft" : "qty"}
      />
    </main>
  )
}
