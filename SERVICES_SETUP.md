# Setting Up External Services (Optional Features)

Your quoting system has some optional advanced features that require external services. You can start without these and add them later as needed!

---

## What's Required vs. Optional

### ✅ Required (Already Covered in Getting Started)
- **Supabase** - Your database (stores quotes, products, customers)

### ⚡ Optional (Add These for Advanced Features)
- **OpenAI** - For OCR on images and transcribing audio files
- **Resend** - For sending professional emails to customers
- **Slack** - For team notifications when quotes are created/accepted
- **Webhooks** - For integrating with other systems you use

**You can launch without these! Add them as you need the features.**

---

## 1. OpenAI Setup (For OCR & Audio Transcription)

### What This Does
- Reads text from uploaded images and PDFs (OCR)
- Converts voice recordings to text (if customers send audio orders)

### When You Need This
- Your customers send photos of order forms
- Your customers call in orders and you record them

### Setup Steps

1. **Create an OpenAI Account**
   - Go to: https://platform.openai.com
   - Click "Sign Up"
   - Verify your email

2. **Add Payment Method**
   - Go to: https://platform.openai.com/account/billing
   - Click "Add payment method"
   - Add a credit card
   - **Cost**: ~$0.006 per audio minute, $0.01 per image
   - Example: 100 audio orders (5 min each) = ~$3/month

3. **Create an API Key**
   - Go to: https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Give it a name: "Quoting System"
   - Copy the key (starts with `sk-...`)
   - **IMPORTANT**: Save this somewhere safe! You can't see it again

4. **Add to Your Environment Variables**

   **Locally (your computer):**
   - Open `.env.local` in VS Code
   - Add this line:
     ```
     OPENAI_API_KEY=sk-your-key-here
     ```
   - Save the file
   - Restart your dev server (`Ctrl+C` then `npm run dev`)

   **On Vercel (your live site):**
   - Go to Vercel Dashboard
   - Click your project
   - Go to Settings > Environment Variables
   - Add:
     - **Name**: `OPENAI_API_KEY`
     - **Value**: `sk-your-key-here`
   - Click "Save"
   - Redeploy your site

5. **Test It**
   - In your quoting system, try uploading a photo of text
   - It should extract the text automatically!

### Cost Management
- Set usage limits in OpenAI dashboard
- Start with a $10/month limit to be safe

---

## 2. Resend Setup (For Sending Emails)

### What This Does
- Sends professional quote PDFs to customers via email
- Sends notifications to your team
- Delivers "Quote Ready" emails with links for customers to view/accept

### When You Need This
- You want to email quotes to customers instead of downloading PDFs manually
- You want automated email notifications

### Setup Steps

1. **Create a Resend Account**
   - Go to: https://resend.com
   - Click "Start Building"
   - Sign up with email or GitHub

2. **Verify Your Domain (Important!)**

   **Option A: Use Resend's Free Domain (easiest for testing)**
   - Resend gives you: `yourname.resend.dev`
   - Emails will come from: `quotes@yourname.resend.dev`
   - Good for testing, not great for clients

   **Option B: Use Your Own Domain (professional)**
   - You need to own a domain (yourcompany.com)
   - In Resend, click "Domains" > "Add Domain"
   - Enter: `yourcompany.com`
   - Resend will show DNS records
   - Go to your domain registrar (Namecheap, GoDaddy, etc.)
   - Add the DNS records Resend provides
   - Wait 24-48 hours for verification
   - Emails will come from: `quotes@yourcompany.com`

3. **Create an API Key**
   - In Resend, click "API Keys"
   - Click "Create API Key"
   - Name it: "Quoting System"
   - Permission: "Sending access"
   - Copy the key (starts with `re_...`)

4. **Add to Your Environment Variables**

   **Locally:**
   - Open `.env.local`
   - Add:
     ```
     RESEND_API_KEY=re_your-key-here
     RESEND_FROM_EMAIL=quotes@yourdomain.com
     ```
   - Save and restart dev server

   **On Vercel:**
   - Vercel Dashboard > Project > Settings > Environment Variables
   - Add both variables
   - Redeploy

5. **Test It**
   - Create a quote
   - Click "Send to Customer"
   - Check if the email arrives (check spam folder!)

### Pricing
- **Free**: 100 emails/day
- **Paid**: $20/month for 50,000 emails
- Start free!

---

## 3. Slack Setup (For Team Notifications)

### What This Does
- Sends messages to your Slack workspace when:
  - A new quote is created
  - A customer accepts/declines a quote
  - A quote needs approval
  - A large order comes in

### When You Need This
- Your team uses Slack
- You want instant notifications for important events

### Setup Steps

