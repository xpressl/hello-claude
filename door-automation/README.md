# Door Automation System

**Multi-Agent Autonomous Door Quote & Vendor Order Processing**

A code-only, multi-agent system that automates the complete workflow from customer door lists and vendor acknowledgments to fully automated quote generation, vendor ordering, and acknowledgment comparison with mismatch detection.

---

## 🎯 What It Does

**Zero manual retyping.** Upload customer list once → system normalizes sizes/swings/jambs → prices → generates quote → produces vendor CSV.

**Automatic vendor acknowledgment checking.** System OCRs the ack → compares line-by-line with tolerances → generates mismatch PDF → emails vendor + internal CC.

**Consistent size conversion and error prevention.** Inches, feet-inch, and vendor codes convert to a single truth. Swing/type/jamb rules applied consistently.

---

## 🏗️ Architecture

### Multi-Agent System (Hybrid Orchestration)

Built using **Option C** architecture from the multi-agent blueprint:

- **Phase 1**: Redis queue + MULTI_AGENT_PLAN.md orchestration ✅
- **Phase 2**: Validator agent + feedback loops 🚧
- **Phase 3**: LangGraph migration for advanced coordination 📋

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Orchestrator API                        │
│              (Queue Manager + REST Endpoints)                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─► Redis Queue (BullMQ)
                   │   ├─ OCR Ack Job
                   │   ├─ Compare Job
                   │   ├─ Generate PDF Job
                   │   └─ Send Email Job
                   │
                   ├─► Worker Agents (Pull from Queue)
                   │   ├─ Ack Parser Agent (OpenAI Vision OCR)
                   │   ├─ Compare Agent (Normalization + Tolerances)
                   │   ├─ PDF Generator (Mismatch Reports)
                   │   └─ Email Agent (SMTP)
                   │
                   └─► Storage & State
                       ├─ PostgreSQL (Projects, Line Items, Comparisons)
                       ├─ MinIO (PDFs, CSVs, Acks - S3-compatible)
                       └─ MULTI_AGENT_PLAN.md (Human-readable audit trail)
```

### Vendor Code Normalization

Consistent size conversion rules:

- `2468` = 24" × 80" (6'8")
- `2668` = 26" × 80"
- `2868` = 28" × 80"
- `3068` = 30" × 80"
- `3268` = 32" × 80"
- `3668` = 36" × 80"

Supports:
- Vendor codes (4-digit)
- Inches (`36 x 80`)
- Feet-inch (`3'-0" x 6'-8"`)
- Natural language parsing

---

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (for Postgres, Redis, MinIO)
- **Node.js 18+** (for orchestrator and agents)
- **OpenAI API Key** (for OCR Vision)
- **SMTP credentials** (for email sending)

### Installation

1. **Clone and navigate:**

```bash
cd door-automation
```

2. **Copy environment file:**

```bash
cp .env.example .env
```

3. **Edit `.env` and add your credentials:**

```env
OPENAI_API_KEY=sk-your-openai-key
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=Door Automation <your-email@gmail.com>
```

4. **Start infrastructure:**

```bash
docker-compose up -d postgres redis minio
```

Wait for services to be healthy:

```bash
docker-compose ps
```

5. **Install dependencies and start orchestrator:**

```bash
cd backend/orchestrator
npm install
npm run dev
```

6. **In separate terminals, start worker agents:**

```bash
# Terminal 2: Ack Parser
cd backend/agents/ack-parser
npm install
npm run dev

# Terminal 3: Compare Agent
cd backend/agents/compare
npm install
npm run dev

# Terminal 4: PDF Generator
cd backend/agents/pdf-generator
npm install
npm run dev

# Terminal 5: Email Agent
cd backend/agents/email
npm install
npm run dev
```

---

## 📋 Workflow: Vendor Ack → Mismatch Email

**Target workflow:** Upload vendor ack PDF → Automatically email vendor with mismatch PDF (if discrepancies found).

### API Endpoint

```http
POST http://localhost:3000/api/vendor-ack
Content-Type: multipart/form-data

{
  "vendor_order_id": "uuid-of-vendor-order",
  "file": <vendor-ack.pdf>
}
```

### What Happens Automatically

1. **Orchestrator** receives upload → creates project → enqueues jobs
2. **Ack Parser Agent** (OpenAI Vision):
   - OCRs PDF
   - Normalizes door specs
   - Stores in `ack_line_items` table
3. **Compare Agent**:
   - Fetches original vendor order line items
   - Compares with ack line items (price/size tolerances)
   - Stores comparison results
4. **PDF Generator** (if mismatches found):
   - Generates mismatch report PDF
   - Uploads to MinIO
5. **Email Agent**:
   - Sends email to vendor with mismatch PDF attachment
   - CCs internal team
   - Updates job status

### Success Metric

⏱️ **Upload ack PDF → Email sent in <2 min** (fully automated)

---

## 🗄️ Database Schema

### Key Tables

- **`projects`**: Customer door lists, blueprints, orders
- **`line_items`**: Normalized door specifications
- **`vendor_orders`**: Generated CSVs/orders sent to vendors
- **`vendor_acknowledgments`**: Parsed acks from vendors
- **`ack_line_items`**: Parsed ack specifications
- **`comparisons`**: Original order vs ack comparison results
- **`mismatch_details`**: Line-by-line mismatch records
- **`jobs`**: BullMQ job tracking
- **`vendor_settings`**: Per-vendor tolerance configs
- **`audit_log`**: Full audit trail

### View Schema

