/**
 * PDF Generator - Creates professional mismatch report PDFs
 *
 * Uses PDFKit to generate clean, formatted comparison reports
 */

const PDFDocument = require('pdfkit');

/**
 * Generate professional mismatch PDF report
 *
 * @param {Object} comparisonData - Comparison data from database
 * @param {Array} mismatchDetails - Mismatch details from database
 * @param {Object} projectData - Project information
 * @param {Object} vendorData - Vendor order information
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateMismatchPDF(comparisonData, mismatchDetails, projectData, vendorData) {
    return new Promise((resolve, reject) => {
        try {
            // Create PDF document
            const doc = new PDFDocument({
                margin: 50,
                size: 'LETTER',
                info: {
                    Title: 'Vendor Acknowledgment Mismatch Report',
                    Author: 'Door Automation System',
                    Subject: `Discrepancies for ${vendorData.vendor_name}`,
                    CreatedDate: new Date(),
                },
            });

            const chunks = [];

            doc.on('data', (chunk) => chunks.push(chunk));

            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });

            doc.on('error', (error) => {
                reject(error);
            });

            // --- HEADER SECTION ---
            doc.fontSize(24)
                .fillColor('#2c3e50')
                .text('Vendor Acknowledgment Mismatch Report', { align: 'center' });

            doc.moveDown(0.5);

            doc.fontSize(10)
                .fillColor('#7f8c8d')
                .text(`Generated: ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`, {
                    align: 'center',
                });

            doc.moveDown(1.5);

            // --- PROJECT INFORMATION ---
            doc.fontSize(14).fillColor('#2c3e50').text('Project Information', { underline: true });

            doc.moveDown(0.5);

            doc.fontSize(10).fillColor('#000000');
            doc.text(`Project: ${projectData.project_name || 'N/A'}`, { continued: false });
            doc.text(`Project ID: ${projectData.id || 'N/A'}`);
            doc.text(`Vendor: ${vendorData.vendor_name || 'N/A'}`);
            doc.text(`Order Number: ${vendorData.order_number || 'N/A'}`);
            doc.text(`Order Date: ${vendorData.order_date ? new Date(vendorData.order_date).toLocaleDateString() : 'N/A'}`);

            doc.moveDown(1.5);

            // --- SUMMARY SECTION ---
            doc.fontSize(14).fillColor('#2c3e50').text('Comparison Summary', { underline: true });

            doc.moveDown(0.5);

            const totalLines = comparisonData.total_lines_compared || 0;
            const matched = comparisonData.lines_matched || 0;
            const mismatched = comparisonData.lines_mismatched || 0;

            doc.fontSize(11).fillColor('#000000');
            doc.text(`Total Lines Compared: ${totalLines}`);

            doc.fillColor('#27ae60').text(`✓ Matched Lines: ${matched} (${totalLines > 0 ? Math.round((matched / totalLines) * 100) : 0}%)`);

            doc.fillColor('#e74c3c').text(`✗ Mismatched Lines: ${mismatched} (${totalLines > 0 ? Math.round((mismatched / totalLines) * 100) : 0}%)`);

            doc.moveDown(1);

            doc.fontSize(10).fillColor('#7f8c8d');
            doc.text(`Tolerances Applied:`);
            doc.text(`  • Price Tolerance: ±${comparisonData.price_tolerance_percent || 2.0}%`);
            doc.text(`  • Size Tolerance: ±${comparisonData.size_tolerance_inches || 0.25} inches`);

            doc.moveDown(2);

            // --- DISCREPANCIES TABLE ---
            doc.fontSize(14).fillColor('#2c3e50').text('Line-by-Line Discrepancies', { underline: true });

            doc.moveDown(1);

            if (mismatchDetails.length === 0) {
                doc.fontSize(11).fillColor('#27ae60').text('No discrepancies found!', { align: 'center' });
            } else {
                // Table header background
                const tableTop = doc.y;
                const tableLeft = 50;
                const tableWidth = doc.page.width - 100;

                // Draw header background
                doc.rect(tableLeft, tableTop, tableWidth, 20).fillAndStroke('#34495e', '#2c3e50');

                // Table header text
                doc.fontSize(9).fillColor('#ffffff');

                const colWidths = {
                    line: 40,
                    type: 80,
                    description: 130,
                    original: 90,
                    ack: 90,
                    difference: 80,
                };

                let x = tableLeft + 5;
                const headerY = tableTop + 6;

                doc.text('Line', x, headerY, { width: colWidths.line, align: 'center' });
                x += colWidths.line;

                doc.text('Type', x, headerY, { width: colWidths.type, align: 'left' });
                x += colWidths.type;

                doc.text('Description', x, headerY, { width: colWidths.description, align: 'left' });
                x += colWidths.description;

                doc.text('Original', x, headerY, { width: colWidths.original, align: 'left' });
                x += colWidths.original;

                doc.text('Ack Value', x, headerY, { width: colWidths.ack, align: 'left' });
                x += colWidths.ack;

                doc.text('Difference', x, headerY, { width: colWidths.difference, align: 'left' });

                doc.moveDown(1.5);

                // Table rows
                mismatchDetails.forEach((mismatch, index) => {
                    // Check if we need a new page
                    if (doc.y > doc.page.height - 100) {
                        doc.addPage();
                    }

                    const rowY = doc.y;
                    const rowHeight = 30;

                    // Alternate row background
                    const bgColor = index % 2 === 0 ? '#ecf0f1' : '#ffffff';
                    doc.rect(tableLeft, rowY, tableWidth, rowHeight).fillAndStroke(bgColor, '#bdc3c7');

                    // Severity color
                    const severityColor = getSeverityColor(mismatch.severity);

                    doc.fontSize(8).fillColor('#000000');

                    x = tableLeft + 5;
                    const textY = rowY + 10;

                    // Line number
                    doc.text(mismatch.line_number || '-', x, textY, {
                        width: colWidths.line,
                        align: 'center',
                    });
                    x += colWidths.line;

                    // Mismatch type (with color coding)
                    doc.fillColor(severityColor);
                    doc.text(formatMismatchType(mismatch.mismatch_type), x, textY, {
                        width: colWidths.type,
                        align: 'left',
                    });
                    x += colWidths.type;

                    doc.fillColor('#000000');

                    // Description
                    const description = getItemDescription(mismatch);
                    doc.text(description, x, textY, { width: colWidths.description, align: 'left' });
                    x += colWidths.description;

                    // Original value
                    doc.text(mismatch.original_value || '-', x, textY, {
                        width: colWidths.original,
                        align: 'left',
                    });
                    x += colWidths.original;

                    // Ack value
                    doc.text(mismatch.ack_value || '-', x, textY, { width: colWidths.ack, align: 'left' });
                    x += colWidths.ack;

                    // Difference
                    doc.fillColor(severityColor);
                    doc.text(mismatch.difference || '-', x, textY, {
                        width: colWidths.difference,
                        align: 'left',
                    });

                    doc.moveDown(2);
                });
            }

            // --- FOOTER SECTION ---
            doc.moveDown(3);

            // Draw separator line
            doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#bdc3c7');

            doc.moveDown(1);

            doc.fontSize(10).fillColor('#7f8c8d');
            doc.text('Next Steps:', { underline: true });
            doc.moveDown(0.5);

            doc.fontSize(9);
            doc.text('1. Review the discrepancies listed above');
            doc.text('2. Contact the vendor to confirm the correct specifications');
            doc.text('3. Update the order if changes are accepted');
            doc.text('4. Request a revised acknowledgment if corrections are needed');

            // Page numbers and footer
            const pages = doc.bufferedPageRange();

            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);

                // Footer at bottom of each page
                doc.fontSize(8)
                    .fillColor('#95a5a6')
                    .text(
                        `Door Automation System | Page ${i + 1} of ${pages.count}`,
                        50,
                        doc.page.height - 30,
                        { align: 'center', width: doc.page.width - 100 }
                    );
            }

            // Finalize PDF
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Get severity color for highlighting
 */
function getSeverityColor(severity) {
    const colors = {
        low: '#f39c12',
        medium: '#e67e22',
        high: '#e74c3c',
        critical: '#c0392b',
    };

    return colors[severity] || colors.medium;
}

/**
 * Format mismatch type for display
 */
function formatMismatchType(type) {
    const types = {
        price: 'Price',
        size: 'Size',
        quantity: 'Quantity',
        missing: 'Missing Item',
        extra: 'Extra Item',
        specification: 'Specification',
        dimension: 'Dimension',
    };

    return types[type] || type;
}

/**
 * Get item description from mismatch details
 */
function getItemDescription(mismatch) {
    // Try to construct a meaningful description
    if (mismatch.mismatch_type === 'missing') {
        return 'Item missing from ack';
    }

    if (mismatch.mismatch_type === 'extra') {
        return 'Extra item in ack';
    }

    // Use the mismatch type as description
    return `${formatMismatchType(mismatch.mismatch_type)} mismatch`;
}

module.exports = {
    generateMismatchPDF,
};
