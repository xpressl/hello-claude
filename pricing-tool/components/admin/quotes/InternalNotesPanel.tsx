'use client'

import { useState, useEffect } from 'react'

interface InternalNote {
  id: string
  quote_id: string
  note: string
  created_by: string
  created_at: string
}

interface InternalNotesPanelProps {
  quoteId: string
}

function formatDateTime(date: string): string {
  try {
    return new Date(date).toLocaleString()
  } catch {
    return date
  }
}

export function InternalNotesPanel({ quoteId }: InternalNotesPanelProps) {
  const [notes, setNotes] = useState('')
  const [savedNotes, setSavedNotes] = useState<InternalNote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNotes()
  }, [quoteId])

  async function fetchNotes() {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/internal-notes`)
      const data = await res.json()
      setSavedNotes(data.notes || [])
    } catch (err) {
      console.error('Failed to fetch notes:', err)
    }
  }

  const handleSaveNote = async () => {
    if (!notes.trim()) {
      setError('Note cannot be empty')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/quotes/${quoteId}/internal-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: notes })
      })

      if (res.ok) {
        setNotes('')
        fetchNotes()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save note')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Internal Notes</h3>

      {/* Add note */}
      <div className="space-y-2 mb-6">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24"
          placeholder="Add internal note (not visible to customer)..."
        />
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        <button
          onClick={handleSaveNote}
          disabled={!notes.trim() || loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Saving...' : 'Add Note'}
        </button>
      </div>

      {/* Notes history */}
      <div className="space-y-3 max-h-64 overflow-auto">
        {savedNotes.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No notes yet</p>
        ) : (
          savedNotes.map(note => (
            <div key={note.id} className="border-l-2 border-blue-500 pl-3 py-2">
              <p className="text-sm text-gray-900">{note.note}</p>
              <p className="text-xs text-gray-500 mt-1">
                {note.created_by} • {formatDateTime(note.created_at)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
