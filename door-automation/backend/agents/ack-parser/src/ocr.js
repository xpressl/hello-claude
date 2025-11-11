/**
 * OCR Engine - OpenAI Vision API
 *
 * Parses vendor acknowledgment PDFs and extracts line items
 */

const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const config = require('./config');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: config.openai.apiKey,
});

/**
 * Parse vendor acknowledgment PDF
 *
 * Strategy:
 * 1. Try PDF text extraction first (fast, cheap)
 * 2. If text extraction fails or confidence is low, use Vision API
 *
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} vendorName - Vendor name (helps with parsing)
 * @returns {Promise<Object>} - Parsed line items and metadata
 */
async function parseVendorAck(pdfBuffer, vendorName) {
    try {
        console.log(`Parsing vendor ack for: ${vendorName}`);

        // Step 1: Try PDF text extraction
        const textResult = await extractPdfText(pdfBuffer);

        if (textResult.success && textResult.confidence > 0.7) {
            console.log('Using PDF text extraction (high confidence)');
            return textResult;
        }

        console.log('PDF text extraction failed or low confidence, using Vision API');

        // Step 2: Use Vision API for scanned PDFs or complex layouts
        const visionResult = await parseWithVision(pdfBuffer, vendorName);

        return visionResult;
    } catch (error) {
        console.error('OCR error:', error);
        throw error;
    }
}

/**
 * Extract text from PDF (for digital/text-based PDFs)
 */
async function extractPdfText(pdfBuffer) {
    try {
        const data = await pdfParse(pdfBuffer);

        const text = data.text;

        if (!text || text.trim().length < 50) {
            return {
                success: false,
                confidence: 0,
                reason: 'No text extracted',
            };
        }

        // Parse line items from text
        const lineItems = parseLineItemsFromText(text);

        if (lineItems.length === 0) {
            return {
                success: false,
                confidence: 0.5,
                reason: 'No line items found in text',
            };
        }

        return {
            success: true,
            method: 'pdf_text',
            confidence: 0.9, // High confidence for text-based PDFs
            lineItems,
            rawText: text,
        };
    } catch (error) {
        console.error('PDF text extraction error:', error);

        return {
            success: false,
            confidence: 0,
            error: error.message,
        };
    }
}

/**
 * Parse line items from extracted text
 *
 * This is a simplified parser - you may need to customize based on vendor formats
 */
function parseLineItemsFromText(text) {
    const lineItems = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines
        if (!line) continue;

        // Look for patterns that indicate a door line item
        // Example: "1  3068  36x80  LH  KD  $450.00  2  $900.00"

        // Match: line number, size/code, quantity, price
        const pattern = /(\d+)\s+(\d{4}|[\d\s]+"?[xX×][\d\s]+"?)\s+.*?\$?([\d,]+\.?\d*)\s+(\d+)\s+\$?([\d,]+\.?\d*)/;
        const match = line.match(pattern);

        if (match) {
            const lineNumber = parseInt(match[1], 10);
            const sizeOrCode = match[2].trim();
            const unitPrice = parseFloat(match[3].replace(/,/g, ''));
            const quantity = parseInt(match[4], 10);
            const totalPrice = parseFloat(match[5].replace(/,/g, ''));

            lineItems.push({
                lineNumber,
                sizeOrCode,
                quantity,
                unitPrice,
                totalPrice,
                rawText: line,
            });
        }
    }

    return lineItems;
}

/**
 * Parse with OpenAI Vision API
 *
 * For scanned PDFs or complex layouts
 */
async function parseWithVision(pdfBuffer, vendorName) {
    try {
        console.log('Using OpenAI Vision API...');

        // Convert PDF to image (first page for now)
        // In production, you might want to convert all pages
        const base64Image = pdfBuffer.toString('base64');

        const prompt = `You are a door specification parser. Extract all line items from this vendor acknowledgment.

For each line item, extract:
- Line number
- Door size (e.g., "36x80", "3068", "3'-0\" x 6'-8\"")
- Quantity
- Unit price
- Total price
- Swing/handing (if present: LH, RH, LHR, RHR)
- Door type (if present)
- Jamb type (if present)

Return a JSON array of line items with this structure:
{
  "lineItems": [
    {
      "lineNumber": 1,
      "size": "3068" or "36x80",
      "quantity": 2,
      "unitPrice": 450.00,
      "totalPrice": 900.00,
      "swing": "LH",
      "doorType": "Hollow Metal",
      "jambType": "KD",
      "rawText": "original text from PDF"
    }
  ]
}

Vendor: ${vendorName}

IMPORTANT: Return ONLY valid JSON, no other text.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // Updated model for vision
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt,
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:application/pdf;base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 4096,
            temperature: 0.1, // Low temperature for consistency
        });

        const content = response.choices[0].message.content;

        // Parse JSON response
        const result = JSON.parse(content);

        return {
            success: true,
            method: 'openai_vision',
            confidence: 0.85, // Vision API confidence
            lineItems: result.lineItems || [],
            rawResponse: content,
        };
    } catch (error) {
        console.error('Vision API error:', error);

        // Fallback: return empty result
        return {
            success: false,
            method: 'openai_vision',
            confidence: 0,
            error: error.message,
            lineItems: [],
        };
    }
}

module.exports = {
    parseVendorAck,
};
