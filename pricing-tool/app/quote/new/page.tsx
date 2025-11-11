"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import CustomerSelect from "@/components/CustomerSelect"
import SearchBox from "@/components/SearchBox"
import { getLocalProducts } from "@/lib/sync"
import { createQuoteWithItems, recalculateQuoteTotals } from "@/lib/quotes"
import {
  calculateLineItem,
  calculateQuoteTotals,
  getEffectiveMarkup,
  formatMoney,
  DEFAULT_GLOBAL_MARKUP,
} from "@/lib/pricing"
import type { Customer, Product, QuoteBuilderItem, QuoteStatus } from "@/lib/types"

export default function NewQuotePage() {
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [items, setItems] = useState<QuoteBuilderItem[]>([])
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<QuoteStatus>("DRAFT")
  const [isSaving, setIsSaving] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState(false)

  const handleAddProduct = async (productId: string) => {
    const products = await getLocalProducts()
    const product = products.find((p) => p.id === productId)
    if (!product) return

    // Get effective markup
    const markup = getEffectiveMarkup(
      customer?.default_markup,
      product.default_markup,
      DEFAULT_GLOBAL_MARKUP
    )

    // Create new line item
    const newItem: QuoteBuilderItem = {
      product,
      quantity: product.unit_type === "LF" ? 12 : 1,
      markup_pct: markup.effectiveMarkup,
      cost: 0,
      price: 0,
      profit: 0,
    }

    // Calculate totals
    const calcs = calculateLineItem(
      Number(product.unit_price),
      newItem.quantity,
      newItem.markup_pct
    )
    newItem.cost = calcs.cost
    newItem.price = calcs.price
    newItem.profit = calcs.profit

    setItems([...items, newItem])
    setShowProductSearch(false)
  }

  const handleUpdateItem = (index: number, updates: Partial<QuoteBuilderItem>) => {
    const updated = [...items]
    updated[index] = { ...updated[index], ...updates }

    // Recalculate if quantity or markup changed
    if (updates.quantity !== undefined || updates.markup_pct !== undefined) {
      const item = updated[index]
      const calcs = calculateLineItem(
        Number(item.product.unit_price),
        item.quantity,
        item.markup_pct
      )
      updated[index].cost = calcs.cost
      updated[index].price = calcs.price
      updated[index].profit = calcs.profit
    }

    setItems(updated)
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSaveQuote = async () => {
    if (items.length === 0) {
      alert("Please add at least one product to the quote")
      return
    }

    setIsSaving(true)
    try {
      // Calculate quote totals
      const totals = calculateQuoteTotals(items)

      // Prepare quote data
      const quoteData = {
        customer_id: customer?.id,
        customer_name: customer?.name,
        customer_phone: customer?.phone,
        customer_email: customer?.email,
        status,
        subtotal: totals.subtotal,
        total: totals.total,
        notes: notes.trim() || undefined,
      }

      // Prepare line items
      const lineItems = items.map((item) => ({
        product_id: item.product.id,
        product_sku: item.product.sku,
        product_name: item.product.name,
        unit_type: item.product.unit_type,
        quantity: item.quantity,
        unit_price: Number(item.product.unit_price),
        markup_pct: item.markup_pct,
        cost: item.cost,
        price: item.price,
        profit: item.profit,
        line_notes: item.line_notes,
      }))

      // Create quote with items
      const newQuote = await createQuoteWithItems(quoteData, lineItems)

      alert(`Quote ${newQuote.quote_number} created successfully!`)
      router.push(`/quote/${newQuote.id}`)
    } catch (error) {
      console.error("Save quote error:", error)
      alert("Failed to save quote. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const totals = calculateQuoteTotals(items)

  return (
    <main className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Quote</h1>
        <button
          className="px-4 py-2 border rounded hover:bg-slate-100"
          onClick={() => router.back()}
        >
          Cancel
        </button>
      </div>

      {/* Customer Selection */}
      <CustomerSelect onSelect={setCustomer} selectedCustomer={customer} />

      {/* Product Search */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Line Items</h2>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => setShowProductSearch(!showProductSearch)}
          >
            + Add Product
          </button>
        </div>

        {showProductSearch && (
          <div className="mb-4 p-4 border rounded bg-slate-50">
            <SearchBox onSelectProduct={handleAddProduct} />
          </div>
        )}

        {/* Line Items List */}
        {items.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No items yet. Click "Add Product" to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border rounded p-4 bg-white">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-medium">{item.product.name}</div>
                    <div className="text-sm text-slate-600">
                      {item.product.sku} • {formatMoney(Number(item.product.unit_price))}/
                      {item.product.unit_type}
                    </div>
                  </div>
                  <button
                    className="text-red-600 hover:text-red-800 text-sm"
                    onClick={() => handleRemoveItem(index)}
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm mb-1">
                      Quantity ({item.product.unit_type === "LF" ? "ft" : "qty"})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="border rounded px-3 py-2 w-full"
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateItem(index, { quantity: Number(e.target.value || 0) })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Markup %</label>
                    <input
                      type="number"
                      step="0.1"
                      className="border rounded px-3 py-2 w-full"
                      value={item.markup_pct}
                      onChange={(e) =>
                        handleUpdateItem(index, { markup_pct: Number(e.target.value || 0) })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Line Total</label>
                    <div className="px-3 py-2 bg-slate-100 rounded font-semibold text-green-700">
                      {formatMoney(item.price)}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  Cost: {formatMoney(item.cost)} • Profit: {formatMoney(item.profit)}
                </div>

                <div className="mt-2">
                  <input
                    type="text"
                    className="border rounded px-3 py-1.5 w-full text-sm"
                    placeholder="Line notes (optional)"
                    value={item.line_notes || ""}
                    onChange={(e) => handleUpdateItem(index, { line_notes: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quote Totals */}
      {items.length > 0 && (
        <div className="border-t pt-4">
          <div className="bg-slate-50 rounded p-4 space-y-2">
            <div className="flex justify-between text-lg">
              <span className="text-slate-600">Subtotal (Cost):</span>
              <span className="font-semibold">{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-2xl border-t pt-2">
              <span className="font-bold">Total Quote:</span>
              <span className="font-bold text-green-700">{formatMoney(totals.total)}</span>
            </div>
            <div className="text-sm text-slate-600 text-right">
              Total Profit: {formatMoney(totals.totalProfit)}
            </div>
          </div>
        </div>
      )}

      {/* Quote Notes and Status */}
      <div className="border-t pt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Quote Notes</label>
          <textarea
            className="border rounded px-3 py-2 w-full"
            rows={3}
            placeholder="Internal notes or special instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            className="border rounded px-3 py-2 w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value as QuoteStatus)}
          >
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Save Button */}
      <div className="border-t pt-4">
        <button
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSaveQuote}
          disabled={isSaving || items.length === 0}
        >
          {isSaving ? "Saving..." : `Save Quote (${formatMoney(totals.total)})`}
        </button>
      </div>
    </main>
  )
}
