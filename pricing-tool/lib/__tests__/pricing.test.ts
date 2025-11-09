import { describe, it, expect } from '@jest/globals'
import {
  computeTotal,
  applyMarkup,
  formatMoney,
  calculateMargin,
  calculateMarkup,
} from './pricing'

describe('pricing utilities', () => {
  describe('computeTotal', () => {
    it('should calculate total for simple multiplication', () => {
      expect(computeTotal(10, 5)).toBe(50)
    })

    it('should handle decimal unit prices', () => {
      expect(computeTotal(3.50, 12)).toBe(42)
    })

    it('should round to 2 decimal places', () => {
      expect(computeTotal(10.99, 3)).toBe(32.97)
    })

    it('should avoid floating point errors', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      expect(computeTotal(0.1, 3)).toBe(0.3)
    })

    it('should handle zero quantity', () => {
      expect(computeTotal(10, 0)).toBe(0)
    })

    it('should handle large numbers', () => {
      expect(computeTotal(1234.56, 100)).toBe(123456)
    })
  })

  describe('applyMarkup', () => {
    it('should calculate 20% markup correctly', () => {
      const result = applyMarkup(100, 20)
      expect(result.price).toBe(120)
      expect(result.profit).toBe(20)
      expect(result.marginPct).toBe(16.67)
    })

    it('should calculate 50% markup correctly', () => {
      const result = applyMarkup(100, 50)
      expect(result.price).toBe(150)
      expect(result.profit).toBe(50)
      expect(result.marginPct).toBe(33.33)
    })

    it('should handle decimal costs', () => {
      const result = applyMarkup(42.50, 15)
      expect(result.price).toBe(48.88)
      expect(result.profit).toBe(6.38)
      expect(result.marginPct).toBe(13.05)
    })

    it('should handle zero markup', () => {
      const result = applyMarkup(100, 0)
      expect(result.price).toBe(100)
      expect(result.profit).toBe(0)
      expect(result.marginPct).toBe(0)
    })

    it('should handle 100% markup (double price)', () => {
      const result = applyMarkup(50, 100)
      expect(result.price).toBe(100)
      expect(result.profit).toBe(50)
      expect(result.marginPct).toBe(50)
    })
  })

  describe('formatMoney', () => {
    it('should format whole numbers', () => {
      expect(formatMoney(100)).toBe('$100.00')
    })

    it('should format decimals', () => {
      expect(formatMoney(123.45)).toBe('$123.45')
    })

    it('should format large numbers with commas', () => {
      expect(formatMoney(1234.56)).toBe('$1,234.56')
    })

    it('should round to 2 decimal places', () => {
      expect(formatMoney(10.999)).toBe('$11.00')
    })

    it('should handle zero', () => {
      expect(formatMoney(0)).toBe('$0.00')
    })

    it('should handle negative numbers', () => {
      expect(formatMoney(-50.25)).toBe('-$50.25')
    })
  })

  describe('calculateMargin', () => {
    it('should calculate margin from cost and price', () => {
      expect(calculateMargin(100, 120)).toBe(16.67)
    })

    it('should calculate margin for 50% markup', () => {
      expect(calculateMargin(100, 150)).toBe(33.33)
    })

    it('should return 0 for zero selling price', () => {
      expect(calculateMargin(100, 0)).toBe(0)
    })

    it('should handle equal cost and price (no profit)', () => {
      expect(calculateMargin(100, 100)).toBe(0)
    })

    it('should handle loss (negative margin)', () => {
      expect(calculateMargin(100, 80)).toBe(-25)
    })
  })

  describe('calculateMarkup', () => {
    it('should calculate markup from cost and price', () => {
      expect(calculateMarkup(100, 120)).toBe(20)
    })

    it('should calculate 50% markup', () => {
      expect(calculateMarkup(100, 150)).toBe(50)
    })

    it('should return 0 for zero cost', () => {
      expect(calculateMarkup(0, 100)).toBe(0)
    })

    it('should handle equal cost and price (no markup)', () => {
      expect(calculateMarkup(100, 100)).toBe(0)
    })

    it('should handle 100% markup (double)', () => {
      expect(calculateMarkup(50, 100)).toBe(100)
    })
  })
})
