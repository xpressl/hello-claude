/**
 * Door Specification Normalizer
 *
 * Converts various door size formats into a consistent normalized format.
 * Handles vendor codes, inches, feet-inch notation, and natural language.
 *
 * Example conversions:
 * - "2468" → { width: 24, height: 68, vendorCode: "2468" }
 * - "3'-0\" x 6'-8\"" → { width: 36, height: 80 }
 * - "36 x 80" → { width: 36, height: 80 }
 */

/**
 * Standard vendor code mappings
 * Format: XXYY where XX = width in inches, YY = height in inches (rounded)
 *
 * Common heights:
 * - 68 = 6'8" (80 inches)
 * - 70 = 7'0" (84 inches)
 *
 * Common widths:
 * - 24, 26, 28, 30, 32, 34, 36, 42, 48
 */
const VENDOR_CODE_MAPPINGS = {
    // 24" wide doors
    '2468': { width: 24, height: 80 },
    '2470': { width: 24, height: 84 },

    // 26" wide doors
    '2668': { width: 26, height: 80 },
    '2670': { width: 26, height: 84 },

    // 28" wide doors
    '2868': { width: 28, height: 80 },
    '2870': { width: 28, height: 84 },

    // 30" wide doors
    '3068': { width: 30, height: 80 },
    '3070': { width: 30, height: 84 },

    // 32" wide doors
    '3268': { width: 32, height: 80 },
    '3270': { width: 32, height: 84 },

    // 34" wide doors
    '3468': { width: 34, height: 80 },
    '3470': { width: 34, height: 84 },

    // 36" wide doors (most common)
    '3668': { width: 36, height: 80 },
    '3670': { width: 36, height: 84 },
    '3672': { width: 36, height: 96 },

    // 42" wide doors
    '4268': { width: 42, height: 80 },
    '4270': { width: 42, height: 84 },

    // 48" wide doors (double door)
    '4868': { width: 48, height: 80 },
    '4870': { width: 48, height: 84 },
};

/**
 * Swing type mappings (various notations)
 */
const SWING_MAPPINGS = {
    'LH': 'LH',
    'LEFT HAND': 'LH',
    'LEFT-HAND': 'LH',
    'L.H.': 'LH',

    'RH': 'RH',
    'RIGHT HAND': 'RH',
    'RIGHT-HAND': 'RH',
    'R.H.': 'RH',

    'LHR': 'LHR',
    'LEFT HAND REVERSE': 'LHR',
    'L.H.R.': 'LHR',

    'RHR': 'RHR',
    'RIGHT HAND REVERSE': 'RHR',
    'R.H.R.': 'RHR',
};

/**
 * Jamb type mappings
 */
const JAMB_MAPPINGS = {
    'KD': 'Knock-Down',
    'KNOCK DOWN': 'Knock-Down',
    'KNOCK-DOWN': 'Knock-Down',

    'WELDED': 'Welded',
    'WELD': 'Welded',

    'MASONRY': 'Masonry',
    'WOOD': 'Wood',
    'STEEL': 'Steel',
};

/**
 * Parse vendor code (4-digit format)
 */
function parseVendorCode(code) {
    const normalized = String(code).replace(/[^0-9]/g, '');

    if (normalized.length !== 4) {
        return null;
    }

    if (VENDOR_CODE_MAPPINGS[normalized]) {
        return {
            ...VENDOR_CODE_MAPPINGS[normalized],
            vendorCode: normalized,
        };
    }

    // Attempt to parse unknown vendor codes
    const width = parseInt(normalized.substring(0, 2), 10);
    const heightCode = parseInt(normalized.substring(2, 4), 10);

    // Convert height code to actual height
    // 68 → 80", 70 → 84", 72 → 96"
    const heightMap = {
        68: 80,
        70: 84,
        72: 96,
    };

    const height = heightMap[heightCode] || heightCode;

    return {
        width,
        height,
        vendorCode: normalized,
    };
}

/**
 * Parse feet-inch format (e.g., "3'-0\" x 6'-8\"" or "3'0\" x 6'8\"")
 */
function parseFeetInches(text) {
    const pattern = /(\d+)[''][\s-]?(\d+)[""]?\s*[xX×]\s*(\d+)[''][\s-]?(\d+)[""]?/;
    const match = text.match(pattern);

    if (match) {
        const widthFeet = parseInt(match[1], 10);
        const widthInches = parseInt(match[2], 10);
        const heightFeet = parseInt(match[3], 10);
        const heightInches = parseInt(match[4], 10);

        return {
            width: widthFeet * 12 + widthInches,
            height: heightFeet * 12 + heightInches,
        };
    }

    return null;
}

/**
 * Parse simple inch format (e.g., "36 x 80" or "36x80")
 */
function parseInches(text) {
    const pattern = /(\d+)\s*[xX×]\s*(\d+)/;
    const match = text.match(pattern);

    if (match) {
        return {
            width: parseInt(match[1], 10),
            height: parseInt(match[2], 10),
        };
    }

    return null;
}

