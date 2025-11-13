import { createHash } from 'crypto'

/**
 * Quote Token Utilities
 * Used for secure token-based access to customer quote view pages
 */

export function generateQuoteToken(quoteId: string): string {
  const secret = process.env.QUOTE_TOKEN_SECRET || 'dev-secret-key'
  const hash = createHash('sha256')
    .update(`${quoteId}:${secret}`)
    .digest('hex')
  return hash.substring(0, 32)
}

export function verifyQuoteToken(quoteId: string, token: string): boolean {
  const expectedToken = generateQuoteToken(quoteId)
  return expectedToken === token
}

export function generateQuoteViewUrl(quoteId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const token = generateQuoteToken(quoteId)
  return `${baseUrl}/quote/${quoteId}/view?token=${token}`
}
