# Deployment Guide

Step-by-step guide to deploy the Pricing Tool to Vercel with Supabase integration.

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Supabase project (completed SUPABASE_SETUP.md)
- Git repository pushed to GitHub

## Step 1: Prepare Supabase

1. **Complete Database Setup**
   - Follow `SUPABASE_SETUP.md` to create tables and RLS policies
   - Add admin and sales users to the `users` table
   - Test authentication with magic link

2. **Get API Credentials**
   - Go to Supabase Dashboard → Project Settings → API
   - Copy **Project URL** (e.g., `https://abcdefg.supabase.co`)
   - Copy **anon/public key** (starts with `eyJhbGc...`)

3. **Configure Email Templates (Optional)**
   - Go to Authentication → Email Templates
   - Customize the "Magic Link" email template
   - Add your branding/logo

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard

1. **Import Repository**
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select your GitHub repository
   - Select the `pricing-tool` folder as the root directory

2. **Configure Build Settings**
   - Framework Preset: **Next.js**
   - Root Directory: `pricing-tool`
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

3. **Add Environment Variables**
   Click "Environment Variables" and add:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - Visit your app at `https://your-app.vercel.app`

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to project
cd pricing-tool

# Login to Vercel
vercel login

# Deploy
vercel

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Deploy to production
vercel --prod
```

## Step 3: Configure Supabase Redirect URLs

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your Vercel deployment URL to **Redirect URLs**:
   ```
   https://your-app.vercel.app/catalog
   ```
3. Add to **Site URL**:
   ```
   https://your-app.vercel.app
   ```

## Step 4: Seed Initial Data

### Option 1: Via Admin Panel

1. Visit `https://your-app.vercel.app/login`
2. Sign in with your admin email
3. Go to `/admin`
4. Upload a CSV file with initial products

### Option 2: Via SQL Editor

Run this in Supabase SQL Editor:

```sql
INSERT INTO public.products (sku, name, unit_type, unit_price, aliases)
VALUES
  ('STD-20G-8FT', '20 Gauge Steel Stud 8ft', 'EA', 3.50, ARRAY['stud', '20ga stud']),
  ('STD-20G-10FT', '20 Gauge Steel Stud 10ft', 'EA', 4.25, ARRAY['stud', '20ga stud']),
  ('TRK-20G-10FT', '20 Gauge Steel Track 10ft', 'EA', 4.75, ARRAY['track', '20ga track']),
  ('DRY-SHEETROCK-4X8', 'Drywall Sheetrock 4x8 1/2"', 'EA', 12.00, ARRAY['drywall', 'sheetrock']),
  ('SCREW-DRYWALL-1000', 'Drywall Screws 1-1/4" (1000ct)', 'BOX', 8.50, ARRAY['screws', 'fasteners'])
ON CONFLICT (sku) DO NOTHING;
```

## Step 5: Generate PWA Icons

The app includes a placeholder SVG icon. Generate PNG icons for full PWA support:

```bash
# Using ImageMagick
convert -background none -resize 192x192 public/icon.svg public/icon-192.png
convert -background none -resize 512x512 public/icon.svg public/icon-512.png

# Or use https://realfavicongenerator.net/
```

Redeploy after adding icons:
```bash
vercel --prod
```

## Step 6: Test the Deployment

### Basic Functionality
- [ ] Visit homepage (should redirect to /catalog)
- [ ] Search for products
- [ ] Click "Sync" to load products from Supabase
- [ ] Search works offline after sync
- [ ] Voice input button appears and works
- [ ] Product detail page loads
- [ ] Calculator computes correctly
- [ ] Copy button works

### Authentication
- [ ] Visit /login
- [ ] Enter admin email
- [ ] Receive magic link email
- [ ] Click link and authenticate
- [ ] Redirects to /catalog

### Admin Functions
- [ ] Visit /admin (should require ADMIN role)
- [ ] Upload CSV file
- [ ] Products appear in catalog
- [ ] Sales role users cannot access /admin

### PWA
- [ ] Visit on mobile browser
- [ ] "Add to Home Screen" prompt appears
- [ ] Install app
- [ ] App opens in standalone mode
- [ ] Works offline after initial sync

## Step 7: Custom Domain (Optional)

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your custom domain (e.g., `pricing.yourcompany.com`)
3. Follow DNS configuration instructions
4. Update Supabase redirect URLs with new domain

## Troubleshooting

### "Failed to fetch products"
- Check environment variables are set correctly
- Verify Supabase URL and key
- Check Supabase RLS policies are active
- Ensure user has a role in `users` table

### "Access Denied" on /admin
- Verify user has `ADMIN` role in `users` table
- Check `auth.uid()` matches `users.id`
- Sign out and sign in again

### Magic link not working
- Check Supabase redirect URLs include your domain
- Verify email template is enabled
- Check spam folder
- Try different email provider

### PWA not installing
- Ensure site uses HTTPS (Vercel provides this)
- Generate PNG icons (SVG doesn't work for install)
- Check manifest.webmanifest is accessible
- Run Lighthouse audit in Chrome DevTools

### Service worker errors
- Service workers only work on HTTPS or localhost
- Clear browser cache and reload
- Check browser console for errors
- Unregister old service workers in DevTools

## Monitoring and Maintenance

### Vercel Analytics
- Go to Project → Analytics
- Monitor page views, performance
- Track Core Web Vitals

### Supabase Logs
- Go to Supabase → Logs
- Monitor API usage
- Check for errors

### Regular Updates
```bash
# Update dependencies
npm update

# Test locally
npm run dev

# Deploy to production
vercel --prod
```

## Cost Estimation

### Free Tier Usage
- **Vercel**: Unlimited personal projects, 100GB bandwidth/month
- **Supabase**: 500MB database, 2GB bandwidth, 50,000 auth users

### Potential Costs
- Vercel Pro ($20/mo): Team collaboration, more bandwidth
- Supabase Pro ($25/mo): More storage, better performance
- Custom domain ($10-15/year): Optional

**Total for small team:** $0-45/month depending on usage

## Security Checklist

- [x] Environment variables not in code
- [x] RLS enabled on all tables
- [x] HTTPS enforced (Vercel default)
- [x] API keys use anon key (not service role)
- [x] CORS configured in Supabase
- [x] Magic link authentication only
- [ ] Consider adding rate limiting
- [ ] Monitor for suspicious activity

## Next Steps

After successful deployment:

1. **Train your team** on using the app
2. **Import full product catalog** via CSV
3. **Test on real devices** (iOS, Android)
4. **Collect feedback** and iterate
5. **Monitor usage** and optimize performance

Congratulations! Your pricing tool is now live! 🎉
