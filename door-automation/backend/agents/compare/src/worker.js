/**
 * Compare Worker Agent
 *
 * Pulls jobs from the 'compare' queue, compares original vendor order line items
 * with parsed ack line items, applies tolerances, and stores comparison results.
 */

require('dotenv').config();

const { Worker, Queue } = require('bullmq');
const Redis = require('ioredis');
const pino = require('pino');

const config = require('./config');
const db = require('../shared/db/db');
const { compareDoorSpecs } = require('../shared/normalization/door-normalizer');

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

// Create queue instance for enqueueing jobs
const generatePdfQueue = new Queue('generate-pdf', { connection });

/**
 * Update MULTI_AGENT_PLAN.md task status
 */
async function updatePlanStatus(projectId, taskNumber, status, metadata = {}) {
    try {
        // Import shared module for plan updates
        const { updateTaskStatus } = require('../shared/multi-agent-plan/updater');
        await updateTaskStatus(projectId, taskNumber, status, metadata);
    } catch (error) {
        logger.warn({ err: error }, 'Failed to update plan status (non-critical)');
    }
}

/**
 * Enqueue PDF generation job
 */
async function enqueueGeneratePdf(projectId, vendorOrderId, comparisonId) {
    try {
        const job = await generatePdfQueue.add(
            'generate-mismatch-pdf',
            {
                projectId,
                vendorOrderId,
                comparisonId,
            },
            {
                attempts: 2,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            }
        );

        logger.info({ jobId: job.id, comparisonId }, 'PDF generation job enqueued');

        // Update plan with conditional job ID
        try {
            const { addConditionalJob } = require('../shared/multi-agent-plan/updater');
            await addConditionalJob(projectId, 3, job.id);
        } catch (error) {
            logger.warn({ err: error }, 'Failed to add conditional job to plan (non-critical)');
        }

        return job;
    } catch (error) {
        logger.error({ err: error }, 'Failed to enqueue PDF generation job');
        throw error;
    }
}

/**
 * Process Compare Job
 */
