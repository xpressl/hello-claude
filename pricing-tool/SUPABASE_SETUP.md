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

| Role    | Products SELECT | Products INSERT | Products UPDATE | Products DELETE |
|---------|-----------------|-----------------|-----------------|-----------------|
| ADMIN   | ✅              | ✅              | ✅              | ✅              |
| SALES   | ✅              | ❌              | ❌              | ❌              |
| Anonymous | ❌            | ❌              | ❌              | ❌              |

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
