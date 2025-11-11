/**
 * Shared Type Definitions for Door Automation System
 *
 * Common interfaces and types used across all agents
 */

/**
 * @typedef {Object} NormalizedDoorSpec
 * @property {string} rawDescription - Original OCR text
 * @property {number|null} widthInches - Width in inches
 * @property {number|null} heightInches - Height in inches
 * @property {number|null} thicknessInches - Thickness in inches
 * @property {string|null} vendorCode - Vendor code (e.g., "2468")
 * @property {string|null} swing - Swing direction (LH, RH, LHR, RHR)
 * @property {string|null} jambType - Jamb type
 * @property {string|null} doorType - Door type
 * @property {string|null} fireRating - Fire rating
 * @property {number} quantity - Quantity
 * @property {number|null} unitPrice - Unit price
 * @property {number|null} totalPrice - Total price
 * @property {string} normalizedAt - ISO timestamp
 * @property {number|null} confidence - OCR confidence score
 */

/**
 * @typedef {Object} ComparisonResult
 * @property {boolean} matches - True if specs match within tolerance
 * @property {Array<ComparisonDifference>} differences - List of differences found
 */

/**
 * @typedef {Object} ComparisonDifference
 * @property {string} field - Field that differs (width, height, price, etc.)
 * @property {any} original - Original value
 * @property {any} ack - Acknowledgment value
 * @property {number} [difference] - Numeric difference
 * @property {number} [percentDifference] - Percentage difference
 */

/**
 * @typedef {Object} Project
 * @property {string} id - UUID
 * @property {string} projectName - Project name
 * @property {string} customerName - Customer name
 * @property {string} customerEmail - Customer email
 * @property {string} projectType - Type: 'customer_list', 'blueprint', 'vendor_order'
 * @property {string} status - Status: 'pending', 'processing', 'completed', 'failed'
 * @property {Date} createdAt - Created timestamp
 * @property {Date} updatedAt - Updated timestamp
 * @property {Object} metadata - Additional data
 */

/**
 * @typedef {Object} LineItem
 * @property {string} id - UUID
 * @property {string} projectId - Project UUID
 * @property {number} lineNumber - Line number
 * @property {number} widthInches - Width in inches
 * @property {number} heightInches - Height in inches
 * @property {number} thicknessInches - Thickness in inches
 * @property {string} vendorCode - Vendor code
 * @property {string} doorType - Door type
 * @property {string} swing - Swing direction
 * @property {string} jambType - Jamb type
 * @property {string} fireRating - Fire rating
 * @property {number} quantity - Quantity
 * @property {number} unitPrice - Unit price
 * @property {number} totalPrice - Total price
 * @property {string} rawDescription - Original text
 * @property {Date} normalizedAt - Normalized timestamp
 * @property {Date} createdAt - Created timestamp
 * @property {Date} updatedAt - Updated timestamp
 */

/**
 * @typedef {Object} VendorOrder
 * @property {string} id - UUID
 * @property {string} projectId - Project UUID
 * @property {string} vendorName - Vendor name
 * @property {string} orderNumber - Order number
 * @property {Date} orderDate - Order date
 * @property {string} csvFilePath - MinIO path to CSV
 * @property {string} sentVia - Sent via: 'email', 'api', 'manual'
 * @property {Date} sentAt - Sent timestamp
 * @property {string} status - Status: 'draft', 'sent', 'acknowledged', 'discrepancy'
 * @property {Date} createdAt - Created timestamp
 * @property {Date} updatedAt - Updated timestamp
 * @property {Object} metadata - Additional data
 */

/**
 * @typedef {Object} VendorAcknowledgment
 * @property {string} id - UUID
 * @property {string} vendorOrderId - Vendor order UUID
 * @property {string} ackFilePath - MinIO path to ack PDF
 * @property {Date} parsedAt - Parsed timestamp
 * @property {number} ocrConfidence - Average OCR confidence
 * @property {string} ocrMethod - OCR method: 'openai_vision', 'tesseract', 'pdf_text'
 * @property {Date} createdAt - Created timestamp
 * @property {Date} updatedAt - Updated timestamp
 * @property {Object} rawData - Full OCR output
 */

/**
 * @typedef {Object} Comparison
 * @property {string} id - UUID
 * @property {string} vendorOrderId - Vendor order UUID
 * @property {string} ackId - Acknowledgment UUID
 * @property {number} totalLinesCompared - Total lines compared
 * @property {number} linesMatched - Lines that matched
 * @property {number} linesMismatched - Lines that mismatched
 * @property {number} priceTolerancePercent - Price tolerance used
 * @property {number} sizeToleranceInches - Size tolerance used
 * @property {boolean} hasDiscrepancies - True if discrepancies found
 * @property {string} mismatchPdfPath - MinIO path to mismatch PDF
 * @property {Date} comparedAt - Comparison timestamp
 * @property {Date} createdAt - Created timestamp
 * @property {Object} details - Detailed mismatch data
 */

/**
 * @typedef {Object} Job
 * @property {string} id - UUID
 * @property {string} jobName - Job name: 'ocr-ack', 'compare', 'generate-pdf', 'send-email'
 * @property {string} jobId - BullMQ job ID
 * @property {string} projectId - Project UUID
 * @property {string} status - Status: 'pending', 'active', 'completed', 'failed', 'delayed'
 * @property {number} progress - Progress 0-100
 * @property {Date} queuedAt - Queued timestamp
 * @property {Date} startedAt - Started timestamp
 * @property {Date} completedAt - Completed timestamp
 * @property {Object} result - Job result
 * @property {string} error - Error message
 * @property {number} retryCount - Retry count
 * @property {Date} createdAt - Created timestamp
 * @property {Date} updatedAt - Updated timestamp
 */

/**
 * Job types
 */
const JOB_TYPES = {
    OCR_ACK: 'ocr-ack',
    COMPARE: 'compare',
    GENERATE_PDF: 'generate-pdf',
    SEND_EMAIL: 'send-email',
};

/**
 * Project statuses
 */
const PROJECT_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
};

/**
 * Vendor order statuses
 */
const VENDOR_ORDER_STATUS = {
    DRAFT: 'draft',
    SENT: 'sent',
    ACKNOWLEDGED: 'acknowledged',
    DISCREPANCY: 'discrepancy',
};

/**
 * Job statuses
 */
const JOB_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    FAILED: 'failed',
    DELAYED: 'delayed',
};

module.exports = {
    JOB_TYPES,
    PROJECT_STATUS,
    VENDOR_ORDER_STATUS,
    JOB_STATUS,
};
