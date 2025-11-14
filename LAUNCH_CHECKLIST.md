# Launch Checklist

Use this checklist to make sure everything is set up correctly before giving the system to clients.

Print this out or keep it open while you work through the setup!

---

## Phase 1: Local Development Setup

### Install Required Software
- [ ] Install Node.js from https://nodejs.org (LTS version)
- [ ] Install Git from https://git-scm.com
- [ ] Install VS Code from https://code.visualstudio.com
- [ ] Verify installation:
  ```bash
  node --version
  git --version
  ```

### Get the Project Running
- [ ] Open project in VS Code
- [ ] Open terminal in VS Code (Terminal > New Terminal)
- [ ] Run `npm install` and wait for it to complete
- [ ] Create `.env.local` file (copy from `.env.example`)

### Set Up Supabase
- [ ] Create account at https://supabase.com
- [ ] Create new project (note: takes 2-3 minutes)
- [ ] Save database password somewhere safe
- [ ] Get Project URL from Settings > API
- [ ] Get anon public key from Settings > API
- [ ] Add both to `.env.local` file
- [ ] Run database migrations: `npm run migrate`

### Start Development Server
- [ ] Run `npm run dev`
- [ ] Open browser to http://localhost:3000
- [ ] See the website load without errors
- [ ] Check terminal for any red error messages (should be none)

**✅ If you can see your website, you're ready for Phase 2!**

---

## Phase 2: Basic Testing

### Test User Registration
- [ ] Click "Sign Up" or "Register"
- [ ] Enter email and password
- [ ] Receive confirmation email
- [ ] Click confirmation link
- [ ] Successfully log in

### Test Product Management
- [ ] Navigate to Products or Admin section
- [ ] Click "Add New Product"
- [ ] Fill in:
  - SKU: `TEST-001`
  - Description: `Test Product`
  - Base Price: `100.00`
- [ ] Click Save
- [ ] See product appear in list
- [ ] Edit the product
- [ ] Delete the product

### Test Quote Creation
- [ ] Navigate to Quotes section
- [ ] Click "New Quote" or "Create Quote"
- [ ] Fill in customer information:
  - Name: `Test Customer`
  - Email: `test@example.com`
  - Phone: `555-1234`
- [ ] Add a line item (select a product)
- [ ] Set quantity to `5`
- [ ] See price calculate automatically
- [ ] Save the quote
- [ ] View the quote details

### Test Quote Workflow
- [ ] Create a draft quote
- [ ] Change status to "Submitted"
- [ ] Change status to "Sent"
- [ ] See status timeline update
- [ ] Add internal notes
- [ ] View notes in quote history

### Test PDF Generation
- [ ] Open a saved quote
- [ ] Click "Generate PDF" or "Download PDF"
- [ ] PDF downloads to your computer
- [ ] Open PDF and verify:
  - Company name shows correctly
  - Customer information is accurate
  - Line items are listed correctly
  - Prices are calculated correctly
  - PDF looks professional

**✅ If all basic features work, you're ready for Phase 3!**

---

## Phase 3: Optional Features Setup

### Email Service (Resend) - Optional
- [ ] Create account at https://resend.com
- [ ] Verify your domain (or use test domain)
- [ ] Create API key
- [ ] Add to `.env.local`:
  ```
  RESEND_API_KEY=re_...
  RESEND_FROM_EMAIL=quotes@yourdomain.com
  ```
- [ ] Restart dev server
- [ ] Test: Send a quote via email
- [ ] Verify: Email arrives in inbox

### OCR Service (OpenAI) - Optional
- [ ] Create account at https://platform.openai.com
- [ ] Add payment method
- [ ] Create API key
- [ ] Add to `.env.local`:
  ```
  OPENAI_API_KEY=sk-...
  ```
- [ ] Restart dev server
- [ ] Test: Upload an image with text
- [ ] Verify: Text is extracted correctly

### Slack Notifications - Optional
- [ ] Have a Slack workspace (or create one)
- [ ] Create channel: `#quotes`
- [ ] Create incoming webhook at https://api.slack.com/apps
- [ ] Add webhook URL to `.env.local`:
  ```
  SLACK_WEBHOOK_URL=https://hooks.slack.com/...
  ```
- [ ] Restart dev server
- [ ] Test: Create a quote
- [ ] Verify: Notification appears in Slack

**✅ Optional features are nice-to-have, not required!**

---

## Phase 4: Deploy to Production

### Prepare for Deployment
- [ ] Test locally one more time
- [ ] Run `npm run build` to check for errors
- [ ] All tests should pass
- [ ] Fix any errors before continuing

