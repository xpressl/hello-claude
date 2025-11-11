"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getQuotes, searchQuotes } from "@/lib/quotes"
import { formatMoney } from "@/lib/pricing"
import type { Quote } from "@/lib/types"

export default function QuotesPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  useEffect(() => {
    loadQuotes()
  }, [])

  const loadQuotes = async () => {
    setIsLoading(true)
    try {
      const data = await getQuotes()
      setQuotes(data)
    } catch (error) {
      console.error("Load quotes error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      loadQuotes()
      return
    }

    try {
      const results = await searchQuotes(query)
      setQuotes(results)
    } catch (error) {
      console.error("Search error:", error)
    }
  }

  const filteredQuotes = statusFilter === "ALL"
    ? quotes
    : quotes.filter(q => q.status === statusFilter)

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

  return (
    <main className="p-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => router.push("/quote/new")}
        >
          + New Quote
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          className="flex-1 border rounded px-3 py-2"
          placeholder="Search by quote number, customer, or notes..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {/* Quotes List */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading quotes...</div>
      ) : filteredQuotes.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {searchQuery ? "No quotes found matching your search." : "No quotes yet. Create your first quote!"}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuotes.map((quote) => (
            <button
              key={quote.id}
              className="w-full border rounded p-4 hover:bg-slate-50 text-left transition-colors"
              onClick={() => router.push(`/quote/${quote.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono font-semibold text-lg">
                      {quote.quote_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(quote.status)}`}>
                      {quote.status}
                    </span>
                  </div>

                  <div className="text-slate-600 mb-1">
                    {quote.customer_name ? (
                      <span className="font-medium">{quote.customer_name}</span>
                    ) : (
                      <span className="italic">Quick Quote (No Customer)</span>
                    )}
                  </div>

                  {quote.notes && (
                    <div className="text-sm text-slate-500 line-clamp-1">
                      {quote.notes}
                    </div>
                  )}

                  <div className="text-xs text-slate-400 mt-2">
                    Created {new Date(quote.created_at).toLocaleDateString()} at{" "}
                    {new Date(quote.created_at).toLocaleTimeString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-green-700">
                    {formatMoney(quote.total)}
                  </div>
                  <div className="text-sm text-slate-500">
                    Cost: {formatMoney(quote.subtotal)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Profit: {formatMoney(quote.total - quote.subtotal)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      {!isLoading && quotes.length > 0 && (
        <div className="border-t pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{quotes.length}</div>
            <div className="text-sm text-slate-600">Total Quotes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {quotes.filter(q => q.status === "ACCEPTED").length}
            </div>
            <div className="text-sm text-slate-600">Accepted</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {quotes.filter(q => q.status === "SENT").length}
            </div>
            <div className="text-sm text-slate-600">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {formatMoney(quotes.reduce((sum, q) => sum + q.total, 0))}
            </div>
            <div className="text-sm text-slate-600">Total Value</div>
          </div>
        </div>
      )}
    </main>
  )
}
