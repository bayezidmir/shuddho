# Conversion Webhook on Order Confirmation (`WEBHOOK.md`)

## 1. Firing Lifecycle
In Bangladeshi COD e-commerce, unconfirmed checkouts often contain fake or duplicate phone numbers. Therefore:
- Placing an order at `/checkout` creates an order in `pending` status and **does not** fire the Conversion Webhook.
- When a staff member confirms the order (`pending → confirmed`) in **Admin → Orders**, the backend (`server/tracking.ts`) builds the enriched conversion payload and dispatches an HTTPS `POST` request to all enabled webhook endpoints subscribed to `Purchase`.
- Additional lifecycle events supported: `OrderDelivered` (when courier or staff marks delivered) and `OrderCancelled` (when a previously confirmed order is cancelled).

## 2. HTTP Headers
Every webhook request includes:
- `Content-Type: application/json`
- `X-Store-Event`: `Purchase` | `OrderDelivered` | `OrderCancelled`
- `X-Store-Signature`: `sha256=<HMAC_SHA256_HEX_OF_RAW_BODY>`
- `X-Store-Timestamp`: Unix epoch seconds
- `Idempotency-Key`: `order_<order_number>_purchase` (matches browser GA4 `event_id`)

## 3. Payload Schema
```json
{
  "event_name": "Purchase",
  "event_id": "order_10251_purchase",
  "event_time": 1794994128,
  "action_source": "website",
  "test_event": false,
  "order_status": "confirmed",
  "order": {
    "id": "10251",
    "created_at": "2026-11-18 09:10:00",
    "confirmed_at": "2026-11-18T09:15:22.000Z",
    "confirmed_by": "owner@shuddho.com.bd",
    "currency": "BDT",
    "value": 1570,
    "subtotal": 1500,
    "shipping": 70,
    "discount": 0,
    "tax": 0,
    "coupon": null,
    "payment_method": "Cash on delivery",
    "payment_status": "unpaid",
    "num_items": 2,
    "items": [
      {
        "item_id": "SH-HNY-500",
        "item_name": "Sundarban Raw Khalisha Honey",
        "item_category": "Raw Honey",
        "item_variant": "500g",
        "price": 750,
        "quantity": 2
      }
    ]
  },
  "customer": {
    "external_id": "cust_8801711482910",
    "name": "Tariqul Islam",
    "phone": "+8801711482910",
    "email": "tariq@example.com",
    "city": "Dhaka",
    "district": "Dhaka",
    "address": "House 12, Road 4, Dhanmondi",
    "country": "BD",
    "is_returning": false
  },
  "user_data_hashed": {
    "ph": "<sha256_hex_of_8801711482910>",
    "em": "<sha256_hex_of_email>",
    "fn": "<sha256_hex_of_firstname>",
    "ln": "<sha256_hex_of_lastname>",
    "ct": "<sha256_hex_of_district>",
    "country": "<sha256_hex_of_bd>",
    "external_id": "<sha256_hex_of_external_id>"
  },
  "click_ids": {
    "fbc": "fb.1.1794994000.IwAR2TestClick123",
    "fbp": "fb.1.1794994000.99881122",
    "fbclid": "IwAR2TestClick123",
    "ttclid": null,
    "ttp": null,
    "gclid": null,
    "gbraid": null,
    "wbraid": null,
    "msclkid": null,
    "twclid": null,
    "li_fat_id": null,
    "ScCid": null,
    "epik": null
  },
  "attribution": {
    "utm_source": "facebook",
    "utm_medium": "cpc",
    "utm_campaign": "winter_honey",
    "landing_page": "https://shuddho.com.bd/?fbclid=IwAR2TestClick123",
    "referrer": null
  },
  "context": {
    "client_ip_address": "103.112.55.21",
    "client_user_agent": "Mozilla/5.0...",
    "event_source_url": "https://shuddho.com.bd/checkout"
  }
}
```

## 4. Signature Verification Examples
### Node.js / Express
```js
import crypto from 'node:crypto';

function verifyShuddhoWebhook(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader || ''));
}
```

### PHP
```php
<?php
$rawBody = file_get_contents('php://input');
$expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);
if (!hash_equals($expected, $_SERVER['HTTP_X_STORE_SIGNATURE'] ?? '')) {
  http_response_code(401);
  exit('Invalid signature');
}
```

## 5. Mapping to Server GTM / Meta CAPI / TikTok / Google Ads
- **Meta Conversions API**: Map `event_name`, `event_id`, `event_time`, `action_source`, `user_data` (`ph`, `em`, `fn`, `ln`, `ct`, `country`, `fbc`, `fbp`, `client_ip_address`, `client_user_agent`), and `custom_data` (`currency: "BDT"`, `value: order.value`, `contents`).
- **TikTok Events API**: Map `event: "CompletePayment"`, `event_id`, `context.ad.callback = click_ids.ttclid`, `context.user` (`phone_number: user_data_hashed.ph`, `ttp: click_ids.ttp`), and `properties` (`value`, `currency: "BDT"`).
- **Google Ads Offline Conversions**: Map `gclid = click_ids.gclid`, `order_id = order.id`, `conversion_value = order.value`, `currency_code = "BDT"`.

## 6. Retries & SSRF Safety
- Failed deliveries (non-2xx or timeout >8s) are automatically retried at **1m → 5m → 30m → 2h → 12h**.
- Endpoint URLs must use `https://` and block localhost (`127.0.0.1`), link-local (`169.254.x.x`), and private RFC-1918 ranges.
