# Setup

Next.js storefront + owner dashboard. Orders are stored in Supabase and emailed to the owner through Resend.

| Page | What it is |
|---|---|
| `/` | Storefront: menu, bag, checkout (cash on delivery or QR) |
| `/admin` | Orders board: progress, delivery and payment status |
| `/admin/finance` | Revenue, best sellers and payment split from completed orders |

## 1. Create the database table

Supabase → **SQL Editor** → New query → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.

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

## Changing the menu

Prices, names and photos live in [`src/lib/menu.ts`](src/lib/menu.ts); photos are in `public/images`. The server always prices orders from this file, never from the browser.

## The QR code

The QR shown at checkout is a placeholder. To use a real GCash/Maya QR, save it as `public/images/payment-qr.png` and swap the `<QRCodeSVG … />` in [`src/components/Shop.tsx`](src/components/Shop.tsx) for an `<Image src="/images/payment-qr.png" … />`.
