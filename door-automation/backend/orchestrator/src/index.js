/**
 * Door Automation Orchestrator API
 *
 * Main server - handles file uploads, queue management, and API endpoints
 */

require('dotenv').config();
require('express-async-errors'); // Automatic error handling for async routes

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const pino = require('pino');
const pinoHttp = require('pino-http');

const config = require('./config');
const { initializeMinio } = require('./minio-client');
const { closeConnections: closeQueueConnections } = require('./queue-manager');
const { closePool: closeDbPool } = require('../../shared/db/db');

// Routes
const vendorAckRoutes = require('./routes/vendor-ack');
const jobsRoutes = require('./routes/jobs');
const planRoutes = require('./routes/plan');
const healthRoutes = require('./routes/health');

// Create Express app
const app = express();

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

// Middleware
app.use(pinoHttp({ logger }));
app.use(helmet()); // Security headers
app.use(cors()); // CORS
app.use(compression()); // Response compression
app.use(express.json()); // JSON body parser
app.use(express.urlencoded({ extended: true })); // URL-encoded body parser

// Routes
app.use('/health', healthRoutes);
app.use('/api/vendor-ack', vendorAckRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/plan', planRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({
        service: 'Door Automation Orchestrator',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            vendorAck: 'POST /api/vendor-ack',
            jobs: 'GET /api/jobs/:projectId',
            plan: 'GET /api/plan/:projectId',
        },
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
    });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error({ err, req }, 'Request error');

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'File too large',
            message: 'Maximum file size is 20MB',
        });
    }

    // Default error response
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(config.nodeEnv === 'development' && { stack: err.stack }),
    });
});

// Graceful shutdown
const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Close queue connections
    await closeQueueConnections();

    // Close database pool
    await closeDbPool();

    logger.info('All connections closed. Exiting.');
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Initialize and start server
const startServer = async () => {
    try {
        logger.info('Initializing Door Automation Orchestrator...');

        // Initialize MinIO
        logger.info('Initializing MinIO...');
        await initializeMinio();
        logger.info('MinIO initialized successfully');

        // Start server
        const port = config.port;

        app.listen(port, () => {
            logger.info(`🚀 Orchestrator API running on port ${port}`);
            logger.info(`Environment: ${config.nodeEnv}`);
            logger.info(`Health check: http://localhost:${port}/health`);
            logger.info('');
            logger.info('Available endpoints:');
            logger.info(`  POST http://localhost:${port}/api/vendor-ack`);
            logger.info(`  GET  http://localhost:${port}/api/jobs/:projectId`);
            logger.info(`  GET  http://localhost:${port}/api/plan/:projectId`);
            logger.info('');
            logger.info('Ready to process vendor acknowledgments! 📄');
        });
    } catch (error) {
        logger.error({ err: error }, 'Failed to start server');
        process.exit(1);
    }
};

// Start the server
startServer();

module.exports = app;
