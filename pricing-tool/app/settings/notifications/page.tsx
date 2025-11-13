/**
 * Notification Preferences Settings Page
 * Allows users to manage their notification preferences
 */

'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { NOTIFICATION_TYPES } from '@/lib/notifications/notification-templates'

interface Preference {
  id: string
  notification_type: string
  email_enabled: boolean
  digest_enabled: boolean
}

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const supabase = createClientComponentClient()

  // Fetch preferences on mount
  useEffect(() => {
    fetchPreferences()
  }, [])

  async function fetchPreferences() {
    try {
      const response = await fetch('/api/preferences/notifications')
      if (!response.ok) throw new Error('Failed to fetch preferences')

      const { preferences: data } = await response.json()
      setPreferences(data)
    } catch (error) {
      console.error('Error fetching preferences:', error)
      setMessage({ type: 'error', text: 'Failed to load preferences' })
    } finally {
      setLoading(false)
    }
  }

  async function updatePreference(
    notificationType: string,
    emailEnabled: boolean,
    digestEnabled: boolean
  ) {
    setSaving(true)
    try {
      const response = await fetch('/api/preferences/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationType,
          emailEnabled,
          digestEnabled
        })
      })

      if (!response.ok) throw new Error('Failed to update preference')

      const { preferences: data } = await response.json()
      setPreferences(data)
      setMessage({ type: 'success', text: 'Preference updated' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error updating preference:', error)
      setMessage({ type: 'error', text: 'Failed to update preference' })
    } finally {
      setSaving(false)
    }
  }

  function isEnabled(notificationType: string, type: 'email' | 'digest'): boolean {
    const pref = preferences.find(p => p.notification_type === notificationType)
    return type === 'email' ? pref?.email_enabled ?? true : pref?.digest_enabled ?? false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading notification settings...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Notification Preferences</h1>
      <p className="text-gray-600 mb-8">
        Manage how you receive notifications about quotes and approvals
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
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Notification Type
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                Email
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                Daily Digest
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {NOTIFICATION_TYPES.map((type) => (
              <tr key={type.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{type.label}</p>
                    <p className="text-sm text-gray-500">{type.description}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={isEnabled(type.id, 'email')}
                    onChange={(e) =>
                      updatePreference(
                        type.id,
                        e.target.checked,
                        isEnabled(type.id, 'digest')
                      )
                    }
                    disabled={saving}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={isEnabled(type.id, 'digest')}
                    onChange={(e) =>
                      updatePreference(
                        type.id,
                        isEnabled(type.id, 'email'),
                        e.target.checked
                      )
                    }
                    disabled={saving || !isEnabled(type.id, 'email')}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Digest Notifications</h3>
        <p className="text-sm text-blue-800">
          When digest is enabled for a notification type, notifications will be batched into a
          single daily email sent at 8:00 AM instead of sending immediately.
        </p>
      </div>
    </div>
  )
}
