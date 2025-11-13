# Staging Deployment Checklist

Complete step-by-step guide for deploying Phase 1 (Core Quoting System) and Phase 2 (Item Options System) to a staging environment.

## Prerequisites

Before starting deployment, ensure you have:

- [ ] GitHub repository with all Phase 1 & 2 code
- [ ] Vercel account (free tier works)
- [ ] Supabase account (free tier works)
- [ ] Git CLI installed locally
- [ ] Node.js 20+ and npm installed
- [ ] Access to email for magic link authentication

## Phase 0: Pre-Deployment Verification

### Step 0.1: Run Pre-Deployment Script

```bash
cd /home/user/hello-claude/pricing-tool
chmod +x verify-build.sh
./verify-build.sh
```

This script will verify:
- All required files exist
- TypeScript compiles without errors
- Tests pass
- Schema file is complete
- Environment variables are documented

### Step 0.2: Manual Code Review

- [ ] Review recent commits for Phase 1 and Phase 2
- [ ] Verify all migration files are committed
- [ ] Check that no sensitive data is in code
- [ ] Ensure `.env.local` is in `.gitignore`

### Step 0.3: Push to GitHub

```bash
# Ensure you're on the correct branch
git status

# Push to GitHub
git push origin <your-branch-name>
```

---

## Phase 1: Supabase Staging Setup

### Step 1.1: Create Supabase Staging Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **New Project**
3. Choose your organization
4. Configure project:
   - **Name**: `pricing-tool-staging`
   - **Database Password**: Generate a strong password (save it securely)
   - **Region**: Choose closest to your users
   - **Plan**: Free tier is sufficient for staging
5. Click **Create new project**
6. Wait 2-3 minutes for provisioning

### Step 1.2: Run Complete Database Schema

1. Navigate to **SQL Editor** in Supabase Dashboard
2. Click **New Query**
3. Open `/home/user/hello-claude/pricing-tool/supabase-schema.sql` locally
4. Copy entire file contents (1212 lines)
5. Paste into SQL Editor
6. Click **Run** or press `Cmd/Ctrl + Enter`
7. Verify success message appears

Expected output:
```
Success. No rows returned
```

### Step 1.3: Verify Database Tables

Run this query in SQL Editor:

```sql
-- Check all tables exist
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'products', 'quotes', 'quote_lines', 'uploads', 'events', 'item_options', 'option_values')
ORDER BY table_name;
```

Expected result: 8 tables with correct column counts:
- `events` (8 columns)
- `item_options` (13 columns)
- `option_values` (9 columns)
- `products` (8 columns)
- `quote_lines` (13 columns)
- `quotes` (16 columns)
- `uploads` (11 columns)
- `users` (4 columns)

### Step 1.4: Verify RLS is Enabled

```sql
-- Verify RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'products', 'quotes', 'quote_lines', 'uploads', 'events', 'item_options', 'option_values')
ORDER BY tablename;
```

Expected: All tables should show `rowsecurity = true`

### Step 1.5: Verify RLS Policies

```sql
-- Check all policies exist
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

Expected policy counts:
- `events`: 3 policies
- `item_options`: 5 policies
- `option_values`: 5 policies
- `products`: 6 policies
- `quote_lines`: 5 policies
- `quotes`: 6 policies
- `uploads`: 4 policies
- `users`: 2 policies

### Step 1.6: Verify Sample Data

```sql
-- Check sample products exist (including Phase 2 sample door)
SELECT sku, name, unit_price
FROM products
ORDER BY sku;
```

Expected: 6 sample products including:
- 5 basic products (studs, track, drywall, screws)
- 1 door with options (`DR-3080-20G`)

```sql
-- Check sample door has options configured
SELECT
  p.sku,
  io.code as option_code,
  io.label,
  io.required,
  COUNT(ov.id) as value_count
