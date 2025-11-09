"use client"

import Papa from "papaparse"
import { upsertProducts } from "@/lib/supabase"
import { useState } from "react"

export default function UploadCsv() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string>("")

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept=".csv"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          setBusy(true)
          setMsg("")
          Papa.parse(file, {
            header: true,
            complete: async (res) => {
              try {
                const rows = (res.data as any[]).map((r) => ({
                  sku: String(r.sku).trim(),
                  name: String(r.name).trim(),
                  unit_type: String(r.unit_type).toUpperCase(),
                  unit_price: Number(r.unit_price),
                  aliases: r.aliases
                    ? String(r.aliases)
                        .split("|")
                        .map((s) => s.trim())
                    : [],
                }))
                await upsertProducts(rows)
                setMsg(`Imported ${rows.length} rows`)
              } catch (err: any) {
                setMsg(err.message || "Import failed")
              } finally {
                setBusy(false)
              }
            },
          })
        }}
      />
      {busy && <div>Importing…</div>}
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  )
}
