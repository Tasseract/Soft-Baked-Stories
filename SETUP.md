# Setup

Next.js storefront + owner dashboard. Orders are stored in Supabase and emailed to the owner through Resend.

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
| `RESEND_API_KEY` | resend.com → API Keys |
| `ORDER_EMAIL_TO` | The owner's inbox. On Resend's free plan without a verified domain, this must be the email you signed up to Resend with. |
| `ADMIN_PASSWORD` | Any strong password; the owner types it at `/admin` |
| `ORDER_EMAIL_FROM` | Optional. Only after verifying a domain in Resend, e.g. `Soft Baked Stories <orders@yourdomain.com>` |

If the Resend variables are empty, orders are still saved and appear in the dashboard; only the email is skipped.

## 3. Deploy

Import the GitHub repo in Vercel (framework is detected as Next.js), add the environment variables above, and deploy.

## Local development

```bash
npm install
npm run dev
```

To try everything without touching real orders, `npm run dev:mock` starts the app on http://localhost:3006 against a stand-in database with sample orders (admin password: `preview`). It resets every time it stops.

## Changing the menu

Use **Admin → Menu**. The **Mix & Match Box** is edited there too: each row is a flavor pairing and its price, and customers only see pairings whose flavors are on the menu. Products live in the `products` table and photos in the `product-images` bucket. The server always prices orders from the database, never from the browser. [`src/lib/menu.ts`](src/lib/menu.ts) holds the original menu, used for **Settings → Reset the menu** and as a fallback if the database can't be reached.

## The QR code

The QR shown at checkout is a placeholder. To use a real GCash/Maya QR, save it as `public/images/payment-qr.png` and swap the `<QRCodeSVG … />` in [`src/components/Shop.tsx`](src/components/Shop.tsx) for an `<Image src="/images/payment-qr.png" … />`.
