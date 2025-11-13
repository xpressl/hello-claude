import { createClient } from '@supabase/supabase-js'
import { getEmailTemplate, EmailTemplate } from './templates'
import { generateQuotePDF, savePDFToStorage, getPDFDownloadUrl } from '../pdf/generate-pdf'
import { generateQuoteViewUrl } from '../quote-tokens'

/**
 * Email Service
 * Handles sending quote emails via Resend or fallback methods
 */

export interface EmailSendResult {
  success: boolean
  emailId?: string
  error?: string
}

interface QuoteForEmail {
  id: string
  customer_name: string | null
  customer_email: string | null
  total: number
  expires_at: string | null
  status: string
}

/**
 * Send quote email using Resend
 */
export async function sendQuoteEmail(
  quoteId: string,
  template: EmailTemplate
): Promise<EmailSendResult> {
  try {
    const quote = await fetchQuoteForEmail(quoteId)
    if (!quote) {
      return {
        success: false,
        error: `Quote ${quoteId} not found`,
      }
    }

    if (!quote.customer_email) {
      return {
        success: false,
        error: 'Customer email not provided',
      }
    }

    // Generate view URL for customer
    const viewUrl = generateQuoteViewUrl(quoteId)

    // Get email template content
    const emailContent = getEmailTemplate(template, quote, viewUrl)

    // Get PDF attachment if sending quote
    let attachmentData: Buffer | undefined
    let attachmentFilename: string | undefined

    if (template === 'quote_sent') {
      const pdfBuffer = await generateQuotePDF(quoteId)
      if (pdfBuffer) {
        attachmentData = pdfBuffer
        attachmentFilename = `quote_${quoteId.substring(0, 8)}.pdf`
      }
    }

    // Send via Resend if API key available
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      return await sendViaResend(
        {
          to: quote.customer_email,
          subject: emailContent.subject,
          html: emailContent.html,
          attachmentData,
          attachmentFilename,
        },
        quoteId,
        template
      )
    }

    // Fallback: Log email send (for development)
    return await logEmailSend(quoteId, template, quote.customer_email)
  } catch (error) {
    console.error('Error sending quote email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send email via Resend API
 */
async function sendViaResend(
  emailData: {
    to: string
    subject: string
    html: string
    attachmentData?: Buffer
    attachmentFilename?: string
  },
  quoteId: string,
  template: EmailTemplate
): Promise<EmailSendResult> {
  const resendApiKey = process.env.RESEND_API_KEY!
  const fromEmail = process.env.FROM_EMAIL || 'quotes@company.com'

  try {
    const endpoint = 'https://api.resend.com/emails'

    const formData = new FormData()
    formData.append('from', fromEmail)
    formData.append('to', emailData.to)
    formData.append('subject', emailData.subject)
    formData.append('html', emailData.html)

    if (emailData.attachmentData && emailData.attachmentFilename) {
      const blob = new Blob([emailData.attachmentData], { type: 'application/pdf' })
      formData.append('attachments', blob, emailData.attachmentFilename)
    }

    // Add tags for tracking
    formData.append('tags', JSON.stringify([
      { name: 'quote_id', value: quoteId },
      { name: 'template', value: template },
    ]))

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Resend API error:', error)
      return {
        success: false,
        error: `Resend API error: ${response.status}`,
      }
    }

    const data = (await response.json()) as { id?: string }
    const emailId = data.id

    // Log successful send
    await logEmailEvent(quoteId, template, 'sent', emailId)

    return {
      success: true,
      emailId,
    }
  } catch (error) {
    console.error('Error sending via Resend:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Fallback email logging for development
 */
async function logEmailSend(
  quoteId: string,
  template: EmailTemplate,
  customerEmail: string
): Promise<EmailSendResult> {
  console.log(`[EMAIL] Template: ${template}`)
  console.log(`[EMAIL] Quote ID: ${quoteId}`)
  console.log(`[EMAIL] To: ${customerEmail}`)
  console.log(`[EMAIL] Time: ${new Date().toISOString()}`)

  // Still log to database
  await logEmailEvent(quoteId, template, 'logged')

  return {
    success: true,
    emailId: `dev-${Date.now()}`,
  }
}

/**
 * Log email event to database
 */
async function logEmailEvent(
  quoteId: string,
  template: EmailTemplate,
  status: string,
  emailId?: string
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    await supabase.from('events').insert({
      quote_id: quoteId,
      event_type: 'email_sent',
      payload_json: {
        template,
        status,
        emailId: emailId || null,
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error logging email event:', error)
  }
}

/**
 * Fetch quote data for email
 */
async function fetchQuoteForEmail(quoteId: string): Promise<QuoteForEmail | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('id, customer_name, customer_email, total, expires_at, status')
      .eq('id', quoteId)
      .single()

    if (error || !quote) {
      console.error('Quote not found:', error)
      return null
    }

    return quote as QuoteForEmail
  } catch (error) {
    console.error('Error fetching quote:', error)
    return null
  }
}

/**
 * Send notification to sales team
 */
export async function notifySalesTeam(
  quoteId: string,
  message: string,
  action?: 'accepted' | 'declined'
): Promise<void> {
  const salesEmail = process.env.SALES_TEAM_EMAIL || 'sales@company.com'

  try {
    // Create a simple notification email
    const subject = `Quote ${action ? action.toUpperCase() : 'UPDATE'} - #${quoteId.substring(0, 8)}`
    const html = `
<!DOCTYPE html>
<html>
<body>
  <h2>${message}</h2>
  <p><strong>Quote ID:</strong> ${quoteId}</p>
  <p><strong>Action:</strong> ${action || 'N/A'}</p>
  <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
</body>
</html>
    `

    // Try to send via Resend
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      const fromEmail = process.env.FROM_EMAIL || 'quotes@company.com'

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: salesEmail,
          subject,
          html,
        }),
      })
    }
  } catch (error) {
    console.error('Error notifying sales team:', error)
  }
}
