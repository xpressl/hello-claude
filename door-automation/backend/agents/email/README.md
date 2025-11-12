# Email Worker Agent

**Worker 4 in the Door Automation Multi-Agent System**

## Overview

The Email Worker Agent is responsible for sending vendor discrepancy notifications via email. It downloads mismatch PDF reports from MinIO and sends them as attachments to vendors, with CCs to internal team members.

## Architecture

```
┌─────────────────────────────────────┐
│         Redis Queue                 │
│     (send-email)                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Email Worker Agent             │
│  • Pull job from queue              │
│  • Download PDF from MinIO          │
│  • Send email via SMTP              │
│  • Update vendor order status       │
│  • Update project status            │
│  • Update MULTI_AGENT_PLAN.md       │
└─────────────────────────────────────┘
```

## Features

- **Email Sending**: Sends professional HTML emails via SMTP (Gmail, Outlook, etc.)
- **PDF Attachments**: Downloads mismatch PDFs from MinIO and attaches to emails
- **CC Support**: Automatically CCs internal team members
- **Retry Logic**: Exponential backoff retry (3 attempts)
- **Rate Limiting**: Respects SMTP rate limits (20 emails/minute)
- **Status Updates**: Updates vendor order and project status in database
- **Plan Tracking**: Updates Task 4 status in MULTI_AGENT_PLAN.md
- **Error Handling**: Graceful handling of SMTP errors with clear logging

## Queue

**Queue Name**: `send-email`

**Job Data Structure**:
```javascript
{
    projectId: 'uuid',
    vendorOrderId: 'uuid',
    comparisonId: 'uuid',
    mismatchPdfPath: 'path/to/mismatch.pdf', // MinIO path
    vendorEmail: 'vendor@example.com',
    vendorName: 'Vendor Name',
    projectName: 'Project Name',
    orderNumber: 'PO-12345',
    mismatchCount: 5,
    mismatchSummary: [
        {
            lineNumber: 1,
            mismatchType: 'price',
            originalValue: '$100.00',
            ackValue: '$105.00'
        },
        // ... more mismatches
    ]
}
```

## Configuration

Environment variables (see `.env.example`):

### SMTP Configuration
- `SMTP_HOST`: SMTP server hostname (default: `smtp.gmail.com`)
- `SMTP_PORT`: SMTP port (default: `587`)
- `SMTP_USER`: SMTP username (required)
- `SMTP_PASSWORD`: SMTP password (required)
- `SMTP_FROM`: Sender email address
- `EMAIL_CC`: Comma-separated list of CC emails (optional)

### Redis
- `REDIS_HOST`: Redis hostname
- `REDIS_PORT`: Redis port

### MinIO
- `MINIO_ENDPOINT`: MinIO endpoint
- `MINIO_PORT`: MinIO port
- `MINIO_ROOT_USER`: MinIO access key
- `MINIO_ROOT_PASSWORD`: MinIO secret key
- `MINIO_BUCKET`: MinIO bucket name

### Database
- `POSTGRES_HOST`: PostgreSQL hostname
- `POSTGRES_PORT`: PostgreSQL port
- `POSTGRES_DB`: Database name
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password

## Email Template

The worker sends professional HTML emails with:

1. **Subject**: "Vendor Acknowledgment Discrepancy - [Project Name]"
2. **Body**:
   - Alert banner with discrepancy count
   - Project details (name, order number, project ID)
   - Summary of mismatches (first 10)
   - Required action items
   - Professional footer
3. **Attachment**: Mismatch PDF report

## SMTP Setup

### Gmail
1. Enable 2-Step Verification in Google Account
2. Create App Password: https://myaccount.google.com/apppasswords
3. Use app password as `SMTP_PASSWORD`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
```

### Outlook / Office 365
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

## Running the Worker

### Development
```bash
npm install
npm run dev
```

### Production
```bash
npm install --only=production
npm start
```

### Docker
```bash
docker build -t email-worker .
docker run -d --name email-worker --env-file .env email-worker
```

## Worker Configuration

- **Concurrency**: 3 (processes 3 email jobs concurrently)
- **Rate Limiting**: 20 emails per minute
- **Retry Attempts**: 3
- **Retry Strategy**: Exponential backoff (5s, 15s, 45s)

## Database Updates

Upon successful email send, the worker:

1. Updates vendor order status to `'discrepancy'`
2. Updates project status to `'completed'`
3. Updates job status to `'completed'` with result metadata
4. Logs audit entry for email sent

## Error Handling

The worker handles various error scenarios:

- **Missing SMTP Credentials**: Throws clear error on startup
- **Invalid Email Address**: Job fails with validation error
- **SMTP Authentication Failure**: Retries with exponential backoff
- **PDF Download Failure**: Logs error and fails job
- **Rate Limiting**: Respects SMTP provider limits (20/min)

## Logging

Uses `pino` for structured logging:

- **Info**: Job start, PDF download, email sent, status updates
- **Warn**: Non-critical errors (e.g., plan update failures)
- **Error**: Job failures, SMTP errors

Development mode includes pretty-printed colored logs.

## Health Monitoring

Monitor worker health via:

1. **Worker Events**: `ready`, `completed`, `failed`, `error`
2. **BullMQ Dashboard**: View job queue and status
3. **Database**: Check `jobs` table for job status
4. **MULTI_AGENT_PLAN.md**: View Task 4 status in MinIO

## Troubleshooting

### Email not sending
1. Check SMTP credentials are set correctly
2. Verify SMTP server allows connections (firewall, network)
3. For Gmail, ensure App Password is used (not regular password)
4. Check logs for specific SMTP error codes

### PDF not attaching
1. Verify MinIO connection and credentials
2. Check `mismatchPdfPath` in job data is correct
3. Ensure PDF was uploaded by PDF Generator agent

### CC not working
1. Ensure `EMAIL_CC` is set with comma-separated emails
2. Check SMTP provider allows CC/BCC
3. Verify CC email addresses are valid

## Testing

To test the email worker:

1. Start Redis, PostgreSQL, and MinIO
2. Run the worker: `npm run dev`
3. Enqueue a test job using BullMQ or orchestrator API
4. Check logs for email send confirmation
5. Verify email received at vendor address
6. Check database for updated statuses

## Integration

The Email Worker is enqueued by the **PDF Generator Agent** (Worker 3) after successfully generating the mismatch PDF.

**Workflow**:
```
PDF Generator (Worker 3)
    ↓ (enqueue 'send-email' job)
Email Worker (Worker 4)
    ↓
Vendor receives email with PDF
    ↓
Project marked as 'completed'
```

## Dependencies

- **bullmq**: Job queue processing
- **ioredis**: Redis client
- **minio**: MinIO SDK for PDF downloads
- **nodemailer**: Email sending via SMTP
- **pino**: Structured logging
- **dotenv**: Environment variable management

## License

ISC
