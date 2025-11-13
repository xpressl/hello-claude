/**
 * Admin Approvals Queue Page
 */

export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ApprovalsClient from '@/components/admin/approvals/ApprovalsClient'

async function getCurrentUserRole(): Promise<'ADMIN' | 'SALES' | 'MANAGER' | null> {
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return null
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  return userRecord?.role as 'ADMIN' | 'SALES' | 'MANAGER' | null
}

export default async function ApprovalsPage() {
  const role = await getCurrentUserRole()

  if (!role) {
    redirect('/login')
  }

  if (!['ADMIN', 'MANAGER'].includes(role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">
              You do not have permission to access the approvals queue.
            </p>
            <a
              href="/admin"
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Return to Admin
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <ApprovalsClient userRole={role} />
    </main>
  )
}
