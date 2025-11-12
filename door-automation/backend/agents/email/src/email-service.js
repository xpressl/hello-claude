/**
 * Email Service - Handles sending emails with attachments
 */

const nodemailer = require('nodemailer');
const config = require('./config');

/**
 * Create SMTP transporter
 */
function createTransporter() {
    // Check if SMTP credentials are configured
    if (!config.smtp.auth.user || !config.smtp.auth.pass) {
        throw new Error(
            'SMTP credentials not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables.'
        );
    }

    return nodemailer.createTransport(config.smtp);
}

/**
 * Send mismatch notification email to vendor
 *
 * @param {Object} data - Email data
 * @param {string} data.vendorEmail - Vendor email address
 * @param {string} data.vendorName - Vendor name
 * @param {string} data.projectName - Project name
 * @param {string} data.projectId - Project UUID
 * @param {string} data.orderNumber - Vendor order number
 * @param {number} data.mismatchCount - Number of discrepancies
 * @param {Buffer} data.pdfBuffer - PDF attachment buffer
 * @param {Array} data.mismatchSummary - Summary of mismatches
 * @returns {Promise<Object>} - Email send result
 */
async function sendMismatchEmail(data) {
    const {
        vendorEmail,
        vendorName,
        projectName,
        projectId,
        orderNumber,
        mismatchCount,
        pdfBuffer,
        mismatchSummary = [],
    } = data;

    // Create transporter
    const transporter = createTransporter();

    // Build mismatch summary HTML
    let summaryHtml = '';
    if (mismatchSummary.length > 0) {
        summaryHtml = `
            <h3>Summary of Discrepancies:</h3>
            <ul>
                ${mismatchSummary
                    .slice(0, 10) // Show first 10
                    .map(
                        (m) =>
                            `<li><strong>Line ${m.lineNumber}:</strong> ${m.mismatchType} - Expected: ${m.originalValue}, Received: ${m.ackValue}</li>`
                    )
                    .join('')}
                ${mismatchSummary.length > 10 ? '<li><em>...and more (see attached report)</em></li>' : ''}
            </ul>
        `;
    }

    // Email HTML body
    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .header {
                    background-color: #d32f2f;
                    color: white;
                    padding: 20px;
                    border-radius: 5px;
                }
                .content {
                    padding: 20px;
                }
                .footer {
                    margin-top: 30px;
                    padding: 20px;
                    background-color: #f5f5f5;
                    border-radius: 5px;
                    font-size: 0.9em;
                }
                .alert {
                    background-color: #fff3cd;
                    border: 1px solid #ffc107;
                    padding: 15px;
                    margin: 15px 0;
                    border-radius: 5px;
                }
                ul {
                    margin: 10px 0;
                }
                li {
                    margin: 5px 0;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>⚠️ Vendor Acknowledgment Discrepancy Detected</h2>
            </div>

            <div class="content">
                <p>Dear ${vendorName} Team,</p>

                <div class="alert">
                    <strong>Alert:</strong> We have detected <strong>${mismatchCount}</strong> discrepancies between your acknowledgment and our original purchase order.
                </div>

                <p><strong>Project Details:</strong></p>
                <ul>
                    <li><strong>Project Name:</strong> ${projectName}</li>
                    <li><strong>Order Number:</strong> ${orderNumber}</li>
                    <li><strong>Project ID:</strong> ${projectId}</li>
                </ul>

                ${summaryHtml}

                <p>Please review the attached <strong>Mismatch Report PDF</strong> for a detailed line-by-line comparison of the discrepancies.</p>

                <p><strong>Required Action:</strong></p>
                <ul>
                    <li>Review the attached mismatch report carefully</li>
                    <li>Verify the correct specifications for each flagged line item</li>
                    <li>Respond with confirmation or corrections within 48 hours</li>
                </ul>

                <p>If you have any questions or need clarification, please don't hesitate to reach out.</p>

                <p>Best regards,<br>
                <strong>Door Automation System</strong></p>
            </div>

            <div class="footer">
                <p><em>This is an automated notification from the Door Automation System. Please do not reply directly to this email.</em></p>
                <p><em>For support, contact your project manager or email support@example.com</em></p>
            </div>
        </body>
        </html>
    `;

    // Plain text fallback
    const textBody = `
VENDOR ACKNOWLEDGMENT DISCREPANCY DETECTED

Dear ${vendorName} Team,

We have detected ${mismatchCount} discrepancies between your acknowledgment and our original purchase order.

Project Details:
- Project Name: ${projectName}
- Order Number: ${orderNumber}
- Project ID: ${projectId}

Please review the attached Mismatch Report PDF for a detailed line-by-line comparison of the discrepancies.

Required Action:
- Review the attached mismatch report carefully
- Verify the correct specifications for each flagged line item
- Respond with confirmation or corrections within 48 hours

If you have any questions or need clarification, please don't hesitate to reach out.

Best regards,
Door Automation System

---
This is an automated notification from the Door Automation System.
For support, contact your project manager or email support@example.com
    `.trim();

    // Build CC list
    const ccEmails = config.emailCc ? config.emailCc.split(',').map((e) => e.trim()).filter(Boolean) : [];

    // Mail options
    const mailOptions = {
        from: config.emailFrom,
        to: vendorEmail,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        subject: `Vendor Acknowledgment Discrepancy - ${projectName}`,
        text: textBody,
        html: htmlBody,
        attachments: [
            {
                filename: `Mismatch_Report_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${orderNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            },
        ],
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
    };
}

/**
 * Verify SMTP connection
 */
async function verifyConnection() {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        return { success: true, message: 'SMTP connection verified' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    sendMismatchEmail,
    verifyConnection,
};
