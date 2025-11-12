/**
 * Database Connection Pool and Helper Functions
 *
 * Provides pooled Postgres connections and common query helpers
 */

const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'door_automation',
    user: process.env.POSTGRES_USER || 'dooradmin',
    password: process.env.POSTGRES_PASSWORD || 'doorpass123',
    max: 20, // Maximum connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Log pool errors
pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});

/**
 * Execute a query with parameters
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Database query error:', { text, error: error.message });
        throw error;
    }
}

/**
 * Get a client from the pool (for transactions)
 */
async function getClient() {
    return await pool.connect();
}

/**
 * Create a new project
 */
async function createProject(data) {
    const { projectName, customerName, customerEmail, projectType, metadata = {} } = data;

    const result = await query(
        `INSERT INTO projects (project_name, customer_name, customer_email, project_type, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [projectName, customerName, customerEmail, projectType, JSON.stringify(metadata)]
    );

    return result.rows[0];
}

/**
 * Update project status
 */
async function updateProjectStatus(projectId, status) {
    const result = await query(
        `UPDATE projects SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [status, projectId]
    );

    return result.rows[0];
}

/**
 * Get project by ID
 */
async function getProject(projectId) {
    const result = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
    return result.rows[0];
}

/**
 * Insert line items (batch)
 */
