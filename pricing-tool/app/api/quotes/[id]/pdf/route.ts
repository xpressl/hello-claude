import { NextRequest, NextResponse } from 'next/server'
import { generateQuotePDF, savePDFToStorage, getPDFDownloadUrl } from '@/lib/pdf/generate-pdf'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/quotes/[id]/pdf
 * Generate a PDF for a quote and save it
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params

    // Generate PDF
    const pdfBuffer = await generateQuotePDF(quoteId)
    if (!pdfBuffer) {
      return NextResponse.json(
        { error: 'Failed to generate PDF' },
        { status: 500 }
      )
    }

    // Save to storage
    const storagePath = await savePDFToStorage(pdfBuffer, quoteId)
    if (!storagePath) {
      return NextResponse.json(
        { error: 'Failed to save PDF to storage' },
        { status: 500 }
      )
    }

    // Get download URL
    const downloadUrl = await getPDFDownloadUrl(storagePath)

    return NextResponse.json({
      success: true,
      quoteId,
      storagePath,
      downloadUrl,
      size: pdfBuffer.length,
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate PDF',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/quotes/[id]/pdf
 * Download the generated PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params

    // Generate PDF (or get from cache)
    const pdfBuffer = await generateQuotePDF(quoteId)
    if (!pdfBuffer) {
      return NextResponse.json(
        { error: 'PDF not found' },
        { status: 404 }
      )
    }

    // Return as downloadable PDF
    const filename = `quote_${quoteId.substring(0, 8)}.pdf`
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error downloading PDF:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to download PDF',
      },
      { status: 500 }
    )
  }
}
