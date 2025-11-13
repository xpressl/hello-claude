# Task 11: Client-Side File Parsers

## Objective
Implement client-side parsers for CSV, text, and spreadsheet files to extract line items before upload, with pattern recognition for SKUs, quantities, and sizes.

## Context
- Parse files on client-side before upload (faster feedback, less server load)
- Extract structured data from unstructured text
- Support CSV, XLSX, and plain text formats
- Use heuristics to detect SKU, quantity, size patterns
- Provide confidence scores for extracted data
- Allow user to review/correct before adding to quote

## Requirements

### 1. CSV Parser with PapaParse

**Install dependency:**
```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

**File:** `pricing-tool/lib/parsers/csv-parser.ts`

**Features:**
- Auto-detect delimiter (comma, tab, semicolon)
- Handle quoted fields
- Skip empty rows
- Map column headers
- Validate data types

```typescript
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
```

### 2. XLSX Parser

**Install dependency:**
```bash
npm install xlsx
```

**File:** `pricing-tool/lib/parsers/xlsx-parser.ts`

```typescript
import * as XLSX from 'xlsx'

export interface ParsedXLSXData {
  sheets: string[]
  data: Record<string, any[][]>
}

export async function parseXLSX(file: File): Promise<ParsedXLSXData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const result: ParsedXLSXData = {
          sheets: workbook.SheetNames,
          data: {}
        }

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: ''
          })
          result.data[sheetName] = jsonData as any[][]
        })

        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