async function insertLineItems(projectId, lineItems) {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const insertedItems = [];

        for (const item of lineItems) {
            const result = await client.query(
                `INSERT INTO line_items (
                    project_id, line_number, width_inches, height_inches, thickness_inches,
                    vendor_code, door_type, swing, jamb_type, fire_rating,
                    quantity, unit_price, total_price, raw_description
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 RETURNING *`,
                [
                    projectId,
                    item.lineNumber || item.line_number,
                    item.widthInches || item.width_inches,
                    item.heightInches || item.height_inches,
                    item.thicknessInches || item.thickness_inches,
                    item.vendorCode || item.vendor_code,
                    item.doorType || item.door_type,
                    item.swing,
                    item.jambType || item.jamb_type,
                    item.fireRating || item.fire_rating,
                    item.quantity || 1,
                    item.unitPrice || item.unit_price,
                    item.totalPrice || item.total_price,
                    item.rawDescription || item.raw_description,
                ]
            );

            insertedItems.push(result.rows[0]);
        }

        await client.query('COMMIT');
        return insertedItems;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get line items for a project
 */
async function getLineItems(projectId) {
    const result = await query(
        'SELECT * FROM line_items WHERE project_id = $1 ORDER BY line_number',
        [projectId]
    );
    return result.rows;
}

/**
 * Create vendor order
 */
async function createVendorOrder(data) {
    const { projectId, vendorName, orderNumber, csvFilePath, metadata = {} } = data;

    const result = await query(
        `INSERT INTO vendor_orders (project_id, vendor_name, order_number, csv_file_path, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [projectId, vendorName, orderNumber, csvFilePath, JSON.stringify(metadata)]
    );

    return result.rows[0];
}

/**
 * Update vendor order status
 */
async function updateVendorOrderStatus(orderId, status, sentAt = null) {
    const result = await query(
        `UPDATE vendor_orders
         SET status = $1, sent_at = COALESCE($2, sent_at), updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`,
        [status, sentAt, orderId]
    );

    return result.rows[0];
}

/**
 * Get vendor order by ID
 */
async function getVendorOrder(orderId) {
    const result = await query('SELECT * FROM vendor_orders WHERE id = $1', [orderId]);
    return result.rows[0];
}

/**
 * Create vendor acknowledgment
 */
async function createVendorAck(data) {
    const { vendorOrderId, ackFilePath, ocrConfidence, ocrMethod, rawData = {} } = data;

    const result = await query(
        `INSERT INTO vendor_acknowledgments (vendor_order_id, ack_file_path, ocr_confidence, ocr_method, raw_data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [vendorOrderId, ackFilePath, ocrConfidence, ocrMethod, JSON.stringify(rawData)]
    );

    return result.rows[0];
}

/**
 * Insert ack line items (batch)
 */
async function insertAckLineItems(ackId, lineItems) {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const insertedItems = [];

        for (const item of lineItems) {
            const result = await client.query(
                `INSERT INTO ack_line_items (
                    ack_id, line_number, width_inches, height_inches, thickness_inches,
                    vendor_code, quantity, unit_price, total_price, matched_line_item_id, raw_text
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING *`,
                [
                    ackId,
                    item.lineNumber || item.line_number,
                    item.widthInches || item.width_inches,
                    item.heightInches || item.height_inches,
                    item.thicknessInches || item.thickness_inches,
                    item.vendorCode || item.vendor_code,
                    item.quantity,
                    item.unitPrice || item.unit_price,
                    item.totalPrice || item.total_price,
                    item.matchedLineItemId || item.matched_line_item_id || null,
                    item.rawText || item.raw_text,
                ]
            );

            insertedItems.push(result.rows[0]);
        }

        await client.query('COMMIT');
        return insertedItems;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Create comparison record
 */
async function createComparison(data) {
    const {
        vendorOrderId,
        ackId,
        totalLinesCompared,
        linesMatched,
        linesMismatched,
        priceTolerancePercent,
        sizeToleranceInches,
        hasDiscrepancies,
        mismatchPdfPath,
        details = {},
    } = data;

    const result = await query(
        `INSERT INTO comparisons (
            vendor_order_id, ack_id, total_lines_compared, lines_matched, lines_mismatched,
            price_tolerance_percent, size_tolerance_inches, has_discrepancies, mismatch_pdf_path, details
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
            vendorOrderId,
            ackId,
            totalLinesCompared,
            linesMatched,
            linesMismatched,
            priceTolerancePercent,
            sizeToleranceInches,
            hasDiscrepancies,
            mismatchPdfPath,
            JSON.stringify(details),
        ]
    );

    return result.rows[0];
}

/**
 * Insert mismatch details (batch)
 */
async function insertMismatchDetails(comparisonId, mismatches) {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const insertedMismatches = [];

        for (const mismatch of mismatches) {
            const result = await client.query(
                `INSERT INTO mismatch_details (
                    comparison_id, line_number, original_line_item_id, ack_line_item_id,
                    mismatch_type, original_value, ack_value, difference, severity
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING *`,
                [
                    comparisonId,
                    mismatch.lineNumber || mismatch.line_number,
                    mismatch.originalLineItemId || mismatch.original_line_item_id,
                    mismatch.ackLineItemId || mismatch.ack_line_item_id,
                    mismatch.mismatchType || mismatch.mismatch_type,
                    mismatch.originalValue || mismatch.original_value,
                    mismatch.ackValue || mismatch.ack_value,
                    mismatch.difference,
                    mismatch.severity || 'medium',
                ]
            );

            insertedMismatches.push(result.rows[0]);
        }

        await client.query('COMMIT');
        return insertedMismatches;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Create job record
 */
async function createJob(data) {
    const { jobName, jobId, projectId, status = 'pending' } = data;

    const result = await query(
        `INSERT INTO jobs (job_name, job_id, project_id, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [jobName, jobId, projectId, status]
    );

    return result.rows[0];
}

/**
 * Update job status and progress
 */
async function updateJob(jobId, updates) {
    const { status, progress, result, error, startedAt, completedAt } = updates;

    const result_ = await query(
        `UPDATE jobs
         SET status = COALESCE($1, status),
             progress = COALESCE($2, progress),
             result = COALESCE($3, result),
             error = COALESCE($4, error),
             started_at = COALESCE($5, started_at),
             completed_at = COALESCE($6, completed_at),
             updated_at = CURRENT_TIMESTAMP
         WHERE job_id = $7
         RETURNING *`,
        [
            status,
            progress,
            result ? JSON.stringify(result) : null,
            error,
            startedAt,
            completedAt,
            jobId,
        ]
    );

    return result_.rows[0];
}

/**
 * Get jobs for a project
 */
async function getProjectJobs(projectId) {
    const result = await query(
        'SELECT * FROM jobs WHERE project_id = $1 ORDER BY created_at DESC',
        [projectId]
    );
    return result.rows;
}

/**
 * Log audit entry
 */
async function logAudit(entityType, entityId, action, details = {}) {
    await query(
        `INSERT INTO audit_log (entity_type, entity_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [entityType, entityId, action, JSON.stringify(details)]
    );
}

/**
 * Get vendor settings
 */
async function getVendorSettings(vendorName) {
    const result = await query(
        'SELECT * FROM vendor_settings WHERE vendor_name = $1',
        [vendorName]
    );

    return result.rows[0] || {
        price_tolerance_percent: parseFloat(process.env.DEFAULT_PRICE_TOLERANCE_PERCENT || '2.0'),
        size_tolerance_inches: parseFloat(process.env.DEFAULT_SIZE_TOLERANCE_INCHES || '0.25'),
    };
}

/**
 * Health check
 */
async function healthCheck() {
    try {
        const result = await query('SELECT NOW()');
        return { healthy: true, timestamp: result.rows[0].now };
    } catch (error) {
        return { healthy: false, error: error.message };
    }
}

/**
 * Close pool (for graceful shutdown)
 */
async function closePool() {
    await pool.end();
}

module.exports = {
    query,
    getClient,
    createProject,
    updateProjectStatus,
    getProject,
    insertLineItems,
    getLineItems,
    createVendorOrder,
    updateVendorOrderStatus,
    getVendorOrder,
    createVendorAck,
    insertAckLineItems,
    createComparison,
    insertMismatchDetails,
    createJob,
    updateJob,
    getProjectJobs,
    logAudit,
    getVendorSettings,
    healthCheck,
    closePool,
};
