"use client"

import { useMemo, useState } from "react"
import { computeTotal, applyMarkup, formatMoney } from "@/lib/pricing"

export default function Calculator({
  unitPrice,
  unitLabel,
}: {
  unitPrice: number
  unitLabel: string
}) {
  const [qty, setQty] = useState<number>(12)
  const [markup, setMarkup] = useState<number>(20)

  const cost = useMemo(() => computeTotal(unitPrice, qty), [unitPrice, qty])
  const { price, profit, marginPct } = useMemo(() => applyMarkup(cost, markup), [cost, markup])

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm">Quantity ({unitLabel})</label>
        <input
          type="number"
          className="border rounded px-3 py-2 w-full"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value || 0))}
        />
      </div>
      <div>
        <label className="block text-sm">Markup %</label>
        <input
          type="number"
          className="border rounded px-3 py-2 w-full"
          value={markup}
          onChange={(e) => setMarkup(Number(e.target.value || 0))}
        />
      </div>
      <div className="rounded border p-3 bg-white">
        <div>
          Cost: <b>{formatMoney(cost)}</b>
        </div>
        <div>
          Price: <b>{formatMoney(price)}</b>
        </div>
        <div className="text-sm text-slate-600">
          Profit {formatMoney(profit)} • Margin {marginPct.toFixed(1)}%
        </div>
      </div>
      <button
        className="px-3 py-2 border rounded"
        onClick={() => navigator.clipboard.writeText(formatMoney(price))}
      >
        Copy Price
      </button>
    </div>
  )
}
