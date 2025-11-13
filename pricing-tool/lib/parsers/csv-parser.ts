import Papa from 'papaparse'

export interface ParsedCSVData {
  headers: string[]
  rows: Record<string, any>[]
  errors: Papa.ParseError[]
}

export async function parseCSV(file: File): Promise<ParsedCSVData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,  // Auto-convert numbers
      transformHeader: (header) => {
        // Normalize headers (lowercase, remove special chars)
        return header.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
      },
      complete: (results) => {
        resolve({
          headers: results.meta.fields || [],
          rows: results.data as Record<string, any>[],
          errors: results.errors
        })
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

export function detectCSVColumns(headers: string[]): {
  sku?: string
  quantity?: string
  description?: string
  size?: string
  unit?: string
  price?: string
} {
  const mapping: Record<string, string> = {}

  // SKU patterns
  const skuPatterns = ['sku', 'item', 'product', 'code', 'part']
  const skuHeader = headers.find(h =>
    skuPatterns.some(p => h.includes(p))
  )
  if (skuHeader) mapping.sku = skuHeader

  // Quantity patterns
  const qtyPatterns = ['qty', 'quantity', 'count', 'amount']
  const qtyHeader = headers.find(h =>
    qtyPatterns.some(p => h.includes(p))
  )
  if (qtyHeader) mapping.quantity = qtyHeader

  // Description patterns
  const descPatterns = ['desc', 'description', 'name', 'product']
  const descHeader = headers.find(h =>
    descPatterns.some(p => h.includes(p))
  )
  if (descHeader) mapping.description = descHeader

  // Size patterns
  const sizePatterns = ['size', 'dimension', 'dims']
  const sizeHeader = headers.find(h =>
    sizePatterns.some(p => h.includes(p))
  )
  if (sizeHeader) mapping.size = sizeHeader

  // Unit patterns
  const unitPatterns = ['unit', 'uom', 'each']
  const unitHeader = headers.find(h =>
    unitPatterns.some(p => h.includes(p))
  )
  if (unitHeader) mapping.unit = unitHeader

  // Price patterns
  const pricePatterns = ['price', 'cost', 'rate', 'unit_price']
  const priceHeader = headers.find(h =>
    pricePatterns.some(p => h.includes(p))
  )
  if (priceHeader) mapping.price = priceHeader

  return mapping
}
