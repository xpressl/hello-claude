"use client"

import { useEffect, useState } from "react"
import { searchLocalProducts } from "@/lib/sync"

export default function SearchBox({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<any[]>([])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q) {
        setResults([])
        return
      }
      setResults(await searchLocalProducts(q))
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search product name, sku, alias"
        className="w-full border rounded px-3 py-2"
      />
      <ul className="mt-2 divide-y">
        {results.map((r) => (
          <li
            key={r.id}
            className="py-2 cursor-pointer hover:bg-slate-100 px-2"
            onClick={() => onPick(r.id)}
          >
            <div className="font-medium">{r.name}</div>
            <div className="text-sm text-slate-600">
              {r.sku} • {r.unit_type} • ${r.unit_price}/unit
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
