# Task 12: OCR Pipeline Integration

## Objective
Integrate Optical Character Recognition (OCR) to extract text from PDF and image uploads, with confidence scoring and structured storage of results.

## Context
- Process uploaded PDFs and images to extract text
- Support handwritten and printed text
- Store extracted text with confidence scores
- Enable downstream processing (line item extraction)
- Choose between Tesseract.js (free, client-side) or cloud API (Google Vision, AWS Textract)
- Recommendation: Start with Tesseract.js for MVP, upgrade to cloud for better accuracy

## Requirements

### 1. OCR Service Selection

**Option A: Tesseract.js (Recommended for MVP)**
- Pros: Free, runs in browser or Node.js, no API costs
- Cons: Lower accuracy than cloud services, slower processing
- Best for: MVP, development, basic documents

**Option B: Google Cloud Vision API**
- Pros: Excellent accuracy, handles complex layouts, detects handwriting
- Cons: API costs (~$1.50 per 1000 images)
- Best for: Production with budget

**Option C: AWS Textract**
- Pros: Good accuracy, extracts tables/forms, pay-as-you-go
- Cons: API costs, requires AWS account
- Best for: Production, complex documents

**Decision for this task:** Implement Tesseract.js with architecture to support cloud providers later.

### 2. Tesseract.js Installation and Setup

**Install dependencies:**
```bash
npm install tesseract.js
npm install pdf-parse  # For PDF text extraction
npm install @pdf-lib/pdfjs-dist  # For PDF to image conversion
```

**File:** `pricing-tool/lib/ocr/tesseract-ocr.ts`

```typescript
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
```

### 3. PDF Processing

**File:** `pricing-tool/lib/ocr/pdf-processor.ts`

**Strategy:** Extract text if available, fallback to OCR if scanned PDF

```typescript
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
```

### 4. OCR Processing Queue

**File:** `pricing-tool/lib/ocr/ocr-queue.ts`

**Purpose:** Process uploads asynchronously to avoid blocking

```typescript
import { createClient } from '@supabase/supabase-js'
import { extractTextFromImage, OCRResult } from './tesseract-ocr'
import { extractTextFromPDF } from './pdf-processor'
import { getSignedUploadUrl } from '@/lib/storage'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function processUpload(uploadId: string) {
  try {
    // 1. Get upload record
    const { data: upload, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single()

    if (error || !upload) {
      throw new Error('Upload not found')
    }

    // 2. Update status to processing
    await supabase
      .from('uploads')
      .update({ status: 'processing' })
      .eq('id', uploadId)

    // 3. Download file from storage
    const { data: fileData } = await supabase.storage
      .from('quote-uploads')
      .download(upload.storage_path)

    if (!fileData) {
      throw new Error('Failed to download file')
    }

    // 4. Process based on file type
    let result: OCRResult | PDFProcessResult

    if (upload.file_type === 'pdf') {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      result = await extractTextFromPDF(buffer)
    } else if (upload.file_type === 'image') {
      const buffer = Buffer.from(await fileData.arrayBuffer())
      result = await extractTextFromImage(buffer)
    } else {
      throw new Error(`OCR not supported for file type: ${upload.file_type}`)
    }

    // 5. Store results
    const { error: updateError } = await supabase
      .from('uploads')
      .update({
        status: 'completed',
        parsed_payload_json: {
          text: result.text,
          confidence: result.confidence,
          words: 'words' in result ? result.words : undefined,
          method: 'method' in result ? result.method : 'ocr',
          processingTime: result.processingTime
        },
        confidence_score: result.confidence / 100,  // Normalize to 0-1
        processed_at: new Date().toISOString()
      })
      .eq('id', uploadId)

    if (updateError) {
      throw updateError
    }

    // 6. Trigger line item extraction
    await extractLineItemsFromText(uploadId, result.text)

    return { success: true, uploadId }
  } catch (error) {
    console.error('OCR processing error:', error)

    // Update upload with error
    await supabase
      .from('uploads')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', uploadId)

    return { success: false, error }
  }
}

async function extractLineItemsFromText(uploadId: string, text: string) {
  // Import text parser from Task 11
  const { parseTextToLineItems } = await import('@/lib/parsers/text-parser')

  const items = parseTextToLineItems(text)

  // Store extracted items linked to upload
  const { data: upload } = await supabase
    .from('uploads')
    .select('quote_id')
    .eq('id', uploadId)
    .single()

  if (upload?.quote_id) {
    for (const item of items) {
      await supabase.from('quote_lines').insert({
        quote_id: upload.quote_id,
        description: item.description || 'Unknown item',
        quantity: item.quantity || 1,
        unit: item.unit || 'EA',
        source: 'ocr',
        confidence_score: item.confidence,
        mapping_warnings_json: { warnings: item.warnings },
        options_json: item.size ? { SIZE: item.size } : {}
      })
    }
  }
}
```

### 5. API Route for Triggering OCR

**File:** `pricing-tool/app/api/uploads/[id]/process/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { processUpload } from '@/lib/ocr/ocr-queue'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const uploadId = params.id

  // Trigger async processing
  processUpload(uploadId).catch(error => {
    console.error('Background OCR processing failed:', error)
  })

  return NextResponse.json({
    success: true,
    message: 'OCR processing started',
    uploadId
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check processing status
  const { createClient } = await import('@supabase/supabase-js')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: upload } = await supabase
    .from('uploads')
    .select('id, status, confidence_score, error_message, processed_at')
    .eq('id', params.id)
    .single()

  return NextResponse.json(upload)
}
```

