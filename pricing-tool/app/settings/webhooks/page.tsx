/**
 * Webhooks Management Page
 * Allows users to create and manage custom webhooks for external integrations
 */

'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Webhook {
  id: string
  url: string
  event_types: string[]
  is_active: boolean
  last_triggered_at?: string
  failure_count: number
  created_at: string
}

const AVAILABLE_EVENTS = [
  { id: 'quote_created', label: 'Quote Created' },
  { id: 'quote_sent', label: 'Quote Sent' },
  { id: 'quote_accepted', label: 'Quote Accepted' },
  { id: 'quote_declined', label: 'Quote Declined' },
  { id: 'approval_required', label: 'Approval Required' },
  { id: 'approval_approved', label: 'Approval Approved' }
]

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [selectedSecret, setSelectedSecret] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    url: '',
    eventTypes: [] as string[]
  })
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchWebhooks()
  }, [])

  async function fetchWebhooks() {
    try {
      const response = await fetch('/api/webhooks/manage')
      if (!response.ok) throw new Error('Failed to fetch webhooks')

      const { webhooks: data } = await response.json()
      setWebhooks(data)
    } catch (error) {
      console.error('Error fetching webhooks:', error)
      setMessage({ type: 'error', text: 'Failed to load webhooks' })
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!formData.url || formData.eventTypes.length === 0) {
      setMessage({ type: 'error', text: 'URL and at least one event type are required' })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/webhooks/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formData.url,
          eventTypes: formData.eventTypes
        })
      })

      if (!response.ok) throw new Error('Failed to create webhook')

      const { webhook, secret } = await response.json()
      setSelectedSecret(secret)
      setWebhooks([...webhooks, webhook])
      setFormData({ url: '', eventTypes: [] })
      setMessage({ type: 'success', text: 'Webhook created' })

      // Show secret for 30 seconds then hide
      setTimeout(() => setSelectedSecret(null), 30000)
    } catch (error) {
      console.error('Error creating webhook:', error)
      setMessage({ type: 'error', text: 'Failed to create webhook' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(webhookId: string) {
    if (!confirm('Are you sure you want to delete this webhook?')) return

    setSaving(true)
    try {
      const response = await fetch('/api/webhooks/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId })
      })

      if (!response.ok) throw new Error('Failed to delete webhook')

      setWebhooks(webhooks.filter(w => w.id !== webhookId))
      setMessage({ type: 'success', text: 'Webhook deleted' })
    } catch (error) {
      console.error('Error deleting webhook:', error)
      setMessage({ type: 'error', text: 'Failed to delete webhook' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(webhookId: string) {
    setSaving(true)
    try {
      const response = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId })
      })

      if (!response.ok) throw new Error('Failed to send test')

      setMessage({ type: 'success', text: 'Test event sent to webhook' })
    } catch (error) {
      console.error('Error testing webhook:', error)
      setMessage({ type: 'error', text: 'Failed to send test event' })
    } finally {
      setSaving(false)
    }
  }

  function toggleEventType(eventTypeId: string) {
    setFormData(prev => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(eventTypeId)
        ? prev.eventTypes.filter(t => t !== eventTypeId)
        : [...prev.eventTypes, eventTypeId]
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading webhooks...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Webhooks</h1>
          <p className="text-gray-600">
            Create webhooks to receive events from our system
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Webhook
        </button>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {webhooks.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">No webhooks yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first webhook
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  URL
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Events
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {webhooks.map((webhook) => (
                <tr key={webhook.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 truncate block max-w-xs">
                      {webhook.url}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {webhook.event_types.map((event) => (
                        <span
                          key={event}
                          className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          webhook.is_active ? 'bg-green-600' : 'bg-red-600'
                        }`}
                      />
                      <span className="text-sm text-gray-600">
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {webhook.failure_count > 0 && (
                        <span className="text-xs text-red-600">
                          ({webhook.failure_count} failures)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleTest(webhook.id)}
                        className="text-sm px-3 py-1 text-green-600 hover:bg-green-50 rounded"
                        disabled={saving || !webhook.is_active}
                      >
                        Test
                      </button>
                      <button
                        onClick={() => handleDelete(webhook.id)}
                        className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Webhook Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Create Webhook</h2>
            </div>

            <div className="p-6 space-y-6">
              {selectedSecret && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-yellow-900 mb-2">
                    Save your webhook secret now - you won't see it again!
                  </p>
                  <code className="block bg-white p-2 rounded text-xs text-gray-800 break-all">
                    {selectedSecret}
                  </code>
                  <p className="text-xs text-yellow-800 mt-2">
                    Use this secret to verify webhook signatures from our system.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Webhook URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/webhooks/quotes"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Event Types
                </label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label key={event.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.eventTypes.includes(event.id)}
                        onChange={() => toggleEventType(event.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  Webhooks will receive POST requests with event data. Use the webhook secret to verify
                  the signature in the X-Webhook-Signature header.
                </p>
              </div>
            </div>

            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowModal(false)
                  setFormData({ url: '', eventTypes: [] })
                  setSelectedSecret(null)
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={saving}
              >
                Close
              </button>
              {!selectedSecret && (
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : 'Create Webhook'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