1. **Create a Slack Workspace** (if you don't have one)
   - Go to: https://slack.com
   - Click "Get Started"
   - Follow the prompts to create a workspace

2. **Create a Slack Channel**
   - In Slack, click "+" next to Channels
   - Name it: `#quotes` or `#sales-alerts`
   - This is where notifications will appear

3. **Create an Incoming Webhook**
   - Go to: https://api.slack.com/apps
   - Click "Create New App"
   - Choose "From scratch"
   - Name: "Quoting System"
   - Select your workspace
   - Click "Incoming Webhooks"
   - Toggle "Activate Incoming Webhooks" to ON
   - Click "Add New Webhook to Workspace"
   - Select the `#quotes` channel
   - Click "Allow"
   - Copy the Webhook URL (starts with `https://hooks.slack.com/...`)

4. **Add to Your Environment Variables**

   **Locally:**
   - Open `.env.local`
   - Add:
     ```
     SLACK_WEBHOOK_URL=https://hooks.slack.com/your-webhook-url
     ```

   **On Vercel:**
   - Add the same variable in Vercel settings

5. **Test It**
   - Create a quote in your system
   - Check your Slack channel
   - You should see a notification!

### Customizing Notifications
- In your code, look for: `pricing-tool/lib/slack/send-message.ts`
- You can customize which events trigger notifications
- You can change the message format

### Pricing
- **Free**: Slack is free for basic usage

---

## 4. Custom Webhooks (For Integrations)

### What This Does
- Sends data to other systems you use when events happen
- Examples:
  - Send new quotes to your CRM (Salesforce, HubSpot)
  - Notify your accounting software when quotes are accepted
  - Integrate with your ERP system

### When You Need This
- You use other business software
- You want automatic data syncing

### Setup Steps

1. **Identify What You Want to Integrate**
   - QuickBooks? Salesforce? Custom internal tools?
   - Check if they support "webhooks" or "API endpoints"

2. **Get Their Webhook URL**
   - Most services provide a URL to send data to
   - Example: `https://api.yourcrm.com/webhooks/quotes`

3. **Configure in Your System**
   - In your quoting system, go to Admin > Settings > Webhooks
   - Click "Add Webhook"
   - Enter:
     - **Name**: "CRM Integration"
     - **URL**: The webhook URL from the other service
     - **Events**: Select which events to send (quote.created, quote.accepted, etc.)
     - **Secret**: Create a random string for security
   - Save

4. **The Other System Needs to Handle the Data**
   - They'll receive JSON data like:
     ```json
     {
       "event": "quote.created",
       "quote_id": "123",
       "customer": "ABC Corp",
       "total": 5000.00
     }
     ```
   - They need to process this data
   - *This usually requires a developer on their end*

### Security
- All webhooks include HMAC-SHA256 signatures
- This proves the data came from your system
- The receiving system should verify the signature

---

## 5. File Storage (Already Included with Supabase!)

### What This Does
- Stores uploaded files (Excel, PDFs, images, audio)
- Stores generated quote PDFs

### You Already Have This!
- Supabase includes 1GB free storage
- No additional setup needed!

### If You Need More Storage
- Upgrade your Supabase plan
- Or configure AWS S3 (requires technical knowledge)

---

## Environment Variables Summary

Here's a complete list of all variables you might need:

### Required
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Optional
```
# OpenAI (for OCR/ASR)
OPENAI_API_KEY=sk-...

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=quotes@yourcompany.com

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Custom integrations (add as needed)
WEBHOOK_SECRET=your-secret-key
```

---

## Adding Variables Checklist

Every time you add a new service:

- [ ] Get the API key or credentials
- [ ] Add to `.env.local` (for local development)
- [ ] Add to Vercel Environment Variables (for live site)
- [ ] Restart your dev server locally
- [ ] Redeploy on Vercel
- [ ] Test the feature

---

## Costs at a Glance

| Service | Free Tier | Paid Tier | When to Upgrade |
|---------|-----------|-----------|-----------------|
| **Supabase** | 500MB DB, 1GB storage | $25/mo | >500MB data or >50K users |
| **OpenAI** | N/A | Pay-as-you-go | ~$0.006/min audio, $0.01/image |
| **Resend** | 100 emails/day | $20/mo | >100 emails/day |
| **Slack** | Free | $8/user/mo | Only if you want advanced features |
| **Vercel** | 1 project | $20/mo | >1 project or need more bandwidth |

**Total to start:** $0 (everything has free tiers!)

**Typical monthly cost with all features:** $25-50/month

---

## Priority Order

If you're just starting:

1. **Start with Supabase only** - Get the basic system working
2. **Add Resend** - When you want to email quotes to customers
3. **Add OpenAI** - When customers start sending images/audio
4. **Add Slack** - When your team wants notifications
5. **Add Webhooks** - When you need to integrate with other systems

**Don't try to set up everything at once!** Start simple and add features as you need them.

---

## Getting Help

Each service has great documentation:
- **Supabase**: https://supabase.com/docs
- **OpenAI**: https://platform.openai.com/docs
- **Resend**: https://resend.com/docs
- **Slack**: https://api.slack.com/messaging/webhooks

Most have free chat support or community forums!
