# Quote Management System - Migration Guide

## 🚀 Overview

This migration adds a complete quote management system to your pricing tool:
- Customer tracking with custom markups
- Multi-product quote builder
- Quote history and search
- Auto-generated quote numbers
- Markup hierarchy (customer → product → global)

---

## 📋 Prerequisites

- Existing pricing tool deployed with base schema
- Access to Supabase SQL Editor
- Admin account in the system

---

## 🗄️ Step 1: Run Database Migration

### 1.1 Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**

### 1.2 Execute Migration

1. Open `/migrations/002_quote_management.sql` from your project
2. Copy the entire SQL script
3. Paste into the Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Wait for "Success" message

The migration creates:
- `customers` table - Contact info and default markups
- `quotes` table - Quote headers with status tracking
- `quote_items` table - Individual line items
- `quote_summary` view - Optimized query view
- RLS policies - Secure access control
- Triggers - Auto-update timestamps and quote numbers
- Functions - `generate_quote_number()` and `set_quote_number()`

### 1.3 Verify Migration Success

Run this verification query:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('customers', 'quotes', 'quote_items');
```

**Expected result:** 3 rows

```sql
-- Test quote number generation
SELECT public.generate_quote_number();
```

**Expected result:** `Q-2025-001`

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('customers', 'quotes', 'quote_items');
```

**Expected result:** All show `rowsecurity = true`

---

## 🧪 Step 2: Test the New Features

### 2.1 Test Voice Integration Fix

1. Navigate to `/catalog`
2. Search for any product
3. Click product to open detail page
4. Click microphone icon
5. Say: **"fourteen feet markup twenty five"**
6. ✅ Verify: Calculator updates with qty=14, markup=25%

### 2.2 Test Calculator Enhancements

1. On any product detail page:
   - ✅ Preset length buttons appear (8′, 10′, 12′, 14′, 16′, 20′)
   - ✅ Markup preset buttons appear (Standard 25%, Contractor 20%, etc.)
   - ✅ Copy button has dropdown with 4 format options
2. Click preset buttons → values update instantly
3. Click copy dropdown → see "Price Only", "SMS Format", "Full Details", "Email Format"

### 2.3 Test Customer Creation

1. Navigate to `/quote/new`
2. Click **+ New Customer**
3. Fill in:
   - Name: "Test Customer Inc"
   - Phone: "555-1234"
   - Email: "test@example.com"
   - Default Markup: 30%
4. Click **Create Customer**
5. ✅ Verify: Customer appears selected with green background
6. ✅ Verify: Shows "Customer markup: 30%"

### 2.4 Test Multi-Product Quote

1. On `/quote/new` page:
2. Click **+ Add Product**
3. Search and select first product
4. Adjust quantity to 10, markup to 25%
5. Click **+ Add Product** again
6. Add second product with qty 20, markup 30%
7. ✅ Verify: Both products listed with line totals
8. ✅ Verify: Quote total updates in real-time
9. Add notes: "Test quote for steel materials"
10. Change status to **"SENT"**
11. Click **Save Quote**
12. ✅ Verify: Redirects to quote detail page
13. ✅ Verify: Quote number is Q-2025-001 (or next in sequence)

### 2.5 Test Quote History

1. Navigate to `/quotes`
2. ✅ Verify: Your test quote appears in list
3. Try search: Type "Test Customer"
4. ✅ Verify: Quote filters to matching results
5. Try status filter: Select "SENT"
6. ✅ Verify: Only SENT quotes show
7. Check stats at bottom:
   - Total Quotes: 1
   - Accepted: 0
   - Pending: 1
   - Total Value: (your quote total)

### 2.6 Test Quote Editing

1. Click on your test quote from list
2. ✅ Verify: Full quote details display
3. Click **Edit** button
4. Change first item quantity to 15
5. ✅ Verify: Line total recalculates
6. ✅ Verify: Quote total updates
7. Change status to **"ACCEPTED"**
8. Update notes: "Updated quantities"
9. Click **Save Changes**
10. ✅ Verify: Changes persist after reload

