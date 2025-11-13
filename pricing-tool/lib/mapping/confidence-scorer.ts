export interface ConfidenceFactors {
  skuMatch: number         // 0-1
  descriptionMatch: number // 0-1
  sizeMatch: number       // 0-1
  quantityValid: number   // 0-1
  priceReasonable: number // 0-1
}

export function calculateOverallConfidence(
  factors: Partial<ConfidenceFactors>
): number {
  const weights = {
    skuMatch: 0.4,
    descriptionMatch: 0.3,
    sizeMatch: 0.15,
    quantityValid: 0.1,
    priceReasonable: 0.05
  }

  let totalScore = 0
  let totalWeight = 0

  for (const [factor, weight] of Object.entries(weights)) {
    const value = factors[factor as keyof ConfidenceFactors]
    if (value !== undefined) {
      totalScore += value * weight
      totalWeight += weight
    }
  }

  // Normalize by actual weight used
  return totalWeight > 0 ? totalScore / totalWeight : 0
}

export function getConfidenceLabel(score: number): {
  label: string
  color: string
  requiresReview: boolean
} {
  if (score >= 0.9) {
    return {
      label: 'High',
      color: 'green',
      requiresReview: false
    }
  } else if (score >= 0.7) {
    return {
      label: 'Medium',
      color: 'yellow',
      requiresReview: false
    }
  } else if (score >= 0.5) {
    return {
      label: 'Low',
      color: 'orange',
      requiresReview: true
    }
  } else {
    return {
      label: 'Very Low',
      color: 'red',
      requiresReview: true
    }
  }
}