FROM products p
JOIN item_options io ON io.catalog_item_id = p.id
LEFT JOIN option_values ov ON ov.item_option_id = io.id
WHERE p.sku = 'DR-3080-20G'
GROUP BY p.sku, io.code, io.label, io.required, io.sort_order
ORDER BY io.sort_order;
```

Expected: 4 options (SIZE, COLOR, FINISH, HARDWARE) with their values

### Step 1.7: Verify Triggers and Functions

```sql
-- Verify triggers exist
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('products', 'quotes', 'quote_lines', 'item_options')
ORDER BY event_object_table, trigger_name;
```

Expected triggers:
- `products`: `set_updated_at`
- `quotes`: `set_quote_status_timestamps`
- `quote_lines`: `auto_line_number`, `calculate_extended_price`, `update_quote_totals_on_line_*` (3 triggers)
- `item_options`: `set_item_options_updated_at`

```sql
-- Verify validation function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'validate_product_options';
```

Expected: `validate_product_options` function exists

### Step 1.8: Create Admin and Sales Users

#### Create Admin User

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add User** → **Create new user**
3. Configure:
   - **Email**: `admin-staging@yourcompany.com` (use a real email you control)
   - **Auto Confirm User**: ✅ Checked
   - **Auto Generate Password**: ✅ Checked (or set a password)
4. Click **Create user**
5. **Copy the User ID (UUID)** - you'll need it next

#### Assign Admin Role

Go to SQL Editor and run:

```sql
-- Replace 'USER_ID_HERE' with the UUID you just copied
INSERT INTO public.users (id, email, role)
VALUES
  ('USER_ID_HERE', 'admin-staging@yourcompany.com', 'ADMIN')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
```

#### Create Sales User (Optional)

Repeat the process above with:
- Email: `sales-staging@yourcompany.com`
- Role: `SALES`

### Step 1.9: Get Supabase API Credentials

1. Go to **Project Settings** → **API**
2. Copy these values (you'll need them for Vercel):
   - **Project URL**: `https://[your-project-id].supabase.co`
   - **anon public key**: Long string starting with `eyJhbGc...`

Keep these values secure - paste them in a temporary note.

### Step 1.10: Configure Authentication Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add to **Redirect URLs** (we'll update these after Vercel deployment):
   ```
   http://localhost:3000/**
   ```
3. Leave **Site URL** as default for now

---

## Phase 2: Vercel Staging Deployment

### Step 2.1: Create Vercel Project

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select your GitHub repository
4. Configure import:
   - **Project Name**: `pricing-tool-staging`
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `pricing-tool`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

#### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to project
cd /home/user/hello-claude/pricing-tool

# Login to Vercel
vercel login

# Deploy (will prompt for configuration)
vercel
```

### Step 2.2: Configure Environment Variables in Vercel

**Before deploying**, add environment variables:

1. In the Vercel import screen, click **Environment Variables**
2. Add these variables:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL from Step 1.9 | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key from Step 1.9 | Production, Preview, Development |

**Important**: Select all three environments (Production, Preview, Development) for both variables.

### Step 2.3: Deploy to Vercel

1. Click **Deploy** button
2. Wait 2-3 minutes for build to complete
3. Monitor build logs for any errors
4. Once deployed, you'll see: **Visit** button

### Step 2.4: Get Staging URL

1. Click **Visit** to open your deployed app
2. Copy the deployment URL (e.g., `https://pricing-tool-staging-abc123.vercel.app`)
3. Test that the app loads (you should see login page)

---

## Phase 3: Connect Supabase to Vercel

### Step 3.1: Update Supabase Redirect URLs

1. Go back to Supabase Dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Update **Redirect URLs** to include:
   ```
   https://pricing-tool-staging-abc123.vercel.app/**
   http://localhost:3000/**
   ```
   (Replace with your actual Vercel URL)
4. Update **Site URL** to:
   ```
   https://pricing-tool-staging-abc123.vercel.app
   ```