async function processCompareJob(job) {
    const { projectId, vendorOrderId } = job.data;

    logger.info({ jobId: job.id, projectId, vendorOrderId }, 'Processing compare job');

    const startedAt = new Date();

    try {
        // Update plan status to in_progress
        await updatePlanStatus(projectId, 2, 'in_progress', { startedAt });

        // Update job in database
        await db.updateJob(String(job.id), {
            status: 'active',
            progress: 10,
            startedAt,
        });

        // Get vendor order details
        logger.info({ vendorOrderId }, 'Fetching vendor order');
        const vendorOrder = await db.getVendorOrder(vendorOrderId);

        if (!vendorOrder) {
            throw new Error(`Vendor order not found: ${vendorOrderId}`);
        }

        const vendorName = vendorOrder.vendor_name;

        await job.updateProgress(20);

        // Get vendor settings for tolerances
        logger.info({ vendorName }, 'Fetching vendor settings');
        const vendorSettings = await db.getVendorSettings(vendorName);

        const priceTolerancePercent = vendorSettings.price_tolerance_percent || 2.0;
        const sizeToleranceInches = vendorSettings.size_tolerance_inches || 0.25;

        logger.info(
            { priceTolerancePercent, sizeToleranceInches },
            'Using tolerance settings'
        );

        await job.updateProgress(30);

        // Get original line items from project
        logger.info({ projectId }, 'Fetching original line items');
        const originalLineItems = await db.getLineItems(projectId);

        if (!originalLineItems || originalLineItems.length === 0) {
            throw new Error(`No line items found for project: ${projectId}`);
        }

        logger.info({ count: originalLineItems.length }, 'Original line items fetched');

        await job.updateProgress(40);

        // Get ack line items
        logger.info({ vendorOrderId }, 'Fetching ack line items');
        const ackResult = await db.query(
            `SELECT ali.*
             FROM ack_line_items ali
             JOIN vendor_acknowledgments va ON ali.ack_id = va.id
             WHERE va.vendor_order_id = $1
             ORDER BY ali.line_number`,
            [vendorOrderId]
        );

        const ackLineItems = ackResult.rows;

        if (!ackLineItems || ackLineItems.length === 0) {
            throw new Error(`No ack line items found for vendor order: ${vendorOrderId}`);
        }

        logger.info({ count: ackLineItems.length }, 'Ack line items fetched');

        await job.updateProgress(50);

        // Get ack ID for comparison record
        const ackIdResult = await db.query(
            'SELECT id FROM vendor_acknowledgments WHERE vendor_order_id = $1',
            [vendorOrderId]
        );
        const ackId = ackIdResult.rows[0]?.id;

        // Compare line items
        logger.info('Starting line-by-line comparison');

        const comparisonResults = [];
        const mismatches = [];

        let linesMatched = 0;
        let linesMismatched = 0;

        // Compare each pair of line items
        for (let i = 0; i < Math.max(originalLineItems.length, ackLineItems.length); i++) {
            const originalItem = originalLineItems[i];
            const ackItem = ackLineItems[i];

            if (!originalItem) {
                // Extra item in ack
                linesMismatched++;
                mismatches.push({
                    lineNumber: ackItem.line_number,
                    ackLineItemId: ackItem.id,
                    mismatchType: 'extra_in_ack',
                    originalValue: null,
                    ackValue: JSON.stringify(ackItem),
                    severity: 'high',
                });
                continue;
            }

            if (!ackItem) {
                // Missing item in ack
                linesMismatched++;
                mismatches.push({
                    lineNumber: originalItem.line_number,
                    originalLineItemId: originalItem.id,
                    mismatchType: 'missing_in_ack',
                    originalValue: JSON.stringify(originalItem),
                    ackValue: null,
                    severity: 'high',
                });
                continue;
            }

            // Compare using normalization function
            const comparisonResult = compareDoorSpecs(
                {
                    widthInches: originalItem.width_inches,
                    heightInches: originalItem.height_inches,
                    thicknessInches: originalItem.thickness_inches,
                    unitPrice: originalItem.unit_price,
                    swing: originalItem.swing,
                    vendorCode: originalItem.vendor_code,
                },
                {
                    widthInches: ackItem.width_inches,
                    heightInches: ackItem.height_inches,
                    thicknessInches: ackItem.thickness_inches,
                    unitPrice: ackItem.unit_price,
                    swing: ackItem.swing,
                    vendorCode: ackItem.vendor_code,
                },
                {
                    sizeTolerance: sizeToleranceInches,
                    priceTolerance: priceTolerancePercent,
                }
            );

            comparisonResults.push({
                lineNumber: originalItem.line_number,
                originalItemId: originalItem.id,
                ackItemId: ackItem.id,
                matches: comparisonResult.matches,
                differences: comparisonResult.differences,
            });

            if (comparisonResult.matches) {
                linesMatched++;
            } else {
                linesMismatched++;

                // Store each difference as a mismatch detail
                for (const diff of comparisonResult.differences) {
                    const severity = diff.field === 'swing' ? 'critical' : 'medium';

                    mismatches.push({
                        lineNumber: originalItem.line_number,
                        originalLineItemId: originalItem.id,
                        ackLineItemId: ackItem.id,
                        mismatchType: diff.field,
                        originalValue: String(diff.original),
                        ackValue: String(diff.ack),
                        difference: diff.difference || null,
                        severity,
                    });
                }
            }
        }

        await job.updateProgress(70);

        const hasDiscrepancies = linesMismatched > 0;

        logger.info(
            { linesMatched, linesMismatched, hasDiscrepancies },
            'Comparison completed'
        );

        // Store comparison results
        logger.info('Storing comparison results');
        const comparison = await db.createComparison({
            vendorOrderId,
            ackId,
            totalLinesCompared: Math.max(originalLineItems.length, ackLineItems.length),
            linesMatched,
            linesMismatched,
            priceTolerancePercent,
            sizeToleranceInches,
            hasDiscrepancies,
            mismatchPdfPath: null, // Will be set by PDF generator
            details: {
                comparisonResults,
            },
        });

        logger.info({ comparisonId: comparison.id }, 'Comparison record created');

        // Store mismatch details if any
        if (mismatches.length > 0) {
            logger.info({ count: mismatches.length }, 'Storing mismatch details');
            await db.insertMismatchDetails(comparison.id, mismatches);
        }

        await job.updateProgress(80);

        // Handle discrepancies or success
        if (hasDiscrepancies) {
            logger.info('Discrepancies found - enqueuing PDF generation');

            // Enqueue PDF generation job
            await enqueueGeneratePdf(projectId, vendorOrderId, comparison.id);

            // Update vendor order status to 'discrepancy_found'
            await db.updateVendorOrderStatus(vendorOrderId, 'discrepancy_found');
        } else {
            logger.info('No discrepancies - marking order as acknowledged');

            // No discrepancies - mark vendor order as acknowledged
            await db.updateVendorOrderStatus(vendorOrderId, 'acknowledged');

            // Update project status to completed
            await db.updateProjectStatus(projectId, 'completed');

            logger.info({ projectId }, 'Project marked as completed');
        }

        await job.updateProgress(90);

        // Update job in database
        const completedAt = new Date();

        await db.updateJob(String(job.id), {
            status: 'completed',
            progress: 100,
            completedAt,
            result: {
                comparisonId: comparison.id,
                totalLinesCompared: Math.max(originalLineItems.length, ackLineItems.length),
                linesMatched,
                linesMismatched,
                hasDiscrepancies,
            },
        });

        // Update plan status to completed
        await updatePlanStatus(projectId, 2, 'completed', { startedAt, completedAt });

        logger.info({ jobId: job.id, duration: completedAt - startedAt }, 'Compare job completed');

        return {
            success: true,
            comparisonId: comparison.id,
            linesMatched,
            linesMismatched,
            hasDiscrepancies,
        };
    } catch (error) {
        logger.error({ err: error, jobId: job.id }, 'Compare job failed');

        // Update job in database
        await db.updateJob(String(job.id), {
            status: 'failed',
            error: error.message,
        });

        // Update plan status to failed
        await updatePlanStatus(projectId, 2, 'failed', { error: error.message });

        throw error;
    }
}

/**
 * Create worker
 */
const worker = new Worker('compare', processCompareJob, {
    connection,
    concurrency: 3, // Process 3 jobs concurrently
    limiter: {
        max: 10, // Max 10 jobs per second
        duration: 1000,
    },
});

// Event handlers
worker.on('ready', () => {
    logger.info('✅ Compare Worker ready and waiting for jobs');
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

logger.info('🚀 Compare Worker started');
logger.info(`Queue: compare`);
logger.info(`Concurrency: 3`);
logger.info(`Redis: ${config.redis.host}:${config.redis.port}`);

module.exports = worker;
