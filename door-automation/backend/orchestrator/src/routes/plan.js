/**
 * MULTI_AGENT_PLAN Routes
 *
 * GET /api/plan/:projectId - Get MULTI_AGENT_PLAN.md for a project
 */

const express = require('express');
const { getPlan } = require('../multi-agent-plan');
const db = require('../../../shared/db/db');

const router = express.Router();

/**
 * GET /api/plan/:projectId
 *
 * Get MULTI_AGENT_PLAN.md content for a project
 *
 * Returns the plan as markdown text
 */
router.get('/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;

        // Verify project exists
        const project = await db.getProject(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get plan from MinIO
        const planContent = await getPlan(projectId);

        // Return as plain text with markdown content type
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        return res.status(200).send(planContent);
    } catch (error) {
        console.error('Error getting plan:', error);

        // Check if plan doesn't exist
        if (error.message && error.message.includes('does not exist')) {
            return res.status(404).json({
                error: 'Plan not found',
                message: 'MULTI_AGENT_PLAN.md has not been created for this project yet',
            });
        }

        return res.status(500).json({
            error: 'Failed to get plan',
            message: error.message,
        });
    }
});

/**
 * GET /api/plan/:projectId/json
 *
 * Get MULTI_AGENT_PLAN.md as JSON (for programmatic access)
 */
router.get('/:projectId/json', async (req, res) => {
    try {
        const { projectId } = req.params;

        // Verify project exists
        const project = await db.getProject(projectId);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get plan from MinIO
        const planContent = await getPlan(projectId);

        return res.status(200).json({
            success: true,
            project: {
                id: project.id,
                name: project.project_name,
                status: project.status,
            },
            plan: {
                content: planContent,
                lastUpdated: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('Error getting plan:', error);

        return res.status(500).json({
            error: 'Failed to get plan',
            message: error.message,
        });
    }
});

module.exports = router;