5. Click **Save**

### Step 3.2: Test Authentication Flow

1. Visit your staging URL: `https://pricing-tool-staging-abc123.vercel.app`
2. Should redirect to `/login`
3. Enter your admin email: `admin-staging@yourcompany.com`
4. Click **Send Magic Link**
5. Check email for magic link
6. Click link in email
7. Should redirect to app and show authenticated state

**Troubleshooting**:
- No email received? Check Supabase **Authentication** → **Email Templates** → ensure "Confirm signup" is enabled
- Check spam folder
- Try a different email provider (Gmail, Outlook)

---

## Phase 4: Testing Phase 1 Features

### Step 4.1: Test Quote Creation

1. Log in as admin user
2. Navigate to `/quotes/new` (or click "New Quote" button)
3. Fill in customer information:
   - **Customer Name**: `Test Customer`
   - **Email**: `test@example.com`
   - **Phone**: `555-1234`
4. Click **Create Quote**
5. Verify quote is created and shows `draft` status

### Step 4.2: Test Quote Line Items

1. In the quote you just created, click **Add Line Item**
2. Fill in:
   - **Description**: `Test Product`
   - **Quantity**: `10`
   - **Unit**: `EA`
   - **Unit Price**: `25.00`
3. Click **Save**
4. Verify:
   - Extended price shows `$250.00`
   - Quote subtotal updates to `$250.00`
   - Quote total updates to `$250.00`

### Step 4.3: Test Quote Totals Auto-Calculation

1. Add another line item:
   - Description: `Another Item`
   - Quantity: `5`
   - Unit Price: `10.00`
2. Verify:
   - Extended price: `$50.00`
   - Quote subtotal: `$300.00`
   - Quote total: `$300.00`

### Step 4.4: Test Quote Status Changes

1. Click **Submit Quote** (or change status to 'submitted')
2. Verify:
   - Status changes to `submitted`
   - `submitted_at` timestamp is set
3. Change status to `sent`
4. Verify:
   - `sent_at` timestamp is set
   - `expires_at` is set to 14 days from now

### Step 4.5: Test Catalog Products

1. Navigate to `/catalog`
2. Verify sample products are visible:
   - Steel studs
   - Track
   - Drywall
   - Screws
   - Door with options
3. Test search functionality
4. Click on a product to view details

### Step 4.6: Test Upload Tracking (UI permitting)

If upload UI is implemented:
1. Create a new quote
2. Upload a test file (PDF, image, or spreadsheet)
3. Verify upload record is created
4. Check `uploads` table has new record

### Step 4.7: Test Event Logging

Run in SQL Editor:

```sql
-- Check events are being logged
SELECT event_type, COUNT(*) as count
FROM events
GROUP BY event_type
ORDER BY count DESC;
```

Expected: Events like `quote_created`, `quote_viewed`, etc.

### Step 4.8: Test RLS Permissions

#### As Admin User:
- [ ] Can view all quotes
- [ ] Can create quotes
- [ ] Can edit quotes
- [ ] Can delete quotes
- [ ] Can view/edit products
- [ ] Can view/edit catalog

#### As Sales User (if created):
- [ ] Can view all quotes
- [ ] Can create quotes
- [ ] Cannot edit other users' quotes (unless policy allows)
- [ ] Can view products (read-only)
- [ ] Cannot edit/delete products

---

## Phase 5: Testing Phase 2 Features (Item Options)

### Step 5.1: Verify Sample Door Product with Options

1. Navigate to `/catalog`
2. Search for `DR-3080-20G` or `Commercial Steel Door`
3. Click on the product
4. Verify options are displayed:
   - **Size** (required): 30x80, 36x80, 36x84, 42x84
   - **Color** (required): White, Black, Gray, Custom
   - **Finish** (optional): Primed, Powder Coated, Galvanized
   - **Hardware** (required): Various options