### 2.7 Test Markup Hierarchy

#### Test 1: Customer Markup (highest priority)
1. Create customer with 40% default markup
2. Create quote for this customer
3. Add product (with or without product markup)
4. ✅ Verify: Initial markup is 40%

#### Test 2: Product Markup (middle priority)
1. In Supabase SQL Editor, set product markup:
   ```sql
   UPDATE products SET default_markup = 35
   WHERE sku = 'YOUR-PRODUCT-SKU';
   ```
2. Create quote WITHOUT customer
3. Add that product
4. ✅ Verify: Initial markup is 35%

#### Test 3: Global Default (lowest priority)
1. Create quote without customer
2. Add product without product markup
3. ✅ Verify: Initial markup is 25% (global default)

---

## 🎯 Step 3: Feature Walkthrough

### Customer Management
- **Location**: Integrated into `/quote/new`
- **Actions**: Create, search, select
- **Features**: Default markup per customer

### Quote Builder
- **Location**: `/quote/new`
- **Features**:
  - Multi-product line items
  - Real-time total calculations
  - Customer association (optional)
  - Status selection (Draft, Sent, Accepted, Rejected, Expired)
  - Internal notes

### Quote History
- **Location**: `/quotes`
- **Features**:
  - List all quotes
  - Search by quote number, customer, notes
  - Filter by status
  - Summary statistics
  - Click to view/edit

### Quote Detail/Edit
- **Location**: `/quote/[id]`
- **Features**:
  - View full quote details
  - Edit mode for changes
  - Add/remove line items
  - Update quantities and markups
  - Change status
  - Delete quote

---

## 🔧 Configuration Options

### Change Global Default Markup

Edit `pricing-tool/lib/pricing.ts`:
```typescript
export const DEFAULT_GLOBAL_MARKUP = 25 // Change to your default
```

### Customize Markup Presets

Edit `pricing-tool/components/Calculator.tsx`:
```typescript
const markupPresets = [
  { label: "Standard", value: 25 },      // Change these
  { label: "Contractor", value: 20 },
  { label: "Preferred", value: 15 },
  { label: "Retail", value: 35 },
]
```

### Customize Preset Lengths

Edit `pricing-tool/components/Calculator.tsx`:
```typescript
const presetLengths = [8, 10, 12, 14, 16, 20] // Change to your common lengths
```

---

## 🔐 Security & Permissions

### Row Level Security (RLS)

All tables are protected by RLS policies:

**Customers:**
- SALES + ADMIN: Can view, create, update
- ADMIN: Can delete

**Quotes:**
- Users: Can view their own quotes
- ADMIN: Can view all quotes
- Users: Can update/delete their own DRAFT quotes
- ADMIN: Can update/delete any quote

**Quote Items:**
- Inherit permissions from parent quote
- Cascade delete when quote is deleted

### Testing Permissions

```sql
-- Check your user's role
SELECT id, email, role FROM users WHERE email = 'your@email.com';

-- If role is missing or wrong, update it:
UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.com';
```

---

## 🐛 Troubleshooting

### Issue: "Permission denied for table customers"
**Cause**: User doesn't have SALES or ADMIN role
**Fix**:
```sql
-- Check roles
SELECT * FROM users WHERE id = auth.uid();

-- Add role if missing
UPDATE users SET role = 'SALES' WHERE id = auth.uid();
```

### Issue: Quote number stays blank or shows error
**Cause**: Trigger not installed correctly
**Fix**:
```sql
-- Verify trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'set_quote_number';

-- If missing, re-run migration lines 124-136
```

