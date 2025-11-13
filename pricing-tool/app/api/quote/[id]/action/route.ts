import { NextRequest, NextResponse } from 'next/server'
import { verifyQuoteToken } from '@/lib/quote-tokens'
import { trackQuoteAction } from '@/lib/track-view'
import { notifySalesTeam } from '@/lib/email/send-email'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/quote/[id]/action
 * Handle quote accept/decline actions from customers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
    const body = await request.json()

    const { token, action } = body

    // Validate token
    if (!token || !verifyQuoteToken(quoteId, token)) {
      return NextResponse.json(
        { error: 'Invalid or missing token' },
        { status: 401 }
      )
    }

    // Validate action
    if (!action || !['accepted', 'declined'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "accepted" or "declined"' },
        { status: 400 }
      )
    }

    // Get user agent for tracking
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || null

    // Track the action
    await trackQuoteAction(quoteId, action as 'accepted' | 'declined', userAgent)

    // Notify sales team
    const message = `Quote #${quoteId.substring(0, 8)} has been ${action} by the customer`
    await notifySalesTeam(quoteId, message, action as 'accepted' | 'declined')

    // Return success response
    return NextResponse.json({
      success: true,
      quoteId,
      action,
      message: `Quote has been ${action}. Thank you for your response!`,
    })
  } catch (error) {
    console.error('Error handling quote action:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process action',
      },
      { status: 500 }
    )
  }
}
