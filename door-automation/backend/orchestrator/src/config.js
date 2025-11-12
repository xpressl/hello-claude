/**
 * Orchestrator Configuration
 */

require('dotenv').config();

module.exports = {
    // Server
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    database: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DB || 'door_automation',
        user: process.env.POSTGRES_USER || 'dooradmin',
        password: process.env.POSTGRES_PASSWORD || 'doorpass123',
    },

    // Redis
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },

    // MinIO
    minio: {
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000', 10),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
        secretKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin123',
        bucket: process.env.MINIO_BUCKET || 'door-automation',
    },

    // Tolerances
    tolerances: {
        pricePercent: parseFloat(process.env.DEFAULT_PRICE_TOLERANCE_PERCENT || '2.0'),
        sizeInches: parseFloat(process.env.DEFAULT_SIZE_TOLERANCE_INCHES || '0.25'),
    },

    // Auth (basic auth for now)
    auth: {
        username: process.env.DASHBOARD_USERNAME || 'admin',
        password: process.env.DASHBOARD_PASSWORD || 'admin123',
    },
};
