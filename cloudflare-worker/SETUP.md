# Cloudflare R2 Storage Setup

This Cloudflare Worker provides image storage for the Virtual Try-On extension using Cloudflare R2 (free tier).

## Prerequisites

- A Cloudflare account (free): https://dash.cloudflare.com/sign-up
- Node.js installed on your computer

## Setup Steps

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate.

### 3. Create the R2 Bucket

```bash
cd cloudflare-worker
npm install
npm run create-bucket
```

This creates a bucket named `tryon-images`.

### 4. Deploy the Worker

```bash
npm run deploy
```

After deployment, you'll see a URL like:
```
https://tryon-image-storage.YOUR_USERNAME.workers.dev
```

### 5. Configure the Extension

1. Open the extension popup
2. Go to Settings tab
3. Find "Cloud Storage (R2)" section
4. Paste your Worker URL
5. Click "Test" to verify connection
6. Click "Save & Enable"

## Free Tier Limits

Cloudflare R2 free tier includes:
- **10 GB** storage
- **10 million** Class A operations (writes) per month
- **1 million** Class B operations (reads) per month

This is more than enough for personal use!

## Optional: Restrict Access

By default, the worker accepts requests from any origin (for development).
To restrict to only your extension:

1. Go to Cloudflare Dashboard > Workers & Pages
2. Select your worker
3. Go to Settings > Variables
4. Add a variable:
   - Name: `ALLOWED_ORIGINS`
   - Value: `chrome-extension://YOUR_EXTENSION_ID`

To find your extension ID:
1. Go to `chrome://extensions`
2. Enable Developer mode
3. Copy the ID shown under your extension

## Troubleshooting

**"Connection failed" error:**
- Make sure the Worker URL is correct (no trailing slash)
- Check that the worker is deployed: run `wrangler tail` to see logs

**CORS errors:**
- Make sure your extension ID is in the ALLOWED_ORIGINS variable
- Or leave ALLOWED_ORIGINS empty to allow all origins

**Bucket not found:**
- Run `npm run create-bucket` first
- Check bucket exists: `wrangler r2 bucket list`