/**
 * Normalize door size from any format
 */
function normalizeDoorSize(input) {
    if (!input) return null;

    const text = String(input).trim().toUpperCase();

    // Try vendor code first (most specific)
    const vendorCode = parseVendorCode(text);
    if (vendorCode) {
        return vendorCode;
    }

    // Try feet-inches format
    const feetInches = parseFeetInches(text);
    if (feetInches) {
        return feetInches;
    }

    // Try simple inches format
    const inches = parseInches(text);
    if (inches) {
        return inches;
    }

    return null;
}

/**
 * Normalize swing direction
 */
function normalizeSwing(input) {
    if (!input) return null;

    const text = String(input).trim().toUpperCase();

    return SWING_MAPPINGS[text] || input;
}

/**
 * Normalize jamb type
 */
function normalizeJamb(input) {
    if (!input) return null;

    const text = String(input).trim().toUpperCase();

    return JAMB_MAPPINGS[text] || input;
}

/**
 * Normalize door thickness
 */
function normalizeThickness(input) {
    if (!input) return null;

    const text = String(input).trim();

    // Extract numeric value
    const match = text.match(/(\d+\.?\d*)/);
    if (match) {
        return parseFloat(match[1]);
    }

    return null;
}

/**
 * Complete door specification normalization
 *
 * Takes raw OCR text and returns normalized door specs
 */
function normalizeDoorSpec(rawData) {
    const normalized = {
        // Original data
        rawDescription: rawData.description || rawData.raw_text || '',

        // Normalized dimensions
        widthInches: null,
        heightInches: null,
        thicknessInches: null,
        vendorCode: null,

        // Normalized attributes
        swing: null,
        jambType: null,
        doorType: null,
        fireRating: null,

        // Pricing
        quantity: rawData.quantity || 1,
        unitPrice: rawData.unit_price || rawData.price || null,
        totalPrice: null,

        // Metadata
        normalizedAt: new Date().toISOString(),
        confidence: rawData.confidence || null,
    };

    // Normalize size
    const sizeData = normalizeDoorSize(rawData.size || rawData.vendor_code || rawData.description);
    if (sizeData) {
        normalized.widthInches = sizeData.width;
        normalized.heightInches = sizeData.height;
        normalized.vendorCode = sizeData.vendorCode || null;
    }

    // Normalize other attributes
    normalized.swing = normalizeSwing(rawData.swing || rawData.handing);
    normalized.jambType = normalizeJamb(rawData.jamb || rawData.jamb_type);
    normalized.thicknessInches = normalizeThickness(rawData.thickness);

    // Extract door type if present
    normalized.doorType = rawData.door_type || rawData.type || null;
    normalized.fireRating = rawData.fire_rating || null;

    // Calculate total price
    if (normalized.unitPrice && normalized.quantity) {
        normalized.totalPrice = normalized.unitPrice * normalized.quantity;
    }

    return normalized;
}

/**
 * Compare two normalized door specs
 * Returns true if they match within tolerances
 */
function compareDoorSpecs(spec1, spec2, tolerances = {}) {
    const {
        sizeTolerance = 0.25, // inches
        priceTolerance = 2.0,  // percent
    } = tolerances;

    const differences = [];

    // Compare dimensions
    if (spec1.widthInches && spec2.widthInches) {
        const widthDiff = Math.abs(spec1.widthInches - spec2.widthInches);
        if (widthDiff > sizeTolerance) {
            differences.push({
                field: 'width',
                original: spec1.widthInches,
                ack: spec2.widthInches,
                difference: widthDiff,
            });
        }
    }

    if (spec1.heightInches && spec2.heightInches) {
        const heightDiff = Math.abs(spec1.heightInches - spec2.heightInches);
        if (heightDiff > sizeTolerance) {
            differences.push({
                field: 'height',
                original: spec1.heightInches,
                ack: spec2.heightInches,
                difference: heightDiff,
            });
        }
    }

    // Compare price
    if (spec1.unitPrice && spec2.unitPrice) {
        const priceDiff = Math.abs(spec1.unitPrice - spec2.unitPrice);
        const pricePercent = (priceDiff / spec1.unitPrice) * 100;

        if (pricePercent > priceTolerance) {
            differences.push({
                field: 'price',
                original: spec1.unitPrice,
                ack: spec2.unitPrice,
                difference: priceDiff,
                percentDifference: pricePercent,
            });
        }
    }

    // Compare swing (exact match required)
    if (spec1.swing && spec2.swing && spec1.swing !== spec2.swing) {
        differences.push({
            field: 'swing',
            original: spec1.swing,
            ack: spec2.swing,
        });
    }

    return {
        matches: differences.length === 0,
        differences,
    };
}

module.exports = {
    normalizeDoorSize,
    normalizeSwing,
    normalizeJamb,
    normalizeThickness,
    normalizeDoorSpec,
    compareDoorSpecs,
    VENDOR_CODE_MAPPINGS,
    SWING_MAPPINGS,
    JAMB_MAPPINGS,
};
