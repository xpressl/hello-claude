export interface SizeNormalizationResult {
  original: string
  normalized: string
  width: number  // In inches
  height: number  // In inches
  format: 'inches' | 'feet-inches' | 'metric'
  confidence: number
}

export function normalizeSize(input: string): SizeNormalizationResult | null {
  // Remove all whitespace
  const cleaned = input.replace(/\s+/g, '')

  // Pattern 1: "30x80" (inches)
  const inchPattern = /^(\d{2,3})x(\d{2,3})$/i
  const inchMatch = cleaned.match(inchPattern)
  if (inchMatch) {
    const width = parseInt(inchMatch[1])
    const height = parseInt(inchMatch[2])

    // Validate reasonable sizes (12-144 inches)
    if (width >= 12 && width <= 144 && height >= 12 && height <= 144) {
      return {
        original: input,
        normalized: `${width}x${height}`,
        width,
        height,
        format: 'inches',
        confidence: 0.95
      }
    }
  }

  // Pattern 2: "3'0\" x 6'8\"" (feet-inches)
  const feetPattern = /^(\d)'(\d{1,2})"?x(\d)'(\d{1,2})"?$/i
  const feetMatch = cleaned.match(feetPattern)
  if (feetMatch) {
    const width = parseInt(feetMatch[1]) * 12 + parseInt(feetMatch[2])
    const height = parseInt(feetMatch[3]) * 12 + parseInt(feetMatch[4])

    if (width >= 12 && width <= 144 && height >= 12 && height <= 144) {
      return {
        original: input,
        normalized: `${width}x${height}`,
        width,
        height,
        format: 'feet-inches',
        confidence: 0.9
      }
    }
  }

  // Pattern 3: "762x2032" (millimeters - convert to inches)
  const mmPattern = /^(\d{3,4})x(\d{3,4})$/
  const mmMatch = cleaned.match(mmPattern)
  if (mmMatch) {
    const widthMm = parseInt(mmMatch[1])
    const heightMm = parseInt(mmMatch[2])

    // Check if values are reasonable for mm (300-3000mm)
    if (widthMm >= 300 && widthMm <= 3000 && heightMm >= 300 && heightMm <= 3000) {
      const width = Math.round(widthMm / 25.4)  // Convert mm to inches
      const height = Math.round(heightMm / 25.4)

      return {
        original: input,
        normalized: `${width}x${height}`,
        width,
        height,
        format: 'metric',
        confidence: 0.85
      }
    }
  }

  return null
}

export function generateSizeVariations(size: string): string[] {
  const normalized = normalizeSize(size)
  if (!normalized) return [size]

  const { width, height } = normalized

  return [
    `${width}x${height}`,           // 30x80
    `${width} x ${height}`,         // 30 x 80
    `${width}X${height}`,           // 30X80
    `${Math.floor(width/12)}'${width%12}" x ${Math.floor(height/12)}'${height%12}"`,  // 3'0" x 6'8"
    `${width}"x${height}"`        // 30"x80"
  ]
}
