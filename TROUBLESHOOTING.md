# Troubleshooting Common Issues

When things don't work, don't panic! Most issues are easy to fix. This guide covers the most common problems and how to solve them.

---

## Issue #1: "npm: command not found"

### What This Means
Node.js isn't installed or isn't in your system PATH.

### How to Fix

1. **Check if Node.js is installed:**
   ```bash
   node --version
   ```
   If you get an error, Node.js isn't installed.

2. **Install Node.js:**
   - Go to: https://nodejs.org
   - Download the LTS version
   - Run the installer
   - **Important**: Restart your terminal/command prompt after installing

3. **If it's still not working:**
   - Mac: Check if you need to add Node to your PATH
   - Windows: The installer should do this automatically
   - Try restarting your computer

---

## Issue #2: "Port 3000 is already in use"

### What This Means
Another program is using port 3000 (the default port for your software).

### How to Fix

**Option A: Use a Different Port**
```bash
npm run dev -- -p 3001
```
Now go to: http://localhost:3001

**Option B: Find and Stop the Other Program**

Mac/Linux:
```bash
lsof -ti:3000 | xargs kill
```

Windows:
```bash
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
```

---

## Issue #3: "Cannot connect to database" or "Invalid Supabase credentials"

### What This Means
Your `.env.local` file has incorrect Supabase credentials.

### How to Fix

1. **Check your `.env.local` file exists:**
   - It should be in the root folder: `/home/user/hello-claude/.env.local`
   - If it doesn't exist, create it (copy from `.env.example`)

2. **Verify your Supabase credentials:**
   - Go to: https://supabase.com
   - Open your project
   - Click "Project Settings" (gear icon)
   - Click "API"
   - Copy the correct values:
     - **Project URL** (looks like: `https://abc123.supabase.co`)
     - **anon public key** (long string)