### Step 5.2: Test Option Selection and Pricing

1. Create a new quote
2. Add the door product as a line item
3. Select options:
   - Size: `36x80` (+$25)
   - Color: `black` (+$15)
   - Finish: `powder_coat` (+$45)
   - Hardware: `lever_satin` (+$45)
4. Verify unit price calculation:
   - Base price: $425.00
   - Total with options: $555.00
5. Set quantity to `2`
6. Verify extended price: $1,110.00

### Step 5.3: Test Required Options Validation

1. Try to add door product without selecting required options
2. Verify validation error appears
3. Select all required options
4. Verify item is added successfully

### Step 5.4: Test Option Validation Function

Run in SQL Editor:

```sql
-- Test valid options
SELECT * FROM validate_product_options(
  (SELECT id FROM products WHERE sku = 'DR-3080-20G'),
  '{"SIZE": "36x80", "COLOR": "white", "HARDWARE": "lever_satin"}'::jsonb
);
```

Expected: `is_valid = true, errors = {}`

```sql
-- Test invalid options (missing required field)
SELECT * FROM validate_product_options(
  (SELECT id FROM products WHERE sku = 'DR-3080-20G'),
  '{"SIZE": "36x80", "COLOR": "white"}'::jsonb
);
```

Expected: `is_valid = false, errors = {"Required option \"Hardware Package\" is missing"}`

```sql
-- Test invalid option value
SELECT * FROM validate_product_options(
  (SELECT id FROM products WHERE sku = 'DR-3080-20G'),
  '{"SIZE": "invalid-size", "COLOR": "white", "HARDWARE": "lever_satin"}'::jsonb
);
```

Expected: `is_valid = false, errors = {"Invalid value \"invalid-size\" for option \"Door Size\""}`

### Step 5.5: Test Creating Products with Options (Admin Only)

If admin UI is implemented for creating products with options:

1. Log in as admin
2. Navigate to product creation page
3. Create a new product
4. Add an option (e.g., "SIZE")
5. Configure option:
   - Type: `select`
   - Required: `true`
   - Add values with price deltas
6. Save and verify

### Step 5.6: Test Options in Quote Lines

1. Create a quote with a door product
2. Select various option combinations
3. Verify `options_json` is saved correctly in `quote_lines` table:

```sql
-- Check options_json structure
SELECT
  ql.id,
  ql.description,
  ql.options_json,
  ql.unit_price,
  p.unit_price as base_price
FROM quote_lines ql
JOIN products p ON p.id = ql.catalog_item_id
WHERE p.sku = 'DR-3080-20G'
ORDER BY ql.created_at DESC
LIMIT 5;
```

Expected: `options_json` contains selected options in correct format

---

## Phase 6: Performance and Load Testing

### Step 6.1: Test Query Performance

Run these queries and verify they execute quickly (< 100ms):

```sql
-- Test quote retrieval with lines (should use indexes)
EXPLAIN ANALYZE
SELECT q.*,
       json_agg(ql.*) as lines
FROM quotes q
LEFT JOIN quote_lines ql ON ql.quote_id = q.id
WHERE q.id = (SELECT id FROM quotes LIMIT 1)
GROUP BY q.id;
```

```sql
-- Test product search with options (should use indexes)
EXPLAIN ANALYZE
SELECT p.*,
       json_agg(io.*) as options
FROM products p
LEFT JOIN item_options io ON io.catalog_item_id = p.id
WHERE p.sku LIKE 'DR-%'
GROUP BY p.id;
```

### Step 6.2: Test Bulk Operations

1. Create a quote with 50+ line items
2. Verify totals calculate correctly
3. Verify page loads quickly

### Step 6.3: Monitor Vercel Analytics

1. Go to Vercel Dashboard → Your Project → Analytics
2. Check:
   - Page load times
   - Core Web Vitals
   - Error rate

### Step 6.4: Monitor Supabase Metrics

