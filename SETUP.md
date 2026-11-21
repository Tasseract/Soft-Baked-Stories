# Setup

Next.js storefront + owner dashboard. Orders are stored in Supabase; order and payment emails go out through the shop's Gmail.

| Page | What it is |
|---|---|
| `/` | Storefront: menu, bag, checkout (cash on delivery or QR) |
| `/admin` | Orders board: progress, delivery and payment status |
| `/admin/pos` | POS mode: enter orders taken over Messenger, Facebook, Instagram, calls or walk-ins |
| `/admin/finance` | Revenue, best sellers and payment split from completed orders |
| `/admin/menu` | Edit prices and sizes, add or hide products, upload photos |
| `/admin/settings` | Light / dark / automatic theme, delete all orders, reset the menu |

## 1. Set up the database

Supabase → **SQL Editor** → New query → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.

It creates the orders, products and settings tables, the `product-images` storage bucket, and fills the menu with the original six products. Run it again after pulling changes that touch it: it only adds what's missing and never deletes data or overwrites menu edits.

## 2. Environment variables

Copy `.env.example` to `.env.local` for local development, and add the same values in Vercel → Project → Settings → Environment Variables.

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`) |
| `GMAIL_USER` | The shop's Gmail address that emails are sent from |
| `GMAIL_APP_PASSWORD` | A Google App Password for that account (see **Emails** below) |
| `ORDER_EMAIL_TO` | Optional. Where new-order alerts go; defaults to `GMAIL_USER` |
| `ADMIN_PASSWORD` | Any strong password; the owner types it at `/admin` |

If the Gmail variables are empty, orders still work and show on the dashboard; only the emails are skipped. Admin → Settings shows whether emails are on.

## Emails

| When | Who gets it |
|---|---|
| A customer places an order | The owner (new-order alert) and the customer, if they left an email (order confirmation with payment instructions) |
| The owner enters an order in POS | The customer, if an email was entered |
| A QR order is marked **Paid** on the Orders board | The customer, if they left an email (payment confirmation). Sent once per order, even if Paid is toggled again |

Setting up the shop's Gmail (free, about 500 emails a day):

1. Use a Gmail account for the shop and turn on **2-Step Verification** at https://myaccount.google.com/security.
2. Open https://myaccount.google.com/apppasswords, create an App Password named "Soft Baked Stories", and copy the 16 characters.
3. In Vercel → Settings → Environment Variables add `GMAIL_USER` (the Gmail address) and `GMAIL_APP_PASSWORD` (the 16 characters), then redeploy.

Customers' replies go to the shop's Gmail.

## 3. Deploy

Import the GitHub repo in Vercel (framework is detected as Next.js), add the environment variables above, and deploy.

## Local development

```bash
npm install
npm run dev
```

To try everything without touching real orders, `npm run dev:mock` starts the app on http://localhost:3006 against a stand-in database with sample orders (admin password: `preview`). Emails are written to `.email-previews/` as HTML files instead of being sent. It resets every time it stops.

## Changing the menu

Use **Admin → Menu**. The **Mix & Match Box** is edited there too: each row is a flavor pairing and its price, and customers only see pairings whose flavors are on the menu. Products live in the `products` table and photos in the `product-images` bucket. The server always prices orders from the database, never from the browser. [`src/lib/menu.ts`](src/lib/menu.ts) holds the original menu, used for **Settings → Reset the menu** and as a fallback if the database can't be reached.

## The payment QR

Checkout shows the shop's InstaPay QR from `public/images/payment-qr.jpg`. To change it, replace that file with the new QR (keep the name) and push.
