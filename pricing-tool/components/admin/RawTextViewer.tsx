'use client'

interface RawTextViewerProps {
  item: {
    raw_text?: string
    source: string
    mapping_warnings_json?: {
      warnings: string[]
    }
  }
  onClose: () => void
}

export function RawTextViewer({ item, onClose }: RawTextViewerProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Original Extracted Text</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Source</label>
            <p className="mt-1 text-sm uppercase px-2 py-1 bg-gray-100 rounded inline-block">
              {item.source}
            </p>
          </div>

          {item.raw_text && (
            <div>
              <label className="text-sm font-medium text-gray-700">Raw Text</label>
              <pre className="mt-1 p-4 bg-gray-50 rounded text-sm whitespace-pre-wrap font-mono">
                {item.raw_text}
              </pre>
            </div>
          )}

          {item.mapping_warnings_json?.warnings && item.mapping_warnings_json.warnings.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700">Warnings</label>
              <ul className="mt-1 space-y-1">
                {item.mapping_warnings_json.warnings.map((warning, i) => (
                  <li key={i} className="text-sm text-yellow-700 flex items-start gap-2">
                    <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
