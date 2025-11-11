"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  getQuoteById,
  updateQuote,
  deleteQuote,
  createQuoteItem,
  updateQuoteItem,
  deleteQuoteItem,
  recalculateQuoteTotals,
} from "@/lib/quotes"
import { getLocalProducts } from "@/lib/sync"
import { formatMoney, calculateLineItem } from "@/lib/pricing"
import SearchBox from "@/components/SearchBox"
import type { QuoteWithItems, QuoteItem, QuoteStatus, Product } from "@/lib/types"

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [quote, setQuote] = useState<QuoteWithItems | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)

  // Editable fields
  const [status, setStatus] = useState<QuoteStatus>("DRAFT")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    loadQuote()
  }, [params.id])

  const loadQuote = async () => {
    setIsLoading(true)
    try {
      const data = await getQuoteById(params.id)
      if (!data) {
        alert("Quote not found")
        router.push("/quotes")
        return
      }
      setQuote(data)
      setStatus(data.status)
      setNotes(data.notes || "")
    } catch (error) {
      console.error("Load quote error:", error)
      alert("Failed to load quote")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (newStatus: QuoteStatus) => {
    if (!quote) return
    try {
      await updateQuote({ id: quote.id, status: newStatus })
      setStatus(newStatus)
      setQuote({ ...quote, status: newStatus })
    } catch (error) {
      console.error("Update status error:", error)
      alert("Failed to update status")
    }
  }

  const handleSaveChanges = async () => {
    if (!quote) return
    setIsSaving(true)
    try {
      await updateQuote({
        id: quote.id,
        status,
        notes: notes.trim() || undefined,
      })
      await loadQuote()
      setIsEditing(false)
      alert("Quote updated successfully!")
    } catch (error) {
      console.error("Save error:", error)
      alert("Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteQuote = async () => {
    if (!quote) return
    if (!confirm(`Delete quote ${quote.quote_number}? This cannot be undone.`)) return

    try {
      await deleteQuote(quote.id)
      alert("Quote deleted")
      router.push("/quotes")
    } catch (error) {
      console.error("Delete error:", error)
      alert("Failed to delete quote")
    }
  }

  const handleAddProduct = async (productId: string) => {
    if (!quote) return

    const products = await getLocalProducts()
    const product = products.find((p) => p.id === productId)
    if (!product) return

    const quantity = product.unit_type === "LF" ? 12 : 1
    const markup_pct = 25 // Default markup
    const calcs = calculateLineItem(Number(product.unit_price), quantity, markup_pct)

    try {
      await createQuoteItem({
        quote_id: quote.id,
        product_id: product.id,
        product_sku: product.sku,
        product_name: product.name,
        unit_type: product.unit_type,
        quantity,
        unit_price: Number(product.unit_price),
        markup_pct,
        cost: calcs.cost,
        price: calcs.price,
        profit: calcs.profit,
      })

      await recalculateQuoteTotals(quote.id)
      await loadQuote()
      setShowAddProduct(false)
    } catch (error) {
      console.error("Add product error:", error)
      alert("Failed to add product")
    }
  }

  const handleUpdateItem = async (item: QuoteItem, updates: Partial<QuoteItem>) => {
    try {
      // Recalculate if quantity or markup changed
      let finalUpdates = { ...updates }
      if (updates.quantity !== undefined || updates.markup_pct !== undefined) {
        const calcs = calculateLineItem(
          updates.unit_price ?? item.unit_price,
          updates.quantity ?? item.quantity,
          updates.markup_pct ?? item.markup_pct
        )
        finalUpdates = {
          ...finalUpdates,
          cost: calcs.cost,
          price: calcs.price,
          profit: calcs.profit,
        }
      }

      await updateQuoteItem({ id: item.id, ...finalUpdates })
      await recalculateQuoteTotals(quote!.id)
      await loadQuote()
    } catch (error) {
      console.error("Update item error:", error)
      alert("Failed to update item")
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Remove this item from the quote?")) return

    try {
      await deleteQuoteItem(itemId)
      await recalculateQuoteTotals(quote!.id)
      await loadQuote()
    } catch (error) {
      console.error("Delete item error:", error)
      alert("Failed to remove item")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT": return "bg-slate-100 text-slate-700"
      case "SENT": return "bg-blue-100 text-blue-700"
      case "ACCEPTED": return "bg-green-100 text-green-700"
      case "REJECTED": return "bg-red-100 text-red-700"
      case "EXPIRED": return "bg-orange-100 text-orange-700"
      default: return "bg-slate-100 text-slate-700"
    }
  }

  if (isLoading) {
    return (
      <main className="p-4 max-w-4xl mx-auto">
        <div className="text-center py-12">Loading quote...</div>
      </main>
    )
  }

  if (!quote) {
    return (
      <main className="p-4 max-w-4xl mx-auto">
        <div className="text-center py-12">Quote not found</div>
      </main>
    )
  }

  return (
    <main className="p-4 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono">{quote.quote_number}</h1>
          <div className="text-sm text-slate-600">
            Created {new Date(quote.created_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <button
                className="px-4 py-2 border rounded hover:bg-slate-100"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
              <button
                className="px-4 py-2 border rounded hover:bg-slate-100"
                onClick={() => router.push("/quotes")}
              >
                Back to Quotes
              </button>
            </>
          ) : (
            <>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                className="px-4 py-2 border rounded hover:bg-slate-100"
                onClick={() => {
                  setIsEditing(false)
                  setStatus(quote.status)
                  setNotes(quote.notes || "")
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(quote.status)}`}>
          {quote.status}
        </span>
        {isEditing && (
          <select
            className="border rounded px-3 py-1 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as QuoteStatus)}
          >
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
        )}
      </div>

      {/* Customer Info */}
      <div className="border rounded p-4 bg-slate-50">
        <h2 className="font-semibold mb-2">Customer</h2>
        {quote.customer ? (
          <div>
            <div className="font-medium">{quote.customer.name}</div>
            {quote.customer.company && <div className="text-sm">{quote.customer.company}</div>}
            {quote.customer.phone && <div className="text-sm">{quote.customer.phone}</div>}
            {quote.customer.email && <div className="text-sm">{quote.customer.email}</div>}
          </div>
        ) : quote.customer_name ? (
          <div className="text-slate-600">{quote.customer_name}</div>
        ) : (
          <div className="text-slate-500 italic">No customer (quick quote)</div>
        )}
      </div>

      {/* Line Items */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Line Items ({quote.items.length})</h2>
          {isEditing && (
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => setShowAddProduct(!showAddProduct)}
            >
              + Add Product
            </button>
          )}
        </div>

        {showAddProduct && (
          <div className="mb-4 p-4 border rounded bg-slate-50">
            <SearchBox onSelectProduct={handleAddProduct} />
          </div>
        )}

        <div className="space-y-3">
          {quote.items.map((item) => (
            <div key={item.id} className="border rounded p-4 bg-white">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium">{item.product_name}</div>
                  <div className="text-sm text-slate-600">
                    {item.product_sku} • {formatMoney(item.unit_price)}/{item.unit_type}
                  </div>
                </div>
                {isEditing && (
                  <button
                    className="text-red-600 hover:text-red-800 text-sm"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    Remove
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      className="border rounded px-3 py-2 w-full"
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateItem(item, { quantity: Number(e.target.value || 0) })
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
                        handleUpdateItem(item, { markup_pct: Number(e.target.value || 0) })
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
              ) : (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-slate-600">Quantity:</span>{" "}
                    <span className="font-medium">{item.quantity} {item.unit_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Markup:</span>{" "}
                    <span className="font-medium">{item.markup_pct}%</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Total:</span>{" "}
                    <span className="font-semibold text-green-700">{formatMoney(item.price)}</span>
                  </div>
                </div>
              )}

              <div className="mt-2 text-sm text-slate-600">
                Cost: {formatMoney(item.cost)} • Profit: {formatMoney(item.profit)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quote Totals */}
      <div className="border-t pt-4">
        <div className="bg-slate-50 rounded p-4 space-y-2">
          <div className="flex justify-between text-lg">
            <span className="text-slate-600">Subtotal (Cost):</span>
            <span className="font-semibold">{formatMoney(quote.subtotal)}</span>
          </div>
          <div className="flex justify-between text-2xl border-t pt-2">
            <span className="font-bold">Total Quote:</span>
            <span className="font-bold text-green-700">{formatMoney(quote.total)}</span>
          </div>
          <div className="text-sm text-slate-600 text-right">
            Total Profit: {formatMoney(quote.total - quote.subtotal)}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">Notes</h3>
        {isEditing ? (
          <textarea
            className="border rounded px-3 py-2 w-full"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        ) : quote.notes ? (
          <div className="text-slate-700">{quote.notes}</div>
        ) : (
          <div className="text-slate-400 italic">No notes</div>
        )}
      </div>

      {/* Danger Zone */}
      {isEditing && (
        <div className="border-t pt-4 border-red-200">
          <button
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={handleDeleteQuote}
          >
            Delete Quote
          </button>
        </div>
      )}
    </main>
  )
}
