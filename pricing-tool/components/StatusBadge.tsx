/**
 * StatusBadge Component
 * Displays a status badge with appropriate color coding
 */

import type { QuoteStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: QuoteStatus
  className?: string
}

const statusConfig: Record<
  QuoteStatus,
  { label: string; className: string }
> = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-800 border border-gray-300',
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-blue-100 text-blue-800 border border-blue-300',
  },
  reviewed: {
    label: 'Reviewed',
    className: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  },
  sent: {
    label: 'Sent',
    className: 'bg-green-100 text-green-800 border border-green-300',
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  },
  declined: {
    label: 'Declined',
    className: 'bg-red-100 text-red-800 border border-red-300',
  },
  expired: {
    label: 'Expired',
    className: 'bg-gray-100 text-gray-600 border border-gray-300',
  },
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  )
}
