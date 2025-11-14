# Complete Beginner's Guide: Getting Your Quoting System Running

This guide assumes you know nothing about coding. We'll walk through every single step.

---

## Part 1: Understanding What You Have

You now have a **quoting system** - software that helps you:
- Create price quotes for customers
- Upload files (Excel, PDFs) to extract product information
- Manage products and pricing
- Send professional PDF quotes to customers
- Track quote status (draft, sent, accepted, etc.)
- Generate reports and analytics

Think of it like having a custom-built tool instead of using Excel spreadsheets.

---

## Part 2: What You Need to Install (One-Time Setup)

### Step 1: Install Node.js (The Engine)
Think of Node.js as the "engine" that runs your software.

1. Go to: https://nodejs.org
2. Download the **LTS version** (the green button)
3. Run the installer
4. Click "Next" through all the screens
5. Verify it worked:
   - Open "Terminal" (Mac) or "Command Prompt" (Windows)
   - Type: `node --version`
   - You should see something like `v20.11.0`

### Step 2: Install Git (Version Control)
Git tracks all changes to your code.

1. Go to: https://git-scm.com/downloads
2. Download for your system
3. Run the installer with default settings
4. Verify: Type `git --version` in Terminal/Command Prompt

### Step 3: Choose a Code Editor
This is like Microsoft Word, but for code.

**Recommended: Visual Studio Code (VS Code)**
1. Go to: https://code.visualstudio.com
2. Download and install
3. Open it - this is where you'll see your code

---

## Part 3: Getting the Code Running on Your Computer

### Step 1: Open Your Project

1. Open VS Code
2. Click: **File > Open Folder**
3. Navigate to this folder: `/home/user/hello-claude`
4. Click "Open"

You'll now see all the code files on the left side.

### Step 2: Open the Terminal Inside VS Code

1. In VS Code, click: **Terminal > New Terminal** (top menu)
2. A box will appear at the bottom - this is where you type commands

### Step 3: Install Dependencies

Dependencies are pre-built code pieces your software needs to work.

In the terminal, type:
```bash
npm install
```

This will take 2-5 minutes. You'll see lots of text scrolling - that's normal!

