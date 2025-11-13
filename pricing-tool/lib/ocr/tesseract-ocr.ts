import Tesseract from 'tesseract.js'

export interface OCRResult {
  text: string
  confidence: number  // 0-100
  words: OCRWord[]
  processingTime: number
}

export interface OCRWord {
  text: string
  confidence: number
  bbox: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

export async function extractTextFromImage(
  imagePath: string | Buffer
): Promise<OCRResult> {
  const startTime = Date.now()

  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
      }
    }
  })

  try {
    const { data } = await worker.recognize(imagePath)

    const processingTime = Date.now() - startTime

    return {
      text: data.text,
      confidence: data.confidence,
      words: data.words.map(word => ({
        text: word.text,
        confidence: word.confidence,
        bbox: {
          x0: word.bbox.x0,
          y0: word.bbox.y0,
          x1: word.bbox.x1,
          y1: word.bbox.y1
        }
      })),
      processingTime
    }
  } finally {
    await worker.terminate()
  }
}
