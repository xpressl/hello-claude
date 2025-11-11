/**
 * Multi-Agent Plan Updater (Shared Module)
 *
 * This module provides functions for workers to update the MULTI_AGENT_PLAN.md file.
 * It wraps the orchestrator's plan functions and handles MinIO operations.
 */

const Minio = require('minio');

// MinIO client (initialized lazily)
let minioClient = null;

/**
 * Get or create MinIO client
 */
function getMinioClient() {
    if (!minioClient) {
        minioClient = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000', 10),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
            secretKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin123',
        });
    }
    return minioClient;
}

const BUCKET_NAME = process.env.MINIO_BUCKET || 'door-automation';

/**
 * Download text file from MinIO
 */
async function downloadTextFile(objectPath) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const client = getMinioClient();

        client.getObject(BUCKET_NAME, objectPath, (err, stream) => {
            if (err) {
                return reject(err);
            }

            stream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            stream.on('end', () => {
                resolve(Buffer.concat(chunks).toString('utf-8'));
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    });
}

/**
 * Upload text file to MinIO
 */
async function uploadTextFile(content, projectId, filename) {
    const client = getMinioClient();
    const objectPath = `${projectId}/${filename}`;
    const buffer = Buffer.from(content, 'utf-8');

    await client.putObject(BUCKET_NAME, objectPath, buffer, buffer.length, {
        'Content-Type': 'text/markdown; charset=utf-8',
    });

    return objectPath;
}

/**
 * Task status enum
 */
const TaskStatus = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
};

/**
 * Update task status in MULTI_AGENT_PLAN.md
 *
 * @param {string} projectId - Project UUID
 * @param {number} taskNumber - Task number (1-4)
 * @param {string} status - New status
 * @param {Object} metadata - Optional metadata (startedAt, completedAt, error)
 */
async function updateTaskStatus(projectId, taskNumber, status, metadata = {}) {
    try {
        const planPath = `${projectId}/MULTI_AGENT_PLAN.md`;

        // Download current plan
        let plan = await downloadTextFile(planPath);

        // Update task status in the task breakdown section
        const taskHeader = `### Task ${taskNumber}:`;
        const statusLine = '**Status:**';

        const taskIndex = plan.indexOf(taskHeader);

        if (taskIndex === -1) {
            console.warn(`Task ${taskNumber} not found in plan`);
            return;
        }

        const statusIndex = plan.indexOf(statusLine, taskIndex);

        if (statusIndex === -1) {
            console.warn(`Status line not found for task ${taskNumber}`);
            return;
        }

        const statusLineEnd = plan.indexOf('\n', statusIndex);
        const currentStatusLine = plan.substring(statusIndex, statusLineEnd);

        // Create new status line with emoji
        const statusEmoji = {
            [TaskStatus.PENDING]: '⏳',
            [TaskStatus.IN_PROGRESS]: '🔄',
            [TaskStatus.COMPLETED]: '✅',
            [TaskStatus.FAILED]: '❌',
        };

        const emoji = statusEmoji[status] || '❓';
        const newStatusLine = `**Status:** ${emoji} ${status}`;

        plan = plan.replace(currentStatusLine, newStatusLine);

        // Update progress summary table
        const tableRow = `| ${taskNumber}.`;
        const tableIndex = plan.indexOf(tableRow);

        if (tableIndex !== -1) {
            const tableRowEnd = plan.indexOf('\n', tableIndex);
            const currentTableRow = plan.substring(tableIndex, tableRowEnd);

            // Parse current row
            const parts = currentTableRow.split('|').map((s) => s.trim());

            // Update status column
            parts[3] = `${emoji} ${status}`;

            // Update timestamps if provided
            if (metadata.startedAt) {
                parts[4] = new Date(metadata.startedAt).toLocaleTimeString('en-US', { hour12: false });
            }

            if (metadata.completedAt) {
                parts[5] = new Date(metadata.completedAt).toLocaleTimeString('en-US', { hour12: false });

                // Calculate duration
                if (metadata.startedAt) {
                    const duration = new Date(metadata.completedAt) - new Date(metadata.startedAt);
                    const seconds = Math.floor(duration / 1000);
                    parts[6] = `${seconds}s`;
                }
            }

            const newTableRow = `| ${parts.slice(1).join(' | ')} |`;

            plan = plan.replace(currentTableRow, newTableRow);
        }

        // Update "Last Updated" timestamp
        const lastUpdatedPattern = /\*\*Last Updated:\*\* .+/;
        plan = plan.replace(lastUpdatedPattern, `**Last Updated:** ${new Date().toISOString()}`);

        // Add error note if failed
        if (status === TaskStatus.FAILED && metadata.error) {
            const notesSection = '## 📝 Notes';
            const notesSectionIndex = plan.indexOf(notesSection);

            if (notesSectionIndex !== -1) {
                const insertIndex = plan.indexOf('\n', notesSectionIndex) + 1;
                const errorNote = `\n**⚠️ Task ${taskNumber} Failed:** ${metadata.error}\n`;

                plan = plan.substring(0, insertIndex) + errorNote + plan.substring(insertIndex);
            }
        }

        // Upload updated plan
        await uploadTextFile(plan, projectId, 'MULTI_AGENT_PLAN.md');

        console.log(`Task ${taskNumber} status updated to: ${status}`);
    } catch (error) {
        console.error('Error updating task status:', error);
        // Don't throw - plan updates are non-critical
    }
}

/**
 * Add conditional job to plan (PDF generation, email)
 *
 * @param {string} projectId - Project UUID
 * @param {number} taskNumber - Task number
 * @param {string} jobId - BullMQ job ID
 */
async function addConditionalJob(projectId, taskNumber, jobId) {
    try {
        const planPath = `${projectId}/MULTI_AGENT_PLAN.md`;

        // Download current plan
        let plan = await downloadTextFile(planPath);

        // Update job ID for conditional task
        const taskHeader = `### Task ${taskNumber}:`;
        const jobIdLine = '**Job ID:**';

        const taskIndex = plan.indexOf(taskHeader);

        if (taskIndex === -1) {
            return;
        }

        const jobIdIndex = plan.indexOf(jobIdLine, taskIndex);

        if (jobIdIndex === -1) {
            return;
        }

        const jobIdLineEnd = plan.indexOf('\n', jobIdIndex);
        const currentJobIdLine = plan.substring(jobIdIndex, jobIdLineEnd);

        const newJobIdLine = `**Job ID:** ${jobId}`;

        plan = plan.replace(currentJobIdLine, newJobIdLine);

        // Upload updated plan
        await uploadTextFile(plan, projectId, 'MULTI_AGENT_PLAN.md');

        console.log(`Conditional job ${jobId} added to task ${taskNumber}`);
    } catch (error) {
        console.error('Error adding conditional job:', error);
    }
}

module.exports = {
    TaskStatus,
    updateTaskStatus,
    addConditionalJob,
};
