import pdfParse from 'pdf-parse'
import { getDocument } from 'pdfjs-dist'
import { createCanvas } from 'canvas'
import { extractTextFromImage } from './tesseract-ocr'

export interface PDFProcessResult {
  text: string
  pageCount: number
  method: 'native' | 'ocr' | 'hybrid'
  confidence: number
  processingTime: number
}

export async function extractTextFromPDF(
  pdfBuffer: Buffer
): Promise<PDFProcessResult> {
  const startTime = Date.now()

  // 1. Try native PDF text extraction
  try {
    const pdfData = await pdfParse(pdfBuffer)

    // If we got substantial text, use it
    if (pdfData.text.trim().length > 50) {
      return {
        text: pdfData.text,
        pageCount: pdfData.numpages,
        method: 'native',
        confidence: 95,  // High confidence for native extraction
        processingTime: Date.now() - startTime
      }
    }
  } catch (error) {
    console.error('Native PDF extraction failed:', error)
  }

  // 2. Fallback to OCR (scanned PDF)
  const ocrText = await ocrPDF(pdfBuffer)

  return {
    text: ocrText.text,
    pageCount: ocrText.pageCount,
    method: 'ocr',
    confidence: ocrText.confidence,
    processingTime: Date.now() - startTime
  }
}

async function ocrPDF(pdfBuffer: Buffer): Promise<{
  text: string
  pageCount: number
  confidence: number
}> {
  const loadingTask = getDocument({ data: pdfBuffer })
  const pdf = await loadingTask.promise

  const pageTexts: string[] = []
  let totalConfidence = 0

  // Process each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 2.0 })  // Higher scale = better quality

    // Render page to canvas
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')

    await page.render({
      canvasContext: context as any,
      viewport: viewport
    }).promise

    // Convert canvas to image buffer
    const imageBuffer = canvas.toBuffer('image/png')

    // OCR the image
    const ocrResult = await extractTextFromImage(imageBuffer)
    pageTexts.push(ocrResult.text)
    totalConfidence += ocrResult.confidence
  }

  return {
    text: pageTexts.join('\n\n--- Page Break ---\n\n'),
    pageCount: pdf.numPages,
    confidence: totalConfidence / pdf.numPages
  }
}
