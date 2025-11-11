/**
 * BullMQ Queue Manager
 *
 * Manages job queues for multi-agent workflow
 */

const { Queue } = require('bullmq');
const Redis = require('ioredis');
const config = require('./config');

// Redis connection
const connection = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null, // Required for BullMQ
});

// Define queues
const queues = {
    ocrAck: new Queue('ocr-ack', { connection }),
    compare: new Queue('compare', { connection }),
    generatePdf: new Queue('generate-pdf', { connection }),
    sendEmail: new Queue('send-email', { connection }),
};

/**
 * Enqueue vendor ack workflow
 *
 * Creates a chain of jobs:
 * 1. OCR ack PDF
 * 2. Compare with original order
 * 3. Generate mismatch PDF (if discrepancies)
 * 4. Send email to vendor
 *
 * @param {Object} data - Workflow data
 * @param {string} data.projectId - Project UUID
 * @param {string} data.vendorOrderId - Vendor order UUID
 * @param {string} data.ackFilePath - MinIO path to ack PDF
 * @param {string} data.vendorName - Vendor name
 * @param {string} data.vendorEmail - Vendor email
 * @returns {Promise<Object>} - Job IDs
 */
async function enqueueVendorAckWorkflow(data) {
    try {
        console.log('Enqueueing vendor ack workflow:', data);

        const { projectId, vendorOrderId, ackFilePath, vendorName, vendorEmail } = data;

        // Job 1: OCR Ack
        const ocrJob = await queues.ocrAck.add(
            'parse-ack',
            {
                projectId,
                vendorOrderId,
                ackFilePath,
                vendorName,
            },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
            }
        );

        console.log(`OCR Ack job enqueued: ${ocrJob.id}`);

        // Job 2: Compare (depends on OCR completion)
        const compareJob = await queues.compare.add(
            'compare-order-ack',
            {
                projectId,
                vendorOrderId,
                // Will be populated by OCR job
            },
            {
                attempts: 2,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                // Delay until OCR completes (will be triggered by OCR job completion)
                delay: 5000, // 5 second delay to allow OCR to complete
            }
        );

        console.log(`Compare job enqueued: ${compareJob.id}`);

        // Job 3: Generate PDF (conditional - only if mismatches found)
        // This will be enqueued by Compare job if needed

        // Job 4: Send Email (conditional)
        // This will be enqueued by PDF Generator or Compare job

        return {
            ocrJobId: ocrJob.id,
            compareJobId: compareJob.id,
        };
    } catch (error) {
        console.error('Error enqueueing vendor ack workflow:', error);
        throw error;
    }
}

/**
 * Enqueue OCR ack job
 */
async function enqueueOcrAck(data) {
    const job = await queues.ocrAck.add('parse-ack', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
    });

    console.log(`OCR Ack job enqueued: ${job.id}`);
    return job;
}

/**
 * Enqueue compare job
 */
async function enqueueCompare(data) {
    const job = await queues.compare.add('compare-order-ack', data, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
    });

    console.log(`Compare job enqueued: ${job.id}`);
    return job;
}

/**
 * Enqueue PDF generation job
 */
async function enqueueGeneratePdf(data) {
    const job = await queues.generatePdf.add('generate-mismatch-pdf', data, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
    });

    console.log(`Generate PDF job enqueued: ${job.id}`);
    return job;
}

/**
 * Enqueue email sending job
 */
async function enqueueEmail(data) {
    const job = await queues.sendEmail.add('send-email', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
    });

    console.log(`Email job enqueued: ${job.id}`);
    return job;
}

/**
 * Get job status
 */
async function getJobStatus(queueName, jobId) {
    const queue = queues[queueName];

    if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
    }

    const job = await queue.getJob(jobId);

    if (!job) {
        return null;
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
        id: job.id,
        name: job.name,
        data: job.data,
        state,
        progress,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
    };
}

/**
 * Get all jobs for a project (across all queues)
 */
async function getProjectJobs(projectId) {
    const allJobs = [];

    for (const [queueName, queue] of Object.entries(queues)) {
        const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);

        const projectJobs = jobs.filter((job) => job.data.projectId === projectId);

        for (const job of projectJobs) {
            const state = await job.getState();

            allJobs.push({
                queueName,
                id: job.id,
                name: job.name,
                state,
                progress: job.progress,
                data: job.data,
                returnvalue: job.returnvalue,
                failedReason: job.failedReason,
                timestamp: job.timestamp,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
            });
        }
    }

    // Sort by timestamp (newest first)
    allJobs.sort((a, b) => b.timestamp - a.timestamp);

    return allJobs;
}

/**
 * Clear all queues (for development/testing)
 */
async function clearAllQueues() {
    for (const queue of Object.values(queues)) {
        await queue.drain();
        await queue.clean(0, 1000, 'completed');
        await queue.clean(0, 1000, 'failed');
    }

    console.log('All queues cleared');
}

/**
 * Health check
 */
async function healthCheck() {
    try {
        await connection.ping();
        return { healthy: true };
    } catch (error) {
        return { healthy: false, error: error.message };
    }
}

/**
 * Close connections (for graceful shutdown)
 */
async function closeConnections() {
    await connection.quit();

    for (const queue of Object.values(queues)) {
        await queue.close();
    }

    console.log('Queue connections closed');
}

module.exports = {
    queues,
    connection,
    enqueueVendorAckWorkflow,
    enqueueOcrAck,
    enqueueCompare,
    enqueueGeneratePdf,
    enqueueEmail,
    getJobStatus,
    getProjectJobs,
    clearAllQueues,
    healthCheck,
    closeConnections,
};
