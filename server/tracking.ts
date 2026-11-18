import crypto from 'node:crypto';
import net from 'node:net';
import { db, getSetting } from './db';

export function sha256Lower(val: string | null | undefined): string | null {
  if (!val) return null;
  const clean = val.trim().toLowerCase();
  if (!clean) return null;
  return crypto.createHash('sha256').update(clean).digest('hex');
}

export function normalizePhoneForHash(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Meta/Google E.164 without '+'
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('01') && digits.length === 11) {
    return `88${digits}`;
  }
  return digits;
}

export function isPrivateOrUnsafeUrl(rawUrl: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'Invalid URL format.' };
  }
  if (parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Conversion webhook endpoint URL must use HTTPS.' };
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0') {
    return { safe: false, reason: 'Localhost and .local hostnames are blocked for SSRF protection.' };
  }
  if (net.isIP(host)) {
    const parts = host.split('.').map(Number);
    if (
      parts[0] === 127 ||
      parts[0] === 10 ||
      parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd')
    ) {
      return { safe: false, reason: 'Private IP addresses are blocked for SSRF protection.' };
    }
  }
  return { safe: true };
}

export function signWebhookPayload(rawBody: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function buildConversionPayload(
  orderId: string,
  eventName: 'Purchase' | 'OrderDelivered' | 'OrderCancelled' | 'OrderPlaced',
  includeHashedPii = true,
  isTest = false,
) {
  const general = getSetting<{ storeName: string; domain: string }>('general', {
    storeName: 'Shuddho',
    domain: 'shuddho.com.bd',
  });

  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(orderId, orderId) as Record<string, any> | undefined;
  if (!order) return null;

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as Record<string, any>[];
  let attr: Record<string, any> = {};
  try {
    attr = JSON.parse(order.attribution || '{}');
  } catch {
    attr = {};
  }
  const clickIds = attr.click_ids || {};

  const priorCountRow = db
    .prepare('SELECT COUNT(*) as c FROM orders WHERE customer_phone = ? AND id != ?')
    .get(order.customer_phone, order.id) as { c: number };
  const isReturning = (priorCountRow?.c ?? 0) > 0;

  const nameParts = String(order.customer_name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const phoneForHash = normalizePhoneForHash(order.customer_phone);

  const eventSuffix =
    eventName === 'Purchase'
      ? 'purchase'
      : eventName === 'OrderDelivered'
        ? 'delivered'
        : eventName === 'OrderCancelled'
          ? 'cancelled'
          : 'placed';

  const eventId = `order_${order.order_number}_${eventSuffix}`;
  const externalId = `cust_${phoneForHash || order.customer_id || order.order_number}`;

  const payload: Record<string, unknown> = {
    event_name: eventName,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    test_event: isTest,
    order_status: order.status,
    order: {
      id: order.order_number,
      created_at: order.created_at,
      confirmed_at: order.confirmed_at || new Date().toISOString(),
      confirmed_by: order.confirmed_by || 'staff@' + general.domain,
      currency: 'BDT',
      value: order.total,
      subtotal: order.subtotal,
      shipping: order.shipping_fee,
      discount: order.discount,
      tax: order.tax,
      coupon: order.coupon_code || null,
      payment_method: order.payment_method === 'cod' ? 'Cash on delivery' : order.payment_method,
      payment_status: order.payment_status,
      num_items: items.reduce((s, i) => s + Number(i.quantity), 0),
      items: items.map((i) => ({
        item_id: i.sku,
        item_name: i.name,
        item_category: i.category || 'Natural Food',
        item_variant: i.variant_label || 'Standard',
        price: i.unit_price,
        quantity: i.quantity,
      })),
    },
    customer: {
      external_id: externalId,
      name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email || null,
      city: order.district,
      district: order.district,
      address: order.address,
      country: 'BD',
      is_returning: isReturning,
    },
    click_ids: {
      fbc: clickIds.fbc || null,
      fbp: clickIds.fbp || null,
      fbclid: clickIds.fbclid || null,
      ttclid: clickIds.ttclid || null,
      ttp: clickIds.ttp || null,
      gclid: clickIds.gclid || null,
      gbraid: clickIds.gbraid || null,
      wbraid: clickIds.wbraid || null,
      msclkid: clickIds.msclkid || null,
      twclid: clickIds.twclid || null,
      li_fat_id: clickIds.li_fat_id || null,
      ScCid: clickIds.ScCid || null,
      epik: clickIds.epik || null,
    },
    attribution: {
      utm_source: attr.utm_source || null,
      utm_medium: attr.utm_medium || null,
      utm_campaign: attr.utm_campaign || null,
      utm_content: attr.utm_content || null,
      utm_term: attr.utm_term || null,
      landing_page: attr.landing_page || `https://${general.domain}/`,
      referrer: attr.referrer || null,
      first_touch_at: attr.first_touch_at || order.created_at,
    },
    context: {
      client_ip_address: order.client_ip || '103.112.55.21',
      client_user_agent: order.user_agent || 'Mozilla/5.0',
      event_source_url: `https://${general.domain}/checkout`,
    },
  };

  if (includeHashedPii) {
    payload.user_data_hashed = {
      ph: sha256Lower(phoneForHash),
      em: sha256Lower(order.customer_email),
      fn: sha256Lower(firstName),
      ln: sha256Lower(lastName),
      ct: sha256Lower(order.district),
      country: sha256Lower('bd'),
      external_id: sha256Lower(externalId),
    };
  }

  return payload;
}

const RETRY_DELAYS_MINUTES = [1, 5, 30, 120, 720];

export async function dispatchWebhookDelivery(deliveryId: string): Promise<{ ok: boolean; status: number; durationMs: number }> {
  const row = db.prepare(`
    SELECT d.*, e.url, e.secret, e.name as endpoint_name
    FROM webhook_deliveries d
    JOIN webhook_endpoints e ON e.id = d.endpoint_id
    WHERE d.id = ?
  `).get(deliveryId) as Record<string, any> | undefined;

  if (!row) return { ok: false, status: 0, durationMs: 0 };

  const safety = isPrivateOrUnsafeUrl(row.url);
  if (!safety.safe) {
    db.prepare(`
      UPDATE webhook_deliveries
      SET status = 'failed', http_status = 400, response_body = ?, attempts = attempts + 1
      WHERE id = ?
    `).run(safety.reason || 'Blocked unsafe URL', deliveryId);
    return { ok: false, status: 400, durationMs: 0 };
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signWebhookPayload(row.payload, row.secret);
  const start = Date.now();
  let httpStatus = 0;
  let responseBody = '';
  let ok = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(row.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Store-Event': row.event_name,
        'X-Store-Signature': signature,
        'X-Store-Timestamp': timestamp,
        'Idempotency-Key': row.event_id,
      },
      body: row.payload,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    httpStatus = resp.status;
    responseBody = (await resp.text()).slice(0, 2000);
    ok = resp.ok;
  } catch (err: any) {
    httpStatus = 0;
    responseBody = err?.message || 'Network/timeout error delivering webhook';
  }

  const durationMs = Date.now() - start;
  const attempts = Number(row.attempts) + 1;

  if (ok) {
    db.prepare(`
      UPDATE webhook_deliveries
      SET status = 'delivered', http_status = ?, response_body = ?, duration_ms = ?, attempts = ?, next_retry_at = NULL
      WHERE id = ?
    `).run(httpStatus, responseBody, durationMs, attempts, deliveryId);
  } else {
    const delayMin = RETRY_DELAYS_MINUTES[attempts - 1];
    const nextStatus = delayMin ? 'retrying' : 'failed';
    const nextRetryAt = delayMin ? new Date(Date.now() + delayMin * 60 * 1000).toISOString() : null;
    db.prepare(`
      UPDATE webhook_deliveries
      SET status = ?, http_status = ?, response_body = ?, duration_ms = ?, attempts = ?, next_retry_at = ?
      WHERE id = ?
    `).run(nextStatus, httpStatus, responseBody, durationMs, attempts, nextRetryAt, deliveryId);
  }

  return { ok, status: httpStatus, durationMs };
}

export async function triggerOrderConversionEvent(
  orderId: string,
  eventName: 'Purchase' | 'OrderDelivered' | 'OrderCancelled' | 'OrderPlaced',
  options: { forceResend?: boolean; isTest?: boolean } = {},
) {
  const endpoints = db.prepare('SELECT * FROM webhook_endpoints WHERE enabled = 1').all() as Record<string, any>[];
  const results: Array<{ endpointId: string; deliveryId: string; ok: boolean; status: number }> = [];

  for (const ep of endpoints) {
    let events: string[] = [];
    try {
      events = JSON.parse(ep.events || '[]');
    } catch {
      events = [];
    }
    if (!options.isTest && !events.includes(eventName)) continue;

    const payloadObj = buildConversionPayload(orderId, eventName, Boolean(ep.include_hashed_pii), Boolean(options.isTest));
    if (!payloadObj) continue;

    const eventId = String(payloadObj.event_id);
    // Deduplicate unless forced resend or test
    if (!options.forceResend && !options.isTest) {
      const existing = db
        .prepare(`SELECT id FROM webhook_deliveries WHERE endpoint_id = ? AND event_id = ? AND status = 'delivered'`)
        .get(ep.id, eventId) as { id: string } | undefined;
      if (existing) continue;
    }

    const deliveryId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO webhook_deliveries (id, endpoint_id, order_id, event_name, event_id, payload, status, attempts)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)
    `).run(deliveryId, ep.id, orderId, eventName, eventId, JSON.stringify(payloadObj, null, 2));

    const res = await dispatchWebhookDelivery(deliveryId);
    results.push({ endpointId: ep.id, deliveryId, ok: res.ok, status: res.status });
  }

  return results;
}

export async function processRetryQueue() {
  const due = db.prepare(`
    SELECT id FROM webhook_deliveries
    WHERE status = 'retrying' AND next_retry_at IS NOT NULL AND next_retry_at <= ?
    LIMIT 10
  `).all(new Date().toISOString()) as { id: string }[];

  for (const d of due) {
    await dispatchWebhookDelivery(d.id);
  }
}
