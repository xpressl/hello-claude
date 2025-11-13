# Supabase Setup Guide

## Step 1: Run the SQL Schema

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `supabase-schema.sql`
5. Click **Run** or press `Cmd/Ctrl + Enter`

This will create:
- ✅ `users` table with role-based access
- ✅ `products` table with pricing data
- ✅ RLS enabled on all tables
- ✅ Policies for ADMIN and SALES roles
- ✅ Sample product data (optional)

## Step 2: Add Users with Roles

### Option A: Using Supabase Dashboard

1. **Add Admin User:**
   - Go to **Authentication** → **Users**
   - Click **Add User** → **Create new user**
   - Enter admin email (e.g., `admin@yourcompany.com`)
   - Set a password or enable auto-confirm
   - Click **Create user**
   - Copy the user's UUID

2. **Insert Admin Role:**
   - Go to **Table Editor** → **users** table
   - Click **Insert** → **Insert row**
   - Paste the UUID in `id` field
   - Enter the email
   - Set `role` to `ADMIN`
   - Click **Save**

3. **Add Sales User:**
   - Repeat the same process
   - Set `role` to `SALES` instead

### Option B: Using SQL

Run this in the SQL Editor after creating auth users:

```sql
-- Replace these UUIDs with actual user IDs from Authentication → Users
INSERT INTO public.users (id, email, role)
VALUES
  ('your-admin-user-uuid-here', 'admin@yourcompany.com', 'ADMIN'),
  ('your-sales-user-uuid-here', 'sales@yourcompany.com', 'SALES')
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role;
```

## Step 3: Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Fill in your Supabase credentials:
   - Go to **Project Settings** → **API**
   - Copy **Project URL** → paste as `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon/public key** → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Example `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 4: Verify Setup

Run these queries in SQL Editor to verify:

### Check Tables Exist
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'products');
```

### Check RLS is Enabled
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users', 'products');
```

### Check Policies
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### View Sample Data
```sql
SELECT id, sku, name, unit_type, unit_price
FROM products
ORDER BY name;
```

### Test User Roles
```sql
SELECT id, email, role
FROM users
ORDER BY role;
```

## RLS Permissions Summary

### Phase 1: Core Tables

| Role    | Products SELECT | Products INSERT | Products UPDATE | Products DELETE |
|---------|-----------------|-----------------|-----------------|-----------------|
| ADMIN   | ✅              | ✅              | ✅              | ✅              |
| SALES   | ✅              | ❌              | ❌              | ❌              |
| Anonymous | ❌            | ❌              | ❌              | ❌              |

| Role    | Quotes SELECT | Quotes INSERT | Quotes UPDATE | Quotes DELETE |
|---------|---------------|---------------|---------------|---------------|
| ADMIN   | ✅ (all)      | ✅            | ✅            | ✅            |
| SALES   | ✅ (all)      | ✅            | ❌            | ❌            |
| Users   | ✅ (own)      | ✅            | ❌            | ❌            |
| Anonymous | ❌          | ✅            | ❌            | ❌            |

### Phase 2: Item Options Tables

| Role    | Item Options SELECT | Item Options INSERT | Item Options UPDATE | Item Options DELETE |
|---------|---------------------|---------------------|---------------------|---------------------|
| ADMIN   | ✅                  | ✅                  | ✅                  | ✅                  |
| SALES   | ✅                  | ❌                  | ❌                  | ❌                  |
| Anonymous | ❌                | ❌                  | ❌                  | ❌                  |

| Role    | Option Values SELECT | Option Values INSERT | Option Values UPDATE | Option Values DELETE |
|---------|----------------------|----------------------|----------------------|----------------------|
| ADMIN   | ✅                   | ✅                   | ✅                   | ✅                   |
| SALES   | ✅                   | ❌                   | ❌                   | ❌                   |
| Anonymous | ❌                 | ❌                   | ❌                   | ❌                   |

## Phase 2: Item Options System

Phase 2 introduces configurable product options with dynamic pricing.

### Tables Created

