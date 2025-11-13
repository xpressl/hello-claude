import { parseTextToLineItems } from '../text-parser'
import {
  validateSKU,
  validateQuantity,
  validateSize,
  normalizeSize,
  normalizeSKU
} from '../pattern-validator'

describe('Text Parser', () => {
  describe('parseTextToLineItems', () => {
    it('should extract line with SKU, quantity, description, and size', () => {
      const text = '5x DR-3080-20G Steel Door 30x80'
      const items = parseTextToLineItems(text)

      expect(items).toHaveLength(1)
      expect(items[0].sku).toBe('DR-3080-20G')
      expect(items[0].quantity).toBe(5)
      expect(items[0].size).toBe('30x80')
      expect(items[0].description).toContain('Steel Door')
      expect(items[0].confidence).toBeGreaterThan(0.8)
    })

    it('should extract line with different SKU format', () => {
      const text = '10 DOOR-123 Commercial Entry'
      const items = parseTextToLineItems(text)

      expect(items).toHaveLength(1)
      expect(items[0].sku).toBe('DOOR-123')
      expect(items[0].quantity).toBe(10)
      expect(items[0].description).toContain('Commercial Entry')
    })

    it('should extract line with qty prefix', () => {
      const text = 'qty: 20 Window 36x48'
      const items = parseTextToLineItems(text)

      expect(items).toHaveLength(1)
      expect(items[0].quantity).toBe(20)
      expect(items[0].size).toBe('36x48')
      expect(items[0].description).toContain('Window')
    })

    it('should handle line with no SKU', () => {
      const text = '5x Steel Door 30x80'
      const items = parseTextToLineItems(text)

      expect(items).toHaveLength(1)
      expect(items[0].sku).toBeUndefined()
      expect(items[0].quantity).toBe(5)
      expect(items[0].size).toBe('30x80')
      expect(items[0].warnings).toContain('No SKU detected')
      expect(items[0].confidence).toBeLessThan(0.8)
    })

    it('should handle line with no quantity', () => {
      const text = 'DR-3080-20G Steel Door 30x80'
      const items = parseTextToLineItems(text)

      expect(items).toHaveLength(1)
      expect(items[0].sku).toBe('DR-3080-20G')
      expect(items[0].quantity).toBeUndefined()
      expect(items[0].size).toBe('30x80')
      expect(items[0].warnings).toContain('No quantity detected')
    })

    it('should handle various size formats', () => {
      const text1 = '5x DR-123 Door 30x80'
      const text2 = '5x DR-123 Door 30 x 80'
      const text3 = "5x DR-123 Door 3'0\" x 6'8\""

      const items1 = parseTextToLineItems(text1)
      const items2 = parseTextToLineItems(text2)
      const items3 = parseTextToLineItems(text3)

      expect(items1[0].size).toBe('30x80')
      expect(items2[0].size).toBe('30x80')
      expect(items3[0].size).toBe('36x80')  // 3'0" = 36", 6'8" = 80"
    })

    it('should extract unit from text', () => {
      const text1 = '10 lf DR-123 Trim'
      const text2 = '5 sf DR-123 Flooring'
      const text3 = '2 box DR-123 Hardware'

      const items1 = parseTextToLineItems(text1)
      const items2 = parseTextToLineItems(text2)
      const items3 = parseTextToLineItems(text3)

      expect(items1[0].unit).toBe('LF')
      expect(items2[0].unit).toBe('SF')
      expect(items3[0].unit).toBe('BOX')
    })

    it('should default to EA unit if no unit specified', () => {
      const text = '5x DR-123 Door 30x80'
      const items = parseTextToLineItems(text)

      expect(items[0].unit).toBe('EA')
    })

    it('should skip header lines', () => {
      const text = `SKU\tDescription\tQty
5x DR-3080-20G Steel Door 30x80`
      const items = parseTextToLineItems(text)

      expect(items).toHaveLength(1)
      expect(items[0].sku).toBe('DR-3080-20G')
    })

    it('should parse multiple lines', () => {
      const text = `5x DR-3080-20G Steel Door 30x80
10 DOOR-123 Commercial Entry
qty: 20 Window 36x48`
      const items = parseTextToLineItems(text)

      expect(items).toHaveLength(3)
      expect(items[0].quantity).toBe(5)
      expect(items[1].quantity).toBe(10)
      expect(items[2].quantity).toBe(20)
    })

    it('should handle ea/each quantity suffix', () => {
      const text1 = '10 ea DR-123 Door'
      const text2 = '5 each DR-456 Window'

      const items1 = parseTextToLineItems(text1)
      const items2 = parseTextToLineItems(text2)

      expect(items1[0].quantity).toBe(10)
      expect(items2[0].quantity).toBe(5)
    })

    it('should extract numeric-only SKU if 5+ digits', () => {
      const text = '5x 12345 Steel Door'
      const items = parseTextToLineItems(text)

      expect(items[0].sku).toBe('12345')
    })

    it('should calculate confidence scores appropriately', () => {
      const textHigh = '5x DR-3080-20G Steel Door 30x80'  // Has SKU, qty, size
      const textMedium = '5x Steel Door 30x80'  // Has qty, size, no SKU
      const textLow = 'Steel Door'  // No SKU, qty, or size

      const itemsHigh = parseTextToLineItems(textHigh)
      const itemsMedium = parseTextToLineItems(textMedium)
      const itemsLow = parseTextToLineItems(textLow)

      expect(itemsHigh[0].confidence).toBeGreaterThan(0.7)
      expect(itemsMedium[0].confidence).toBeGreaterThan(0.5)
      expect(itemsMedium[0].confidence).toBeLessThanOrEqual(0.7)
      expect(itemsLow[0].confidence).toBeLessThanOrEqual(0.5)
    })
  })
})

