import { normalizeSize, generateSizeVariations } from '../size-normalizer'

describe('Size Normalizer', () => {
  describe('normalizeSize', () => {
    it('should normalize inch format (30x80)', () => {
      const result = normalizeSize('30x80')
      expect(result).not.toBeNull()
      expect(result?.normalized).toBe('30x80')
      expect(result?.width).toBe(30)
      expect(result?.height).toBe(80)
      expect(result?.format).toBe('inches')
      expect(result?.confidence).toBeGreaterThan(0.9)
    })

    it('should normalize inch format with spaces (30 x 80)', () => {
      const result = normalizeSize('30 x 80')
      expect(result).not.toBeNull()
      expect(result?.normalized).toBe('30x80')
      expect(result?.width).toBe(30)
      expect(result?.height).toBe(80)
    })

    it('should normalize feet-inches format (3\'0" x 6\'8")', () => {
      const result = normalizeSize('3\'0"x6\'8"')
      expect(result).not.toBeNull()
      expect(result?.normalized).toBe('36x80')
      expect(result?.width).toBe(36)
      expect(result?.height).toBe(80)
      expect(result?.format).toBe('feet-inches')
    })

    it('should normalize metric format (762x2032mm)', () => {
      const result = normalizeSize('762x2032')
      expect(result).not.toBeNull()
      expect(result?.normalized).toBe('30x80')
      expect(result?.width).toBe(30)
      expect(result?.height).toBe(80)
      expect(result?.format).toBe('metric')
    })

    it('should return null for invalid sizes', () => {
      expect(normalizeSize('invalid')).toBeNull()
      expect(normalizeSize('10x10')).toBeNull() // Too small
      expect(normalizeSize('200x200')).toBeNull() // Too large
      expect(normalizeSize('')).toBeNull()
    })

    it('should handle various separators', () => {
      expect(normalizeSize('30X80')?.normalized).toBe('30x80')
      expect(normalizeSize('30 X 80')?.normalized).toBe('30x80')
      expect(normalizeSize('30 x 80')?.normalized).toBe('30x80')
    })
  })

  describe('generateSizeVariations', () => {
    it('should generate multiple variations', () => {
      const variations = generateSizeVariations('30x80')
      expect(variations.length).toBeGreaterThan(1)
      expect(variations).toContain('30x80')
      expect(variations).toContain('30 x 80')
    })

    it('should return original for invalid size', () => {
      const variations = generateSizeVariations('invalid')
      expect(variations).toEqual(['invalid'])
    })
  })
})
