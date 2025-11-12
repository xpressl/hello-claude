/**
 * MinIO Client for Object Storage
 */

const Minio = require('minio');
const config = require('./config');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Initialize MinIO client
const minioClient = new Minio.Client({
    endPoint: config.minio.endPoint,
    port: config.minio.port,
    useSSL: config.minio.useSSL,
    accessKey: config.minio.accessKey,
    secretKey: config.minio.secretKey,
});

const BUCKET_NAME = config.minio.bucket;

/**
 * Initialize MinIO - create bucket if not exists
 */
async function initializeMinio() {
    try {
        const bucketExists = await minioClient.bucketExists(BUCKET_NAME);

        if (!bucketExists) {
            console.log(`Creating bucket: ${BUCKET_NAME}`);
            await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
            console.log(`Bucket created: ${BUCKET_NAME}`);
        } else {
            console.log(`Bucket already exists: ${BUCKET_NAME}`);
        }

        return true;
    } catch (error) {
        console.error('MinIO initialization error:', error);
        throw error;
    }
}

/**
 * Upload file to MinIO
 *
 * @param {Buffer|Stream} file - File buffer or stream
 * @param {string} projectId - Project UUID
 * @param {string} fileName - Original filename
 * @param {string} fileType - File type (e.g., 'ack-pdf', 'mismatch-pdf', 'quote-pdf', 'csv')
 * @returns {Promise<string>} - MinIO object path
 */
async function uploadFile(file, projectId, fileName, fileType) {
    try {
        const fileExtension = path.extname(fileName);
        const uniqueId = uuidv4();
        const objectName = `${projectId}/${fileType}/${uniqueId}${fileExtension}`;

        // Determine content type
        const contentType = getContentType(fileExtension);

        // Upload to MinIO
        await minioClient.putObject(BUCKET_NAME, objectName, file, {
            'Content-Type': contentType,
            'X-Amz-Meta-Original-Filename': fileName,
            'X-Amz-Meta-Project-Id': projectId,
            'X-Amz-Meta-File-Type': fileType,
        });

        console.log(`File uploaded: ${objectName}`);

        return objectName;
    } catch (error) {
        console.error('MinIO upload error:', error);
        throw error;
    }
}

/**
 * Download file from MinIO
 *
 * @param {string} objectName - MinIO object path
 * @returns {Promise<Stream>} - File stream
 */
async function downloadFile(objectName) {
    try {
        const stream = await minioClient.getObject(BUCKET_NAME, objectName);
        return stream;
    } catch (error) {
        console.error('MinIO download error:', error);
        throw error;
    }
}

/**
 * Get pre-signed URL for file download (valid for 24 hours)
 *
 * @param {string} objectName - MinIO object path
 * @returns {Promise<string>} - Pre-signed URL
 */
async function getPresignedUrl(objectName) {
    try {
        const url = await minioClient.presignedGetObject(BUCKET_NAME, objectName, 24 * 60 * 60);
        return url;
    } catch (error) {
        console.error('MinIO presigned URL error:', error);
        throw error;
    }
}

/**
 * Upload text file (e.g., MULTI_AGENT_PLAN.md)
 *
 * @param {string} content - Text content
 * @param {string} projectId - Project UUID
 * @param {string} fileName - Filename
 * @returns {Promise<string>} - MinIO object path
 */
async function uploadTextFile(content, projectId, fileName) {
    try {
        const buffer = Buffer.from(content, 'utf-8');
        const objectName = `${projectId}/${fileName}`;

        await minioClient.putObject(BUCKET_NAME, objectName, buffer, {
            'Content-Type': 'text/markdown',
            'X-Amz-Meta-Project-Id': projectId,
        });

        console.log(`Text file uploaded: ${objectName}`);

        return objectName;
    } catch (error) {
        console.error('MinIO text upload error:', error);
        throw error;
    }
}

/**
 * Download text file (e.g., MULTI_AGENT_PLAN.md)
 *
 * @param {string} objectName - MinIO object path
 * @returns {Promise<string>} - File content as string
 */
async function downloadTextFile(objectName) {
    try {
        const stream = await minioClient.getObject(BUCKET_NAME, objectName);

        return new Promise((resolve, reject) => {
            let content = '';

            stream.on('data', (chunk) => {
                content += chunk.toString();
            });

            stream.on('end', () => {
                resolve(content);
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    } catch (error) {
        console.error('MinIO text download error:', error);
        throw error;
    }
}

/**
 * List files for a project
 *
 * @param {string} projectId - Project UUID
 * @returns {Promise<Array>} - List of objects
 */
async function listProjectFiles(projectId) {
    try {
        const objectsList = [];
        const stream = minioClient.listObjectsV2(BUCKET_NAME, `${projectId}/`, true);

        return new Promise((resolve, reject) => {
            stream.on('data', (obj) => {
                objectsList.push(obj);
            });

            stream.on('end', () => {
                resolve(objectsList);
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    } catch (error) {
        console.error('MinIO list error:', error);
        throw error;
    }
}

/**
 * Delete file from MinIO
 *
 * @param {string} objectName - MinIO object path
 */
async function deleteFile(objectName) {
    try {
        await minioClient.removeObject(BUCKET_NAME, objectName);
        console.log(`File deleted: ${objectName}`);
    } catch (error) {
        console.error('MinIO delete error:', error);
        throw error;
    }
}

/**
 * Get content type from file extension
 */
function getContentType(extension) {
    const contentTypes = {
        '.pdf': 'application/pdf',
        '.csv': 'text/csv',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
    };

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Health check
 */
async function healthCheck() {
    try {
        await minioClient.bucketExists(BUCKET_NAME);
        return { healthy: true };
    } catch (error) {
        return { healthy: false, error: error.message };
    }
}

module.exports = {
    minioClient,
    initializeMinio,
    uploadFile,
    downloadFile,
    getPresignedUrl,
    uploadTextFile,
    downloadTextFile,
    listProjectFiles,
    deleteFile,
    healthCheck,
};
