# Task 01: Quote Database Schema

## Objective
Create database schema for the quoting system including quotes, quote_lines, uploads, and events tables.

## Context
- Existing database has `users` and `products` tables (see pricing-tool/supabase-schema.sql)
- Using Supabase (PostgreSQL 15)
- Need Row Level Security (RLS) policies
- This is the foundation for the entire quoting system

## Requirements

### 1. Quotes Table
Create table: `public.quotes`

**Columns:**
- `id` UUID PRIMARY KEY (default uuid_generate_v4())
- `customer_name` TEXT (nullable for drafts)
- `customer_email` TEXT (nullable for drafts)
- `customer_phone` TEXT (nullable)
- `status` TEXT CHECK (status IN ('draft', 'submitted', 'reviewed', 'sent', 'accepted', 'declined', 'expired'))
- `currency` TEXT DEFAULT 'USD'
- `subtotal` NUMERIC(12, 2) DEFAULT 0
- `tax` NUMERIC(12, 2) DEFAULT 0
- `total` NUMERIC(12, 2) DEFAULT 0
- `margin_percent` NUMERIC(5, 2) (nullable)
- `metadata_json` JSONB (for source, IP, user_agent, etc.)
- `created_by` UUID REFERENCES users(id) (nullable - allow anonymous)
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `submitted_at` TIMESTAMPTZ (nullable)
- `sent_at` TIMESTAMPTZ (nullable)
- `expires_at` TIMESTAMPTZ (nullable, default NOW() + 14 days when sent)
- `version` INTEGER DEFAULT 1 (for locking)

**Indexes:**
- idx_quotes_status
- idx_quotes_customer_email
- idx_quotes_created_at DESC
- idx_quotes_created_by

### 2. Quote Lines Table
Create table: `public.quote_lines`

**Columns:**
- `id` UUID PRIMARY KEY (default uuid_generate_v4())
- `quote_id` UUID REFERENCES quotes(id) ON DELETE CASCADE
- `line_number` INTEGER NOT NULL
- `catalog_item_id` UUID REFERENCES products(id) (nullable - allow custom items)
- `description` TEXT NOT NULL
- `quantity` NUMERIC(10, 2) NOT NULL CHECK (quantity > 0)
- `unit` TEXT DEFAULT 'EA'
- `options_json` JSONB (e.g., {"size": "30x80", "color": "white", "finish": "primed"})
- `unit_price` NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
- `extended_price` NUMERIC(12, 2) NOT NULL
- `source` TEXT CHECK (source IN ('manual', 'ocr', 'asr', 'paste', 'spreadsheet', 'voice'))
- `confidence_score` NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1) (nullable)
- `mapping_warnings_json` JSONB (e.g., {"low_confidence": true, "fuzzy_match": true})
- `notes` TEXT (nullable)
- `created_at` TIMESTAMPTZ DEFAULT NOW()

**Indexes:**
- idx_quote_lines_quote_id
- idx_quote_lines_catalog_item_id
- idx_quote_lines_source
- UNIQUE(quote_id, line_number)

### 3. Uploads Table
Create table: `public.uploads`

**Columns:**
- `id` UUID PRIMARY KEY (default uuid_generate_v4())
- `quote_id` UUID REFERENCES quotes(id) ON DELETE CASCADE
- `file_type` TEXT CHECK (file_type IN ('pdf', 'image', 'spreadsheet', 'audio', 'text'))
- `original_name` TEXT NOT NULL
- `storage_path` TEXT NOT NULL (Supabase Storage path)
- `size_bytes` BIGINT NOT NULL
- `mime_type` TEXT NOT NULL
- `status` TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
- `parsed_payload_json` JSONB (extracted data)
- `confidence_score` NUMERIC(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1) (nullable)
- `error_message` TEXT (nullable)
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `processed_at` TIMESTAMPTZ (nullable)

**Indexes:**
- idx_uploads_quote_id
- idx_uploads_status
- idx_uploads_created_at DESC

### 4. Events Table (Audit Trail)
Create table: `public.events`

**Columns:**
- `id` UUID PRIMARY KEY (default uuid_generate_v4())
- `quote_id` UUID REFERENCES quotes(id) ON DELETE CASCADE
- `user_id` UUID REFERENCES users(id) (nullable - allow anonymous events)
- `event_type` TEXT NOT NULL (e.g., 'created', 'viewed', 'edited', 'submitted', 'sent', 'accepted', 'declined')
- `payload_json` JSONB (event-specific data)
- `ip_address` INET (nullable)
- `user_agent` TEXT (nullable)
- `created_at` TIMESTAMPTZ DEFAULT NOW()

**Indexes:**
- idx_events_quote_id
- idx_events_event_type
- idx_events_created_at DESC

### 5. Row Level Security (RLS)

**Enable RLS on all new tables:**
```sql
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
```

**RLS Policies:**

**Quotes:**
- Anonymous users can INSERT quotes (for public quote creation)
- Authenticated SALES/ADMIN can view all quotes
- Quote creator can view their own quotes
- Only ADMIN can UPDATE/DELETE quotes

**Quote Lines:**
- Follow parent quote permissions
- Anyone who can see quote can see its lines
- Only ADMIN can modify lines

**Uploads:**
- Follow parent quote permissions
- Anyone who can see quote can see its uploads

**Events:**
- Anyone can INSERT events (for tracking)
- Only ADMIN can view events

### 6. Triggers

**Auto-update quote totals when lines change:**
Create trigger function to recalculate `quotes.subtotal` and `quotes.total` when quote_lines are inserted/updated/deleted.

**Auto-increment line_number:**
Create trigger to set line_number to MAX(line_number) + 1 if not provided.

## Files to Modify
- `pricing-tool/supabase-schema.sql` - Append new schema (keep it idempotent)

## Testing Requirements
1. Verify all tables created successfully
2. Verify indexes exist
3. Verify RLS policies work (test with different user roles)
4. Test trigger: line insert should update quote totals
5. Test constraint: invalid status should be rejected
6. Test cascade delete: deleting quote should delete lines

## Acceptance Criteria
- [ ] All tables created with correct columns and constraints
- [ ] All indexes created
- [ ] RLS enabled and policies configured
- [ ] Triggers working correctly
- [ ] Schema is idempotent (can run multiple times safely)
- [ ] No breaking changes to existing tables
- [ ] Comments added to schema explaining complex parts

## Dependencies
- None (foundation task)

## Estimated Effort
2-3 hours

## Review Checklist for Review Agent
- [ ] Column types are correct for use cases
- [ ] All constraints make sense (CHECK, NOT NULL, etc.)
- [ ] Indexes are on frequently queried columns
- [ ] RLS policies prevent unauthorized access
- [ ] Foreign key ON DELETE behavior is correct
- [ ] JSONB columns have clear documentation
- [ ] Triggers don't cause performance issues
- [ ] Schema is PostgreSQL 15 compatible