1. **item_options** - Defines available options for products (e.g., SIZE, COLOR, FINISH)
2. **option_values** - Predefined values for select-type options with price deltas

### Verify Phase 2 Tables

Run these queries after executing the full schema:

#### Check Phase 2 Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('item_options', 'option_values')
ORDER BY table_name;
```

Expected result: 2 tables

#### Check RLS is Enabled on Phase 2 Tables

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('item_options', 'option_values');
```

Expected: Both tables show `rowsecurity = true`

#### Check Phase 2 Policies

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('item_options', 'option_values')
ORDER BY tablename, policyname;
```

Expected: 5 policies per table (10 total)

#### View Sample Door Product with Options

```sql
SELECT
  p.sku,
  p.name,
  p.unit_price as base_price,
  io.code as option_code,
  io.label as option_label,
  io.type,
  io.required,
  ov.value,
  ov.label as value_label,
  ov.price_delta
FROM products p
JOIN item_options io ON io.catalog_item_id = p.id
LEFT JOIN option_values ov ON ov.item_option_id = io.id
WHERE p.sku = 'DR-3080-20G'
ORDER BY io.sort_order, ov.sort_order;
```

Expected: 4 options (SIZE, COLOR, FINISH, HARDWARE) with multiple values each

#### Test Option Validation Function

```sql
-- Test valid options (should return is_valid = true)
SELECT * FROM validate_product_options(
  (SELECT id FROM products WHERE sku = 'DR-3080-20G'),
  '{"SIZE": "36x80", "COLOR": "white", "HARDWARE": "lever_satin"}'::jsonb
);
```

Expected result:
```
is_valid | errors
---------|--------
true     | {}
```

```sql
-- Test invalid options (missing required field)
SELECT * FROM validate_product_options(
  (SELECT id FROM products WHERE sku = 'DR-3080-20G'),
  '{"SIZE": "36x80", "COLOR": "white"}'::jsonb
);
```

Expected result:
```
is_valid | errors
---------|--------
false    | {"Required option \"Hardware Package\" is missing"}
```

### Options Pricing Structure

The schema supports two pricing models:

1. **Value-level pricing**: Each option value has its own `price_delta`
   - Example: COLOR → "White" (+$0), "Black" (+$15), "Custom" (+$75)

2. **Option-level pricing**: The option itself has a `price_delta_type` and `price_delta_value`
   - `flat`: Add/subtract fixed amount
   - `percent`: Add/subtract percentage
   - `none`: No option-level delta (use value-level only)

### Sample Pricing Calculation

For a Commercial Steel Door with:
- Base price: **$425.00**
- SIZE: 36x80 (+**$25.00**)
- COLOR: black (+**$15.00**)
- FINISH: powder_coat (+**$45.00**)
- HARDWARE: lever_satin (+**$45.00**)

**Total unit price: $555.00**

This calculation should be performed in your application when creating quote line items.

### options_json Format in Quote Lines

When adding a product with options to a quote, store selections in `quote_lines.options_json`:

```json
{
  "SIZE": "36x80",
  "COLOR": "black",
  "FINISH": "powder_coat",
  "HARDWARE": "lever_satin"
}
```

The application should:
1. Validate options using `validate_product_options()` function
2. Calculate unit_price by summing base price + all price deltas
3. Store selected options in `options_json` column
4. Store calculated `unit_price` in `quote_lines.unit_price`

## Troubleshooting

### "relation does not exist" error
- Make sure you ran the schema SQL in the **public** schema
- Refresh the Table Editor page

### Can't see products after login
- Verify the user has a record in the `users` table
- Check that the `id` in `users` matches the `auth.users.id`
- Verify RLS policies are active

### Products not updating
- Make sure the logged-in user has `ADMIN` role in the `users` table
- Check browser console for authentication errors

## Next Steps

After completing setup:
1. Test authentication by logging in with your admin account
2. Try creating/editing products (should work for ADMIN)
3. Log in as SALES user and verify read-only access
4. Proceed with building the UI components
