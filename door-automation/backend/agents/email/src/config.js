/**
 * Email Worker Configuration
 */

require('dotenv').config();

module.exports = {
    // Node environment
    nodeEnv: process.env.NODE_ENV || 'development',

    // Redis
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },

    // Database
    database: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DB || 'door_automation',
        user: process.env.POSTGRES_USER || 'dooradmin',
        password: process.env.POSTGRES_PASSWORD || 'doorpass123',
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

    // SMTP Configuration
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false, // true for 465, false for other ports (587, 25)
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    },

    // Email settings
    emailFrom: process.env.SMTP_FROM || 'Door Automation <noreply@example.com>',
    emailCc: process.env.EMAIL_CC || '', // Comma-separated internal team emails
};
