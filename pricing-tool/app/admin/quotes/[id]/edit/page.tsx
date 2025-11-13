/**
 * Quote Detail Editor Page
 */

export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import QuoteDetailClient from '@/components/admin/quotes/QuoteDetailClient'
import type { Quote } from '@/lib/types'

async function getCurrentUserRole(): Promise<{ role: 'ADMIN' | 'SALES' | 'MANAGER'; userId: string } | null> {
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

  if (!userRecord) {
    return null
  }

  return {
    role: userRecord.role as 'ADMIN' | 'SALES' | 'MANAGER',
    userId: user.id
  }
}

async function fetchQuote(quoteId: string): Promise<Quote | null> {
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

  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  if (error || !quote) {
    return null
  }

  // Get line count
  const { count } = await supabase
    .from('quote_lines')
    .select('*', { count: 'exact', head: true })
    .eq('quote_id', quoteId)

  return {
    ...quote,
    line_count: count || 0
  }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function QuoteDetailEditPage({ params }: PageProps) {
  const { id } = await params

  const userAuth = await getCurrentUserRole()
  if (!userAuth) {
    redirect('/login')
  }

  const quote = await fetchQuote(id)
  if (!quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-gray-900">Quote Not Found</h1>
          <p className="mt-2 text-gray-600">The requested quote could not be found.</p>
          <a
            href="/admin/quotes"
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Back to Quotes
          </a>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <QuoteDetailClient quote={quote} userRole={userAuth.role} userId={userAuth.userId} />
    </main>
  )
}
