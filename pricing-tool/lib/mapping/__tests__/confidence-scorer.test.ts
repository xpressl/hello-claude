import { calculateOverallConfidence, getConfidenceLabel } from '../confidence-scorer'

describe('Confidence Scorer', () => {
  describe('calculateOverallConfidence', () => {
    it('should calculate confidence with all factors', () => {
      const confidence = calculateOverallConfidence({
        skuMatch: 1.0,
        descriptionMatch: 0.9,
        sizeMatch: 0.95,
        quantityValid: 1.0,
        priceReasonable: 0.8
      })
      expect(confidence).toBeGreaterThan(0.9)
      expect(confidence).toBeLessThanOrEqual(1.0)
    })

    it('should calculate confidence with partial factors', () => {
      const confidence = calculateOverallConfidence({
        skuMatch: 1.0,
        descriptionMatch: 0.8
      })
      expect(confidence).toBeGreaterThan(0)
      expect(confidence).toBeLessThanOrEqual(1.0)
    })

    it('should return 0 for no factors', () => {
      const confidence = calculateOverallConfidence({})
      expect(confidence).toBe(0)
    })

    it('should weight SKU match higher', () => {
      const highSku = calculateOverallConfidence({
        skuMatch: 1.0
      })
      const highDesc = calculateOverallConfidence({
        descriptionMatch: 1.0
      })
      // SKU has higher weight (0.4 vs 0.3)
      expect(highSku).toBeGreaterThan(highDesc)
    })
  })

  describe('getConfidenceLabel', () => {
    it('should return "High" for scores >= 0.9', () => {
      const label = getConfidenceLabel(0.95)
      expect(label.label).toBe('High')
      expect(label.color).toBe('green')
      expect(label.requiresReview).toBe(false)
    })

    it('should return "Medium" for scores 0.7-0.89', () => {
      const label = getConfidenceLabel(0.8)
      expect(label.label).toBe('Medium')
      expect(label.color).toBe('yellow')
      expect(label.requiresReview).toBe(false)
    })

    it('should return "Low" for scores 0.5-0.69', () => {
      const label = getConfidenceLabel(0.6)
      expect(label.label).toBe('Low')
      expect(label.color).toBe('orange')
      expect(label.requiresReview).toBe(true)
    })

    it('should return "Very Low" for scores < 0.5', () => {
      const label = getConfidenceLabel(0.3)
      expect(label.label).toBe('Very Low')
      expect(label.color).toBe('red')
      expect(label.requiresReview).toBe(true)
    })
  })
})
