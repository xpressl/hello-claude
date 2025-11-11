/**
 * Vendor Acknowledgment Routes
 *
 * POST /api/vendor-ack - Upload vendor ack PDF and trigger workflow
 */

const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../../../shared/db/db');
const { uploadFile } = require('../minio-client');
const { enqueueVendorAckWorkflow } = require('../queue-manager');
const { createVendorAckPlan } = require('../multi-agent-plan');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept PDFs only
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    },
});

/**
 * POST /api/vendor-ack
 *
 * Upload vendor acknowledgment PDF and start automated workflow
 *
 * Body (multipart/form-data):
 * - file: vendor ack PDF
 * - vendor_order_id: UUID of existing vendor order
 *
 * OR create a new vendor order:
 * - file: vendor ack PDF
 * - project_name: Project name
 * - vendor_name: Vendor name
 * - vendor_email: Vendor email
 * - customer_name: Customer name (optional)
 * - customer_email: Customer email (optional)
 */
router.post('/', upload.single('file'), async (req, res) => {
    try {
        console.log('Vendor ack upload received');

        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { vendor_order_id, project_name, vendor_name, vendor_email, customer_name, customer_email } = req.body;

        let vendorOrder;
        let project;

        // Check if vendor order exists
        if (vendor_order_id) {
            vendorOrder = await db.getVendorOrder(vendor_order_id);

            if (!vendorOrder) {
                return res.status(404).json({ error: 'Vendor order not found' });
            }

            project = await db.getProject(vendorOrder.project_id);
        } else {
            // Create new project and vendor order
            if (!project_name || !vendor_name) {
                return res.status(400).json({
                    error: 'project_name and vendor_name are required when vendor_order_id is not provided',
                });
            }

            // Create project
            project = await db.createProject({
                projectName: project_name,
                customerName: customer_name || 'Unknown',
                customerEmail: customer_email || null,
                projectType: 'vendor_order',
                metadata: {
                    createdFrom: 'vendor-ack-upload',
                },
            });

            console.log(`Project created: ${project.id}`);

            // Create vendor order
            vendorOrder = await db.createVendorOrder({
                projectId: project.id,
                vendorName: vendor_name,
                orderNumber: `ACK-${Date.now()}`,
                csvFilePath: null, // No CSV for ack-only workflow
                metadata: {
                    vendorEmail: vendor_email,
                },
            });

            console.log(`Vendor order created: ${vendorOrder.id}`);
        }

        // Upload ack PDF to MinIO
        const ackFilePath = await uploadFile(file.buffer, project.id, file.originalname, 'ack-pdf');

        console.log(`Ack PDF uploaded: ${ackFilePath}`);

        // Create vendor acknowledgment record
        const vendorAck = await db.createVendorAck({
            vendorOrderId: vendorOrder.id,
            ackFilePath: ackFilePath,
            ocrConfidence: null, // Will be updated by OCR agent
            ocrMethod: null,
            rawData: {},
        });

        console.log(`Vendor ack created: ${vendorAck.id}`);

        // Update project status
        await db.updateProjectStatus(project.id, 'processing');

        // Enqueue workflow jobs
        const jobs = await enqueueVendorAckWorkflow({
            projectId: project.id,
            vendorOrderId: vendorOrder.id,
            ackId: vendorAck.id,
            ackFilePath: ackFilePath,
            vendorName: vendorOrder.vendor_name,
            vendorEmail: vendor_email || vendorOrder.metadata?.vendorEmail || null,
        });

        console.log('Workflow jobs enqueued:', jobs);

        // Create job records in database
        await db.createJob({
            jobName: 'ocr-ack',
            jobId: String(jobs.ocrJobId),
            projectId: project.id,
            status: 'pending',
        });

        await db.createJob({
            jobName: 'compare',
            jobId: String(jobs.compareJobId),
            projectId: project.id,
            status: 'pending',
        });

        // Create MULTI_AGENT_PLAN.md
        await createVendorAckPlan({
            projectId: project.id,
            projectName: project.project_name,
            vendorName: vendorOrder.vendor_name,
            vendorOrderId: vendorOrder.id,
            jobs,
        });

        console.log('MULTI_AGENT_PLAN.md created');

        // Log audit
        await db.logAudit('vendor_acknowledgment', vendorAck.id, 'uploaded', {
            projectId: project.id,
            fileName: file.originalname,
        });

        return res.status(200).json({
            success: true,
            message: 'Vendor acknowledgment uploaded and workflow started',
            data: {
                projectId: project.id,
                vendorOrderId: vendorOrder.id,
                ackId: vendorAck.id,
                ackFilePath: ackFilePath,
                jobs: {
                    ocrJobId: jobs.ocrJobId,
                    compareJobId: jobs.compareJobId,
                },
            },
        });
    } catch (error) {
        console.error('Error uploading vendor ack:', error);

        return res.status(500).json({
            error: 'Failed to upload vendor acknowledgment',
            message: error.message,
        });
    }
});

module.exports = router;
