/**
 * Jobs Routes
 *
 * GET /api/jobs/:projectId - Get all jobs for a project
 * GET /api/jobs/:queueName/:jobId - Get specific job status
 */

const express = require('express');
const { getProjectJobs, getJobStatus } = require('../queue-manager');
const db = require('../../../shared/db/db');

const router = express.Router();

/**
 * GET /api/jobs/:projectId
 *
 * Get all jobs for a project (from all queues)
 */
router.get('/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;

        // Verify project exists
        const project = await db.getProject(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get jobs from queue system
        const queueJobs = await getProjectJobs(projectId);

        // Get jobs from database
        const dbJobs = await db.getProjectJobs(projectId);

        // Merge and return
        return res.status(200).json({
            success: true,
            project: {
                id: project.id,
                name: project.project_name,
                status: project.status,
            },
            jobs: {
                queue: queueJobs,
                database: dbJobs,
            },
        });
    } catch (error) {
        console.error('Error getting project jobs:', error);

        return res.status(500).json({
            error: 'Failed to get project jobs',
            message: error.message,
        });
    }
});

/**
 * GET /api/jobs/:queueName/:jobId
 *
 * Get specific job status from queue
 *
 * Queue names: ocrAck, compare, generatePdf, sendEmail
 */
router.get('/:queueName/:jobId', async (req, res) => {
    try {
        const { queueName, jobId } = req.params;

        const job = await getJobStatus(queueName, jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        return res.status(200).json({
            success: true,
            job,
        });
    } catch (error) {
        console.error('Error getting job status:', error);

        return res.status(500).json({
            error: 'Failed to get job status',
            message: error.message,
        });
    }
});

module.exports = router;
