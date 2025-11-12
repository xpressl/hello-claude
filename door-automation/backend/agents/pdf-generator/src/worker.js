/**
 * PDF Generator Worker Agent
 *
 * Pulls jobs from the 'generate-pdf' queue, generates professional
 * mismatch report PDFs, uploads to MinIO, and enqueues email jobs.
 */

require('dotenv').config();

const { Worker, Queue } = require('bullmq');
const Redis = require('ioredis');
const pino = require('pino');
const Minio = require('minio');

const config = require('./config');
const { generateMismatchPDF } = require('./pdf-generator');
const db = require('../../shared/db/db');

// Logger
const logger = pino({
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
    transport:
        config.nodeEnv === 'development'
            ? {
                  target: 'pino-pretty',
                  options: {
                      colorize: true,
                      translateTime: 'HH:MM:ss Z',
                      ignore: 'pid,hostname',
                  },
              }
            : undefined,
});

// Redis connection
const connection = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
});

// MinIO client
const minioClient = new Minio.Client({
    endPoint: config.minio.endPoint,
    port: config.minio.port,
    useSSL: config.minio.useSSL,
    accessKey: config.minio.accessKey,
    secretKey: config.minio.secretKey,
});

const BUCKET_NAME = config.minio.bucket;

// Email queue for next step
const emailQueue = new Queue('send-email', { connection });

/**
 * Upload PDF buffer to MinIO
 *
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} projectId - Project UUID
 * @param {string} comparisonId - Comparison UUID
 * @returns {Promise<string>} - MinIO object path
 */
async function uploadPdfToMinio(pdfBuffer, projectId, comparisonId) {
    try {
        const objectName = `${projectId}/mismatch-pdf/${comparisonId}.pdf`;

        await minioClient.putObject(BUCKET_NAME, objectName, pdfBuffer, {
            'Content-Type': 'application/pdf',
            'X-Amz-Meta-Project-Id': projectId,
            'X-Amz-Meta-Comparison-Id': comparisonId,
            'X-Amz-Meta-Generated-At': new Date().toISOString(),
        });

        logger.info({ objectName }, 'PDF uploaded to MinIO');

        return objectName;
    } catch (error) {
        logger.error({ err: error }, 'Failed to upload PDF to MinIO');
        throw error;
    }
}

/**
 * Update MULTI_AGENT_PLAN.md task status
 */
async function updatePlanStatus(projectId, taskNumber, status, metadata = {}) {
    try {
        // Import dynamically to avoid circular dependencies
        const { updateTaskStatus } = require('../../../orchestrator/src/multi-agent-plan');
        await updateTaskStatus(projectId, taskNumber, status, metadata);
    } catch (error) {
        logger.warn({ err: error }, 'Failed to update plan status (non-critical)');
    }
}

/**
 * Add conditional job to plan
 */
async function addConditionalJob(projectId, taskNumber, jobId) {
    try {
        const { addConditionalJob: addJob } = require('../../../orchestrator/src/multi-agent-plan');
        await addJob(projectId, taskNumber, jobId);
    } catch (error) {
        logger.warn({ err: error }, 'Failed to add conditional job to plan (non-critical)');
    }
}

/**
 * Process Generate PDF Job
 */
