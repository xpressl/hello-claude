/**
 * Ack Parser Worker Agent
 *
 * Pulls jobs from the 'ocr-ack' queue, parses vendor ack PDFs,
 * normalizes door specs, and stores results in the database.
 */

require('dotenv').config();

const { Worker } = require('bullmq');
const Redis = require('ioredis');
const pino = require('pino');
const Minio = require('minio');

const config = require('./config');
const { parseVendorAck } = require('./ocr');
const db = require('../../shared/db/db');
const { normalizeDoorSpec } = require('../../shared/normalization/door-normalizer');

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
 * Process OCR Ack Job
 */
async function processOcrAckJob(job) {
    const { projectId, vendorOrderId, ackId, ackFilePath, vendorName } = job.data;

    logger.info({ jobId: job.id, projectId, vendorOrderId }, 'Processing OCR ack job');

    const startedAt = new Date();

    try {
        // Update plan status to in_progress
        await updatePlanStatus(projectId, 1, 'in_progress', { startedAt });

        // Update job in database
        await db.updateJob(String(job.id), {
            status: 'active',
            progress: 10,
            startedAt,
        });

        // Download PDF from MinIO
        logger.info({ ackFilePath }, 'Downloading ack PDF from MinIO');
        const pdfBuffer = await downloadFileBuffer(ackFilePath);

        await job.updateProgress(30);

        // Parse vendor ack using OCR
        logger.info({ vendorName }, 'Parsing vendor ack with OCR');
        const ocrResult = await parseVendorAck(pdfBuffer, vendorName);

        if (!ocrResult.success) {
            throw new Error(`OCR failed: ${ocrResult.error || ocrResult.reason}`);
        }

        await job.updateProgress(60);

        logger.info(
            { lineItems: ocrResult.lineItems.length, method: ocrResult.method },
            'OCR completed successfully'
        );

        // Update vendor acknowledgment with OCR metadata
        await db.query(
            `UPDATE vendor_acknowledgments
             SET ocr_confidence = $1, ocr_method = $2, raw_data = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [ocrResult.confidence, ocrResult.method, JSON.stringify(ocrResult), ackId]
        );

        // Normalize and insert ack line items
        const normalizedLineItems = [];

        for (const rawItem of ocrResult.lineItems) {
            // Normalize door spec
            const normalized = normalizeDoorSpec({
                description: rawItem.rawText,
                size: rawItem.sizeOrCode || rawItem.size,
                swing: rawItem.swing,
                jamb: rawItem.jambType,
                door_type: rawItem.doorType,
                quantity: rawItem.quantity,
                unit_price: rawItem.unitPrice,
            });

            normalizedLineItems.push({
                lineNumber: rawItem.lineNumber,
                widthInches: normalized.widthInches,
                heightInches: normalized.heightInches,
                thicknessInches: normalized.thicknessInches,
                vendorCode: normalized.vendorCode,
                quantity: normalized.quantity,
                unitPrice: normalized.unitPrice,
                totalPrice: rawItem.totalPrice,
                rawText: rawItem.rawText,
            });
        }

        // Insert ack line items into database
        await db.insertAckLineItems(ackId, normalizedLineItems);

        logger.info({ count: normalizedLineItems.length }, 'Ack line items inserted');

        await job.updateProgress(90);

        // Update job in database
        const completedAt = new Date();

        await db.updateJob(String(job.id), {
            status: 'completed',
            progress: 100,
            completedAt,
            result: {
                lineItemsCount: normalizedLineItems.length,
                method: ocrResult.method,
                confidence: ocrResult.confidence,
            },
        });

        // Update plan status to completed
        await updatePlanStatus(projectId, 1, 'completed', { startedAt, completedAt });

        logger.info({ jobId: job.id, duration: completedAt - startedAt }, 'OCR ack job completed');

        return {
            success: true,
            lineItemsCount: normalizedLineItems.length,
            method: ocrResult.method,
            confidence: ocrResult.confidence,
        };
    } catch (error) {
        logger.error({ err: error, jobId: job.id }, 'OCR ack job failed');

        // Update job in database
        await db.updateJob(String(job.id), {
            status: 'failed',
            error: error.message,
        });

        // Update plan status to failed
        await updatePlanStatus(projectId, 1, 'failed', { error: error.message });

        throw error;
    }
}

/**
 * Create worker
 */
const worker = new Worker('ocr-ack', processOcrAckJob, {
    connection,
    concurrency: 2, // Process 2 jobs concurrently
    limiter: {
        max: 10, // Max 10 jobs per second
        duration: 1000,
    },
});

// Event handlers
worker.on('ready', () => {
    logger.info('✅ Ack Parser Worker ready and waiting for jobs');
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
    await connection.quit();
    await db.closePool();

    logger.info('Worker shut down gracefully');
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info('🚀 Ack Parser Worker started');
logger.info(`Queue: ocr-ack`);
logger.info(`Concurrency: 2`);
logger.info(`Redis: ${config.redis.host}:${config.redis.port}`);
logger.info(`MinIO: ${config.minio.endPoint}:${config.minio.port}`);

module.exports = worker;