export function convertXLSXToCSVFormat(
  xlsxData: any[][],
  sheetName: string
): ParsedCSVData {
  if (xlsxData.length === 0) {
    return { headers: [], rows: [], errors: [] }
  }

  // First row is headers
  const headers = xlsxData[0].map((h: any) =>
    String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')
  )

  // Remaining rows are data
  const rows = xlsxData.slice(1).map(row => {
    const obj: Record<string, any> = {}
    row.forEach((cell: any, index: number) => {
      const header = headers[index]
      if (header) {
        obj[header] = cell
      }
    })
    return obj
  })

  return { headers, rows, errors: [] }
}
```

### 3. Text Parser with Pattern Recognition

**File:** `pricing-tool/lib/parsers/text-parser.ts`

**Features:**
- Detect line items from unstructured text
- Extract SKU patterns (e.g., "DR-3080-20G", "DOOR-123")
- Extract quantity patterns (e.g., "5x", "10 ea", "qty: 20")
- Extract size patterns (e.g., "30x80", "36 x 84", "3'0\" x 6'8\"")
- Calculate confidence scores

```typescript
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
  let confidence = 0.5  // Start at medium confidence

  // Skip header-like lines
  if (isHeaderLine(line)) {
    return null
  }

  // Extract SKU
  const sku = extractSKU(line)
  if (sku) {
    confidence += 0.2
  } else {
    warnings.push('No SKU detected')
  }

  // Extract quantity
  const quantity = extractQuantity(line)
  if (quantity) {
    confidence += 0.15
  } else {
    warnings.push('No quantity detected')
  }

  // Extract size
  const size = extractSize(line)
  if (size) {
    confidence += 0.15
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
  const headerPatterns = [
    /^(qty|quantity|sku|item|product|description|size)/i,
    /^[-=]+$/,
    /^\s*$/
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
```

### 4. Pattern Validator

**File:** `pricing-tool/lib/parsers/pattern-validator.ts`

```typescript
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

  // Reasonable door/window sizes
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
```

### 5. Catalog Matching

**File:** `pricing-tool/lib/parsers/catalog-matcher.ts`

**Purpose:** Match extracted SKUs/descriptions to catalog items

```typescript
import { Product } from '@/lib/types'
import Fuse from 'fuse.js'

export interface CatalogMatch {
  product: Product
  score: number  // 0-1, higher is better
  matchType: 'exact_sku' | 'fuzzy_sku' | 'fuzzy_name' | 'none'
}

export async function findCatalogMatch(
  item: ExtractedLineItem,
  catalog: Product[]
): Promise<CatalogMatch | null> {
  // 1. Try exact SKU match
  if (item.sku) {
    const exactMatch = catalog.find(p =>
      p.sku.toLowerCase() === item.sku!.toLowerCase()
    )
    if (exactMatch) {
      return {
        product: exactMatch,
        score: 1.0,
        matchType: 'exact_sku'
      }
    }
  }

  // 2. Try fuzzy SKU match
  if (item.sku) {
    const fuse = new Fuse(catalog, {
      keys: ['sku'],
      threshold: 0.3,
      includeScore: true
    })
    const results = fuse.search(item.sku)
    if (results.length > 0 && results[0].score! < 0.3) {
      return {
        product: results[0].item,
        score: 1 - results[0].score!,
        matchType: 'fuzzy_sku'
      }
    }
  }

  // 3. Try fuzzy description match
  if (item.description) {
    const fuse = new Fuse(catalog, {
      keys: ['name', 'description'],
      threshold: 0.4,
      includeScore: true
    })
    const results = fuse.search(item.description)
    if (results.length > 0 && results[0].score! < 0.4) {
      return {
        product: results[0].item,
        score: 1 - results[0].score!,
        matchType: 'fuzzy_name'
      }
    }
  }

  return null
}
```

### 6. Parser Result Component

**File:** `pricing-tool/components/ParserResults.tsx`

**Purpose:** Display parsed data for user review/correction

```typescript
'use client'

import { ExtractedLineItem } from '@/lib/parsers/text-parser'
import { useState } from 'react'

interface ParserResultsProps {
  items: ExtractedLineItem[]
  onAccept: (items: ExtractedLineItem[]) => void
  onReject: () => void
}

export function ParserResults({
  items,
  onAccept,
  onReject
}: ParserResultsProps) {
  const [editedItems, setEditedItems] = useState(items)

  const updateItem = (index: number, field: string, value: any) => {
    setEditedItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const confidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800'
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Extracted {items.length} line items
        </h3>
        <p className="text-sm text-gray-500">
          Review and correct before adding to quote
        </p>
      </div>

      <div className="overflow-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Size</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Unit</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Confidence</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {editedItems.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2 text-sm">{index + 1}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.sku || ''}
                    onChange={(e) => updateItem(index, 'sku', e.target.value)}
                    className="input-sm w-full"
                    placeholder="SKU"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className="input-sm w-full"
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={item.quantity || ''}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                    className="input-sm w-20"
                    min="0"
                    step="0.01"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={item.size || ''}
                    onChange={(e) => updateItem(index, 'size', e.target.value)}
                    className="input-sm w-24"
                    placeholder="30x80"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={item.unit || 'EA'}
                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                    className="input-sm w-20"
                  >
                    <option value="EA">EA</option>
                    <option value="LF">LF</option>
                    <option value="SF">SF</option>
                    <option value="BOX">BOX</option>
                    <option value="SET">SET</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${confidenceColor(item.confidence)}`}>
                    {Math.round(item.confidence * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          onClick={onReject}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={() => onAccept(editedItems)}
          className="btn btn-primary"
        >
          Add {editedItems.length} items to quote
        </button>
      </div>
    </div>
  )
}
```

## Files to Create

**Parsers:**
- `pricing-tool/lib/parsers/csv-parser.ts`
- `pricing-tool/lib/parsers/xlsx-parser.ts`
- `pricing-tool/lib/parsers/text-parser.ts`
- `pricing-tool/lib/parsers/pattern-validator.ts`
- `pricing-tool/lib/parsers/catalog-matcher.ts`

**Components:**
- `pricing-tool/components/ParserResults.tsx`

**Tests:**
- `pricing-tool/lib/parsers/__tests__/csv-parser.test.ts`
- `pricing-tool/lib/parsers/__tests__/text-parser.test.ts`

## Testing Requirements

1. **CSV Parser:**
   - Parse simple CSV with headers
   - Handle quoted fields with commas
   - Auto-detect column mapping
   - Handle missing columns gracefully

2. **XLSX Parser:**
   - Parse multi-sheet workbook
   - Convert to CSV format
   - Handle empty cells
   - Handle merged cells (use first value)

3. **Text Parser:**
   - Extract line: "5x DR-3080-20G Steel Door 30x80"
   - Extract line: "10 DOOR-123 Commercial Entry"
   - Extract line: "qty: 20 Window 36x48"
   - Handle line with no SKU
   - Handle line with no quantity (default to 1)
   - Various size formats (30x80, 30 x 80, 3'0" x 6'8")

4. **Pattern Validator:**
   - Validate SKU formats
   - Reject invalid quantities (negative, NaN)
   - Validate size ranges (12-144 inches)
   - Normalize inconsistent formats

## Acceptance Criteria

- [ ] CSV parser handles common formats correctly
- [ ] XLSX parser extracts all sheets
- [ ] Text parser detects SKU patterns
- [ ] Text parser detects quantity patterns
- [ ] Text parser detects size patterns
- [ ] Confidence scores calculated accurately
- [ ] Column mapping auto-detection works
- [ ] Catalog matching finds exact SKU matches
- [ ] Catalog matching uses fuzzy search for close matches
- [ ] User can review/edit parsed results
- [ ] Parsed items can be added to quote
- [ ] Validation prevents invalid data
- [ ] Test coverage > 80%

## Dependencies

- papaparse (CSV parsing)
- xlsx (spreadsheet parsing)
- fuse.js (fuzzy search)
- Task 01 (products table for catalog matching)

## Estimated Effort

6-8 hours

## Review Checklist

- [ ] Regex patterns cover common formats
- [ ] Confidence scoring is meaningful
- [ ] Edge cases handled (empty fields, special chars)
- [ ] Performance acceptable for large files (1000+ rows)
- [ ] Memory usage reasonable (stream large files if needed)
- [ ] TypeScript types are accurate
- [ ] No hardcoded product-specific logic
- [ ] Extensible for future pattern types
- [ ] User can correct parser mistakes
- [ ] Tests cover various input formats
- [ ] Error messages are helpful
- [ ] Normalization is consistent (uppercase SKUs, etc.)