```bash
docker exec -it door-automation-db psql -U dooradmin -d door_automation

\dt  -- List all tables
\d projects  -- Describe projects table
```

---

## 🧪 Testing

### Manual Test: Upload Vendor Ack

```bash
curl -X POST http://localhost:3000/api/vendor-ack \
  -F "vendor_order_id=existing-order-uuid" \
  -F "file=@sample-vendor-ack.pdf"
```

Expected response:

```json
{
  "success": true,
  "projectId": "uuid",
  "jobId": "uuid",
  "message": "Vendor ack uploaded and processing started"
}
```

### Check Job Status

```bash
curl http://localhost:3000/api/jobs/:projectId
```

### View MULTI_AGENT_PLAN.md

```bash
curl http://localhost:3000/api/plan/:projectId
```

Example output:

```markdown
# Project: ABC-Construction-2025-001

## Tasks:
- [x] OCR vendor ack (AckParserAgent) — Status: COMPLETE
- [x] Compare with original order (CompareAgent) — Status: COMPLETE
- [x] Generate mismatch PDF (PDFGeneratorAgent) — Status: COMPLETE
- [x] Send email to vendor (EmailAgent) — Status: COMPLETE

## Summary:
- Total lines compared: 15
- Matched: 12
- Mismatched: 3 (price discrepancies)
```

---

## 🔧 Configuration

### Tolerance Settings

**Global defaults** (`.env`):

```env
DEFAULT_PRICE_TOLERANCE_PERCENT=2.0
DEFAULT_SIZE_TOLERANCE_INCHES=0.25
```

**Per-vendor overrides** (database):

```sql
INSERT INTO vendor_settings (vendor_name, price_tolerance_percent, size_tolerance_inches)
VALUES ('Vendor XYZ', 5.0, 0.5);
```

### SMTP Configuration

**Gmail example:**

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Generate at: https://myaccount.google.com/apppasswords
SMTP_FROM=Door Automation <your-email@gmail.com>
```

### MinIO Configuration

Access MinIO console:

```
http://localhost:9001
Username: minioadmin
Password: minioadmin123
```

Create bucket: `door-automation`

---

## 📊 Observability

### BullMQ Dashboard (Future)

Install Bull Board:

```bash
npm install @bull-board/api @bull-board/express
```

Access at: `http://localhost:3000/admin/queues`

### Logs

View orchestrator logs:

```bash
docker logs -f door-automation-orchestrator
```

View agent logs:

```bash
docker logs -f door-automation-ack-parser
docker logs -f door-automation-compare
```

### Database Queries

**Recent projects:**

```sql
SELECT * FROM projects ORDER BY created_at DESC LIMIT 10;
```

**Failed jobs:**

```sql
SELECT * FROM jobs WHERE status = 'failed' ORDER BY created_at DESC;
```

**Comparisons with discrepancies:**

```sql
SELECT * FROM comparisons WHERE has_discrepancies = TRUE;
```

---

## 🛣️ Roadmap

### ✅ Phase 1: Stabilize & Modernize (Weeks 1-2)

- [x] Redis + BullMQ queue system
- [x] MinIO object storage
- [x] Database schema
- [x] Shared normalization library
- [ ] Orchestrator API
- [ ] Worker agents (ack-parser, compare, pdf-generator, email)
- [ ] MULTI_AGENT_PLAN.md generation

### 📋 Phase 2: User Experience (Weeks 3-4)

- [ ] React dashboard (Next.js)
- [ ] JWT authentication + RBAC
- [ ] Real-time job status UI
- [ ] Vendor tolerance config UI

### 📋 Phase 3: Advanced Features (Weeks 5-12)

- [ ] Blueprint CV integration (YOLO/Detectron2)
- [ ] Vendor API push framework
- [ ] BOM pricing engine
- [ ] Approval workflows
- [ ] Migrate to LangGraph for advanced orchestration

---

## 🏛️ Architecture Decisions

### Why Multi-Agent?

- **Separation of concerns**: Each agent has one job (OCR, compare, email)
- **Scalability**: Spin up more workers during peak hours
- **Fault tolerance**: If OCR fails, retry without reprocessing entire workflow
- **Observability**: Each job is tracked independently

### Why Redis Queue?

- **Async processing**: OCR and PDF generation don't block API responses
- **Built-in retries**: Dead-letter queues for failed jobs
- **Job monitoring**: Track progress, completions, failures
- **Parallelization**: Multiple agents process jobs concurrently

### Why MinIO?

- **S3-compatible**: Easy migration to AWS S3 later
- **Pre-signed URLs**: Secure PDF downloads without exposing storage
- **Self-hosted**: No vendor lock-in, full control
- **Versioning**: Track file changes over time

---

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

---

## 📄 License

Proprietary. All rights reserved.

---

## 🆘 Troubleshooting

### Database connection errors

```bash
docker-compose ps postgres  # Check if running
docker logs door-automation-db  # View logs
```

### Redis connection errors

```bash
docker-compose ps redis
docker exec -it door-automation-redis redis-cli ping  # Should return PONG
```

### OCR not working

- Check `OPENAI_API_KEY` in `.env`
- Verify API key at: https://platform.openai.com/api-keys
- Check rate limits: https://platform.openai.com/account/rate-limits

### Emails not sending

- Verify SMTP credentials
- For Gmail: Enable "Less secure app access" or use App Password
- Check spam folder

---

**Built with:**
- Node.js + Express
- PostgreSQL
- Redis + BullMQ
- MinIO (S3-compatible)
- OpenAI Vision API
- Docker + Docker Compose