describe('Pattern Validator', () => {
  describe('validateSKU', () => {
    it('should validate correct SKU formats', () => {
      expect(validateSKU('DR-3080-20G')).toBe(true)
      expect(validateSKU('DOOR-123')).toBe(true)
      expect(validateSKU('12345')).toBe(true)
      expect(validateSKU('ABC-123-XYZ')).toBe(true)
    })

    it('should reject invalid SKU formats', () => {
      expect(validateSKU('AB')).toBe(false)  // Too short
      expect(validateSKU('ABC')).toBe(false)  // Too short
      expect(validateSKU('AB CD')).toBe(false)  // Contains space
      expect(validateSKU('AB@CD')).toBe(false)  // Contains special char
    })
  })

  describe('validateQuantity', () => {
    it('should validate correct quantities', () => {
      expect(validateQuantity(1)).toBe(true)
      expect(validateQuantity(10)).toBe(true)
      expect(validateQuantity(100)).toBe(true)
      expect(validateQuantity(99999)).toBe(true)
    })

    it('should reject invalid quantities', () => {
      expect(validateQuantity(0)).toBe(false)  // Zero
      expect(validateQuantity(-1)).toBe(false)  // Negative
      expect(validateQuantity(100000)).toBe(false)  // Too large
      expect(validateQuantity(NaN)).toBe(false)  // Not a number
    })
  })

  describe('validateSize', () => {
    it('should validate correct sizes', () => {
      expect(validateSize('30x80')).toBe(true)
      expect(validateSize('36x84')).toBe(true)
      expect(validateSize('24x80')).toBe(true)
      expect(validateSize('48x96')).toBe(true)
    })

    it('should reject invalid sizes', () => {
      expect(validateSize('10x80')).toBe(false)  // Width too small
      expect(validateSize('30x10')).toBe(false)  // Height too small
      expect(validateSize('150x80')).toBe(false)  // Width too large
      expect(validateSize('30x200')).toBe(false)  // Height too large
      expect(validateSize('30')).toBe(false)  // Missing dimension
      expect(validateSize('30x')).toBe(false)  // Missing dimension
      expect(validateSize('abcxdef')).toBe(false)  // Not numbers
    })
  })

  describe('normalizeSize', () => {
    it('should normalize size formats', () => {
      expect(normalizeSize('30x80')).toBe('30x80')
      expect(normalizeSize('30 x 80')).toBe('30x80')
      expect(normalizeSize('30X80')).toBe('30x80')
      expect(normalizeSize('30 X 80')).toBe('30x80')
    })
  })

  describe('normalizeSKU', () => {
    it('should normalize SKU formats', () => {
      expect(normalizeSKU('dr-123')).toBe('DR-123')
      expect(normalizeSKU('  DR-123  ')).toBe('DR-123')
      expect(normalizeSKU('door-456')).toBe('DOOR-456')
    })
  })
})
