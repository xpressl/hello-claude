import { NextRequest, NextResponse } from 'next/server'
import { sendQuoteEmail } from '@/lib/email/send-email'
import { EmailTemplate } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

/**
 * POST /api/quotes/[id]/send-email
 * Send a quote email to the customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
    const body = await request.json()

    // Validate request body
    const { template } = body
    if (!template) {
      return NextResponse.json(
        { error: 'Template is required' },
        { status: 400 }
      )
    }

    // Validate template type
    const validTemplates: EmailTemplate[] = ['quote_sent', 'quote_viewed', 'quote_accepted', 'quote_declined']
    if (!validTemplates.includes(template)) {
      return NextResponse.json(
        {
          error: `Invalid template. Must be one of: ${validTemplates.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Send email
    const result = await sendQuoteEmail(quoteId, template as EmailTemplate)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to send email',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      quoteId,
      template,
      emailId: result.emailId,
    })
  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send email',
      },
      { status: 500 }
    )
  }
}
