/**
 * Email Worker Agent
 *
 * Pulls jobs from the 'send-email' queue, downloads mismatch PDFs from MinIO,
 * and sends emails to vendors with PDF attachments.
 */

require('dotenv').config();

const { Worker } = require('bullmq');
const Redis = require('ioredis');
const pino = require('pino');
const Minio = require('minio');

const config = require('./config');
const { sendMismatchEmail, verifyConnection } = require('./email-service');
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

/**
 * Download file from MinIO as buffer
 */
async function downloadFileBuffer(objectName) {
    return new Promise((resolve, reject) => {
        const chunks = [];

        minioClient.getObject(BUCKET_NAME, objectName, (err, stream) => {
            if (err) {
                return reject(err);
            }

            stream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            stream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    });
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
 * Process Send Email Job
 */
async function processSendEmailJob(job) {
    const {
        projectId,
        vendorOrderId,
        comparisonId,
        mismatchPdfPath,
        vendorEmail,
        vendorName,
        projectName,
        orderNumber,
        mismatchCount,
        mismatchSummary,
    } = job.data;

    logger.info({ jobId: job.id, projectId, vendorOrderId }, 'Processing send email job');

    const startedAt = new Date();

    try {
        // Validate required data
        if (!vendorEmail) {
            throw new Error('Vendor email address is required but not provided');
        }

        if (!mismatchPdfPath) {
            throw new Error('Mismatch PDF path is required but not provided');
        }

        // Update plan status to in_progress
        await updatePlanStatus(projectId, 4, 'in_progress', { startedAt });

        // Update job in database
        await db.updateJob(String(job.id), {
            status: 'active',
            progress: 10,
            startedAt,
        });

        // Download mismatch PDF from MinIO
        logger.info({ mismatchPdfPath }, 'Downloading mismatch PDF from MinIO');
        const pdfBuffer = await downloadFileBuffer(mismatchPdfPath);

        logger.info({ pdfSize: pdfBuffer.length }, 'PDF downloaded successfully');

        await job.updateProgress(40);

        // Send email to vendor
        logger.info({ vendorEmail, vendorName }, 'Sending mismatch email to vendor');

        const emailResult = await sendMismatchEmail({
            vendorEmail,
            vendorName,
            projectName,
            projectId,
            orderNumber,
            mismatchCount,
            pdfBuffer,
            mismatchSummary: mismatchSummary || [],
        });

        logger.info(
            { messageId: emailResult.messageId, accepted: emailResult.accepted },
            'Email sent successfully'
        );

        await job.updateProgress(70);

        // Update vendor order status to 'discrepancy'
        logger.info({ vendorOrderId }, 'Updating vendor order status to discrepancy');
        await db.updateVendorOrderStatus(vendorOrderId, 'discrepancy');

        await job.updateProgress(85);

        // Update project status to 'completed'
        logger.info({ projectId }, 'Updating project status to completed');
        await db.updateProjectStatus(projectId, 'completed');

        await job.updateProgress(95);

        // Update job in database
        const completedAt = new Date();

        await db.updateJob(String(job.id), {
            status: 'completed',
            progress: 100,
            completedAt,
            result: {
                emailSent: true,
                messageId: emailResult.messageId,
                vendorEmail,
                projectStatus: 'completed',
                vendorOrderStatus: 'discrepancy',
            },
        });

        // Update plan status to completed
        await updatePlanStatus(projectId, 4, 'completed', { startedAt, completedAt });

        // Log audit entry
        await db.logAudit('email', job.id, 'email_sent', {
            vendorEmail,
            vendorName,
            projectId,
            messageId: emailResult.messageId,
        });

        logger.info({ jobId: job.id, duration: completedAt - startedAt }, 'Send email job completed');

        return {
            success: true,
            emailSent: true,
            messageId: emailResult.messageId,
            vendorEmail,
        };
    } catch (error) {
        logger.error({ err: error, jobId: job.id }, 'Send email job failed');

        // Update job in database
        await db.updateJob(String(job.id), {
            status: 'failed',
            error: error.message,
        });

        // Update plan status to failed
        await updatePlanStatus(projectId, 4, 'failed', { error: error.message });

        // Log audit entry
        await db.logAudit('email', job.id, 'email_failed', {
            vendorEmail,
            projectId,
            error: error.message,
        });

        throw error;
    }
}

/**
 * Create worker
 */
const worker = new Worker('send-email', processSendEmailJob, {
    connection,
    concurrency: 3, // Process 3 jobs concurrently
    limiter: {
        max: 20, // Max 20 emails per minute (to avoid SMTP rate limits)
        duration: 60000,
    },
    settings: {
        backoffStrategy: (attemptsMade) => {
            // Exponential backoff: 5s, 15s, 45s
            return Math.min(5000 * Math.pow(3, attemptsMade - 1), 60000);
        },
    },
});

// Event handlers
worker.on('ready', async () => {
    logger.info('✅ Email Worker ready and waiting for jobs');

    // Verify SMTP connection on startup
    const verification = await verifyConnection();
    if (verification.success) {
        logger.info('✅ SMTP connection verified');
    } else {
        logger.warn({ error: verification.message }, '⚠️ SMTP connection verification failed');
        logger.warn('Emails may fail. Please check SMTP_USER and SMTP_PASSWORD configuration.');
    }
});

worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed successfully');
});

worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error: error.message, attempt: job?.attemptsMade }, 'Job failed');

    // Log SMTP-specific errors
    if (error.message.includes('SMTP') || error.message.includes('auth') || error.message.includes('credentials')) {
        logger.error('SMTP authentication error. Please check SMTP_USER and SMTP_PASSWORD environment variables.');
    }
});

worker.on('error', (error) => {
    logger.error({ error }, 'Worker error');
});

// Graceful shutdown
const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down worker...`);

    await worker.close();
    await connection.quit();
    await db.closePool();

    logger.info('Worker shut down gracefully');
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info('🚀 Email Worker started');
logger.info(`Queue: send-email`);
logger.info(`Concurrency: 3`);
logger.info(`Redis: ${config.redis.host}:${config.redis.port}`);
logger.info(`MinIO: ${config.minio.endPoint}:${config.minio.port}`);
logger.info(`SMTP: ${config.smtp.host}:${config.smtp.port}`);
logger.info(`From: ${config.emailFrom}`);

if (config.emailCc) {
    logger.info(`CC: ${config.emailCc}`);
}

module.exports = worker;
