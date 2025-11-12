# Compare Worker Agent

Worker agent that compares original vendor order line items with parsed acknowledgment line items.

## Purpose

This is Worker 2 in the door automation multi-agent system. It:
- Pulls jobs from the `compare` BullMQ queue
- Fetches original vendor order line items from the database
- Fetches parsed ack line items (output from Worker 1)
- Compares line-by-line with configurable tolerances
- Stores comparison results and mismatch details
- Enqueues PDF generation if discrepancies are found
- Updates project status if no discrepancies found

## Dependencies

- **Redis**: For BullMQ job queue
- **PostgreSQL**: For data storage
- **MinIO**: For file storage (indirect)
- **Shared Modules**: Uses `door-normalizer.js` for comparison logic

## Configuration

Environment variables (via `.env`):

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=door_automation
POSTGRES_USER=dooradmin
POSTGRES_PASSWORD=doorpass123

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET=door-automation

# Node
NODE_ENV=development
```

## Comparison Logic

### Tolerances

Tolerances are fetched from the `vendor_settings` table:
- **Price Tolerance**: ±2.0% (default)
- **Size Tolerance**: ±0.25 inches (default)

### Comparison Fields

1. **Width** (inches) - numeric comparison with size tolerance
2. **Height** (inches) - numeric comparison with size tolerance
3. **Price** (unit price) - percentage-based comparison
4. **Swing** (door handing) - exact match required (LH, RH, LHR, RHR)

### Mismatch Severity

- **Critical**: Swing/handing mismatches
- **High**: Missing or extra line items
- **Medium**: Size or price discrepancies

## Database Operations

### Tables Used

- `vendor_orders` - Vendor order details
- `line_items` - Original order line items
- `ack_line_items` - Parsed ack line items
- `vendor_acknowledgments` - Ack metadata
- `vendor_settings` - Tolerance configurations
- `comparisons` - Comparison results
- `mismatch_details` - Line-by-line mismatch details
- `jobs` - Job tracking

### Workflow

1. Fetch vendor order and settings
2. Fetch original and ack line items
3. Compare using `compareDoorSpecs()` function
4. Store comparison and mismatch records
5. If discrepancies:
   - Enqueue `generate-pdf` job
   - Update order status to `discrepancy_found`
6. If no discrepancies:
   - Update order status to `acknowledged`
   - Update project status to `completed`

## Next Steps

If discrepancies are found, the Compare Worker enqueues:
- **Worker 3**: PDF Generator Agent (generates mismatch report)

If no discrepancies, the workflow completes successfully.

## Development

### Install dependencies
```bash
npm install
```

### Run in development mode
```bash
npm run dev
```

### Run in production
```bash
npm start
```

## Docker

### Build image
```bash
docker build -t door-automation-compare .
```

### Run container
```bash
docker run --env-file .env door-automation-compare
```

## Logging

Uses `pino` for structured logging. In development mode, uses `pino-pretty` for human-readable output.

Log levels:
- `debug` - Development mode
- `info` - Production mode
- `warn` - Non-critical warnings
- `error` - Critical errors

## Error Handling

- **Retries**: 2 attempts with exponential backoff
- **Job Tracking**: Updates `jobs` table with status and progress
- **Plan Updates**: Updates `MULTI_AGENT_PLAN.md` (Task 2) in real-time
- **Graceful Shutdown**: Handles SIGTERM/SIGINT signals

## Testing

To test the compare worker:

1. Ensure ack-parser has completed for a vendor order
2. Job should automatically be in the `compare` queue
3. Worker will process and log results
4. Check database for comparison results
5. Check MinIO for updated plan file

## Architecture

```
Compare Worker (Worker 2)
    ↓
Fetch from 'compare' queue
    ↓
Get original line items (line_items table)
    ↓
Get ack line items (ack_line_items table)
    ↓
Compare with tolerances (compareDoorSpecs)
    ↓
Store results (comparisons + mismatch_details)
    ↓
If discrepancies → Enqueue 'generate-pdf' job
If no issues → Mark project complete
```

## Related Files

- `/backend/shared/normalization/door-normalizer.js` - Comparison logic
- `/backend/shared/db/db.js` - Database functions
- `/orchestrator/src/queue-manager.js` - Queue management
- `/orchestrator/src/multi-agent-plan.js` - Plan updates