3. **Update `.env.local`:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-key-here
   ```

4. **Make sure there are NO spaces around the `=` sign!**
   - ✅ Correct: `KEY=value`
   - ❌ Wrong: `KEY = value`

5. **Restart your dev server:**
   - Press `Ctrl+C` in the terminal
   - Run `npm run dev` again

---

## Issue #4: "Module not found" or "Cannot find package"

### What This Means
Dependencies (code libraries) aren't installed.

### How to Fix

1. **Install all dependencies:**
   ```bash
   npm install
   ```
   Wait for it to complete (2-5 minutes).

2. **If that doesn't work, delete and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Still not working? Check your Node.js version:**
   ```bash
   node --version
   ```
   You need at least v18.0.0. If you're on an older version, update Node.js.

---

## Issue #5: "Database table does not exist"

### What This Means
You haven't run the database migrations yet.

### How to Fix

1. **Run migrations to create tables:**
   ```bash
   npm run migrate
   ```

2. **If you get an error about migrations:**
   - Go to Supabase Dashboard
   - Click "SQL Editor" in the left sidebar
   - Look in the folder: `pricing-tool/supabase-migrations/`
   - Copy each `.sql` file's contents
   - Paste into Supabase SQL Editor
   - Click "Run" for each one

---

## Issue #6: "Build failed" or "Type error"

### What This Means
There's a TypeScript error in the code.

### How to Fix

1. **Check the error message:**
   - The terminal will show you which file has the error
   - And which line number

2. **Common fixes:**
   - **"Property does not exist"**: You might be trying to use a field that doesn't exist
   - **"Type 'X' is not assignable"**: There's a type mismatch

3. **If you didn't change any code:**
   - This shouldn't happen! The code should work as-is.
   - Try: `npm install` again
   - Or: `rm -rf node_modules && npm install`

4. **If you did change code:**
   - Look at the error message carefully
   - Google the error (this is what developers do!)
   - Or revert your changes

---

## Issue #7: "Cannot upload files" or "Storage error"

### What This Means
Supabase storage isn't configured properly.

### How to Fix

1. **Create a storage bucket:**
   - Go to Supabase Dashboard
   - Click "Storage" in the left sidebar
   - Click "Create a new bucket"
   - Name it: `quotes`
   - Make it "Public" (for now - you can change this later)
   - Click "Create"

2. **Set up storage policies:**
   - Click on the `quotes` bucket
   - Click "Policies"
   - Click "New Policy"
   - Use this template: "Allow public read access"
   - Save

3. **Update your code if needed:**
   - Look for: `pricing-tool/lib/upload-validation.ts`
   - Make sure the bucket name matches: `quotes`

---

## Issue #8: "Email not sending" (Resend)

### What This Means
Either Resend isn't configured, or there's an issue with your API key.

### How to Fix

1. **Check if Resend is configured:**
   - Look in `.env.local` for:
     ```
     RESEND_API_KEY=re_...
     ```
   - If it's missing, emails won't send (but the system will still work)

2. **Verify your API key:**
   - Go to: https://resend.com
   - Click "API Keys"
   - Make sure your key is active
   - If needed, create a new key

3. **Check your domain is verified:**
   - In Resend, click "Domains"
   - Your domain should show "Verified"
   - If not, follow the DNS setup instructions

4. **Check the logs:**
   - In Resend Dashboard, click "Logs"
   - You'll see if emails are being sent and any errors

5. **Test with their test domain first:**
   ```
   RESEND_FROM_EMAIL=onboarding@resend.dev
   ```
   This always works for testing!

---

## Issue #9: "OCR not working" (OpenAI)

### What This Means
OpenAI API isn't configured or there's an issue with your API key.

### How to Fix

1. **Check if OpenAI is configured:**
   - Look in `.env.local` for:
     ```
     OPENAI_API_KEY=sk-...
     ```

2. **Verify your API key:**
   - Go to: https://platform.openai.com/api-keys
   - Make sure your key exists and is active
   - If it doesn't work, create a new key

3. **Check your OpenAI account has credits:**
   - Go to: https://platform.openai.com/account/billing
   - Make sure you have a payment method added
   - Check your balance

4. **Test with a simple image first:**
   - Upload a clear, simple image with text
   - Check the browser console for errors (F12 → Console tab)

---

## Issue #10: "Vercel deployment failed"

### What This Means
Something went wrong when deploying to Vercel.

### How to Fix

1. **Check the error message in Vercel:**
   - Go to Vercel Dashboard
   - Click on your project
   - Click on the failed deployment
   - Read the error log

2. **Common issues:**
   - **Missing environment variables**: Add them in Vercel Settings
   - **Build error**: The code has a bug - fix it locally first
   - **Timeout**: Your build is taking too long - check for infinite loops

3. **Try building locally first:**
   ```bash
   npm run build
   ```
   If this fails, fix the errors before deploying.

4. **Check your Node.js version:**
   - Vercel uses Node 18 by default
   - If you need a different version, add to `package.json`:
     ```json
     "engines": {
       "node": "18.x"
     }
     ```

5. **Redeploy:**
   - In Vercel Dashboard, click "Redeploy"
   - Or push new code to GitHub (auto-deploys)

---

## Issue #11: "Git push rejected" or "403 Forbidden"

### What This Means
You don't have permission to push to the repository, or your credentials are wrong.

### How to Fix

1. **Make sure you're on the correct branch:**
   ```bash
   git branch
   ```
   You should see: `* claude/plan-mode-no-coding-011CV28FReDM5kVRddZtj6fx`

2. **If the branch doesn't exist, create it:**
   ```bash
   git checkout -b claude/plan-mode-no-coding-011CV28FReDM5kVRddZtj6fx
   ```

3. **Check your remote:**
   ```bash
   git remote -v
   ```
   Make sure it points to the correct repository.

4. **If you get 403:**
   - You might need to authenticate
   - Try: `git push -u origin claude/plan-mode-no-coding-011CV28FReDM5kVRddZtj6fx`

---

## Issue #12: "White screen" or "Nothing shows up"

### What This Means
There's a JavaScript error preventing the page from loading.

### How to Fix

1. **Open browser console:**
   - Press F12
   - Click the "Console" tab
   - Look for red error messages

2. **Common errors:**
   - **"Cannot read property of undefined"**: Something is missing
   - **"Unexpected token"**: Syntax error in the code
   - **"Network error"**: Can't connect to Supabase

3. **Check your network tab:**
   - In developer tools, click "Network"
   - Reload the page
   - Look for failed requests (red)
   - These tell you what's not loading

4. **Clear your browser cache:**
   - Sometimes old code gets cached
   - Ctrl+Shift+R (or Cmd+Shift+R on Mac) to hard refresh

---

## Issue #13: "Database query slow" or "Page loads slowly"

### What This Means
Your database queries aren't optimized, or you have too much data.

### How to Fix (Later - Not Critical for Starting)

1. **Add indexes to your database:**
   - Go to Supabase SQL Editor
   - Run:
     ```sql
     CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
     CREATE INDEX idx_line_items_quote_id ON quote_line_items(quote_id);
     ```

2. **Optimize your queries:**
   - Look for N+1 query problems
   - Use `select` to only fetch needed columns

3. **Add pagination:**
   - Don't load all quotes at once
   - Load 20-50 at a time with "Load More"

---

## Where to Find Error Messages

### Terminal/Command Prompt
- This is where server-side errors appear
- Look for red text
- Shows compilation errors, database errors, etc.

### Browser Console (F12)
- This is where client-side errors appear
- Shows JavaScript errors, network errors
- Press F12 and click "Console" tab

### Vercel Logs
- For production errors
- Go to: Vercel Dashboard → Your Project → Logs
- Shows real-time errors from your live site

### Supabase Logs
- For database errors
- Go to: Supabase Dashboard → Logs
- Shows database queries and errors

---

## General Troubleshooting Steps

When something doesn't work, follow these steps in order:

1. **Read the error message carefully**
   - It usually tells you exactly what's wrong
   - Google the error message if you don't understand it

2. **Check the terminal and browser console**
   - Errors appear in both places
   - Look for red text

3. **Restart everything**
   - Stop the dev server (Ctrl+C)
   - Close your browser
   - Run `npm run dev` again
   - Open browser in incognito mode (to avoid cache issues)

4. **Check your environment variables**
   - Make sure `.env.local` exists and has correct values
   - No spaces around the `=` signs
   - No quotes around values

5. **Reinstall dependencies**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

6. **Check you're on the latest code**
   ```bash
   git pull
   ```

7. **Try building**
   ```bash
   npm run build
   ```
   This catches many errors.

8. **Google the error**
   - Copy the error message
   - Search: "[error message] Next.js" or "[error message] Supabase"
   - Stack Overflow usually has answers

9. **Ask for help**
   - Post in Next.js Discord, Supabase Discord, or Stack Overflow
   - Include:
     - The full error message
     - What you were trying to do
     - What you've already tried

---

## Prevention Tips

To avoid issues in the future:

1. **Always test locally before deploying**
   - Run `npm run build` before pushing to Vercel
   - Test all features in your browser

2. **Keep a backup of your `.env.local` file**
   - Store it somewhere safe
   - Never commit it to git (it's secret!)

3. **Commit frequently**
   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```
   This way you can always go back if something breaks.

