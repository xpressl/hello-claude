'use client'

interface WarningBadgeProps {
  warnings: string[]
}

export function WarningBadge({ warnings }: WarningBadgeProps) {
  if (warnings.length === 0) return null

  return (
    <div className="group relative inline-block">
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded cursor-help">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
      </span>

      {/* Tooltip */}
      <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white text-xs rounded px-3 py-2 bottom-full mb-2 left-0 w-64 shadow-lg">
        <ul className="space-y-1">
          {warnings.map((warning, index) => (
            <li key={index}>• {warning}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
