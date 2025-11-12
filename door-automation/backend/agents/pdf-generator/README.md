# PDF Generator Worker Agent

Worker 3 in the multi-agent door automation system. Generates professional mismatch report PDFs when discrepancies are detected between vendor orders and acknowledgments.

## Overview

This agent:
1. Pulls jobs from the `generate-pdf` queue
2. Fetches comparison and mismatch data from the database
3. Generates a professional PDF report using PDFKit
4. Uploads the PDF to MinIO storage
5. Updates the comparison record with the PDF path
6. Enqueues a job for the Email Agent (Worker 4)
7. Updates the MULTI_AGENT_PLAN.md (Task 3)

## PDF Report Features

The generated PDF includes:

### Header Section
- Report title: "Vendor Acknowledgment Mismatch Report"
- Project name, vendor name, order date
- Generated timestamp

### Summary Section
- Total lines compared
- Matched vs mismatched counts
- Match percentage visualization
- Tolerances applied (price and size)

### Comparison Table
- Line-by-line discrepancies
- Columns: Line #, Type, Description, Original Value, Ack Value, Difference
- Color-coded by severity:
  - 🟡 Low (orange)
  - 🟠 Medium (dark orange)
  - 🔴 High (red)
  - ⚫ Critical (dark red)
- Alternating row backgrounds for readability

### Footer Section
- Next steps for handling discrepancies
- System name and page numbers

## Configuration

Set these environment variables:

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Postgres
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
```

## Running Locally

```bash
# Install dependencies
npm install

# Start worker
npm start

# Development mode (with auto-restart)
npm run dev
```

## Docker

```bash
# Build
docker build -t pdf-generator .

# Run
docker run --env-file .env pdf-generator
```

## Job Data Format

Jobs enqueued to `generate-pdf` should have this structure:

```javascript
{
  projectId: "uuid",        // Project UUID
  vendorOrderId: "uuid",    // Vendor order UUID
  comparisonId: "uuid",     // Comparison UUID
  ackId: "uuid"             // Acknowledgment UUID
}
```

## Output

- **MinIO Path**: `{projectId}/mismatch-pdf/{comparisonId}.pdf`
- **Database**: Updates `comparisons.mismatch_pdf_path`
- **Next Job**: Enqueues `send-email` job with PDF path

## Dependencies

- **bullmq**: Job queue processing
- **ioredis**: Redis client
- **pg**: PostgreSQL client
- **minio**: Object storage client
- **pdfkit**: PDF generation library
- **pino**: Structured logging

## Error Handling

- Logs all errors with context
- Updates job status in database
- Updates MULTI_AGENT_PLAN.md with failure status
- Does not crash on non-critical errors (e.g., plan updates)

## Performance

- Concurrency: 3 jobs at once
- Rate limiting: 10 jobs per minute
- Typical PDF generation: 1-3 seconds
- Handles multi-page reports automatically

## Architecture

```
Redis Queue (generate-pdf)
         ↓
   PDF Generator Worker
         ↓
    ┌────────────────┐
    │ Fetch Data     │ → Comparison + Mismatches + Project + Vendor
    └────────────────┘
         ↓
    ┌────────────────┐
    │ Generate PDF   │ → PDFKit (header, table, footer)
    └────────────────┘
         ↓
    ┌────────────────┐
    │ Upload MinIO   │ → {projectId}/mismatch-pdf/{comparisonId}.pdf
    └────────────────┘
         ↓
    ┌────────────────┐
    │ Update DB      │ → comparisons.mismatch_pdf_path
    └────────────────┘
         ↓
    ┌────────────────┐
    │ Enqueue Email  │ → send-email queue
    └────────────────┘
```

## Monitoring

Check worker logs for:
- Job processing status
- PDF generation metrics
- Upload success/failure
- Queue health

Example log output:
```
✅ PDF Generator Worker ready and waiting for jobs
Processing generate PDF job { jobId: '123', projectId: 'abc', comparisonId: 'def' }
PDF generated successfully { size: 45621 }
PDF uploaded to MinIO { objectName: 'abc/mismatch-pdf/def.pdf' }
Job completed successfully { jobId: '123' }
```

## Related Agents

- **Worker 2**: Compare Agent (creates comparison data)
- **Worker 4**: Email Agent (sends PDF to vendor)
