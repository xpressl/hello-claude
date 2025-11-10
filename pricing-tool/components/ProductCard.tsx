'use client'

import Link from 'next/link'
import { formatMoney } from '@/lib/pricing'

export interface ProductCardProps {
  id: string
  sku: string
  name: string
  unitType: string
  unitPrice: number
  aliases?: string[]
}

export default function ProductCard({
  id,
  sku,
  name,
  unitType,
  unitPrice,
  aliases = [],
}: ProductCardProps) {
  return (
    <Link
      href={`/item/${id}`}
      className="block bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate" title={name}>
            {name}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            SKU: <span className="font-mono">{sku}</span>
          </p>
          {aliases.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {aliases.slice(0, 3).map((alias, i) => (
                <span
                  key={i}
                  className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                >
                  {alias}
                </span>
              ))}
              {aliases.length > 3 && (
                <span className="inline-block text-xs text-gray-500 px-2 py-1">
                  +{aliases.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-blue-600">
            {formatMoney(unitPrice)}
          </div>
          <div className="text-sm text-gray-500 mt-1">per {unitType}</div>
        </div>
      </div>
    </Link>
  )
}