### Issue: Calculator voice input doesn't work
**Cause**: Browser cache or unsupported browser
**Fix**:
- Clear cache and reload
- Use Chrome, Edge, or Safari (Firefox doesn't support Web Speech API well)
- Ensure microphone permissions are granted

### Issue: "Failed to create quote"
**Check**:
1. Browser console for errors
2. Supabase dashboard → Logs → check for RLS denials
3. Verify user is authenticated: check `/profile` or similar

### Issue: Totals don't match line items
**Fix**:
```sql
-- Recalculate a quote's totals
UPDATE quotes
SET subtotal = (
  SELECT SUM(cost) FROM quote_items WHERE quote_id = 'YOUR-QUOTE-ID'
),
total = (
  SELECT SUM(price) FROM quote_items WHERE quote_id = 'YOUR-QUOTE-ID'
)
WHERE id = 'YOUR-QUOTE-ID';
```

---

## 📊 Data Model

### Entity Relationships

```
customers (1) -----> (many) quotes
quotes (1) -----> (many) quote_items
quote_items (many) -----> (1) products
quotes (many) -----> (1) users (creator)
```

### Key Fields

**customers**
- `default_markup`: Customer-specific markup percentage

**quotes**
- `quote_number`: Auto-generated (e.g., Q-2025-001)
- `status`: DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED
- `customer_id`: Optional (for quick quotes)
- `subtotal`: Sum of all item costs
- `total`: Sum of all item prices

**quote_items**
- `unit_price`: Snapshot at time of quote (doesn't change if product price changes)
- `markup_pct`: Markup used for this line item
- `cost`, `price`, `profit`: Pre-calculated for performance

---

## 🚀 What's Next?

After successful migration:

1. **Import Real Customers**
   - Add your frequent customers with default markups
   - Saves time when creating quotes

2. **Set Product Markups**
   - Identify products that always get same markup
   - Set `default_markup` on those products

3. **Train Your Team**
   - Show sales reps the new quote workflow
   - Demonstrate voice input and preset buttons

4. **Optional Enhancements**
   - Add PDF export for quotes (see roadmap)
   - Email integration to send quotes
   - Analytics dashboard for quote tracking

---

## 📈 Migration Summary

### What Changed
- ✅ Fixed voice input bug on product pages
- ✅ Added preset buttons to calculator
- ✅ Added multiple copy formats
- ✅ Created customer management system
- ✅ Built multi-product quote builder
- ✅ Added quote history and search
- ✅ Implemented markup hierarchy
- ✅ Auto-generated quote numbers

### Database Changes
- ✅ 3 new tables: customers, quotes, quote_items
- ✅ 1 view: quote_summary
- ✅ 2 functions: generate_quote_number(), set_quote_number()
- ✅ 15+ RLS policies for secure access
- ✅ 1 new column: products.default_markup

### Files Modified/Created
- Modified: Calculator.tsx, pricing.ts, app/page.tsx, item/[id]/page.tsx
- Created: lib/types.ts, lib/quotes.ts, CustomerSelect.tsx
- Created: app/quote/new/page.tsx, app/quotes/page.tsx, app/quote/[id]/page.tsx
- Created: migrations/002_quote_management.sql

---

## ✅ Verification Checklist

Before going live, verify:

- [ ] Database migration completed without errors
- [ ] All 3 tables exist (customers, quotes, quote_items)
- [ ] RLS enabled on all tables
- [ ] Quote numbering works (tested with SELECT)
- [ ] Voice input updates calculator
- [ ] Preset buttons work
- [ ] Can create customer with markup
- [ ] Can create multi-product quote
- [ ] Quote saves with auto-generated number
- [ ] Quote list displays correctly
- [ ] Can edit existing quote
- [ ] Can search and filter quotes
- [ ] Markup hierarchy works (customer > product > global)
- [ ] Copy dropdown has all 4 formats
- [ ] Home page shows all 4 navigation cards

---

## 🎉 Success!

Your pricing tool now has a complete quote management system!

**Key Benefits:**
- ✅ Track all quotes in one place
- ✅ Customer-specific pricing
- ✅ Faster quote creation with voice and presets
- ✅ Professional quote numbering
- ✅ Complete audit trail

Need help? Check troubleshooting section or review the test steps above.
