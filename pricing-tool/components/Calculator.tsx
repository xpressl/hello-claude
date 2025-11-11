"use client"

import { useMemo, useState, useEffect } from "react"
import { computeTotal, applyMarkup, formatMoney } from "@/lib/pricing"

export default function Calculator({
  unitPrice,
  unitLabel,
  initialQty,
  initialMarkup,
  productName,
  productSku,
}: {
  unitPrice: number
  unitLabel: string
  initialQty?: number
  initialMarkup?: number
  productName?: string
  productSku?: string
}) {
  const [qty, setQty] = useState<number>(initialQty ?? 12)
  const [markup, setMarkup] = useState<number>(initialMarkup ?? 20)
  const [showCopyOptions, setShowCopyOptions] = useState(false)

  // Update state when voice input provides new values
  useEffect(() => {
    if (initialQty !== undefined) setQty(initialQty)
  }, [initialQty])

  useEffect(() => {
    if (initialMarkup !== undefined) setMarkup(initialMarkup)
  }, [initialMarkup])

  const cost = useMemo(() => computeTotal(unitPrice, qty), [unitPrice, qty])
  const { price, profit, marginPct } = useMemo(() => applyMarkup(cost, markup), [cost, markup])

  // Preset lengths (in feet)
  const presetLengths = [8, 10, 12, 14, 16, 20]

  // Markup presets
  const markupPresets = [
    { label: "Standard", value: 25 },
    { label: "Contractor", value: 20 },
    { label: "Preferred", value: 15 },
    { label: "Retail", value: 35 },
  ]

  // Copy format functions
  const copyFormats = {
    priceOnly: () => formatMoney(price),
    fullDetails: () => {
      const name = productName || "Product"
      const sku = productSku ? ` (${productSku})` : ""
      return `${name}${sku}: ${qty}${unitLabel} @ ${formatMoney(unitPrice)}/${unitLabel} = ${formatMoney(price)} (${markup}% markup)`
    },
    sms: () => {
      const name = productName || "Product"
      return `Quote: ${qty}${unitLabel} ${name} = ${formatMoney(price)}`
    },
    email: () => {
      const name = productName || "Product"
      const sku = productSku ? `SKU: ${productSku}\n` : ""
      return `QUOTE\n${sku}Product: ${name}\nQuantity: ${qty} ${unitLabel}\nUnit Price: ${formatMoney(unitPrice)}\nMarkup: ${markup}%\nCost: ${formatMoney(cost)}\nQuote Price: ${formatMoney(price)}\nProfit: ${formatMoney(profit)}`
    },
  }

  const handleCopy = (format: keyof typeof copyFormats) => {
    const text = copyFormats[format]()
    navigator.clipboard.writeText(text)
    setShowCopyOptions(false)
  }

  return (
    <div className="space-y-4">
      {/* Quantity Input */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Quantity ({unitLabel})
        </label>
        <input
          type="number"
          step="0.01"
          className="border rounded px-3 py-2 w-full text-lg"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value || 0))}
        />

        {/* Preset Length Buttons (only show for LF) */}
        {unitLabel === "ft" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {presetLengths.map((length) => (
              <button
                key={length}
                className="px-3 py-1.5 border rounded text-sm hover:bg-slate-100 active:bg-slate-200"
                onClick={() => setQty(length)}
              >
                {length}′
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Markup Input */}
      <div>
        <label className="block text-sm font-medium mb-1">Markup %</label>
        <input
          type="number"
          step="0.1"
          className="border rounded px-3 py-2 w-full text-lg"
          value={markup}
          onChange={(e) => setMarkup(Number(e.target.value || 0))}
        />

        {/* Markup Preset Buttons */}
        <div className="mt-2 flex flex-wrap gap-2">
          {markupPresets.map((preset) => (
            <button
              key={preset.label}
              className="px-3 py-1.5 border rounded text-sm hover:bg-slate-100 active:bg-slate-200"
              onClick={() => setMarkup(preset.value)}
            >
              {preset.label} ({preset.value}%)
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="rounded border p-4 bg-slate-50 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Cost:</span>
          <span className="text-lg font-semibold">{formatMoney(cost)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Price:</span>
          <span className="text-2xl font-bold text-green-700">{formatMoney(price)}</span>
        </div>
        <div className="text-sm text-slate-500 pt-1 border-t">
          Profit: {formatMoney(profit)} • Margin: {marginPct.toFixed(1)}%
        </div>
      </div>

      {/* Copy Button with Options */}
      <div className="relative">
        <div className="flex gap-2">
          <button
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 active:bg-blue-800"
            onClick={() => handleCopy("priceOnly")}
          >
            Copy Price
          </button>
          <button
            className="px-4 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 active:bg-blue-800"
            onClick={() => setShowCopyOptions(!showCopyOptions)}
            title="More copy options"
          >
            ⋯
          </button>
        </div>

        {/* Copy Options Dropdown */}
        {showCopyOptions && (
          <div className="absolute bottom-full mb-2 right-0 w-full bg-white border rounded shadow-lg overflow-hidden z-10">
            <button
              className="w-full px-4 py-2 text-left hover:bg-slate-100 text-sm"
              onClick={() => handleCopy("priceOnly")}
            >
              <div className="font-medium">Price Only</div>
              <div className="text-xs text-slate-500">{formatMoney(price)}</div>
            </button>
            <button
              className="w-full px-4 py-2 text-left hover:bg-slate-100 text-sm border-t"
              onClick={() => handleCopy("sms")}
            >
              <div className="font-medium">SMS Format</div>
              <div className="text-xs text-slate-500 truncate">
                Quote: {qty}{unitLabel} {productName || "Product"}...
              </div>
            </button>
            <button
              className="w-full px-4 py-2 text-left hover:bg-slate-100 text-sm border-t"
              onClick={() => handleCopy("fullDetails")}
            >
              <div className="font-medium">Full Details</div>
              <div className="text-xs text-slate-500 truncate">
                With qty, unit price, and markup
              </div>
            </button>
            <button
              className="w-full px-4 py-2 text-left hover:bg-slate-100 text-sm border-t"
              onClick={() => handleCopy("email")}
            >
              <div className="font-medium">Email Format</div>
              <div className="text-xs text-slate-500">Multi-line breakdown</div>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