1. Go to Supabase Dashboard → Reports
2. Check:
   - API requests
   - Database connections
   - Error rates

---

## Phase 7: Staging Environment Validation

### Step 7.1: Complete Feature Checklist

**Phase 1 Features:**
- [ ] User authentication (magic link)
- [ ] Quote creation and management
- [ ] Quote line items with auto-calculation
- [ ] Quote status workflow
- [ ] Event logging/audit trail
- [ ] Upload tracking
- [ ] Product catalog
- [ ] RLS permissions working correctly

**Phase 2 Features:**
- [ ] Product options (item_options table)
- [ ] Option values with pricing
- [ ] Option validation
- [ ] Options displayed in UI
- [ ] Option selection updates pricing
- [ ] Required options enforced
- [ ] options_json stored correctly in quote_lines

### Step 7.2: Security Verification

- [ ] RLS enabled on all tables
- [ ] Policies tested and working
- [ ] No sensitive data in client-side code
- [ ] Environment variables not exposed
- [ ] HTTPS enforced (Vercel default)
- [ ] CORS configured properly

### Step 7.3: Data Integrity Checks

```sql
-- Verify no orphaned records
SELECT 'Orphaned quote_lines' as check_type, COUNT(*) as count
FROM quote_lines ql
WHERE NOT EXISTS (SELECT 1 FROM quotes q WHERE q.id = ql.quote_id)
UNION ALL
SELECT 'Orphaned option_values', COUNT(*)
FROM option_values ov
WHERE NOT EXISTS (SELECT 1 FROM item_options io WHERE io.id = ov.item_option_id)
UNION ALL
SELECT 'Orphaned item_options', COUNT(*)
FROM item_options io
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = io.catalog_item_id);
```

Expected: All counts should be 0

### Step 7.4: Backup Staging Database

1. Go to Supabase Dashboard → Database → Backups
2. Click **Create backup** (manual backup)
3. Name it: `staging-deployment-phase1-phase2-baseline`
4. Verify backup is created

---

## Phase 8: Documentation and Handoff

### Step 8.1: Document Staging Environment

Create a document with:
- Staging URL
- Supabase project ID
- Vercel project name
- Admin user email
- Sales user email (if created)
- Database backup location

### Step 8.2: Update Team

Share with team:
- Staging URL for testing
- Test user credentials
- Features to test
- How to report issues

### Step 8.3: Create Issue Template

Prepare issue template for bug reports:
```markdown
## Bug Report

**Environment**: Staging
**URL**: [staging URL]
**User Role**: [Admin/Sales]
**Phase**: [Phase 1/Phase 2]

**Steps to Reproduce**:
1.
2.
3.

**Expected Behavior**:

**Actual Behavior**:

**Screenshots**:

**Browser/Device**:
```

---

## Phase 9: Monitoring Plan

### Step 9.1: Set Up Alerts

1. Vercel:
   - Go to Project Settings → Notifications
   - Enable deployment failure alerts
   - Enable error rate alerts

2. Supabase:
   - Go to Project Settings → Notifications
   - Enable database connection alerts
   - Enable API rate limit alerts

### Step 9.2: Regular Health Checks

Schedule weekly checks:
- [ ] Test authentication flow
- [ ] Create test quote
- [ ] Check database size
- [ ] Review error logs
- [ ] Monitor API usage

---

## Troubleshooting Guide

### Common Issues

#### Build Fails in Vercel

**Symptom**: Deployment fails during build
**Solution**:
1. Check build logs in Vercel
2. Run `npm run build` locally
3. Fix TypeScript errors
4. Ensure all dependencies are in `package.json`
5. Redeploy

#### "Failed to fetch products"

**Symptom**: Products don't load in UI
**Solution**:
1. Check environment variables in Vercel
2. Verify Supabase URL and key are correct
3. Check RLS policies in Supabase
4. Verify user has correct role in `users` table

