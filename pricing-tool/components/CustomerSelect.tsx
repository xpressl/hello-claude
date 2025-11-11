"use client"

import { useState, useEffect } from "react"
import { searchCustomers, createCustomer } from "@/lib/quotes"
import type { Customer, CustomerInsert } from "@/lib/types"

interface CustomerSelectProps {
  onSelect: (customer: Customer | null) => void
  selectedCustomer?: Customer | null
}

export default function CustomerSelect({ onSelect, selectedCustomer }: CustomerSelectProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Customer[]>([])
  const [showResults, setShowResults] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // New customer form
  const [newCustomer, setNewCustomer] = useState<CustomerInsert>({
    name: "",
    company: "",
    phone: "",
    email: "",
    default_markup: undefined,
  })

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const customers = await searchCustomers(query)
        setResults(customers)
        setShowResults(true)
      } catch (error) {
        console.error("Search error:", error)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (customer: Customer) => {
    onSelect(customer)
    setQuery(customer.name)
    setShowResults(false)
  }

  const handleCreateNew = async () => {
    if (!newCustomer.name.trim()) return

    setIsLoading(true)
    try {
      const created = await createCustomer(newCustomer)
      handleSelect(created)
      setShowNewForm(false)
      setNewCustomer({ name: "", company: "", phone: "", email: "", default_markup: undefined })
    } catch (error) {
      console.error("Create customer error:", error)
      alert("Failed to create customer")
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickQuote = () => {
    onSelect(null)
    setQuery("")
    setShowResults(false)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Customer (Optional)</label>
        <div className="relative">
          <input
            type="text"
            className="border rounded px-3 py-2 w-full"
            placeholder="Search customer or leave blank..."
            value={selectedCustomer ? selectedCustomer.name : query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (selectedCustomer) onSelect(null)
            }}
            onFocus={() => query.length >= 2 && setShowResults(true)}
          />

          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto z-20">
              {results.map((customer) => (
                <button
                  key={customer.id}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 border-b last:border-b-0"
                  onClick={() => handleSelect(customer)}
                >
                  <div className="font-medium">{customer.name}</div>
                  {customer.company && (
                    <div className="text-sm text-slate-600">{customer.company}</div>
                  )}
                  {customer.default_markup !== undefined && (
                    <div className="text-xs text-blue-600">
                      Default markup: {customer.default_markup}%
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            className="text-sm text-blue-600 hover:underline"
            onClick={() => setShowNewForm(!showNewForm)}
          >
            + New Customer
          </button>
          {selectedCustomer && (
            <button
              className="text-sm text-slate-600 hover:underline"
              onClick={handleQuickQuote}
            >
              Clear (Quick Quote)
            </button>
          )}
        </div>
      </div>

      {/* New Customer Form */}
      {showNewForm && (
        <div className="border rounded p-4 bg-slate-50 space-y-3">
          <h3 className="font-medium">Create New Customer</h3>

          <div>
            <label className="block text-sm mb-1">Name *</label>
            <input
              type="text"
              className="border rounded px-3 py-2 w-full bg-white"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Company</label>
            <input
              type="text"
              className="border rounded px-3 py-2 w-full bg-white"
              value={newCustomer.company}
              onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Phone</label>
              <input
                type="tel"
                className="border rounded px-3 py-2 w-full bg-white"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                className="border rounded px-3 py-2 w-full bg-white"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Default Markup %</label>
            <input
              type="number"
              step="0.1"
              className="border rounded px-3 py-2 w-full bg-white"
              value={newCustomer.default_markup ?? ""}
              onChange={(e) =>
                setNewCustomer({
                  ...newCustomer,
                  default_markup: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={handleCreateNew}
              disabled={!newCustomer.name.trim() || isLoading}
            >
              {isLoading ? "Creating..." : "Create Customer"}
            </button>
            <button
              className="px-4 py-2 border rounded hover:bg-slate-100"
              onClick={() => setShowNewForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Selected Customer Info */}
      {selectedCustomer && (
        <div className="border rounded p-3 bg-green-50 border-green-200">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium">{selectedCustomer.name}</div>
              {selectedCustomer.company && (
                <div className="text-sm text-slate-600">{selectedCustomer.company}</div>
              )}
              {selectedCustomer.phone && (
                <div className="text-sm text-slate-600">{selectedCustomer.phone}</div>
              )}
              {selectedCustomer.default_markup !== undefined && (
                <div className="text-sm text-green-700 font-medium mt-1">
                  ✓ Customer markup: {selectedCustomer.default_markup}%
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
