export function validateSKU(sku: string): boolean {
  // Valid if alphanumeric with dashes, 5+ chars
  return /^[A-Z0-9-]{5,}$/i.test(sku)
}

export function validateQuantity(qty: number): boolean {
  return qty > 0 && qty < 100000 && !isNaN(qty)
}

export function validateSize(size: string): boolean {
  // Valid if format like "30x80"
  const match = size.match(/^(\d{2,3})x(\d{2,3})$/)
  if (!match) return false

  const width = parseInt(match[1])
  const height = parseInt(match[2])

  // Reasonable door/window sizes (12-120 inches width, 12-144 inches height)
  return width >= 12 && width <= 120 && height >= 12 && height <= 144
}

export function normalizeSize(size: string): string {
  // Convert "30 x 80" or "30X80" to "30x80"
  return size.replace(/\s/g, '').toLowerCase()
}

export function normalizeSKU(sku: string): string {
  // Convert to uppercase, trim
  return sku.toUpperCase().trim()
}
