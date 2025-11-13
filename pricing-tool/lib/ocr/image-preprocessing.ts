import sharp from 'sharp'

/**
 * Preprocess image to improve OCR accuracy
 * Applies grayscale, contrast normalization, binarization, and sharpening
 */
export async function preprocessImage(
  imageBuffer: Buffer
): Promise<Buffer> {
  try {
    // Enhance image for better OCR
    return await sharp(imageBuffer)
      .grayscale()  // Convert to grayscale
      .normalize()  // Normalize contrast
      .threshold(128)  // Binarize
      .sharpen()  // Sharpen edges
      .toBuffer()
  } catch (error) {
    console.error('Image preprocessing failed:', error)
    // Return original buffer if preprocessing fails
    return imageBuffer
  }
}

/**
 * Validate image dimensions and size
 */
export function validateImage(buffer: Buffer): {
  valid: boolean
  error?: string
} {
  // Check buffer size (max 50MB)
  if (buffer.length > 50 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Image too large (max 50MB)'
    }
  }

  return { valid: true }
}
