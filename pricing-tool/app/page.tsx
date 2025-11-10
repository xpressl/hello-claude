import Link from "next/link"

export default function Home() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Price Lookup</h1>
      <p className="mt-2">
        <Link className="text-blue-600 underline" href="/catalog">
          Open Catalog
        </Link>
      </p>
    </main>
  )
}
