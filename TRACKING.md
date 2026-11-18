# Tracking, DataLayer & GTM Implementation Guide (`TRACKING.md`)

## 1. Configuring GTM Without Editing Code
1. Sign in to **Admin (`/admin`)** as **Owner** or **Marketing**.
2. Open **Settings → Tracking (GTM)**.
3. Toggle **Enable GTM** on and enter your container ID (`GTM-XXXXXXX`).
4. Optionally configure **Google Consent Mode v2** defaults (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`) — defaults to `granted` for Bangladesh operations, or `denied` until consent for GDPR regions.
5. Click **Save & Activate Tracking Live**. The storefront immediately injects both the `<script>` in `<head>` and `<noscript><iframe>` in `<body>` across all storefront routes (never on `/admin`).
6. An importable GTM container blueprint is included at `/gtm-container.json`.

## 2. Click ID & UTM Attribution Capture
On landing (`src/lib/attribution.ts`), the storefront automatically captures and persists attribution parameters for **90 days** across both first-party cookies and `localStorage`:
- **Meta**: `fbclid` (auto-formats Meta cookie `fbc = fb.1.<ts>.<fbclid>`), `_fbp` (`fbp`)
- **TikTok**: `ttclid`, `_ttp` (`ttp`)
- **Google Ads**: `gclid`, `gbraid`, `wbraid`
- **Microsoft / X / LinkedIn / Snapchat / Pinterest**: `msclkid`, `twclid`, `li_fat_id`, `ScCid`, `epik`
- **UTM Parameters**: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `landing_page`, `referrer`

These values are stored on every placed order (`orders.attribution`) and incomplete checkout (`incomplete_orders.attribution`), and forwarded inside the Conversion Webhook payload.

## 3. GA4 `window.dataLayer` Events
Every ecommerce push in `src/lib/datalayer.ts` resets `{ ecommerce: null }` first and emits `currency: "BDT"` plus a unique `event_id`:

| Event | Trigger Location | Deduplication `event_id` | Key Fields |
|---|---|---|---|
| `page_view` | Route transition (storefront only) | `page_view.<ts>.<rand>` | `page_type`, `page_location`, `page_title` |
| `view_item_list` | Home / Shop / Category grids | `view_item_list.<ts>.<rand>` | `item_list_name`, `items[]` |
| `select_item` | Clicking a product card | `select_item.<ts>.<rand>` | `item_list_name`, `items[]` |
| `view_item` | Opening Product Detail Page | `view_item.<ts>.<rand>` | `value`, `items[]` |
| `add_to_cart` | Clicking Add to Cart / + qty | `add_to_cart.<ts>.<rand>` | `value`, `items[]` |
| `remove_from_cart` | Decreasing qty / removing item | `remove_from_cart.<ts>.<rand>` | `value`, `items[]` |
| `view_cart` | Opening Cart Drawer or `/cart` | `view_cart.<ts>.<rand>` | `value`, `items[]` |
| `begin_checkout` | Loading `/checkout` | `begin_checkout.<ts>.<rand>` | `value`, `coupon`, `items[]` |
| `add_shipping_info` | Selecting BD District / Zone | `add_shipping_info.<ts>.<rand>` | `shipping_tier`, `items[]` |
| `add_payment_info` | Selecting COD / bKash / Nagad / Card | `add_payment_info.<ts>.<rand>` | `payment_type`, `items[]` |
| `purchase` | Thank-You Page (once per session) | `order_<order_number>_purchase` | `transaction_id`, `value`, `shipping`, `discount`, `user_data` |

## 4. Browser + Server Deduplication
Both the Thank-You page `purchase` dataLayer event and the server-side Conversion Webhook `Purchase` event emit the exact same deterministic key:
`event_id = "order_<order_number>_purchase"`

Meta CAPI and Google Ads Enhanced Conversions use `event_id` / `transaction_id` to deduplicate browser and server events automatically.