### 6. Webhook for Auto-Processing

**Modify:** `pricing-tool/app/api/quotes/[id]/uploads/route.ts`

**Auto-trigger OCR after upload:**
```typescript
// After successful upload...
const { data: uploadRecord } = await supabase
  .from('uploads')
  .insert({ /* ... */ })
  .select()
  .single()

// Trigger OCR processing asynchronously
if (uploadRecord && ['pdf', 'image'].includes(validation.file_type)) {
  // Don't await - process in background
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/uploads/${uploadRecord.id}/process`, {
    method: 'POST'
  }).catch(console.error)
}
```

### 7. OCR Results Viewer Component

**File:** `pricing-tool/components/admin/OCRResultsViewer.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'

interface OCRResultsViewerProps {
  uploadId: string
}

export function OCRResultsViewer({ uploadId }: OCRResultsViewerProps) {
  const [status, setStatus] = useState<'loading' | 'processing' | 'completed' | 'failed'>('loading')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    const checkStatus = async () => {
      const res = await fetch(`/api/uploads/${uploadId}/process`)
      const data = await res.json()

      setStatus(data.status)

      if (data.status === 'completed' && data.parsed_payload_json) {
        setResult(data.parsed_payload_json)
      }

      // Poll if still processing
      if (data.status === 'processing') {
        setTimeout(checkStatus, 2000)
      }
    }

    checkStatus()
  }, [uploadId])

  if (status === 'loading' || status === 'processing') {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
        <span className="text-sm text-gray-600">Processing OCR...</span>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
        OCR processing failed. Please try again or contact support.
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">OCR Results</h3>
        <span className={`text-sm px-2 py-1 rounded ${
          result.confidence > 80 ? 'bg-green-100 text-green-800' :
          result.confidence > 50 ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {result.confidence.toFixed(1)}% confidence
        </span>
      </div>

      <div className="bg-gray-50 border rounded p-4 max-h-96 overflow-auto">
        <pre className="text-sm whitespace-pre-wrap font-mono">
          {result.text}
        </pre>
      </div>

      <div className="text-xs text-gray-500">
        Processed in {(result.processingTime / 1000).toFixed(2)}s
        {result.method && ` • Method: ${result.method}`}
      </div>
    </div>
  )
}
```

### 8. Preprocessing for Better OCR Accuracy

**File:** `pricing-tool/lib/ocr/image-preprocessing.ts`

```typescript
import sharp from 'sharp'

export async function preprocessImage(
  imageBuffer: Buffer
): Promise<Buffer> {
  // Enhance image for better OCR
  return await sharp(imageBuffer)
    .grayscale()  // Convert to grayscale
    .normalize()  // Normalize contrast
    .threshold(128)  // Binarize
    .sharpen()  // Sharpen edges
    .toBuffer()
}
```

## Files to Create

**OCR Engine:**
- `pricing-tool/lib/ocr/tesseract-ocr.ts`
- `pricing-tool/lib/ocr/pdf-processor.ts`
- `pricing-tool/lib/ocr/ocr-queue.ts`
- `pricing-tool/lib/ocr/image-preprocessing.ts`

**API:**
- `pricing-tool/app/api/uploads/[id]/process/route.ts`

**Components:**
- `pricing-tool/components/admin/OCRResultsViewer.tsx`

**Modified:**
- `pricing-tool/app/api/quotes/[id]/uploads/route.ts` (auto-trigger OCR)

## Testing Requirements

1. **Manual Testing:**
   - Upload scanned PDF → verify text extracted
   - Upload native PDF → verify text extracted directly
   - Upload image (JPEG, PNG) → verify OCR works
   - Upload handwritten note → check accuracy
   - Check confidence scores are reasonable
   - Verify processing status updates

2. **Edge Cases:**
   - Very large PDF (50+ pages)
   - Poor quality scan (low DPI)
   - Rotated image
   - Multi-column layout
   - Non-English text (if supported)

3. **Performance Testing:**
   - Measure processing time for 1-page, 10-page, 50-page PDFs
   - Memory usage for large files
   - Concurrent processing (multiple uploads)

## Acceptance Criteria

- [ ] Tesseract.js integrated and working
- [ ] PDF text extraction works (native + OCR)
- [ ] Image OCR works for common formats
- [ ] Results stored in uploads.parsed_payload_json
- [ ] Confidence scores calculated
- [ ] Processing status tracked (pending/processing/completed/failed)
- [ ] Auto-trigger OCR after upload
- [ ] Admin can view OCR results
- [ ] Error handling for failed OCR
- [ ] Processing time < 30s for typical documents
- [ ] Line items auto-extracted from OCR text
- [ ] Works on server-side (API route)

## Dependencies

- Task 01 (uploads table)
- Task 09 (upload API)
- Task 11 (text parser for line item extraction)
- tesseract.js library
- pdf-parse library

## Estimated Effort

6-8 hours

## Review Checklist

- [ ] Tesseract worker properly terminated (no memory leaks)
- [ ] Large files don't timeout (increase timeout if needed)
- [ ] Error handling comprehensive
- [ ] Processing runs asynchronously (doesn't block API)
- [ ] Confidence scores are meaningful
- [ ] Native PDF extraction tried first (faster)
- [ ] Image preprocessing improves accuracy
- [ ] Status polling doesn't overwhelm server
- [ ] Results stored in correct format
- [ ] Ready to swap Tesseract for cloud API later
- [ ] Canvas library works in Node.js environment
- [ ] TypeScript types accurate
