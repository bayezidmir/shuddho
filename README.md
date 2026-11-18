# Shuddho (শুদ্ধ) — Bangladeshi Natural & Organic Food E-Commerce Platform

A self-hosted bilingual (English + বাংলা) e-commerce storefront and WordPress/WooCommerce-style operations admin built for Bangladesh.

## Quick Start (Local / Sandbox)
1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Run tests**:
   ```bash
   npm test
   ```
3. **Start server (Express + Vite on port 3000)**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` for the Storefront and `http://localhost:3000/admin` for the Admin Dashboard.

## Demo Staff Accounts (`/admin`)
- **Owner / Super Admin**: `owner@shuddho.com.bd` / `Shuddho@2026`
- **Confirmation Agent**: `agent@shuddho.com.bd` / `Agent@2026`
- **Packer / Warehouse**: `packer@shuddho.com.bd` / `Packer@2026`
- **Marketing**: `marketing@shuddho.com.bd` / `Marketing@2026`
- **Accountant**: `accountant@shuddho.com.bd` / `Accountant@2026`

## Key Capabilities
- **Coast Storefront**: Floating pill header, English/বাংলা toggle, Light & Dark modes, 64-district checkout with BD phone normalization (`01XXXXXXXXX` → `+8801XXXXXXXXX`), COD/bKash/Nagad/SSLCommerz sandbox, incomplete checkout auto-capture, live tracking (`/track`), OTP account login (`/account`), and PWA installability.
- **Admin Operations**: WordPress-style dark sidebar, `⌘K`/`Ctrl+K` command palette, bulk invoice & 4×6 shipping label print, Call-Centre Agent mode, BD courier fraud-check badge (`X of Y delivered`), 1-click Steadfast/Pathao/RedX/Paperfly/eCourier sandbox booking, inventory batches, live Coast Theme token editor, and 7-role RBAC.
- **No-Code GTM & Conversion Webhook**: Configure `GTM-XXXXXXX` & Consent Mode v2 live in Admin, plus HMAC-SHA256 signed `Purchase` conversion webhooks triggered **only when orders are confirmed** (matching browser GA4 `event_id: order_<id>_purchase`). See `TRACKING.md` and `WEBHOOK.md`.

## Self-Hosting with Docker Compose
```bash
cp .env.example .env
docker compose up -d --build
```