async function processGeneratePdfJob(job) {
    const { projectId, vendorOrderId, comparisonId, ackId } = job.data;

    logger.info(
        { jobId: job.id, projectId, comparisonId },
        'Processing generate PDF job'
    );

    const startedAt = new Date();

    try {
        // Update plan status to in_progress
        await updatePlanStatus(projectId, 3, 'in_progress', { startedAt });

        // Add job ID to plan (conditional task)
        await addConditionalJob(projectId, 3, String(job.id));

        // Update job in database
        await db.updateJob(String(job.id), {
            status: 'active',
            progress: 10,
            startedAt,
        });

        // Fetch comparison data
        logger.info({ comparisonId }, 'Fetching comparison data');

        const comparisonResult = await db.query(
            'SELECT * FROM comparisons WHERE id = $1',
            [comparisonId]
        );

        if (!comparisonResult.rows || comparisonResult.rows.length === 0) {
            throw new Error(`Comparison not found: ${comparisonId}`);
        }

        const comparisonData = comparisonResult.rows[0];

        await job.updateProgress(20);

        // Fetch mismatch details
        logger.info({ comparisonId }, 'Fetching mismatch details');

        const mismatchResult = await db.query(
            `SELECT * FROM mismatch_details
             WHERE comparison_id = $1
             ORDER BY line_number`,
            [comparisonId]
        );

        const mismatchDetails = mismatchResult.rows || [];

        logger.info({ count: mismatchDetails.length }, 'Mismatch details fetched');

        await job.updateProgress(30);

        // Fetch project data
        logger.info({ projectId }, 'Fetching project data');
        const projectData = await db.getProject(projectId);

        if (!projectData) {
            throw new Error(`Project not found: ${projectId}`);
        }

        await job.updateProgress(40);

        // Fetch vendor order data
        logger.info({ vendorOrderId }, 'Fetching vendor order data');
        const vendorData = await db.getVendorOrder(vendorOrderId);

        if (!vendorData) {
            throw new Error(`Vendor order not found: ${vendorOrderId}`);
        }

        await job.updateProgress(50);

        // Generate PDF
        logger.info('Generating mismatch PDF report');

        const pdfBuffer = await generateMismatchPDF(
            comparisonData,
            mismatchDetails,
            projectData,
            vendorData
        );

        logger.info({ size: pdfBuffer.length }, 'PDF generated successfully');

        await job.updateProgress(70);

        // Upload PDF to MinIO
        logger.info('Uploading PDF to MinIO');

        const pdfPath = await uploadPdfToMinio(pdfBuffer, projectId, comparisonId);

        await job.updateProgress(80);

        // Update comparison record with PDF path
        logger.info({ pdfPath }, 'Updating comparison with PDF path');

        await db.query(
            'UPDATE comparisons SET mismatch_pdf_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [pdfPath, comparisonId]
        );

        await job.updateProgress(85);

        // Enqueue email job
        logger.info('Enqueueing send-email job');

        const emailJob = await emailQueue.add('send-email', {
            projectId,
            vendorOrderId,
            comparisonId,
            ackId,
            pdfPath,
            vendorEmail: vendorData.metadata?.vendor_email || null,
            vendorName: vendorData.vendor_name,
        });

        logger.info({ emailJobId: emailJob.id }, 'Email job enqueued');

        // Create job record in database
        await db.createJob({
            jobName: 'send-email',
            jobId: String(emailJob.id),
            projectId,
            status: 'pending',
        });

        await job.updateProgress(90);

        // Update job in database
        const completedAt = new Date();

        await db.updateJob(String(job.id), {
            status: 'completed',
            progress: 100,
            completedAt,
            result: {
                pdfPath,
                pdfSize: pdfBuffer.length,
                mismatchCount: mismatchDetails.length,
                emailJobId: String(emailJob.id),
            },
        });

        // Update plan status to completed
        await updatePlanStatus(projectId, 3, 'completed', { startedAt, completedAt });

        logger.info(
            { jobId: job.id, duration: completedAt - startedAt, pdfPath },
            'Generate PDF job completed'
        );

        return {
            success: true,
            pdfPath,
            pdfSize: pdfBuffer.length,
            mismatchCount: mismatchDetails.length,
            emailJobId: String(emailJob.id),
        };
    } catch (error) {
        logger.error({ err: error, jobId: job.id }, 'Generate PDF job failed');

        // Update job in database
        await db.updateJob(String(job.id), {
            status: 'failed',
            error: error.message,
        });

        // Update plan status to failed
        await updatePlanStatus(projectId, 3, 'failed', { error: error.message });

        throw error;
    }
}

/**
 * Create worker
 */
const worker = new Worker('generate-pdf', processGeneratePdfJob, {
    connection,
    concurrency: 3, // Process 3 jobs concurrently
    limiter: {
        max: 10, // Max 10 jobs per minute
        duration: 60000,
    },
});

// Event handlers
worker.on('ready', () => {
    logger.info('✅ PDF Generator Worker ready and waiting for jobs');
});

worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed successfully');
});

worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
});

worker.on('error', (error) => {
    logger.error({ error }, 'Worker error');
});

// Graceful shutdown
const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down worker...`);

    await worker.close();
    await emailQueue.close();
    await connection.quit();
    await db.closePool();

    logger.info('Worker shut down gracefully');
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info('🚀 PDF Generator Worker started');
logger.info(`Queue: generate-pdf`);
logger.info(`Concurrency: 3`);
logger.info(`Redis: ${config.redis.host}:${config.redis.port}`);
logger.info(`MinIO: ${config.minio.endPoint}:${config.minio.port}`);

module.exports = worker;