#### Magic Link Authentication Not Working

**Symptom**: No email received or link doesn't work
**Solution**:
1. Check Supabase redirect URLs include staging URL
2. Verify email template is enabled
3. Check spam folder
4. Try different email provider

#### Options Not Showing for Products

**Symptom**: Product options don't appear in UI
**Solution**:
1. Verify `item_options` and `option_values` exist for product
2. Check `active = true` on options
3. Verify RLS policies allow SALES/ADMIN to view options
4. Check browser console for errors

#### Quote Totals Not Calculating

**Symptom**: Subtotal/total don't update when adding lines
**Solution**:
1. Verify triggers are installed (`update_quote_totals_on_line_*`)
2. Check quote_lines have correct `extended_price`
3. Run manual update:
   ```sql
   UPDATE quotes
   SET subtotal = (
     SELECT COALESCE(SUM(extended_price), 0)
     FROM quote_lines
     WHERE quote_id = quotes.id
   ),
   total = subtotal + tax
   WHERE id = 'YOUR_QUOTE_ID';
   ```

#### Option Validation Errors

**Symptom**: Cannot add product with options
**Solution**:
1. Verify all required options are selected
2. Check option values are valid
3. Test validation function directly in SQL
4. Review constraints in `item_options`

---

## Rollback Plan

If deployment fails critically:

### Step 1: Revert Vercel Deployment

1. Go to Vercel Dashboard → Deployments
2. Find last working deployment
3. Click **•••** → **Promote to Production**

### Step 2: Restore Supabase Backup

1. Go to Supabase Dashboard → Database → Backups
2. Select backup from before deployment
3. Click **Restore**
4. Wait for restore to complete

### Step 3: Notify Team

Send notification:
- Staging environment rolled back
- Reason for rollback
- Timeline for fix
- Testing needed before redeployment

---

## Next Steps After Successful Staging

1. **Gather Feedback**: Have team test all features
2. **Fix Issues**: Address any bugs found in staging
3. **Performance Optimization**: If needed based on metrics
4. **Security Audit**: Review all RLS policies
5. **Production Planning**: Prepare production deployment checklist
6. **Documentation**: Update user guides with new features

---

## Success Criteria

Staging deployment is successful when:

- [ ] All database tables created correctly
- [ ] All RLS policies active and tested
- [ ] Authentication working (magic link)
- [ ] All Phase 1 features tested and working
- [ ] All Phase 2 features tested and working
- [ ] No critical errors in logs
- [ ] Performance is acceptable (< 2s page loads)
- [ ] Backup created and verified
- [ ] Team has access and test credentials
- [ ] Monitoring and alerts configured

---

## Appendix

### A. Environment Variables Reference

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Project Settings → API → anon/public key |

### B. SQL Quick Reference

```sql
-- List all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- Count records in all tables
SELECT
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'quotes', COUNT(*) FROM quotes
UNION ALL SELECT 'quote_lines', COUNT(*) FROM quote_lines
UNION ALL SELECT 'uploads', COUNT(*) FROM uploads
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'item_options', COUNT(*) FROM item_options
UNION ALL SELECT 'option_values', COUNT(*) FROM option_values;

-- View recent events
SELECT event_type, COUNT(*) as count, MAX(created_at) as last_occurrence
FROM events
GROUP BY event_type
ORDER BY last_occurrence DESC;
```

### C. Vercel CLI Commands

```bash
# View logs
vercel logs [deployment-url]

# List deployments
vercel ls

# Remove deployment
vercel rm [deployment-name]

# View environment variables
vercel env ls

# Pull environment to local
vercel env pull
```

### D. Support Contacts

- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
- **Project Repository**: [GitHub URL]
- **Team Lead**: [Contact info]

---

**Document Version**: 1.0
**Last Updated**: 2025-11-13
**Maintained By**: Deployment Team
