import Link from "next/link"

export default function Home() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pricing Tool</h1>
        <p className="text-slate-600">
          Fast, accurate quotes with voice search and offline support
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Quick Quote */}
        <Link
          href="/catalog"
          className="border rounded-lg p-6 hover:bg-slate-50 transition-colors"
        >
          <div className="text-xl font-semibold mb-2">🔍 Quick Quote</div>
          <p className="text-slate-600 text-sm">
            Search products and calculate prices instantly
          </p>
        </Link>

        {/* Create Quote */}
        <Link
          href="/quote/new"
          className="border rounded-lg p-6 hover:bg-slate-50 transition-colors bg-blue-50 border-blue-200"
        >
          <div className="text-xl font-semibold mb-2">📝 New Quote</div>
          <p className="text-slate-600 text-sm">
            Create multi-product quotes with customer tracking
          </p>
        </Link>

        {/* View Quotes */}
        <Link
          href="/quotes"
          className="border rounded-lg p-6 hover:bg-slate-50 transition-colors"
        >
          <div className="text-xl font-semibold mb-2">📋 View Quotes</div>
          <p className="text-slate-600 text-sm">
            Browse, search, and manage all quotes
          </p>
        </Link>

        {/* Admin */}
        <Link
          href="/admin"
          className="border rounded-lg p-6 hover:bg-slate-50 transition-colors"
        >
          <div className="text-xl font-semibold mb-2">⚙️ Admin</div>
          <p className="text-slate-600 text-sm">
            Manage products, upload CSV, configure settings
          </p>
        </Link>
      </div>

      <div className="mt-8 border-t pt-6 text-sm text-slate-500">
        <h2 className="font-semibold text-slate-700 mb-2">Features:</h2>
        <ul className="space-y-1">
          <li>✓ Voice search for hands-free operation</li>
          <li>✓ Offline-ready with local caching</li>
          <li>✓ Customer-specific markup pricing</li>
          <li>✓ Multi-product quote builder</li>
          <li>✓ Quote history and tracking</li>
          <li>✓ Quick copy in multiple formats (SMS, email, etc.)</li>
        </ul>
      </div>
    </main>
  )
}
