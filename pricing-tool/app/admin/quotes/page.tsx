/**
 * Admin Quotes Dashboard Page
 * Server Component for initial load and authentication
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import QuotesTable from '@/components/QuotesTable'
import type { Quote } from '@/lib/types'

// Get current user role with proper authentication
async function getCurrentUserRole(): Promise<'ADMIN' | 'SALES' | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return null
  }

  // Get user role from database
  const { data: userRecord, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !userRecord) {
    return null
  }

  return userRecord.role as 'ADMIN' | 'SALES' | null
}

// Fetch initial quotes
async function fetchInitialQuotes(): Promise<{
  quotes: Quote[]
  total: number
}> {
  try {
    // Let the client component fetch data
    // This ensures we don't duplicate authentication logic
    return {
      quotes: [],
      total: 0,
    }
  } catch (error) {
    console.error('Error fetching initial quotes:', error)
    return {
      quotes: [],
      total: 0,
    }
  }
}

export default async function AdminQuotesPage() {
  // Check authentication
  const role = await getCurrentUserRole()

  // Redirect if not authenticated
  if (!role) {
    redirect('/login')
  }

  // Check role authorization
  if (!['ADMIN', 'SALES'].includes(role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h1 className="mt-4 text-xl font-semibold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">
              You do not have permission to access the admin dashboard.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Required role: ADMIN or SALES
            </p>
            <div className="mt-6">
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Return Home
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Fetch initial quotes data
  const { quotes, total } = await fetchInitialQuotes()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <QuotesTable initialQuotes={quotes} initialTotal={total} userRole={role || 'SALES'} />
      </div>
    </main>
  )
}
