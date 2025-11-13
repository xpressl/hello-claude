/**
 * Formatting utilities for the admin dashboard
 */

/**
 * Format a quote ID for display
 * Example: "550e8400-e29b-41d4-a716-446655440000" -> "Q-550e8400"
 */
export function formatQuoteId(id: string): string {
  return `Q-${id.slice(0, 8)}`
}

/**
 * Format a currency amount
 * Example: 1234.56 -> "$1,234.56"
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '$0.00'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

/**
 * Format a date as relative time
 * Example: "2024-01-01T00:00:00Z" -> "2 hours ago" or "Jan 1, 2024"
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date'
  }

  const now = new Date()
  const diffMs = now.getTime() - dateObj.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  // Less than 1 minute
  if (diffSeconds < 60) {
    return 'just now'
  }

  // Less than 1 hour
  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`
  }

  // Less than 24 hours
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  }

  // Less than 7 days
  if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  }

  // More than a week - show formatted date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }).format(dateObj)
}

/**
 * Format a full timestamp for tooltips
 * Example: "2024-01-01T12:00:00Z" -> "January 1, 2024 at 12:00 PM"
 */
export function formatFullTimestamp(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  if (isNaN(dateObj.getTime())) {
    return 'Invalid date'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj)
}

/**
 * Truncate a string to a maximum length with ellipsis
 * Example: truncate("Very long customer name", 15) -> "Very long cu..."
 */
export function truncate(str: string | null | undefined, maxLength: number): string {
  if (!str) return '--'
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}

/**
 * Format a phone number for display
 * Example: "1234567890" -> "(123) 456-7890"
 */
export function formatPhoneNumber(phone: string | null): string {
  if (!phone) return '--'

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')

  // Format as (XXX) XXX-XXXX if 10 digits
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }

  // Return as-is if not 10 digits
  return phone
}

/**
 * Format a number with commas
 * Example: 1234567 -> "1,234,567"
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Format file size in bytes to human-readable format
 * Example: 1234567 -> "1.2 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}
