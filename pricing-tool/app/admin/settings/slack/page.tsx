/**
 * Slack Integration Settings Page
 * Admin only - Configure Slack webhooks for notifications
 */

'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface SlackConfig {
  id: string
  event_type: string
  webhook_url: string
  channel?: string
  enabled: boolean
  created_at: string
  updated_at: string
}

const EVENT_TYPES = [
  { id: 'quote_accepted', label: 'Quote Accepted', description: 'When a quote is accepted' },
  { id: 'quote_declined', label: 'Quote Declined', description: 'When a quote is declined' },
  { id: 'approval_required', label: 'Approval Required', description: 'When approval is needed' },
  { id: 'approval_approved', label: 'Approval Approved', description: 'When approval is approved' },
  { id: 'quote_sent', label: 'Quote Sent', description: 'When a quote is sent' }
]

export default function SlackSettingsPage() {
  const [configs, setConfigs] = useState<SlackConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    webhookUrl: '',
    channel: ''
  })
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchConfigs()
  }, [])

  async function fetchConfigs() {
    try {
      const response = await fetch('/api/admin/slack')
      if (!response.ok) throw new Error('Failed to fetch Slack configs')

      const { configs: data } = await response.json()
      setConfigs(data)
    } catch (error) {
      console.error('Error fetching configs:', error)
      setMessage({ type: 'error', text: 'Failed to load Slack configuration' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(eventType: string) {
    if (!formData.webhookUrl) {
      setMessage({ type: 'error', text: 'Webhook URL is required' })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          eventType,
          webhookUrl: formData.webhookUrl,
          channel: formData.channel || null,
          enabled: true
        })
      })

      if (!response.ok) throw new Error('Failed to save configuration')

      const { configs: data } = await response.json()
      setConfigs(data)
      setEditingId(null)
      setFormData({ webhookUrl: '', channel: '' })
      setMessage({ type: 'success', text: 'Configuration saved' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error saving config:', error)
      setMessage({ type: 'error', text: 'Failed to save configuration' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(eventType: string, enabled: boolean) {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          eventType,
          enabled: !enabled
        })
      })

      if (!response.ok) throw new Error('Failed to toggle configuration')

      const { configs: data } = await response.json()
      setConfigs(data)
    } catch (error) {
      console.error('Error toggling config:', error)
      setMessage({ type: 'error', text: 'Failed to toggle configuration' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(webhookUrl: string) {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          webhookUrl
        })
      })

      if (!response.ok) throw new Error('Failed to send test message')

      setMessage({ type: 'success', text: 'Test message sent successfully' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error sending test:', error)
      setMessage({ type: 'error', text: 'Failed to send test message' })
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(config: SlackConfig) {
    setEditingId(config.event_type)
    setFormData({
      webhookUrl: config.webhook_url,
      channel: config.channel || ''
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading Slack settings...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Slack Integration</h1>
      <p className="text-gray-600 mb-8">
        Configure Slack webhooks to receive notifications about quotes and approvals
      </p>

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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold mb-4">Event Configurations</h2>
          <p className="text-sm text-gray-600">
            Configure webhooks for each event type. You can get webhook URLs from your Slack workspace settings.
          </p>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Event
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Webhook URL
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
            {EVENT_TYPES.map((eventType) => {
              const config = configs.find(c => c.event_type === eventType.id)
              const isEditing = editingId === eventType.id

              return (
                <tr key={eventType.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{eventType.label}</p>
                      <p className="text-sm text-gray-500">{eventType.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="text"
                        placeholder="https://hooks.slack.com/services/..."
                        value={formData.webhookUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, webhookUrl: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    ) : config ? (
                      <span className="text-sm text-gray-600 truncate block max-w-xs">
                        {config.webhook_url.substring(0, 50)}...
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Not configured</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {config ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={() =>
                            handleToggle(eventType.id, config.enabled)
                          }
                          disabled={saving}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm text-gray-600">
                          {config.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Disabled</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-sm px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
                          disabled={saving}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSave(eventType.id)}
                          className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          disabled={saving}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleEdit(config || { event_type: eventType.id, webhook_url: '', channel: '', enabled: false })}
                          className="text-sm px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                          disabled={saving}
                        >
                          Edit
                        </button>
                        {config && (
                          <button
                            onClick={() => handleTest(config.webhook_url)}
                            className="text-sm px-3 py-1 text-green-600 hover:bg-green-50 rounded"
                            disabled={saving || !config.enabled}
                          >
                            Test
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions</h3>
        <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
          <li>Go to your Slack workspace settings</li>
          <li>Create an Incoming Webhook for the channel where you want notifications</li>
          <li>Copy the webhook URL and paste it above</li>
          <li>Click "Test" to verify the connection</li>
          <li>Toggle each event type to enable notifications</li>
        </ol>
      </div>
    </div>
  )
}
