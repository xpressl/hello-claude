import { extractKeywords, calculateSemanticSimilarity } from '../description-matcher'

describe('Description Matcher', () => {
  describe('extractKeywords', () => {
    it('should extract keywords from description', () => {
      const keywords = extractKeywords('Steel Door 30x80 Commercial Entry')
      expect(keywords).toContain('steel')
      expect(keywords).toContain('door')
      expect(keywords).toContain('30x80')
      expect(keywords).toContain('commercial')
      expect(keywords).toContain('entry')
    })

    it('should filter out stop words', () => {
      const keywords = extractKeywords('The door and the frame')
      expect(keywords).not.toContain('the')
      expect(keywords).not.toContain('and')
      expect(keywords).toContain('door')
      expect(keywords).toContain('frame')
    })

    it('should remove duplicates', () => {
      const keywords = extractKeywords('door door door')
      expect(keywords.filter(k => k === 'door').length).toBe(1)
    })

    it('should handle special characters', () => {
      const keywords = extractKeywords('Door (30"x80") - Commercial')
      expect(keywords).toContain('door')
      expect(keywords).toContain('30')
      expect(keywords).toContain('80')
      expect(keywords).toContain('commercial')
    })

    it('should filter short words', () => {
      const keywords = extractKeywords('a to in door')
      expect(keywords).not.toContain('a')
      expect(keywords).not.toContain('to')
      expect(keywords).not.toContain('in')
      expect(keywords).toContain('door')
    })
  })

  describe('calculateSemanticSimilarity', () => {
    it('should return 1.0 for identical descriptions', () => {
      const similarity = calculateSemanticSimilarity(
        'Steel Door 30x80',
        'Steel Door 30x80'
      )
      expect(similarity).toBe(1.0)
    })

    it('should return high similarity for similar descriptions', () => {
      const similarity = calculateSemanticSimilarity(
        'Steel Door 30x80 Commercial',
        'Commercial Steel Door 30x80'
      )
      expect(similarity).toBeGreaterThan(0.8)
    })

    it('should return low similarity for different descriptions', () => {
      const similarity = calculateSemanticSimilarity(
        'Steel Door',
        'Wood Window'
      )
      expect(similarity).toBeLessThan(0.5)
    })

    it('should return 0 for completely different descriptions', () => {
      const similarity = calculateSemanticSimilarity(
        'Door',
        'Hardware'
      )
      expect(similarity).toBe(0)
    })

    it('should be case insensitive', () => {
      const similarity1 = calculateSemanticSimilarity('DOOR', 'door')
      const similarity2 = calculateSemanticSimilarity('Door', 'door')
      expect(similarity1).toBe(similarity2)
      expect(similarity1).toBe(1.0)
    })
  })
})