### Set Up GitHub
- [ ] Create GitHub account (if you don't have one)
- [ ] Create new repository called "quoting-system"
- [ ] Follow GitHub instructions to push code:
  ```bash
  git add .
  git commit -m "Initial deployment"
  git branch -M main
  git remote add origin https://github.com/YOUR-USERNAME/quoting-system.git
  git push -u origin main
  ```

### Set Up Vercel
- [ ] Create account at https://vercel.com
- [ ] Sign in with GitHub
- [ ] Click "Add New" > "Project"
- [ ] Import your "quoting-system" repository
- [ ] Vercel detects Next.js automatically
- [ ] Add environment variables (from your `.env.local`):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `RESEND_API_KEY` (if using email)
  - `OPENAI_API_KEY` (if using OCR)
  - `SLACK_WEBHOOK_URL` (if using Slack)
- [ ] Click "Deploy"
- [ ] Wait 2-5 minutes
- [ ] See "Congratulations!" message

### Test Production Deployment
- [ ] Click the Vercel URL (like `https://quoting-system.vercel.app`)
- [ ] Website loads in browser
- [ ] Test user registration
- [ ] Test creating a quote
- [ ] Test generating PDF
- [ ] Test on mobile device
- [ ] Test in different browsers (Chrome, Safari, Firefox)

**✅ If production works, you're almost done!**

---

## Phase 5: Branding & Customization

### Add Your Branding
- [ ] Replace company name in:
  - `pricing-tool/lib/pdf/quote-template.ts`
  - `pricing-tool/components/Header.tsx`
- [ ] Add your logo (if you have one)
- [ ] Update colors in Tailwind config (optional)
- [ ] Customize email templates
- [ ] Customize PDF template

### Set Up Your Products
- [ ] Import your product list (or add manually)
- [ ] Verify all SKUs are correct
- [ ] Verify all prices are accurate
- [ ] Set up categories (if using)
- [ ] Set up product options (size, color, etc.)

### Configure Business Rules
- [ ] Set up price lists (if using tiered pricing)
- [ ] Configure approval thresholds
- [ ] Set up user roles and permissions
- [ ] Configure quote expiration days
- [ ] Set up tax rates (if needed)

**✅ Now it's truly yours!**

---

## Phase 6: Client Onboarding

### Create Documentation for Clients
- [ ] Write simple instructions for clients:
  - How to log in
  - How to view quotes
  - How to accept/decline quotes
  - Who to contact for questions
- [ ] Create FAQ document
- [ ] Create video tutorial (optional)

### Set Up Client Accounts
- [ ] Create accounts for initial clients
- [ ] Send them welcome emails with:
  - Login URL
  - Their username/email
  - Initial password (they'll change it)
  - Link to documentation
  - Support contact info

### Train Your Team
- [ ] Train staff on creating quotes
- [ ] Train staff on managing products
- [ ] Train staff on approving quotes
- [ ] Train staff on running reports
- [ ] Create internal documentation

**✅ Ready to serve clients!**

---

## Phase 7: Go Live!

### Launch Day Checklist
- [ ] All features tested and working
- [ ] Client accounts created
- [ ] Documentation sent to clients
- [ ] Team trained and ready
- [ ] Support process established
- [ ] Backup plan in place (if site goes down)
- [ ] Monitoring set up (Vercel, Supabase dashboards)

### Send Launch Announcement
- [ ] Email clients with:
  - System URL
  - Login instructions
  - Benefits of the new system
  - Support contact
  - Training resources
- [ ] Follow up with clients individually
- [ ] Offer to walk them through first use

### First Week Monitoring
- [ ] Check Vercel logs daily
- [ ] Check Supabase usage daily
- [ ] Respond quickly to client questions
- [ ] Fix any bugs immediately
- [ ] Gather feedback from clients
- [ ] Make small improvements

**✅ You're live! Congratulations! 🎉**

---

## Ongoing Maintenance Checklist

### Weekly Tasks
- [ ] Check Vercel dashboard for errors
- [ ] Check Supabase dashboard for issues
- [ ] Review usage and costs
- [ ] Check for any failed emails (Resend logs)
- [ ] Follow up on any pending quotes

### Monthly Tasks
- [ ] Review analytics and metrics
- [ ] Update products and pricing if needed
- [ ] Check for software updates: `npm outdated`
- [ ] Review and respond to client feedback
- [ ] Backup important data (Supabase auto-backs up, but export manually too)
- [ ] Review costs and optimize if needed

### Quarterly Tasks
- [ ] Major feature review with team
- [ ] Client satisfaction survey
- [ ] Update documentation
- [ ] Update dependencies: `npm update`
- [ ] Security review
- [ ] Performance optimization

---

## Troubleshooting Checklist

If something doesn't work, go through this checklist:

- [ ] Read the error message carefully
- [ ] Check terminal for errors (red text)
- [ ] Check browser console for errors (F12 > Console)
- [ ] Verify `.env.local` has correct values
- [ ] Restart dev server (`Ctrl+C` then `npm run dev`)
- [ ] Clear browser cache (Ctrl+Shift+R)
- [ ] Check Supabase is online (supabase.com)
- [ ] Check Vercel is online (vercel.com/status)
- [ ] Reinstall dependencies: `rm -rf node_modules && npm install`
- [ ] Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) guide
- [ ] Google the error message
- [ ] Ask for help in Discord/Stack Overflow

---

## Success Criteria

You're ready to launch when:

✅ All basic features work locally
✅ All basic features work in production
✅ You can create and send quotes
✅ Clients can view and respond to quotes
✅ PDFs generate correctly
✅ Email delivery works (if configured)
✅ No critical bugs or errors
✅ Documentation is ready
✅ Support process is established
✅ Team is trained

---

## Emergency Contacts

Keep these handy for launch day:

**If the site goes down:**
- Check: https://vercel.com/status
- Check: https://status.supabase.com
- Redeploy from Vercel dashboard

**If database errors occur:**
- Check Supabase logs
- Verify environment variables
- Check database connection

**If clients can't access:**
- Verify their account exists
- Check they're using correct URL
- Reset their password
- Check email for confirmation link

---

## You're Ready!

Take it one phase at a time. Don't rush. Test thoroughly. And remember:

**Every successful software launch started exactly where you are now!**

Good luck! 🚀
