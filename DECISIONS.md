# Architecture & Engineering Decisions (`DECISIONS.md`)

## 1. Brand & Storefront Identity
- **Store Name**: **Shuddho** (`শুদ্ধ`) — Domain `shuddho.com.bd`.
- **Category**: Pure Bangladeshi Natural & Organic Food Store (Sundarban raw honey, Pabna/Sirajganj deshi ghee, wood-pressed mustard oil, premium dates, nuts & seeds, organic spices).
- **Runtime Brand Editability**: All store branding (name EN/BN, domain, hotline, WhatsApp, email, trade licence, VAT BIN) is stored in the `settings` database table (`general` key) and editable anytime from **Admin → Settings → General**.

## 2. Database Engine Selection (Container vs Self-Hosted VPS)
- **Live Sandbox / Zero-Config Runtime (`node:sqlite`)**: Because Node.js v22 ships with built-in `node:sqlite` (`DatabaseSync`), the Express + Vite server (`server.ts`) persists all 30+ tables inside `./data/shuddho.db` automatically with zero external daemon dependencies or C++ addon compilation.
- **Self-Hosted VPS / Production Stack (`prisma/schema.prisma` + `docker-compose.yml`)**: For multi-worker production VPS deployments behind Nginx/Cloudflare, this repository includes a full PostgreSQL `prisma/schema.prisma` alongside `docker-compose.yml` (App + Postgres 16 + Redis 7).

## 3. Security & RBAC Boundaries
- Staff authentication uses scrypt-salted password hashes (`server/auth.ts`), HTTP-only signed session cookies, and optional RFC 6238 TOTP 2FA.
- All 7 staff roles (`owner`, `manager`, `agent`, `packer`, `editor`, `marketing`, `accountant`) are enforced server-side via `requireStaff(permission)` middleware on every `/api/admin/*` endpoint.
- Courier, payment, and SMS secrets are encrypted at rest with AES-256-GCM using `ENCRYPTION_KEY` / `SESSION_SECRET` and never returned to the browser.
- Order checkout validates all item unit prices, shipping zones, and coupons server-side — client-supplied prices are ignored.

## 4. Tracking & Conversion Attribution Strategy
- **Client-side GTM**: Admin-configurable (`GTM-XXXXXXX`) live `<head>` and `<noscript>` injection with Google Consent Mode v2 (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`).
- **Browser DataLayer**: Pushes GA4 ecommerce events (`view_item_list`, `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, reload-guarded `purchase`) with `{ ecommerce: null }` resets and `event_id` deduplication keys.
- **Server-Side Conversion Webhook on Confirmation**: Because Bangladesh COD e-commerce experiences fake/unconfirmed orders at checkout, the signed Conversion Webhook (`Purchase` with `event_id: order_<id>_purchase`) fires **only when staff confirms the order**, preventing wasted ad spend optimization on fake checkouts while sharing exact `event_id` deduplication with browser pixels.

## 5. Coast Design System
- Implements the Coast color tokens (`#EEF5F5` bg, `#FFFFFF` surface, `#0E2A30` ink, `#0E5E6F` primary teal, `#FF6B5B` coral accent, `#D3E3E5` hairlines, `#E0EDEE` image wells), full `.dark` mode token overrides, `Outfit` + `Hind Siliguri` bilingual typography, tabular numerals (`tabular-nums`), and runtime Admin Appearance live overrides.
