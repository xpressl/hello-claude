export interface ExtractedLineItem {
  raw_text: string
  sku?: string
  description?: string
  quantity?: number
  size?: string
  unit?: string
  confidence: number
  warnings: string[]
}

export function parseTextToLineItems(text: string): ExtractedLineItem[] {
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  const items: ExtractedLineItem[] = []

  for (const line of lines) {
    const item = parseTextLine(line)
    if (item) {
      items.push(item)
    }
  }

  return items
}

function parseTextLine(line: string): ExtractedLineItem | null {
  const warnings: string[] = []
  let confidence = 0.3  // Start at lower confidence

  // Skip header-like lines
  if (isHeaderLine(line)) {
    return null
  }

  // Extract SKU
  const sku = extractSKU(line)
  if (sku) {
    confidence += 0.3
  } else {
    warnings.push('No SKU detected')
  }

  // Extract quantity
  const quantity = extractQuantity(line)
  if (quantity) {
    confidence += 0.2
  } else {
    warnings.push('No quantity detected')
  }

  // Extract size
  const size = extractSize(line)
  if (size) {
    confidence += 0.2
  }

  // Extract description (remaining text after removing SKU, qty, size)
  const description = extractDescription(line, { sku, quantity, size })

  // Determine unit
  const unit = extractUnit(line) || 'EA'

  // Normalize confidence to 0-1 range
  confidence = Math.min(confidence, 1)

  return {
    raw_text: line,
    sku,
    description,
    quantity,
    size,
    unit,
    confidence,
    warnings
  }
}

function isHeaderLine(line: string): boolean {
  // Only filter lines that look like column headers, not data lines
  const headerPatterns = [
    /^(qty|quantity|sku|item|product|description|size)\s*$/i,  // Just the keyword alone
    /^(qty|quantity|sku|item|product|description|size)\s+(qty|quantity|sku|item|product|description|size)/i,  // Multiple keywords
    /^[-=]+$/,  // Separator lines
    /^\s*$/  // Empty lines
  ]
  return headerPatterns.some(pattern => pattern.test(line))
}

function extractSKU(line: string): string | undefined {
  // Pattern 1: Letters-Numbers-Letters (e.g., DR-3080-20G)
  const pattern1 = /\b([A-Z]{2,}-\d{4}-[A-Z0-9]{2,})\b/i
  const match1 = line.match(pattern1)
  if (match1) return match1[1]

  // Pattern 2: Letters-Numbers (e.g., DOOR-123)
  const pattern2 = /\b([A-Z]{3,}-\d{3,})\b/i
  const match2 = line.match(pattern2)
  if (match2) return match2[1]

  // Pattern 3: Numbers only if 5+ digits (e.g., 12345)
  const pattern3 = /\b(\d{5,})\b/
  const match3 = line.match(pattern3)
  if (match3) return match3[1]

  return undefined
}

function extractQuantity(line: string): number | undefined {
  // Pattern 1: "5x" or "5 x"
  const pattern1 = /(\d+)\s*x\b/i
  const match1 = line.match(pattern1)
  if (match1) return parseInt(match1[1])

  // Pattern 2: "qty: 10" or "quantity 10"
  const pattern2 = /(?:qty|quantity)[\s:]+(\d+)/i
  const match2 = line.match(pattern2)
  if (match2) return parseInt(match2[1])

  // Pattern 3: "10 ea" or "10 each"
  const pattern3 = /(\d+)\s+(?:ea|each|pcs|pieces)/i
  const match3 = line.match(pattern3)
  if (match3) return parseInt(match3[1])

  // Pattern 4: Number at start of line
  const pattern4 = /^(\d+)\s+/
  const match4 = line.match(pattern4)
  if (match4) return parseInt(match4[1])

  return undefined
}

function extractSize(line: string): string | undefined {
  // Pattern 1: "30x80" or "30 x 80"
  const pattern1 = /(\d{2,3})\s*x\s*(\d{2,3})\b/i
  const match1 = line.match(pattern1)
  if (match1) return `${match1[1]}x${match1[2]}`

  // Pattern 2: Feet and inches: 3'0" x 6'8"
  const pattern2 = /(\d)'(\d{1,2})"\s*x\s*(\d)'(\d{1,2})"/i
  const match2 = line.match(pattern2)
  if (match2) {
    const width = parseInt(match2[1]) * 12 + parseInt(match2[2])
    const height = parseInt(match2[3]) * 12 + parseInt(match2[4])
    return `${width}x${height}`
  }

  // Pattern 3: "size: 36x84" or "size 36x84"
  const pattern3 = /size[\s:]+(\d{2,3}\s*x\s*\d{2,3})/i
  const match3 = line.match(pattern3)
  if (match3) return match3[1].replace(/\s/g, '')

  return undefined
}

function extractUnit(line: string): string | undefined {
  const unitPatterns: Record<string, string[]> = {
    'LF': ['lf', 'linear foot', 'linear feet', 'lineal'],
    'SF': ['sf', 'square foot', 'square feet', 'sq ft'],
    'BOX': ['box', 'boxes'],
    'SET': ['set', 'sets'],
    'PKG': ['pkg', 'package', 'packages'],
    'EA': ['ea', 'each', 'pcs', 'pieces']
  }

  const lowerLine = line.toLowerCase()

  for (const [unit, patterns] of Object.entries(unitPatterns)) {
    if (patterns.some(p => lowerLine.includes(p))) {
      return unit
    }
  }

  return undefined
}

function extractDescription(
  line: string,
  extracted: { sku?: string; quantity?: number; size?: string }
): string {
  let desc = line

  // Remove SKU
  if (extracted.sku) {
    desc = desc.replace(extracted.sku, '')
  }

  // Remove quantity patterns
  desc = desc.replace(/\d+\s*x\b/i, '')
  desc = desc.replace(/(?:qty|quantity)[\s:]+\d+/i, '')
  desc = desc.replace(/\d+\s+(?:ea|each|pcs)/i, '')

  // Remove size patterns
  if (extracted.size) {
    desc = desc.replace(/\d{2,3}\s*x\s*\d{2,3}/i, '')
  }

  // Clean up
  desc = desc.replace(/\s+/g, ' ').trim()

  return desc || 'Unknown item'
}
