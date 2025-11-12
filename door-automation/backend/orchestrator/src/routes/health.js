/**
 * Health Check Routes
 *
 * GET /health - Overall health check
 * GET /health/db - Database health
 * GET /health/redis - Redis health
 * GET /health/minio - MinIO health
 */

const express = require('express');
const db = require('../../../shared/db/db');
const { healthCheck: redisHealthCheck } = require('../queue-manager');
const { healthCheck: minioHealthCheck } = require('../minio-client');

const router = express.Router();

/**
 * GET /health
 *
 * Overall health check - checks all services
 */
router.get('/', async (req, res) => {
    try {
        const dbHealth = await db.healthCheck();
        const redisHealth = await redisHealthCheck();
        const minioHealth = await minioHealthCheck();

        const allHealthy = dbHealth.healthy && redisHealth.healthy && minioHealth.healthy;

        const response = {
            status: allHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            services: {
                database: dbHealth,
                redis: redisHealth,
                minio: minioHealth,
            },
        };

        const statusCode = allHealthy ? 200 : 503;

        return res.status(statusCode).json(response);
    } catch (error) {
        console.error('Health check error:', error);

        return res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * GET /health/db
 *
 * Database health check only
 */
router.get('/db', async (req, res) => {
    try {
        const health = await db.healthCheck();

        return res.status(health.healthy ? 200 : 503).json(health);
    } catch (error) {
        return res.status(503).json({
            healthy: false,
            error: error.message,
        });
    }
});

/**
 * GET /health/redis
 *
 * Redis health check only
 */
router.get('/redis', async (req, res) => {
    try {
        const health = await redisHealthCheck();

        return res.status(health.healthy ? 200 : 503).json(health);
    } catch (error) {
        return res.status(503).json({
            healthy: false,
            error: error.message,
        });
    }
});

/**
 * GET /health/minio
 *
 * MinIO health check only
 */
router.get('/minio', async (req, res) => {
    try {
        const health = await minioHealthCheck();

        return res.status(health.healthy ? 200 : 503).json(health);
    } catch (error) {
        return res.status(503).json({
            healthy: false,
            error: error.message,
        });
    }
});

module.exports = router;