4. **Test after making changes**
   - Changed one thing? Test that one thing immediately
   - Don't change 10 things then try to debug

5. **Keep notes**
   - Write down what you changed
   - Document any custom configurations
   - This helps when troubleshooting later

---

## Still Stuck?

If you've tried everything and it still doesn't work:

1. **Check the official docs:**
   - Next.js: https://nextjs.org/docs
   - Supabase: https://supabase.com/docs
   - Vercel: https://vercel.com/docs

2. **Ask in communities:**
   - Next.js Discord: https://nextjs.org/discord
   - Supabase Discord: https://discord.supabase.com
   - Stack Overflow: https://stackoverflow.com

3. **When asking for help, include:**
   - What you're trying to do
   - What's happening instead
   - Full error message (copy-paste, not screenshot)
   - What you've tried
   - Your environment (OS, Node version, browser)

4. **Create a minimal reproduction:**
   - Can you recreate the issue with fewer steps?
   - This helps others help you

---

## Quick Reference: Commands to Try When Stuck

```bash
# Reinstall everything
rm -rf node_modules package-lock.json
npm install

# Restart dev server
Ctrl+C
npm run dev

# Build to check for errors
npm run build

# Run migrations
npm run migrate

# Check versions
node --version
npm --version

# See what branch you're on
git branch

# Pull latest changes
git pull

# Check for running processes on port 3000
lsof -i:3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows
```

---

Remember: Every developer runs into these issues. You're not alone! The key is to stay calm, read error messages carefully, and google things. You'll get better at troubleshooting with practice!