Wait until you see your cursor again (means it's done).

### Step 4: Set Up Your Database (Supabase)

Your software needs a place to store data (customers, quotes, products). We'll use **Supabase** - it's like having your own database in the cloud.

**Create a Supabase Account:**
1. Go to: https://supabase.com
2. Click "Start your project"
3. Sign up with your email or GitHub
4. Click "New Project"
5. Fill in:
   - **Name**: "quoting-system" (or anything you want)
   - **Database Password**: Create a strong password (SAVE THIS!)
   - **Region**: Choose closest to you
6. Click "Create new project"
7. Wait 2-3 minutes for it to set up

**Get Your Connection Details:**
1. In Supabase, click "Project Settings" (gear icon in left sidebar)
2. Click "API" in the left menu
3. You'll see:
   - **Project URL** (starts with https://)
   - **anon public** key (long string of letters/numbers)
4. Keep this tab open - you'll need these in a minute!

### Step 5: Create Your Configuration File

1. In VS Code, look at the left sidebar with files
2. Find the file named `.env.example`
3. Right-click it and choose "Duplicate"
4. Rename the copy to `.env.local`
5. Open `.env.local` by clicking it

Now you'll see something like:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Replace `your-project-url` with the URL from Supabase
Replace `your-anon-key` with the anon key from Supabase

**Save the file** (Ctrl+S or Cmd+S)

### Step 6: Run Database Migrations

"Migrations" create all the tables and structure in your database.

In the terminal, type:
```bash
npm run migrate
```

This sets up all your database tables (quotes, products, customers, etc.)

### Step 7: Start the Development Server

This runs your software on your computer so you can see it.

In the terminal, type:
```bash
npm run dev
```

You'll see:
```
Ready - started server on 0.0.0.0:3000
```

**Your software is now running!**

### Step 8: Open It in Your Browser

1. Open your web browser (Chrome, Safari, etc.)
2. Go to: http://localhost:3000

You should see your quoting system!

**"localhost" means "this computer" - only you can see it right now.**

---

## Part 4: Testing Your Software

Now let's make sure everything works!

### Test 1: Can You Create an Account?

1. On the homepage, click "Sign Up" or "Register"
2. Enter an email and password
3. Check your email for a confirmation link
4. Click the confirmation link
5. You should be logged in!

### Test 2: Can You Add Products?

1. Look for "Admin" or "Products" in the navigation menu
2. Click "Add New Product"
3. Fill in:
   - **SKU**: DR-3080-20G (this is a product code)
   - **Description**: Door 30x80 RH
   - **Base Price**: 250.00
4. Click "Save"
5. You should see your product in the list!

### Test 3: Can You Create a Quote?

1. Click "Quotes" or "New Quote" in the menu
2. Fill in customer information:
   - Name: Test Customer
   - Email: test@example.com
3. Add line items:
   - Select your product (DR-3080-20G)
   - Quantity: 5
4. Click "Save" or "Calculate"
5. You should see the total price!

### Test 4: Can You Upload a File?

1. Create a simple Excel file with columns:
   - SKU | Quantity | Description
   - DR-3080-20G | 5 | Test Door
2. In your quoting system, find "Upload" or "Import"
3. Drag and drop your Excel file
4. It should parse the file and show the items!

### Test 5: Can You Generate a PDF?

1. Open a quote you created
2. Click "Generate PDF" or "Download PDF"
3. A PDF file should download
4. Open it - you should see a professional-looking quote!

### What If Something Doesn't Work?

**Check the Terminal:**
- Look for red error messages in the VS Code terminal
- These tell you what's wrong

**Common Issues:**
- **Port 3000 already in use**: Another program is using that port
  - Solution: Close other programs or use `npm run dev -- -p 3001`
- **Database connection error**: Check your `.env.local` file
  - Make sure the Supabase URL and key are correct
- **Module not found**: Run `npm install` again

---

## Part 5: Deploying for Clients (Making It Live on the Internet)

Right now, your software only works on your computer. To let clients use it, we need to "deploy" it (put it on the internet).

### Option 1: Vercel (Easiest - Recommended)

Vercel is a hosting service specifically designed for this type of software. It's free for small projects!

**Step-by-Step:**

1. **Create a Vercel Account**
   - Go to: https://vercel.com
   - Click "Sign Up"
   - Sign up with your GitHub account (create one if needed)

2. **Connect Your Code to GitHub**
   - Go to: https://github.com
   - Click the "+" in the top right
   - Click "New repository"
   - Name it: "quoting-system"
   - Click "Create repository"

3. **Push Your Code to GitHub**

   In VS Code terminal, type these commands one at a time:

   ```bash
   git add .
   git commit -m "Initial deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/quoting-system.git
   git push -u origin main
   ```

   (Replace YOUR-USERNAME with your actual GitHub username)

4. **Deploy to Vercel**
   - Go back to Vercel: https://vercel.com
   - Click "Add New" > "Project"
   - Click "Import" next to your "quoting-system" repository
   - Vercel will detect it's a Next.js project
   - Click "Environment Variables"
   - Add your variables from `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase key
   - Click "Deploy"

5. **Wait for Deployment**
   - This takes 2-5 minutes
   - You'll see a "Congratulations!" screen when done
   - You'll get a URL like: `https://quoting-system.vercel.app`

6. **Your Software is Now Live!**
   - Anyone can access it at that URL
   - Give this URL to your clients!

### Setting Up Custom Domain (Optional)

If you want `quotes.yourcompany.com` instead of `quoting-system.vercel.app`:

1. Buy a domain from Namecheap, GoDaddy, or Google Domains
2. In Vercel, go to Project Settings > Domains
3. Add your domain
4. Follow Vercel's instructions to update your domain's DNS settings
5. Wait 24-48 hours for DNS to propagate

---

## Part 6: Giving It to Clients

### Option A: Share the URL

Just send them the Vercel URL:
```
Hi [Client Name],

You can access the quoting system here:
https://quoting-system.vercel.app

Let me know if you need any help!
```

### Option B: Create Accounts for Them

1. Go to your live system
2. Create accounts for each client with their email
3. They'll get a confirmation email
4. They can then log in and use it!

### Option C: Client Self-Registration

1. Make sure "Sign Up" is enabled on your site
2. Send them the URL
3. They create their own accounts
4. You can then assign them permissions (if you've built role-based access)

---

## Part 7: Maintaining Your System

### Updating the Software

When you make changes:

1. Edit code in VS Code
2. Test locally (http://localhost:3000)
3. When it works, commit and push:
   ```bash
   git add .
   git commit -m "Description of what you changed"
   git push
   ```
4. Vercel automatically deploys the changes!
5. Your live site updates in 2-5 minutes

### Monitoring

**Check for Issues:**
- Vercel Dashboard shows errors and logs
- Supabase Dashboard shows database usage

**Backups:**
- Supabase automatically backs up your database
- You can export data anytime from the Supabase dashboard

### Getting Help

**If You Get Stuck:**
1. Check the error message in the terminal or browser console
2. Google the error message (seriously, developers do this all the time!)
3. Ask in communities:
   - Stack Overflow
   - Next.js Discord
   - Supabase Discord

---

## Part 8: Cost Breakdown

### Free Tier (Good for Starting)

- **Vercel**: Free for 1 project
- **Supabase**: Free for up to 500MB database and 1GB file storage
- **Your Computer**: Free to run locally

### When You Need to Pay

- **More clients**: Supabase paid plan starts at $25/month
- **More bandwidth**: Vercel Pro is $20/month
- **Custom domain**: $10-15/year from domain registrar

**You can start completely free and upgrade as you grow!**

---

## Quick Command Reference

Keep these handy:

```bash
# Start development server (run your software locally)
npm run dev

# Install dependencies (after getting new code)
npm install

# Run database migrations (update database structure)
npm run migrate

# Check for code errors
npm run lint

# Run tests
npm test

# Build for production (check if it will work when deployed)
npm run build

# Commit code changes
git add .
git commit -m "Your message here"
git push
```

---

## Checklist: Before Giving to Clients

- [ ] Software runs locally without errors
- [ ] All tests pass (`npm test`)
- [ ] Database migrations run successfully
- [ ] You can create quotes, add products, generate PDFs
- [ ] Deployed to Vercel and accessible via URL
- [ ] Environment variables set correctly in Vercel
- [ ] Created test accounts and verified they work
- [ ] Tested on different browsers (Chrome, Safari, Firefox)
- [ ] Tested on mobile devices
- [ ] Set up email service for sending quotes (Resend API)
- [ ] Added your company branding (logo, colors)
- [ ] Set up backup procedures

---

## Next Steps

1. **Go through this guide step-by-step** - don't skip steps!
2. **Test everything locally first** - make sure it works on your computer
3. **Deploy to Vercel** - make it accessible on the internet
4. **Test the live version** - verify it works online
5. **Create test client accounts** - make sure the client experience is good
6. **Share with real clients** - start with 1-2 clients to test
7. **Gather feedback** - ask clients what works and what doesn't
8. **Iterate** - make improvements based on feedback

---

## You've Got This!

This might seem overwhelming, but thousands of people with no coding background have successfully deployed software. Take it one step at a time, and don't be afraid to ask for help!

Remember: Every expert was once a beginner. You're doing great by even attempting this!
