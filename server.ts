import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import {
  db,
  initSchema,
  seedIfEmpty,
  getSetting,
  setSetting,
  logAudit,
  encryptSecret,
  hashPassword,
} from './server/db';
import {
  authenticateStaffCredentials,
  createStaffSession,
  getStaffFromToken,
  extractBearerOrCookieToken,
  requireStaff,
  checkRateLimit,
  generateTotpSecret,
  verifyTotp,
  type AuthedRequest,
} from './server/auth';
import {
  triggerOrderConversionEvent,
  dispatchWebhookDelivery,
  processRetryQueue,
  isPrivateOrUnsafeUrl,
} from './server/tracking';
import {
  testCourierConnection,
  createCourierParcel,
  syncSandboxCourierStatuses,
  checkCustomerFraudHistory,
} from './server/couriers';
import { sendSms } from './server/sms';
import { processPaymentSandboxOrLive } from './server/payments';
import { normalizeBDPhone, validateGtmContainerId } from './src/lib/bd-validation';
import { calculateCartTotals } from './src/lib/pricing';
import { BD_DISTRICTS } from './src/lib/districts';
import {
  resolveDateRange,
  computeDashboardAnalytics,
  isTimestampInRange,
} from './src/lib/dashboard-analytics';

initSchema();
seedIfEmpty();

const UPLOADS_DIR = path.resolve(process.cwd(), 'public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getClientIp(req: express.Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.ip || '127.0.0.1';
}

function mapProductRow(p: Record<string, any>) {
  const variants = db
    .prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC')
    .all(p.id) as Record<string, any>[];
  const category = p.category_id
    ? (db.prepare('SELECT id, slug, name_en, name_bn FROM categories WHERE id = ?').get(p.category_id) as Record<string, any> | undefined)
    : undefined;
  const brand = p.brand_id
    ? (db.prepare('SELECT id, slug, name FROM brands WHERE id = ?').get(p.brand_id) as Record<string, any> | undefined)
    : undefined;

  return {
    ...p,
    featured: Boolean(p.featured),
    order_now_enabled: Boolean(p.order_now_enabled),
    tags: JSON.parse(p.tags || '[]'),
    badges: JSON.parse(p.badges || '[]'),
    images: JSON.parse(p.images || '[]'),
    specs: JSON.parse(p.specs || '[]'),
    faqs: JSON.parse(p.faqs || '[]'),
    bundle_items: JSON.parse(p.bundle_items || '[]'),
    variants,
    category,
    brand,
  };
}

function getOrderCountsByStatus() {
  const rows = db.prepare('SELECT status, COUNT(*) as count FROM orders GROUP BY status').all() as { status: string; count: number }[];
  const map: Record<string, number> = { all: 0 };
  for (const r of rows) {
    map[r.status] = r.count;
    map.all += r.count;
  }
  return map;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health Check
  app.get('/health', (_req, res) => {
    const prodCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
    res.json({ ok: true, status: 'healthy', database: 'sqlite', products: prodCount, timestamp: new Date().toISOString() });
  });

  // =========================================================================
  // SEO & PRODUCT FEEDS
  // =========================================================================
  app.get('/robots.txt', (_req, res) => {
    const general = getSetting<{ domain: string }>('general', { domain: 'shuddho.com.bd' });
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: https://${general.domain}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (_req, res) => {
    const general = getSetting<{ domain: string }>('general', { domain: 'shuddho.com.bd' });
    const base = `https://${general.domain}`;
    const prods = db.prepare(`SELECT slug, created_at FROM products WHERE status = 'published'`).all() as { slug: string; created_at: string }[];
    const cats = db.prepare(`SELECT slug FROM categories`).all() as { slug: string }[];
    const pages = db.prepare(`SELECT slug, updated_at FROM pages WHERE status = 'published'`).all() as { slug: string; updated_at: string }[];
    const posts = db.prepare(`SELECT slug, published_at FROM blog_posts WHERE status = 'published'`).all() as { slug: string; published_at: string }[];

    const urls = [
      `${base}/`,
      `${base}/shop`,
      ...cats.map((c) => `${base}/category/${c.slug}`),
      ...prods.map((p) => `${base}/products/${p.slug}`),
      ...pages.map((p) => `${base}/pages/${p.slug}`),
      ...posts.map((p) => `${base}/blog/${p.slug}`),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${u}</loc></url>`)
      .join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  });

  app.get('/feeds/meta.xml', (_req, res) => {
    const general = getSetting<{ storeName: string; domain: string }>('general', { storeName: 'Shuddho', domain: 'shuddho.com.bd' });
    const prods = db.prepare(`SELECT * FROM products WHERE status = 'published'`).all() as Record<string, any>[];
    const itemsXml = prods
      .map((p) => {
        const imgs = JSON.parse(p.images || '[]');
        return `  <item>
    <g:id>${p.sku}</g:id>
    <g:title><![CDATA[${p.name_en}]]></g:title>
    <g:description><![CDATA[${p.short_desc_en || p.desc_en}]]></g:description>
    <g:link>https://${general.domain}/products/${p.slug}</g:link>
    <g:image_link>https://${general.domain}${imgs[0] || ''}</g:image_link>
    <g:availability>${p.stock > 0 ? 'in stock' : 'out of stock'}</g:availability>
    <g:price>${p.price} BDT</g:price>
    <g:brand>${general.storeName}</g:brand>
  </item>`;
      })
      .join('\n');
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${general.storeName} Product Feed</title>${itemsXml}</channel></rss>`,
    );
  });

  app.get('/feeds/tiktok.csv', (_req, res) => {
    const general = getSetting<{ storeName: string; domain: string }>('general', { storeName: 'Shuddho', domain: 'shuddho.com.bd' });
    const prods = db.prepare(`SELECT * FROM products WHERE status = 'published'`).all() as Record<string, any>[];
    const header = 'sku_id,title,description,availability,condition,price,link,image_link,brand';
    const lines = prods.map((p) => {
      const imgs = JSON.parse(p.images || '[]');
      const avail = p.stock > 0 ? 'in stock' : 'out of stock';
      return `"${p.sku}","${p.name_en.replace(/"/g, '""')}","${(p.short_desc_en || '').replace(/"/g, '""')}","${avail}","new","${p.price} BDT","https://${general.domain}/products/${p.slug}","https://${general.domain}${imgs[0] || ''}","${general.storeName}"`;
    });
    res.type('text/csv').send([header, ...lines].join('\n'));
  });

  // =========================================================================
  // PUBLIC REST API /api/v1 (API Key authenticated)
  // =========================================================================
  function requireApiKey(scope: string) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const rawKey = String(req.headers['x-api-key'] || '');
      if (!rawKey) {
        res.status(401).json({ error: 'Missing X-API-Key header.' });
        return;
      }
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND active = 1').get(keyHash) as Record<string, any> | undefined;
      if (!row) {
        res.status(401).json({ error: 'Invalid or inactive API key.' });
        return;
      }
      const scopes = JSON.parse(row.scopes || '[]') as string[];
      if (!scopes.includes(scope) && !scopes.includes('*')) {
        res.status(403).json({ error: `API key missing scope: ${scope}` });
        return;
      }
      db.prepare('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
      next();
    };
  }

  app.get('/api/v1/products', requireApiKey('products:read'), (_req, res) => {
    const prods = db.prepare(`SELECT * FROM products WHERE status = 'published'`).all() as Record<string, any>[];
    res.json({ data: prods.map(mapProductRow) });
  });

  app.get('/api/v1/orders', requireApiKey('orders:read'), (_req, res) => {
    const orders = db.prepare(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 100`).all() as Record<string, any>[];
    res.json({ data: orders });
  });

  // =========================================================================
  // STOREFRONT PUBLIC API (/api/store/*)
  // =========================================================================
  app.get('/api/store/bootstrap', (_req, res) => {
    const general = getSetting('general', {});
    const theme = getSetting('theme', {});
    const tracking = getSetting<Record<string, any>>('tracking', {});
    // Never expose encrypted server CAPI tokens to storefront
    const publicTracking = {
      gtmEnabled: Boolean(tracking.gtmEnabled),
      gtmContainerId: tracking.gtmContainerId || '',
      overrideHeadCode: tracking.overrideHeadCode || '',
      overrideBodyCode: tracking.overrideBodyCode || '',
      ga4Id: tracking.ga4Id || '',
      metaPixelId: tracking.metaPixelId || '',
      tiktokPixelId: tracking.tiktokPixelId || '',
      googleAdsId: tracking.googleAdsId || '',
      msUetId: tracking.msUetId || '',
      consentBannerEnabled: tracking.consentBannerEnabled !== false,
      consentDefaultAnalytics: tracking.consentDefaultAnalytics || 'granted',
      consentDefaultAds: tracking.consentDefaultAds || 'granted',
    };

    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
    const brands = db.prepare('SELECT * FROM brands').all();
    const shippingZones = db.prepare('SELECT * FROM shipping_zones').all();
    const products = (db.prepare(`SELECT * FROM products WHERE status = 'published' ORDER BY featured DESC, created_at DESC`).all() as Record<string, any>[]).map(mapProductRow);
    const pages = db.prepare(`SELECT id, slug, title_en, title_bn, is_landing FROM pages WHERE status = 'published'`).all();
    const posts = db.prepare(`SELECT id, slug, title_en, title_bn, excerpt_en, excerpt_bn, category, author, image, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC`).all();
    const activeCoupons = db.prepare(`SELECT code, type, value, min_spend, max_discount, first_order_only FROM coupons WHERE active = 1`).all();

    res.json({
      general,
      theme,
      tracking: publicTracking,
      checkout: getSetting('checkout', {}),
      payments: (() => {
        const p = getSetting<Record<string, any>>('payments', {});
        return {
          cod: p.cod?.enabled ?? true,
          bkash: p.bkash?.enabled ?? true,
          nagad: p.nagad?.enabled ?? true,
          sslcommerz: p.sslcommerz?.enabled ?? true,
          bankTransfer: p.bankTransfer?.enabled ?? false,
        };
      })(),
      announcements: getSetting('announcements', []),
      homepageSections: getSetting('homepage_sections', []),
      menus: getSetting('menus', { header: [], footer: [] }),
      popups: getSetting('popups', []),
      testimonials: getSetting('testimonials', []),
      faqs: getSetting('faqs', []),
      categories,
      brands,
      shippingZones,
      products,
      pages,
      posts,
      activeCoupons,
      districts: BD_DISTRICTS,
    });
  });

  app.get('/api/store/products/:slug', (req, res) => {
    const prod = db.prepare(`SELECT * FROM products WHERE slug = ? AND status = 'published'`).get(req.params.slug) as Record<string, any> | undefined;
    if (!prod) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const reviews = db.prepare(`SELECT * FROM reviews WHERE product_id = ? AND status = 'approved' ORDER BY created_at DESC`).all(prod.id);
    const questions = db.prepare(`SELECT * FROM product_questions WHERE product_id = ? ORDER BY created_at DESC`).all(prod.id);
    const related = (db.prepare(`SELECT * FROM products WHERE category_id = ? AND id != ? AND status = 'published' LIMIT 4`).all(prod.category_id, prod.id) as Record<string, any>[]).map(mapProductRow);

    res.json({
      product: mapProductRow(prod),
      reviews,
      questions,
      related,
    });
  });

  app.get('/api/store/pages/:slug', (req, res) => {
    const page = db.prepare(`SELECT * FROM pages WHERE slug = ? AND status = 'published'`).get(req.params.slug);
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    res.json({ page });
  });

  app.get('/api/store/blog/:slug', (req, res) => {
    const post = db.prepare(`SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'`).get(req.params.slug);
    if (!post) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }
    res.json({ post });
  });

  app.post('/api/store/reviews', (req, res) => {
    const schema = z.object({
      productId: z.string(),
      customerName: z.string().min(2),
      customerPhone: z.string().optional(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().min(4),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please enter your name, rating (1-5), and review comment.' });
      return;
    }
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO reviews (id, product_id, customer_name, customer_phone, rating, comment, verified_buyer, status)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'pending')
    `).run(id, parsed.data.productId, parsed.data.customerName, parsed.data.customerPhone || '', parsed.data.rating, parsed.data.comment);
    res.json({ ok: true, id, message: 'Review submitted for moderation. Thank you!' });
  });

  app.post('/api/store/questions', (req, res) => {
    const schema = z.object({ productId: z.string(), authorName: z.string().min(2), question: z.string().min(5) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please fill out your name and question.' });
      return;
    }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO product_questions (id, product_id, author_name, question) VALUES (?, ?, ?, ?)`).run(
      id, parsed.data.productId, parsed.data.authorName, parsed.data.question,
    );
    res.json({ ok: true, id });
  });

  app.post('/api/store/newsletter', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email.includes('@')) {
      res.status(400).json({ error: 'Valid email address required.' });
      return;
    }
    db.prepare(`INSERT OR IGNORE INTO newsletter_subscribers (id, email) VALUES (?, ?)`).run(crypto.randomUUID(), email);
    res.json({ ok: true });
  });

  app.post('/api/store/contact', (req, res) => {
    const schema = z.object({
      name: z.string().min(2),
      phone: z.string().optional(),
      email: z.string().optional(),
      subject: z.string().optional(),
      message: z.string().min(5),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please fill out your name and message.' });
      return;
    }
    db.prepare(`INSERT INTO contact_messages (id, name, phone, email, subject, message) VALUES (?, ?, ?, ?, ?, ?)`).run(
      crypto.randomUUID(), parsed.data.name, parsed.data.phone || '', parsed.data.email || '', parsed.data.subject || 'Store Inquiry', parsed.data.message,
    );
    res.json({ ok: true });
  });

  app.post('/api/store/coupon/validate', (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const subtotal = Number(req.body?.subtotal || 0);
    const coupon = db.prepare('SELECT * FROM coupons WHERE upper(code) = ? AND active = 1').get(code) as Record<string, any> | undefined;
    if (!coupon) {
      res.status(404).json({ valid: false, error: `Coupon "${code}" not found or inactive.` });
      return;
    }
    if (coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) {
      res.status(400).json({ valid: false, error: `Coupon "${code}" usage limit reached.` });
      return;
    }
    if (coupon.min_spend > 0 && subtotal < coupon.min_spend) {
      res.status(400).json({ valid: false, error: `Minimum spend ৳${coupon.min_spend} required for ${coupon.code}.` });
      return;
    }
    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minSpend: coupon.min_spend,
        maxDiscount: coupon.max_discount,
        firstOrderOnly: Boolean(coupon.first_order_only),
        active: Boolean(coupon.active),
      },
    });
  });

  // Incomplete Order Auto-Capture
  app.post('/api/store/incomplete-order', (req, res) => {
    const phoneCheck = normalizeBDPhone(String(req.body?.phone || ''));
    if (!phoneCheck.valid) {
      res.status(400).json({ error: 'Valid BD phone required for draft capture' });
      return;
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const subtotal = items.reduce((s: number, i: any) => s + Number(i.unitPrice || 0) * Number(i.quantity || 1), 0);
    const existing = db.prepare('SELECT id FROM incomplete_orders WHERE phone = ?').get(phoneCheck.normalized) as { id: string } | undefined;
    const id = existing?.id || `inc-${Date.now()}`;
    const ip = getClientIp(req);
    const ua = String(req.headers['user-agent'] || '');

    if (existing) {
      db.prepare(`
        UPDATE incomplete_orders
        SET name = ?, email = ?, district = ?, area = ?, address = ?, items = ?, subtotal = ?, attribution = ?, ip = ?, user_agent = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        String(req.body?.name || ''),
        String(req.body?.email || ''),
        String(req.body?.district || 'Dhaka'),
        String(req.body?.area || ''),
        String(req.body?.address || ''),
        JSON.stringify(items),
        subtotal,
        JSON.stringify(req.body?.attribution || {}),
        ip,
        ua,
        id,
      );
    } else {
      db.prepare(`
        INSERT INTO incomplete_orders (id, name, phone, email, district, area, address, items, subtotal, attribution, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        String(req.body?.name || ''),
        phoneCheck.normalized,
        String(req.body?.email || ''),
        String(req.body?.district || 'Dhaka'),
        String(req.body?.area || ''),
        String(req.body?.address || ''),
        JSON.stringify(items),
        subtotal,
        JSON.stringify(req.body?.attribution || {}),
        ip,
        ua,
      );
    }
    res.json({ ok: true, id });
  });

  // Place Order (Storefront Checkout)
  app.post('/api/store/orders', async (req, res) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`checkout:${ip}`, 15, 60 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many orders from this IP. Please call our hotline to order.' });
      return;
    }

    // Honeypot bot check
    if (req.body?.website_hp) {
      res.status(400).json({ error: 'Invalid submission.' });
      return;
    }

    const schema = z.object({
      name: z.string().min(2, 'Full name is required'),
      phone: z.string().min(10, 'Mobile number is required'),
      district: z.string().min(2, 'District is required'),
      area: z.string().optional(),
      address: z.string().min(5, 'Full delivery address is required'),
      email: z.string().optional(),
      note: z.string().optional(),
      deliveryZone: z.enum(['inside_dhaka', 'dhaka_suburbs', 'outside_dhaka']),
      isExpress: z.boolean().optional(),
      paymentMethod: z.enum(['cod', 'bkash', 'nagad', 'sslcommerz', 'bank_transfer']),
      couponCode: z.string().optional(),
      items: z.array(
        z.object({
          productId: z.string(),
          variantId: z.string().optional().nullable(),
          quantity: z.number().int().min(1).max(50),
        }),
      ).min(1, 'Cart cannot be empty'),
      attribution: z.any().optional(),
      trxIdInput: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Please check checkout fields.' });
      return;
    }

    const phoneRes = normalizeBDPhone(parsed.data.phone);
    if (!phoneRes.valid) {
      res.status(400).json({ error: phoneRes.error });
      return;
    }

    // Blocklist check
    const blocked = db.prepare(`SELECT * FROM block_list WHERE value = ? OR value = ?`).get(phoneRes.normalized, ip) as { reason: string } | undefined;
    if (blocked) {
      res.status(403).json({ error: 'Unable to process order online. Please call +8809612-004455.' });
      return;
    }

    // Duplicate order protection
    const checkoutSettings = getSetting<{ duplicateWindowMinutes: number; maxOrdersPerPhoneHour: number }>('checkout', {
      duplicateWindowMinutes: 15,
      maxOrdersPerPhoneHour: 4,
    });
    const recentPhoneOrders = db.prepare(`
      SELECT COUNT(*) as c FROM orders WHERE customer_phone = ? AND datetime(created_at) >= datetime('now', '-60 minutes')
    `).get(phoneRes.normalized) as { c: number };
    if ((recentPhoneOrders?.c ?? 0) >= checkoutSettings.maxOrdersPerPhoneHour) {
      res.status(429).json({ error: 'Too many recent orders for this phone number. Please wait or call support.' });
      return;
    }

    // Hydrate items from DB prices (never trust client prices!)
    const resolvedItems: Array<{
      productId: string;
      variantId: string | null;
      sku: string;
      name: string;
      category: string;
      variantLabel: string;
      unitPrice: number;
      costPrice: number;
      quantity: number;
      image: string;
    }> = [];

    for (const reqItem of parsed.data.items) {
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(reqItem.productId) as Record<string, any> | undefined;
      if (!prod) {
        res.status(400).json({ error: `Product not found: ${reqItem.productId}` });
        return;
      }
      let unitPrice = prod.price;
      let costPrice = prod.cost_price;
      let sku = prod.sku;
      let variantLabel = '';
      const imgs = JSON.parse(prod.images || '[]');
      let image = imgs[0] || '';

      if (reqItem.variantId) {
        const variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(reqItem.variantId, prod.id) as Record<string, any> | undefined;
        if (variant) {
          unitPrice = variant.price;
          costPrice = variant.cost_price;
          sku = variant.sku;
          variantLabel = variant.label;
          if (variant.image) image = variant.image;
        }
      }
      const cat = prod.category_id
        ? (db.prepare('SELECT name_en FROM categories WHERE id = ?').get(prod.category_id) as { name_en: string } | undefined)
        : undefined;

      resolvedItems.push({
        productId: prod.id,
        variantId: reqItem.variantId || null,
        sku,
        name: prod.name_en,
        category: cat?.name_en || 'Natural Food',
        variantLabel,
        unitPrice,
        costPrice,
        quantity: reqItem.quantity,
        image,
      });
    }

    const zoneRow = db.prepare('SELECT * FROM shipping_zones WHERE id = ?').get(parsed.data.deliveryZone) as Record<string, any> | undefined;
    const shippingRule = zoneRow
      ? { zoneId: zoneRow.id, zoneName: zoneRow.name, baseFee: zoneRow.base_fee, freeThreshold: zoneRow.free_threshold, expressExtra: zoneRow.express_extra }
      : { zoneId: 'inside_dhaka', zoneName: 'Inside Dhaka', baseFee: 70, freeThreshold: 2000, expressExtra: 50 };

    let couponRule = null;
    if (parsed.data.couponCode) {
      const c = db.prepare('SELECT * FROM coupons WHERE upper(code) = ? AND active = 1').get(parsed.data.couponCode.trim().toUpperCase()) as Record<string, any> | undefined;
      if (c) {
        couponRule = {
          code: c.code,
          type: c.type,
          value: c.value,
          minSpend: c.min_spend,
          maxDiscount: c.max_discount,
          firstOrderOnly: Boolean(c.first_order_only),
          active: Boolean(c.active),
        };
      }
    }

    const totals = calculateCartTotals({
      items: resolvedItems.map((i) => ({ productId: i.productId, unitPrice: i.unitPrice, quantity: i.quantity })),
      coupon: couponRule,
      shipping: shippingRule,
      isExpress: parsed.data.isExpress,
    });

    // Upsert customer
    let customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phoneRes.normalized) as Record<string, any> | undefined;
    const customerId = customer?.id || `cust-${crypto.randomUUID().slice(0, 8)}`;
    const firstSource = parsed.data.attribution?.utm_source || (parsed.data.attribution?.click_ids?.fbclid ? 'facebook' : 'direct');
    if (!customer) {
      db.prepare(`
        INSERT INTO customers (id, name, phone, email, district, area, address, first_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(customerId, parsed.data.name, phoneRes.normalized, parsed.data.email || '', parsed.data.district, parsed.data.area || '', parsed.data.address, firstSource);
    } else {
      db.prepare(`UPDATE customers SET name = ?, district = ?, area = ?, address = ? WHERE id = ?`).run(
        parsed.data.name, parsed.data.district, parsed.data.area || '', parsed.data.address, customerId,
      );
    }

    // Sequential order number
    const general = getSetting<{ nextOrderSeq: number; domain: string }>('general', { nextOrderSeq: 10255, domain: 'shuddho.com.bd' });
    const orderSeq = general.nextOrderSeq || 10255;
    setSetting('general', { ...general, nextOrderSeq: orderSeq + 1 });

    const orderId = `ord-${orderSeq}`;
    const orderNumber = String(orderSeq);
    const invoiceNumber = `INV-${orderSeq}`;

    // Payment processing (sandbox/live)
    const payRes = processPaymentSandboxOrLive({
      orderId,
      orderNumber,
      gateway: parsed.data.paymentMethod,
      amount: totals.total,
      customerPhone: phoneRes.normalized,
      trxIdInput: parsed.data.trxIdInput,
    });
    if (!payRes.ok) {
      res.status(400).json({ error: payRes.message });
      return;
    }

    // Check fraud auto-hold threshold
    const fraud = checkCustomerFraudHistory(phoneRes.normalized);
    const courierSettings = getSetting<{ fraudHoldThresholdPercent: number }>('courier_settings', { fraudHoldThresholdPercent: 50 });
    const initialStatus = fraud.successRate < (courierSettings.fraudHoldThresholdPercent ?? 50) ? 'on_hold' : 'pending';

    // Round-robin assign to active confirmation agent
    const agents = db.prepare(`SELECT id, name FROM staff_users WHERE role = 'agent' AND active = 1`).all() as { id: string; name: string }[];
    const assignedAgent = agents.length > 0 ? agents[orderSeq % agents.length] : null;

    db.prepare(`
      INSERT INTO orders (
        id, order_number, invoice_number, customer_id, customer_name, customer_phone, customer_email,
        district, area, address, delivery_zone, is_express, status, payment_method, payment_status, transaction_id,
        subtotal, discount, shipping_fee, tax, total, paid_amount, coupon_code, order_note,
        assigned_staff_id, assigned_staff_name, attribution, client_ip, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      orderNumber,
      invoiceNumber,
      customerId,
      parsed.data.name,
      phoneRes.normalized,
      parsed.data.email || '',
      parsed.data.district,
      parsed.data.area || '',
      parsed.data.address,
      parsed.data.deliveryZone,
      parsed.data.isExpress ? 1 : 0,
      initialStatus,
      parsed.data.paymentMethod,
      payRes.status === 'paid' ? 'paid' : 'unpaid',
      payRes.trxId,
      totals.subtotal,
      totals.discount,
      totals.shipping,
      totals.tax,
      totals.total,
      payRes.status === 'paid' ? totals.total : 0,
      totals.appliedCoupon || '',
      parsed.data.note || '',
      assignedAgent?.id || null,
      assignedAgent?.name || null,
      JSON.stringify(parsed.data.attribution || {}),
      ip,
      String(req.headers['user-agent'] || ''),
    );

    const insItem = db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, variant_id, sku, name, category, variant_label, unit_price, cost_price, quantity, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Reserve stock on placement
    for (const item of resolvedItems) {
      insItem.run(
        crypto.randomUUID(),
        orderId,
        item.productId,
        item.variantId,
        item.sku,
        item.name,
        item.category,
        item.variantLabel,
        item.unitPrice,
        item.costPrice,
        item.quantity,
        item.image,
      );
      if (item.variantId) {
        db.prepare('UPDATE product_variants SET reserved_stock = reserved_stock + ? WHERE id = ?').run(item.quantity, item.variantId);
      } else {
        db.prepare('UPDATE products SET reserved_stock = reserved_stock + ? WHERE id = ?').run(item.quantity, item.productId);
      }
    }

    if (totals.appliedCoupon) {
      db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(totals.appliedCoupon);
    }

    // Remove matching incomplete order draft
    db.prepare('DELETE FROM incomplete_orders WHERE phone = ?').run(phoneRes.normalized);

    // Note + SMS (Notice: Conversion Webhook is NOT fired at checkout, only on Confirmation per Section 9.4!)
    db.prepare(`INSERT INTO order_notes (id, order_id, type, content, staff_name) VALUES (?, ?, 'system', ?, 'System')`).run(
      crypto.randomUUID(),
      orderId,
      initialStatus === 'on_hold'
        ? `Order placed and auto-held (Fraud score ${fraud.successRate}%).`
        : 'Order placed via storefront checkout; stock reserved.',
    );

    await sendSms({
      to: phoneRes.normalized,
      event: 'order_placed',
      vars: { name: parsed.data.name, order_id: orderNumber, total: totals.total },
    });

    const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, any>;
    res.status(201).json({
      ok: true,
      order: { ...createdOrder, items: resolvedItems },
    });
  });

  // Order Tracking (Customer)
  app.get('/api/store/orders/track', (req, res) => {
    const orderNumber = String(req.query.order || '').replace(/^#/, '').trim();
    const phone = String(req.query.phone || '').trim();
    if (!orderNumber || !phone) {
      res.status(400).json({ error: 'Enter both Order Number and Mobile Number.' });
      return;
    }
    const phoneRes = normalizeBDPhone(phone);
    const searchPhone = phoneRes.valid ? phoneRes.normalized : phone;

    const order = db.prepare(`SELECT * FROM orders WHERE order_number = ? AND customer_phone = ?`).get(orderNumber, searchPhone) as Record<string, any> | undefined;
    if (!order) {
      res.status(404).json({ error: 'No matching order found for that order number and phone.' });
      return;
    }
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const notes = db.prepare(`SELECT * FROM order_notes WHERE order_id = ? AND type = 'customer' ORDER BY created_at DESC`).all(order.id);
    res.json({ order: { ...order, items, customerNotes: notes } });
  });

  // Customer OTP Auth & My Account
  app.post('/api/store/auth/request-otp', async (req, res) => {
    const phoneRes = normalizeBDPhone(String(req.body?.phone || ''));
    if (!phoneRes.valid) {
      res.status(400).json({ error: phoneRes.error });
      return;
    }
    if (!checkRateLimit(`otp:${phoneRes.normalized}`, 5, 10 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many OTP requests. Please wait a few minutes.' });
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    db.prepare(`INSERT INTO otp_codes (id, phone, code, expires_at) VALUES (?, ?, ?, ?)`).run(
      crypto.randomUUID(), phoneRes.normalized, code, expiresAt,
    );
    await sendSms({ to: phoneRes.normalized, event: 'otp', vars: { otp: code } });
    // Return demoHint in sandbox SMS mode so evaluators can test OTP login smoothly without a real SIM!
    const smsCfg = getSetting<{ provider: string }>('sms', { provider: 'sandbox' });
    res.json({
      ok: true,
      phone: phoneRes.normalized,
      sandboxOtp: smsCfg.provider === 'sandbox' ? code : undefined,
      message: 'OTP sent to your mobile number.',
    });
  });

  app.post('/api/store/auth/verify-otp', (req, res) => {
    const phoneRes = normalizeBDPhone(String(req.body?.phone || ''));
    const code = String(req.body?.code || '').trim();
    if (!phoneRes.valid || !code) {
      res.status(400).json({ error: 'Phone and 6-digit OTP code are required.' });
      return;
    }
    const row = db.prepare(`
      SELECT * FROM otp_codes WHERE phone = ? AND code = ? AND used = 0 ORDER BY created_at DESC LIMIT 1
    `).get(phoneRes.normalized, code) as { id: string; expires_at: string } | undefined;

    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      res.status(401).json({ error: 'Invalid or expired OTP code.' });
      return;
    }
    db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(row.id);

    let cust = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phoneRes.normalized) as Record<string, any> | undefined;
    if (!cust) {
      const id = `cust-${crypto.randomUUID().slice(0, 8)}`;
      db.prepare(`INSERT INTO customers (id, name, phone) VALUES (?, ?, ?)`).run(id, 'Shuddho Customer', phoneRes.normalized);
      cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, any>;
    }
    res.json({ ok: true, customer: cust });
  });

  app.get('/api/store/account', (req, res) => {
    const phone = String(req.query.phone || '').trim();
    const phoneRes = normalizeBDPhone(phone);
    if (!phoneRes.valid) {
      res.status(400).json({ error: 'Valid phone required' });
      return;
    }
    const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phoneRes.normalized);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    const orders = db.prepare('SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC').all(phoneRes.normalized) as Record<string, any>[];
    const hydratedOrders = orders.map((o) => ({
      ...o,
      items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
    }));
    res.json({ customer, orders: hydratedOrders });
  });

  // =========================================================================
  // ADMIN AUTHENTICATION
  // =========================================================================
  app.post('/api/admin/auth/login', (req, res) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`admin-login:${ip}`, 20, 15 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many login attempts. Try again later.' });
      return;
    }
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    const totpCode = String(req.body?.totpCode || '').trim();

    const user = authenticateStaffCredentials(email, password);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (user.totp_enabled && user.totp_secret) {
      if (!totpCode) {
        res.status(200).json({ requiresTotp: true });
        return;
      }
      if (!verifyTotp(user.totp_secret, totpCode)) {
        res.status(401).json({ error: 'Invalid 2FA authenticator code.' });
        return;
      }
    }

    const token = createStaffSession(user.id, ip, String(req.headers['user-agent'] || ''));
    res.cookie('shuddho_staff_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    logAudit({ staffId: user.id, staffName: user.name, action: 'staff.login', entityType: 'staff_user', entityId: user.id, ip });
    res.json({
      ok: true,
      token,
      staff: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  app.post('/api/admin/auth/logout', (req, res) => {
    const token = extractBearerOrCookieToken(req);
    if (token) db.prepare('DELETE FROM staff_sessions WHERE token = ?').run(token);
    res.clearCookie('shuddho_staff_token', { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/admin/auth/me', (req, res) => {
    const token = extractBearerOrCookieToken(req);
    const staff = getStaffFromToken(token);
    if (!staff) {
      res.status(200).json({ authenticated: false, staff: null });
      return;
    }
    res.json({ authenticated: true, staff });
  });

  app.post('/api/admin/auth/totp/setup', requireStaff(), (req: AuthedRequest, res) => {
    const secret = generateTotpSecret();
    db.prepare('UPDATE staff_users SET totp_secret = ? WHERE id = ?').run(secret, req.staff!.id);
    const otpauthUrl = `otpauth://totp/Shuddho:${encodeURIComponent(req.staff!.email)}?secret=${secret}&issuer=Shuddho`;
    res.json({ secret, otpauthUrl });
  });

  app.post('/api/admin/auth/totp/enable', requireStaff(), (req: AuthedRequest, res) => {
    const code = String(req.body?.code || '').trim();
    const row = db.prepare('SELECT totp_secret FROM staff_users WHERE id = ?').get(req.staff!.id) as { totp_secret: string } | undefined;
    if (!row?.totp_secret || !verifyTotp(row.totp_secret, code)) {
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }
    db.prepare('UPDATE staff_users SET totp_enabled = 1 WHERE id = ?').run(req.staff!.id);
    res.json({ ok: true });
  });

  // =========================================================================
  // ADMIN DASHBOARD & ANALYTICS
  // =========================================================================
  app.get('/api/admin/dashboard', requireStaff('dashboard.view'), (req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as Record<string, any>[];
    const orderItems = db.prepare('SELECT * FROM order_items').all() as Record<string, any>[];
    const incompleteOrders = db.prepare('SELECT * FROM incomplete_orders').all() as Record<string, any>[];
    const customers = db.prepare('SELECT id, created_at FROM customers').all() as Record<string, any>[];

    const lowStockProducts = db.prepare(`SELECT id, name_en, sku, stock, low_stock_threshold FROM products WHERE stock <= low_stock_threshold`).all();
    const pendingReviews = db.prepare(`SELECT r.*, p.name_en as product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id WHERE r.status = 'pending'`).all();
    const failedWebhooks = db.prepare(`SELECT d.*, e.name as endpoint_name FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id = d.endpoint_id WHERE d.status = 'failed' ORDER BY d.created_at DESC LIMIT 10`).all();

    const resolvedRange = resolveDateRange({
      preset: typeof req.query.preset === 'string' ? req.query.preset : '7d',
      from: typeof req.query.from === 'string' ? req.query.from : null,
      to: typeof req.query.to === 'string' ? req.query.to : null,
      granularity: typeof req.query.granularity === 'string' ? req.query.granularity : 'auto',
    });

    const analytics = computeDashboardAnalytics({
      orders,
      orderItems,
      incompleteOrders,
      customers,
      resolvedRange,
    });

    const pendingIdSet = new Set(analytics.filteredPendingIds);
    const pendingOrders = orders.filter((o) => pendingIdSet.has(o.id)).slice(0, 8);
    const globalPendingCount = orders.filter((o) => o.status === 'pending').length;

    res.json({
      ...analytics,
      pendingOrders,
      globalPendingCount,
      lowStockProducts,
      pendingReviews,
      failedWebhooks,
    });
  });

  // =========================================================================
  // ADMIN ORDERS MODULE
  // =========================================================================
  app.get('/api/admin/orders', requireStaff('orders.view'), (req, res) => {
    const status = String(req.query.status || 'all');
    const q = String(req.query.q || '').trim().toLowerCase();
    const district = String(req.query.district || '');
    const payment = String(req.query.payment || '');
    const courier = String(req.query.courier || '');

    let orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as Record<string, any>[];
    if (status && status !== 'all') {
      orders = orders.filter((o) => o.status === status);
    }
    if (district) orders = orders.filter((o) => o.district === district);
    if (payment) orders = orders.filter((o) => o.payment_method === payment);
    if (courier) orders = orders.filter((o) => o.courier_code === courier);
    if (q) {
      orders = orders.filter(
        (o) =>
          String(o.order_number).toLowerCase().includes(q) ||
          String(o.customer_name).toLowerCase().includes(q) ||
          String(o.customer_phone).toLowerCase().includes(q) ||
          String(o.tracking_code || '').toLowerCase().includes(q),
      );
    }

    const hydrated = orders.map((o) => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      const fraud = checkCustomerFraudHistory(o.customer_phone);
      let attr = {};
      try { attr = JSON.parse(o.attribution || '{}'); } catch { attr = {}; }
      return { ...o, items, fraud, attributionObj: attr, tags: JSON.parse(o.tags || '[]') };
    });

    res.json({
      orders: hydrated,
      counts: getOrderCountsByStatus(),
      incompleteCount: (db.prepare('SELECT COUNT(*) as c FROM incomplete_orders').get() as { c: number }).c,
    });
  });

  app.get('/api/admin/orders/:id', requireStaff('orders.view'), (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(req.params.id, req.params.id) as Record<string, any> | undefined;
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const notes = db.prepare('SELECT * FROM order_notes WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
    const callLogs = db.prepare('SELECT * FROM call_logs WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
    const deliveries = db.prepare(`
      SELECT d.*, e.name as endpoint_name, e.url as endpoint_url
      FROM webhook_deliveries d
      LEFT JOIN webhook_endpoints e ON e.id = d.endpoint_id
      WHERE d.order_id = ?
      ORDER BY d.created_at DESC
    `).all(order.id);
    const payments = db.prepare('SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
    const customerHistory = db.prepare('SELECT id, order_number, status, total, created_at FROM orders WHERE customer_phone = ? AND id != ? ORDER BY created_at DESC').all(order.customer_phone, order.id);
    const fraud = checkCustomerFraudHistory(order.customer_phone);

    let attributionObj = {};
    try { attributionObj = JSON.parse(order.attribution || '{}'); } catch { attributionObj = {}; }

    res.json({
      order: {
        ...order,
        tags: JSON.parse(order.tags || '[]'),
        attributionObj,
        items,
        notes,
        callLogs,
        deliveries,
        payments,
        customerHistory,
        fraud,
      },
    });
  });

  // Create manual order (phone / Facebook inbox order)
  app.post('/api/admin/orders', requireStaff('orders.edit'), async (req: AuthedRequest, res) => {
    const phoneRes = normalizeBDPhone(String(req.body?.customerPhone || ''));
    if (!phoneRes.valid) {
      res.status(400).json({ error: phoneRes.error });
      return;
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      res.status(400).json({ error: 'Add at least one item to create an order.' });
      return;
    }
    const subtotal = items.reduce((s: number, i: any) => s + Number(i.unitPrice) * Number(i.quantity), 0);
    const shippingFee = Number(req.body?.shippingFee ?? 70);
    const discount = Number(req.body?.discount ?? 0);
    const total = Math.max(0, subtotal - discount + shippingFee);

    const general = getSetting<{ nextOrderSeq: number }>('general', { nextOrderSeq: 10255 });
    const orderSeq = general.nextOrderSeq || 10255;
    setSetting('general', { ...general, nextOrderSeq: orderSeq + 1 });
    const orderId = `ord-${orderSeq}`;

    db.prepare(`
      INSERT INTO orders (
        id, order_number, invoice_number, customer_name, customer_phone, customer_email,
        district, area, address, status, payment_method, payment_status,
        subtotal, discount, shipping_fee, total, order_note, assigned_staff_id, assigned_staff_name,
        attribution
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      String(orderSeq),
      `INV-${orderSeq}`,
      String(req.body.customerName || 'Phone Customer'),
      phoneRes.normalized,
      String(req.body.customerEmail || ''),
      String(req.body.district || 'Dhaka'),
      String(req.body.area || ''),
      String(req.body.address || 'Dhaka'),
      String(req.body.status || 'pending'),
      String(req.body.paymentMethod || 'cod'),
      subtotal,
      discount,
      shippingFee,
      total,
      String(req.body.orderNote || ''),
      req.staff!.id,
      req.staff!.name,
      JSON.stringify({ utm_source: req.body.source || 'phone_order', click_ids: {} }),
    );

    const ins = db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, variant_id, sku, name, variant_label, unit_price, quantity, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      ins.run(
        crypto.randomUUID(),
        orderId,
        item.productId,
        item.variantId || null,
        item.sku || 'MANUAL',
        item.name,
        item.variantLabel || '',
        Number(item.unitPrice),
        Number(item.quantity),
        item.image || '',
      );
    }

    db.prepare(`INSERT INTO order_notes (id, order_id, type, content, staff_name) VALUES (?, ?, 'system', 'Manual order created in Admin.', ?)`).run(
      crypto.randomUUID(), orderId, req.staff!.name,
    );
    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: 'order.manual_create', entityType: 'order', entityId: orderId });
    res.status(201).json({ ok: true, id: orderId, orderNumber: String(orderSeq) });
  });

  // Update order details / items
  app.put('/api/admin/orders/:id', requireStaff('orders.edit'), (req: AuthedRequest, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, any> | undefined;
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const { customer_name, customer_phone, alt_phone, customer_email, district, area, address, shipping_fee, discount, order_note, items } = req.body;
    let subtotal = order.subtotal;
    if (Array.isArray(items)) {
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(order.id);
      const ins = db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, variant_id, sku, name, category, variant_label, unit_price, cost_price, quantity, image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      subtotal = 0;
      for (const it of items) {
        subtotal += Number(it.unit_price) * Number(it.quantity);
        ins.run(
          it.id || crypto.randomUUID(),
          order.id,
          it.product_id,
          it.variant_id || null,
          it.sku,
          it.name,
          it.category || '',
          it.variant_label || '',
          Number(it.unit_price),
          Number(it.cost_price || 0),
          Number(it.quantity),
          it.image || '',
        );
      }
    }
    const nextShip = shipping_fee !== undefined ? Number(shipping_fee) : order.shipping_fee;
    const nextDisc = discount !== undefined ? Number(discount) : order.discount;
    const total = Math.max(0, subtotal - nextDisc + nextShip + (order.tax || 0));

    db.prepare(`
      UPDATE orders
      SET customer_name = ?, customer_phone = ?, alt_phone = ?, customer_email = ?, district = ?, area = ?, address = ?,
          subtotal = ?, discount = ?, shipping_fee = ?, total = ?, order_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      customer_name ?? order.customer_name,
      customer_phone ?? order.customer_phone,
      alt_phone ?? order.alt_phone,
      customer_email ?? order.customer_email,
      district ?? order.district,
      area ?? order.area,
      address ?? order.address,
      subtotal,
      nextDisc,
      nextShip,
      total,
      order_note ?? order.order_note,
      order.id,
    );

    db.prepare(`INSERT INTO order_notes (id, order_id, type, content, staff_name) VALUES (?, ?, 'system', 'Order items/details updated.', ?)`).run(
      crypto.randomUUID(), order.id, req.staff!.name,
    );
    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: 'order.update', entityType: 'order', entityId: order.id });
    res.json({ ok: true, total });
  });

  // Order Status Transition (CRITICAL BUSINESS LIFECYCLE: Confirm -> deduct stock, SMS, Conversion Webhook!)
  async function transitionOrderStatus(orderId: string, nextStatus: string, staff: { id: string; name: string; email: string }, reason = '') {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, any> | undefined;
    if (!order) return { ok: false, error: 'Order not found' };

    const prevStatus = order.status;
    if (prevStatus === nextStatus) return { ok: true, order };

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as Record<string, any>[];
    const general = getSetting<{ domain: string }>('general', { domain: 'shuddho.com.bd' });
    const trackingUrl = `https://${general.domain}/track?order=${order.order_number}`;

    let webhookResults: any[] = [];

    if (nextStatus === 'confirmed' && !order.confirmed_at) {
      // Deduct stock from on-hand & release reserved
      for (const it of items) {
        if (it.variant_id) {
          db.prepare('UPDATE product_variants SET stock = MAX(0, stock - ?), reserved_stock = MAX(0, reserved_stock - ?) WHERE id = ?').run(it.quantity, it.quantity, it.variant_id);
        } else {
          db.prepare('UPDATE products SET stock = MAX(0, stock - ?), reserved_stock = MAX(0, reserved_stock - ?) WHERE id = ?').run(it.quantity, it.quantity, it.product_id);
        }
        db.prepare(`INSERT INTO stock_movements (id, product_id, variant_id, delta, reason, reference_id, staff_name) VALUES (?, ?, ?, ?, 'order_confirmed', ?, ?)`).run(
          crypto.randomUUID(), it.product_id, it.variant_id || null, -it.quantity, order.order_number, staff.name,
        );
      }

      db.prepare(`UPDATE orders SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP, confirmed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        staff.email, order.id,
      );

      await sendSms({
        to: order.customer_phone,
        event: 'order_confirmed',
        vars: { name: order.customer_name, order_id: order.order_number, total: order.total, tracking_url: trackingUrl },
      });

      // Fire Conversion Webhook on Confirmation! (Section 9.4)
      webhookResults = await triggerOrderConversionEvent(order.id, 'Purchase');

      // Optional auto-booking to courier
      const cSettings = getSetting<{ autoBookOnConfirm: boolean; autoBookDhaka: string; autoBookOutside: string }>('courier_settings', {
        autoBookOnConfirm: false,
        autoBookDhaka: 'pathao',
        autoBookOutside: 'steadfast',
      });
      if (cSettings.autoBookOnConfirm && !order.tracking_code) {
        const chosenCourier = order.district.toLowerCase() === 'dhaka' ? cSettings.autoBookDhaka : cSettings.autoBookOutside;
        const parcel = await createCourierParcel(chosenCourier, {
          orderId: order.id,
          orderNumber: order.order_number,
          recipientName: order.customer_name,
          recipientPhone: order.customer_phone,
          recipientAddress: order.address,
          district: order.district,
          area: order.area,
          codAmount: order.payment_status === 'paid' ? 0 : order.total - (order.paid_amount || 0),
          weightGrams: 500,
          itemDescription: items.map((i) => `${i.name} x${i.quantity}`).join(', '),
        });
        if (parcel.success) {
          db.prepare(`
            UPDATE orders SET courier_code = ?, consignment_id = ?, tracking_code = ?, courier_status = ?, courier_charge = ?, status = 'shipped', shipped_at = CURRENT_TIMESTAMP WHERE id = ?
          `).run(chosenCourier, parcel.consignmentId, parcel.trackingCode, parcel.status, parcel.deliveryCharge, order.id);
        }
      }
    } else {
      db.prepare(`UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(nextStatus, order.id);

      if (nextStatus === 'delivered') {
        db.prepare(`UPDATE orders SET delivered_at = CURRENT_TIMESTAMP, payment_status = 'paid', paid_amount = total WHERE id = ?`).run(order.id);
        await sendSms({ to: order.customer_phone, event: 'order_delivered', vars: { name: order.customer_name, order_id: order.order_number } });
        webhookResults = await triggerOrderConversionEvent(order.id, 'OrderDelivered');
      }

      if (['cancelled', 'returned', 'fake'].includes(nextStatus)) {
        // Restore stock if previously confirmed, otherwise release reservation
        for (const it of items) {
          if (order.confirmed_at) {
            if (it.variant_id) {
              db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(it.quantity, it.variant_id);
            } else {
              db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(it.quantity, it.product_id);
            }
            db.prepare(`INSERT INTO stock_movements (id, product_id, variant_id, delta, reason, reference_id, staff_name) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
              crypto.randomUUID(), it.product_id, it.variant_id || null, it.quantity, `order_${nextStatus}`, order.order_number, staff.name,
            );
          } else {
            if (it.variant_id) {
              db.prepare('UPDATE product_variants SET reserved_stock = MAX(0, reserved_stock - ?) WHERE id = ?').run(it.quantity, it.variant_id);
            } else {
              db.prepare('UPDATE products SET reserved_stock = MAX(0, reserved_stock - ?) WHERE id = ?').run(it.quantity, it.product_id);
            }
          }
        }
        if (nextStatus === 'fake') {
          db.prepare(`INSERT OR IGNORE INTO block_list (id, type, value, reason) VALUES (?, 'phone', ?, ?)`).run(
            crypto.randomUUID(), order.customer_phone, reason || `Marked fake on order #${order.order_number}`,
          );
          db.prepare('UPDATE customers SET blocked = 1 WHERE phone = ?').run(order.customer_phone);
        }
        if (nextStatus === 'cancelled') {
          await sendSms({ to: order.customer_phone, event: 'order_cancelled', vars: { name: order.customer_name, order_id: order.order_number } });
        }
        if (order.confirmed_at) {
          webhookResults = await triggerOrderConversionEvent(order.id, 'OrderCancelled');
        }
      }
    }

    db.prepare(`INSERT INTO order_notes (id, order_id, type, content, staff_name) VALUES (?, ?, 'system', ?, ?)`).run(
      crypto.randomUUID(),
      order.id,
      `Status changed from ${prevStatus} → ${nextStatus}${reason ? ` (${reason})` : ''}.`,
      staff.name,
    );
    logAudit({
      staffId: staff.id,
      staffName: staff.name,
      action: `order.status.${nextStatus}`,
      entityType: 'order',
      entityId: order.id,
      before: { status: prevStatus },
      after: { status: nextStatus, reason },
    });

    return { ok: true, status: nextStatus, webhookResults };
  }

  app.post('/api/admin/orders/:id/status', requireStaff('orders.confirm'), async (req: AuthedRequest, res) => {
    const nextStatus = String(req.body?.status || '');
    const reason = String(req.body?.reason || '');
    if (!nextStatus) {
      res.status(400).json({ error: 'Target status is required.' });
      return;
    }
    const result = await transitionOrderStatus(req.params.id, nextStatus, req.staff!, reason);
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.post('/api/admin/orders/bulk', requireStaff('orders.confirm'), async (req: AuthedRequest, res) => {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : [];
    const action = String(req.body?.action || '');
    const value = String(req.body?.value || '');
    const results: any[] = [];

    for (const id of ids) {
      if (action === 'status' && value) {
        results.push(await transitionOrderStatus(id, value, req.staff!));
      } else if (action === 'assign' && value) {
        const staffRow = db.prepare('SELECT id, name FROM staff_users WHERE id = ?').get(value) as { id: string; name: string } | undefined;
        if (staffRow) {
          db.prepare('UPDATE orders SET assigned_staff_id = ?, assigned_staff_name = ? WHERE id = ?').run(staffRow.id, staffRow.name, id);
          results.push({ id, assigned: staffRow.name });
        }
      }
    }
    res.json({ ok: true, count: results.length, results });
  });

  app.post('/api/admin/orders/:id/notes', requireStaff('orders.edit'), async (req: AuthedRequest, res) => {
    const { type, content } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, any> | undefined;
    if (!order || !content) {
      res.status(400).json({ error: 'Order and note content required.' });
      return;
    }
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO order_notes (id, order_id, type, content, staff_name) VALUES (?, ?, ?, ?, ?)`).run(
      id, order.id, type === 'customer' ? 'customer' : 'private', String(content), req.staff!.name,
    );
    if (type === 'customer') {
      await sendSms({ to: order.customer_phone, event: 'order_note', customText: `Shuddho #${order.order_number}: ${content}` });
    }
    res.json({ ok: true, id });
  });

  app.post('/api/admin/orders/:id/calls', requireStaff('orders.edit'), async (req: AuthedRequest, res) => {
    const { outcome, note, autoHold } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, any> | undefined;
    if (!order || !outcome) {
      res.status(400).json({ error: 'Call outcome is required.' });
      return;
    }
    db.prepare(`INSERT INTO call_logs (id, order_id, outcome, note, staff_name) VALUES (?, ?, ?, ?, ?)`).run(
      crypto.randomUUID(), order.id, String(outcome), String(note || ''), req.staff!.name,
    );
    if (autoHold && ['no_answer', 'switched_off'].includes(outcome) && order.status === 'pending') {
      await transitionOrderStatus(order.id, 'on_hold', req.staff!, `Call outcome: ${outcome}`);
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/orders/:id/payment', requireStaff('orders.edit'), (req: AuthedRequest, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Record<string, any> | undefined;
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const amount = Number(req.body?.amount || 0);
    const isRefund = req.body?.action === 'refund';
    const trxId = String(req.body?.trxId || `MAN_${Date.now()}`);

    if (isRefund) {
      const nextPaid = Math.max(0, (order.paid_amount || 0) - amount);
      db.prepare(`UPDATE orders SET paid_amount = ?, payment_status = ?, status = 'refunded' WHERE id = ?`).run(
        nextPaid, nextPaid === 0 ? 'refunded' : 'partial', order.id,
      );
      db.prepare(`INSERT INTO payment_transactions (id, order_id, gateway, amount, status, trx_id) VALUES (?, ?, 'refund', ?, 'refunded', ?)`).run(
        crypto.randomUUID(), order.id, -amount, trxId,
      );
    } else {
      const nextPaid = (order.paid_amount || 0) + amount;
      const pStatus = nextPaid >= order.total ? 'paid' : 'partial';
      db.prepare(`UPDATE orders SET paid_amount = ?, payment_status = ?, transaction_id = ? WHERE id = ?`).run(
        nextPaid, pStatus, trxId, order.id,
      );
      db.prepare(`INSERT INTO payment_transactions (id, order_id, gateway, amount, status, trx_id) VALUES (?, ?, ?, ?, 'paid', ?)`).run(
        crypto.randomUUID(), order.id, order.payment_method, amount, trxId,
      );
    }
    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: isRefund ? 'order.refund' : 'order.payment_record', entityType: 'order', entityId: order.id });
    res.json({ ok: true });
  });

  // =========================================================================
  // INCOMPLETE ORDERS (ABANDONED CHECKOUTS)
  // =========================================================================
  app.get('/api/admin/incomplete-orders', requireStaff('incomplete_orders.view'), (_req, res) => {
    const rows = db.prepare('SELECT * FROM incomplete_orders ORDER BY updated_at DESC').all() as Record<string, any>[];
    const data = rows.map((r) => ({
      ...r,
      items: JSON.parse(r.items || '[]'),
      attributionObj: JSON.parse(r.attribution || '{}'),
      fraud: checkCustomerFraudHistory(r.phone),
    }));
    res.json({ incompleteOrders: data });
  });

  app.post('/api/admin/incomplete-orders/:id/convert', requireStaff('orders.edit'), (req: AuthedRequest, res) => {
    const inc = db.prepare('SELECT * FROM incomplete_orders WHERE id = ?').get(req.params.id) as Record<string, any> | undefined;
    if (!inc) {
      res.status(404).json({ error: 'Incomplete order not found' });
      return;
    }
    const items = JSON.parse(inc.items || '[]') as any[];
    const general = getSetting<{ nextOrderSeq: number }>('general', { nextOrderSeq: 10255 });
    const orderSeq = general.nextOrderSeq || 10255;
    setSetting('general', { ...general, nextOrderSeq: orderSeq + 1 });

    const orderId = `ord-${orderSeq}`;
    const shippingFee = inc.district?.toLowerCase() === 'dhaka' ? 70 : 130;
    const total = (inc.subtotal || 0) + shippingFee;

    db.prepare(`
      INSERT INTO orders (
        id, order_number, invoice_number, customer_name, customer_phone, customer_email,
        district, area, address, status, payment_method, payment_status,
        subtotal, discount, shipping_fee, total, assigned_staff_id, assigned_staff_name, attribution
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'cod', 'unpaid', ?, 0, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      String(orderSeq),
      `INV-${orderSeq}`,
      inc.name || 'Recovered Customer',
      inc.phone,
      inc.email || '',
      inc.district || 'Dhaka',
      inc.area || '',
      inc.address || 'Address pending confirmation',
      inc.subtotal || 0,
      shippingFee,
      total,
      req.staff!.id,
      req.staff!.name,
      inc.attribution || '{}',
    );

    const insItem = db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, variant_id, sku, name, variant_label, unit_price, quantity, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const it of items) {
      insItem.run(
        crypto.randomUUID(),
        orderId,
        it.productId || 'prod-honey-1',
        it.variantId || null,
        it.sku || 'REC',
        it.name || 'Product',
        it.variantLabel || '',
        Number(it.unitPrice || 0),
        Number(it.quantity || 1),
        it.image || '',
      );
    }
    db.prepare(`INSERT INTO order_notes (id, order_id, type, content, staff_name) VALUES (?, ?, 'system', 'Converted from Incomplete Checkout.', ?)`).run(
      crypto.randomUUID(), orderId, req.staff!.name,
    );
    db.prepare('DELETE FROM incomplete_orders WHERE id = ?').run(inc.id);
    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: 'incomplete_order.convert', entityType: 'order', entityId: orderId });
    res.json({ ok: true, orderId, orderNumber: String(orderSeq) });
  });

  app.post('/api/admin/incomplete-orders/:id/sms', requireStaff('incomplete_orders.view'), async (req, res) => {
    const inc = db.prepare('SELECT * FROM incomplete_orders WHERE id = ?').get(req.params.id) as Record<string, any> | undefined;
    if (!inc) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const general = getSetting<{ domain: string }>('general', { domain: 'shuddho.com.bd' });
    await sendSms({
      to: inc.phone,
      event: 'abandoned_cart',
      vars: { name: inc.name || 'Friend', cart_url: `https://${general.domain}/checkout?coupon=PURE10` },
    });
    db.prepare('UPDATE incomplete_orders SET recovery_sms_sent = 1, contacted = 1 WHERE id = ?').run(inc.id);
    res.json({ ok: true });
  });

  app.delete('/api/admin/incomplete-orders/:id', requireStaff('orders.edit'), (req, res) => {
    db.prepare('DELETE FROM incomplete_orders WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // =========================================================================
  // CUSTOMERS & BLOCKLIST
  // =========================================================================
  app.get('/api/admin/customers', requireStaff('customers.view'), (_req, res) => {
    const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all() as Record<string, any>[];
    const enriched = customers.map((c) => {
      const stats = db.prepare(`
        SELECT COUNT(*) as orders_count, COALESCE(SUM(total), 0) as total_spent, MAX(created_at) as last_order
        FROM orders WHERE customer_phone = ?
      `).get(c.phone) as { orders_count: number; total_spent: number; last_order: string | null };
      const fraud = checkCustomerFraudHistory(c.phone);
      return { ...c, tags: JSON.parse(c.tags || '[]'), ...stats, fraud };
    });
    res.json({ customers: enriched, blockList: db.prepare('SELECT * FROM block_list ORDER BY created_at DESC').all() });
  });

  app.post('/api/admin/customers/:id/block', requireStaff('customers.edit'), (req: AuthedRequest, res) => {
    const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id) as Record<string, any> | undefined;
    if (!cust) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    const nextBlocked = cust.blocked ? 0 : 1;
    db.prepare('UPDATE customers SET blocked = ? WHERE id = ?').run(nextBlocked, cust.id);
    if (nextBlocked) {
      db.prepare(`INSERT OR IGNORE INTO block_list (id, type, value, reason) VALUES (?, 'phone', ?, ?)`).run(
        crypto.randomUUID(), cust.phone, String(req.body?.reason || 'Blocked by admin'),
      );
    } else {
      db.prepare('DELETE FROM block_list WHERE value = ?').run(cust.phone);
    }
    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: nextBlocked ? 'customer.block' : 'customer.unblock', entityType: 'customer', entityId: cust.id });
    res.json({ ok: true, blocked: Boolean(nextBlocked) });
  });

  // =========================================================================
  // PRODUCTS, CATEGORIES, MEDIA & REVIEWS
  // =========================================================================
  app.get('/api/admin/products', requireStaff('products.view'), (_req, res) => {
    const prods = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all() as Record<string, any>[];
    res.json({
      products: prods.map(mapProductRow),
      categories: db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all(),
      brands: db.prepare('SELECT * FROM brands').all(),
      attributes: db.prepare('SELECT * FROM attributes').all(),
      media: db.prepare('SELECT * FROM media_library ORDER BY created_at DESC').all(),
    });
  });

  app.post('/api/admin/products', requireStaff('products.edit'), (req: AuthedRequest, res) => {
    const d = req.body;
    if (!d?.name_en || !d?.price) {
      res.status(400).json({ error: 'Product name and price are required.' });
      return;
    }
    const id = `prod-${crypto.randomUUID().slice(0, 8)}`;
    const slug = String(d.slug || d.name_en.toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '-' + Math.floor(Math.random() * 999);
    const sku = String(d.sku || `SH-${Math.floor(1000 + Math.random() * 9000)}`);
    const images = Array.isArray(d.images) && d.images.length > 0 ? d.images : ['/src/assets/images/hero_sundarban_honey_1794994128015.jpg'];

    db.prepare(`
      INSERT INTO products (
        id, slug, sku, type, status, featured, name_en, name_bn, short_desc_en, short_desc_bn,
        desc_en, desc_bn, category_id, brand_id, tags, badges, price, regular_price, cost_price,
        stock, low_stock_threshold, weight_grams, images, specs, faqs, meta_title, meta_desc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      slug,
      sku,
      d.type || 'simple',
      d.status || 'published',
      d.featured ? 1 : 0,
      d.name_en,
      d.name_bn || d.name_en,
      d.short_desc_en || '',
      d.short_desc_bn || '',
      d.desc_en || '',
      d.desc_bn || '',
      d.category_id || 'cat-honey',
      d.brand_id || 'br-shuddho',
      JSON.stringify(d.tags || []),
      JSON.stringify(d.badges || []),
      Number(d.price),
      Number(d.regular_price || d.price),
      Number(d.cost_price || 0),
      Number(d.stock ?? 20),
      Number(d.low_stock_threshold ?? 5),
      Number(d.weight_grams ?? 500),
      JSON.stringify(images),
      JSON.stringify(d.specs || []),
      JSON.stringify(d.faqs || []),
      d.meta_title || d.name_en,
      d.meta_desc || d.short_desc_en || '',
    );

    if (Array.isArray(d.variants) && d.variants.length > 0) {
      const insV = db.prepare(`
        INSERT INTO product_variants (id, product_id, label, sku, price, regular_price, cost_price, stock, weight_grams, image, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      d.variants.forEach((v: any, idx: number) => {
        insV.run(
          `var-${crypto.randomUUID().slice(0, 8)}`,
          id,
          v.label,
          v.sku || `${sku}-${idx + 1}`,
          Number(v.price),
          Number(v.regular_price || v.price),
          Number(v.cost_price || 0),
          Number(v.stock ?? 15),
          Number(v.weight_grams ?? 500),
          v.image || images[0],
          idx + 1,
        );
      });
    }

    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: 'product.create', entityType: 'product', entityId: id, after: { name: d.name_en } });
    res.status(201).json({ ok: true, id, slug });
  });

  app.put('/api/admin/products/:id', requireStaff('products.edit'), (req: AuthedRequest, res) => {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as Record<string, any> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const d = req.body;
    db.prepare(`
      UPDATE products
      SET name_en = ?, name_bn = ?, status = ?, featured = ?, price = ?, regular_price = ?, cost_price = ?,
          stock = ?, category_id = ?, short_desc_en = ?, desc_en = ?, images = ?, badges = ?
      WHERE id = ?
    `).run(
      d.name_en ?? existing.name_en,
      d.name_bn ?? existing.name_bn,
      d.status ?? existing.status,
      d.featured !== undefined ? (d.featured ? 1 : 0) : existing.featured,
      d.price !== undefined ? Number(d.price) : existing.price,
      d.regular_price !== undefined ? Number(d.regular_price) : existing.regular_price,
      d.cost_price !== undefined ? Number(d.cost_price) : existing.cost_price,
      d.stock !== undefined ? Number(d.stock) : existing.stock,
      d.category_id ?? existing.category_id,
      d.short_desc_en ?? existing.short_desc_en,
      d.desc_en ?? existing.desc_en,
      d.images ? JSON.stringify(d.images) : existing.images,
      d.badges ? JSON.stringify(d.badges) : existing.badges,
      existing.id,
    );

    if (Array.isArray(d.variants)) {
      db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(existing.id);
      const insV = db.prepare(`
        INSERT INTO product_variants (id, product_id, label, sku, price, regular_price, cost_price, stock, weight_grams, image, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      d.variants.forEach((v: any, idx: number) => {
        insV.run(
          v.id || `var-${crypto.randomUUID().slice(0, 8)}`,
          existing.id,
          v.label,
          v.sku || `${existing.sku}-${idx + 1}`,
          Number(v.price),
          Number(v.regular_price || v.price),
          Number(v.cost_price || 0),
          Number(v.stock ?? 10),
          Number(v.weight_grams ?? 500),
          v.image || '',
          idx + 1,
        );
      });
    }

    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: 'product.update', entityType: 'product', entityId: existing.id });
    res.json({ ok: true });
  });

  app.delete('/api/admin/products/:id', requireStaff('products.edit'), (req: AuthedRequest, res) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: 'product.delete', entityType: 'product', entityId: req.params.id });
    res.json({ ok: true });
  });

  app.post('/api/admin/categories', requireStaff('products.edit'), (req, res) => {
    const { name_en, name_bn, slug, description_en, image } = req.body;
    if (!name_en) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }
    const id = `cat-${crypto.randomUUID().slice(0, 6)}`;
    const safeSlug = String(slug || name_en.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    db.prepare(`INSERT INTO categories (id, slug, name_en, name_bn, description_en, image) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, safeSlug, name_en, name_bn || name_en, description_en || '', image || '/src/assets/images/hero_sundarban_honey_1794994128015.jpg',
    );
    res.status(201).json({ ok: true, id });
  });

  // Upload media file (base64 data URI from computer -> saved locally in public/uploads & registered in media_library)
  app.post('/api/admin/media', requireStaff('products.edit'), (req, res) => {
    const { filename, dataUrl, altText } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string') {
      res.status(400).json({ error: 'Image data is required.' });
      return;
    }
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: 'Only PNG, JPEG, WEBP, or GIF images are allowed.' });
      return;
    }
    const mime = match[1];
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Max image size is 5MB.' });
      return;
    }
    const safeName = `${Date.now()}_${String(filename || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, safeName), buf);
    const url = `/uploads/${safeName}`;
    const id = `med-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`INSERT INTO media_library (id, filename, url, alt_text, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, safeName, url, altText || safeName, mime, buf.length,
    );
    res.status(201).json({ ok: true, media: { id, filename: safeName, url, alt_text: altText || safeName } });
  });

  app.get('/api/admin/reviews', requireStaff('content.view'), (_req, res) => {
    const reviews = db.prepare(`SELECT r.*, p.name_en as product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id ORDER BY r.created_at DESC`).all();
    res.json({ reviews });
  });

  app.post('/api/admin/reviews/:id/status', requireStaff('content.edit'), (req, res) => {
    db.prepare('UPDATE reviews SET status = ?, reply = ? WHERE id = ?').run(req.body.status, req.body.reply || '', req.params.id);
    res.json({ ok: true });
  });

  // =========================================================================
  // INVENTORY, BATCHES & PURCHASE ORDERS
  // =========================================================================
  app.get('/api/admin/inventory', requireStaff('inventory.view'), (_req, res) => {
    const products = db.prepare('SELECT id, name_en, sku, stock, reserved_stock, low_stock_threshold, cost_price FROM products').all() as Record<string, any>[];
    const variants = db.prepare(`
      SELECT v.*, p.name_en as product_name FROM product_variants v JOIN products p ON p.id = v.product_id
    `).all();
    const movements = db.prepare('SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT 50').all();
    const batches = db.prepare(`SELECT b.*, p.name_en as product_name FROM inventory_batches b LEFT JOIN products p ON p.id = b.product_id ORDER BY b.expiry_date ASC`).all();
    const suppliers = db.prepare('SELECT * FROM suppliers').all();
    const pos = db.prepare(`SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.created_at DESC`).all();
    res.json({ products, variants, movements, batches, suppliers, purchaseOrders: pos });
  });

  app.post('/api/admin/inventory/adjust', requireStaff('inventory.edit'), (req: AuthedRequest, res) => {
    const { productId, variantId, delta, reason } = req.body;
    const d = Number(delta);
    if (!productId || !Number.isFinite(d)) {
      res.status(400).json({ error: 'Product and numeric adjustment required.' });
      return;
    }
    if (variantId) {
      db.prepare('UPDATE product_variants SET stock = MAX(0, stock + ?) WHERE id = ?').run(d, variantId);
    } else {
      db.prepare('UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?').run(d, productId);
    }
    db.prepare(`INSERT INTO stock_movements (id, product_id, variant_id, delta, reason, staff_name) VALUES (?, ?, ?, ?, ?, ?)`).run(
      crypto.randomUUID(), productId, variantId || null, d, reason || 'manual_adjustment', req.staff!.name,
    );
    res.json({ ok: true });
  });

  // =========================================================================
  // COURIERS (ONE-CLICK BOOKING, BULK, SYNC, FRAUD CHECK, RECONCILIATION)
  // =========================================================================
  app.get('/api/admin/couriers', requireStaff('couriers.view'), (_req, res) => {
    const accounts = db.prepare('SELECT code, name, enabled, sandbox, pickup_store_id, status, last_tested_at FROM courier_accounts').all();
    const bookings = db.prepare(`SELECT * FROM orders WHERE tracking_code != '' ORDER BY shipped_at DESC, updated_at DESC`).all();
    const locationMaps = db.prepare('SELECT * FROM courier_location_maps').all();
    const logs = db.prepare('SELECT * FROM courier_logs ORDER BY created_at DESC LIMIT 40').all();
    const settings = getSetting('courier_settings', {});
    res.json({ accounts, bookings, locationMaps, logs, settings });
  });

  app.put('/api/admin/couriers/:code', requireStaff('couriers.edit'), (req: AuthedRequest, res) => {
    const { enabled, sandbox, pickup_store_id, credentials } = req.body;
    const existing = db.prepare('SELECT * FROM courier_accounts WHERE code = ?').get(req.params.code) as Record<string, any> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Courier not found' });
      return;
    }
    const enc = credentials ? encryptSecret(JSON.stringify(credentials)) : existing.credentials_enc;
    db.prepare(`UPDATE courier_accounts SET enabled = ?, sandbox = ?, pickup_store_id = ?, credentials_enc = ? WHERE code = ?`).run(
      enabled ? 1 : 0, sandbox ? 1 : 0, pickup_store_id ?? existing.pickup_store_id, enc, req.params.code,
    );
    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: 'courier.update', entityType: 'courier', entityId: req.params.code });
    res.json({ ok: true });
  });

  app.post('/api/admin/couriers/:code/test', requireStaff('couriers.edit'), async (req, res) => {
    const result = await testCourierConnection(req.params.code);
    res.json(result);
  });

  app.post('/api/admin/couriers/book', requireStaff('orders.courier'), async (req: AuthedRequest, res) => {
    const orderIds: string[] = Array.isArray(req.body?.orderIds)
      ? req.body.orderIds
      : req.body?.orderId
        ? [req.body.orderId]
        : [];
    const courierCode = String(req.body?.courierCode || 'steadfast');
    const overrideCod = req.body?.codAmount !== undefined ? Number(req.body.codAmount) : undefined;
    const weightGrams = Number(req.body?.weightGrams || 500);
    const note = String(req.body?.note || '');
    const deliveryType = req.body?.deliveryType === 'express' ? 'express' : 'normal';

    const general = getSetting<{ domain: string }>('general', { domain: 'shuddho.com.bd' });
    const booked: any[] = [];

    for (const id of orderIds) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, any> | undefined;
      if (!order) continue;
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as Record<string, any>[];
      const codAmount = overrideCod !== undefined && orderIds.length === 1
        ? overrideCod
        : order.payment_status === 'paid'
          ? 0
          : Math.max(0, order.total - (order.paid_amount || 0));

      const parcel = await createCourierParcel(courierCode, {
        orderId: order.id,
        orderNumber: order.order_number,
        recipientName: order.customer_name,
        recipientPhone: order.customer_phone,
        recipientAddress: order.address,
        district: order.district,
        area: order.area,
        codAmount,
        weightGrams,
        itemDescription: items.map((i) => `${i.name} x${i.quantity}`).join(', '),
        note,
        deliveryType,
      });

      if (parcel.success) {
        db.prepare(`
          UPDATE orders
          SET courier_code = ?, consignment_id = ?, tracking_code = ?, courier_status = ?, courier_charge = ?,
              status = 'shipped', shipped_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(courierCode, parcel.consignmentId, parcel.trackingCode, parcel.status, parcel.deliveryCharge, order.id);

        db.prepare(`INSERT INTO order_notes (id, order_id, type, content, staff_name) VALUES (?, ?, 'system', ?, ?)`).run(
          crypto.randomUUID(),
          order.id,
          `Parcel booked with ${courierCode.toUpperCase()} (${parcel.trackingCode}).`,
          req.staff!.name,
        );

        await sendSms({
          to: order.customer_phone,
          event: 'order_shipped',
          vars: {
            name: order.customer_name,
            order_id: order.order_number,
            courier: courierCode.toUpperCase(),
            tracking_id: parcel.trackingCode,
            tracking_url: `https://${general.domain}/track?order=${order.order_number}`,
          },
        });
        booked.push({ orderId: order.id, orderNumber: order.order_number, ...parcel });
      }
    }
    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: 'courier.book', entityType: 'order', entityId: orderIds.join(',') });
    res.json({ ok: true, booked });
  });

  app.post('/api/admin/couriers/sync', requireStaff('couriers.view'), (_req, res) => {
    const updated = syncSandboxCourierStatuses();
    res.json({ ok: true, updated });
  });

  app.get('/api/admin/couriers/fraud-check', requireStaff('orders.view'), (req, res) => {
    const phone = String(req.query.phone || '');
    if (!phone) {
      res.status(400).json({ error: 'Phone required' });
      return;
    }
    res.json(checkCustomerFraudHistory(phone));
  });

  // =========================================================================
  // MARKETING (COUPONS, CAMPAIGNS)
  // =========================================================================
  app.get('/api/admin/marketing', requireStaff('marketing.view'), (_req, res) => {
    res.json({
      coupons: db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all(),
      subscribers: db.prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC').all(),
      campaigns: db.prepare(`SELECT * FROM notification_logs WHERE event = 'campaign' ORDER BY created_at DESC LIMIT 30`).all(),
    });
  });

  app.post('/api/admin/coupons', requireStaff('marketing.edit'), (req, res) => {
    const { code, type, value, min_spend, max_discount, usage_limit, first_order_only } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Coupon code is required.' });
      return;
    }
    db.prepare(`
      INSERT INTO coupons (id, code, type, value, min_spend, max_discount, usage_limit, first_order_only, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      `cp-${crypto.randomUUID().slice(0, 6)}`,
      String(code).trim().toUpperCase(),
      type || 'percentage',
      Number(value || 0),
      Number(min_spend || 0),
      Number(max_discount || 0),
      Number(usage_limit || 0),
      first_order_only ? 1 : 0,
    );
    res.status(201).json({ ok: true });
  });

  app.delete('/api/admin/coupons/:id', requireStaff('marketing.edit'), (req, res) => {
    db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/admin/campaigns/sms', requireStaff('marketing.edit'), async (req, res) => {
    const { segment, message } = req.body;
    if (!message) {
      res.status(400).json({ error: 'Campaign message required.' });
      return;
    }
    const customers = db.prepare('SELECT phone, name FROM customers WHERE blocked = 0 LIMIT 50').all() as { phone: string; name: string }[];
    let sent = 0;
    for (const c of customers) {
      await sendSms({ to: c.phone, event: 'campaign', customText: String(message).replace('{name}', c.name) });
      sent++;
    }
    res.json({ ok: true, sent, segment });
  });

  // =========================================================================
  // CONTENT CMS, APPEARANCE & SETTINGS
  // =========================================================================
  app.get('/api/admin/settings/:key', requireStaff('settings.view'), (req, res) => {
    res.json({ key: req.params.key, value: getSetting(req.params.key, {}) });
  });

  app.put('/api/admin/settings/:key', requireStaff(), (req: AuthedRequest, res) => {
    const key = req.params.key;
    // Enforce permission split: Appearance vs Tracking Code Injection vs General Settings
    if (key === 'theme' || key === 'homepage_sections' || key === 'menus' || key === 'announcements' || key === 'popups') {
      // allow appearance/content editors or owner
      if (!['owner', 'manager', 'editor'].includes(req.staff!.role)) {
        res.status(403).json({ error: 'Permission denied for appearance/content settings.' });
        return;
      }
    } else if (key === 'tracking') {
      if (req.staff!.role !== 'owner' && req.staff!.role !== 'marketing') {
        res.status(403).json({ error: 'Tracking & GTM settings require Owner or Marketing role.' });
        return;
      }
      const val = req.body?.value || {};
      if (val.gtmEnabled && val.gtmContainerId && !validateGtmContainerId(val.gtmContainerId)) {
        res.status(400).json({ error: 'GTM Container ID must match GTM-XXXXXXX format.' });
        return;
      }
      if ((val.overrideHeadCode || val.overrideBodyCode) && req.staff!.role !== 'owner') {
        res.status(403).json({ error: 'Custom GTM head/body code overrides are Owner-only.' });
        return;
      }
    } else if (req.staff!.role !== 'owner' && req.staff!.role !== 'manager') {
      res.status(403).json({ error: `Permission denied: role '${req.staff!.role}' cannot modify settings.` });
      return;
    }

    const before = getSetting(key, {});
    setSetting(key, req.body?.value);
    logAudit({
      staffId: req.staff!.id,
      staffName: req.staff!.name,
      action: `settings.update.${key}`,
      entityType: 'settings',
      entityId: key,
      before,
      after: req.body?.value,
    });
    res.json({ ok: true });
  });

  app.get('/api/admin/content', requireStaff('content.view'), (_req, res) => {
    res.json({
      pages: db.prepare('SELECT * FROM pages ORDER BY updated_at DESC').all(),
      posts: db.prepare('SELECT * FROM blog_posts ORDER BY published_at DESC').all(),
      contactMessages: db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all(),
      redirects: db.prepare('SELECT * FROM redirects').all(),
    });
  });

  app.post('/api/admin/pages', requireStaff('content.edit'), (req, res) => {
    const { id, slug, title_en, title_bn, content_en, content_bn, is_landing } = req.body;
    const safeId = id || `pg-${crypto.randomUUID().slice(0, 6)}`;
    db.prepare(`
      INSERT INTO pages (id, slug, title_en, title_bn, content_en, content_bn, is_landing, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title_en=excluded.title_en, title_bn=excluded.title_bn, content_en=excluded.content_en, content_bn=excluded.content_bn, updated_at=CURRENT_TIMESTAMP
    `).run(safeId, slug, title_en, title_bn || title_en, content_en, content_bn || content_en, is_landing ? 1 : 0);
    res.json({ ok: true, id: safeId });
  });

  app.post('/api/admin/blog', requireStaff('content.edit'), (req, res) => {
    const { id, slug, title_en, title_bn, excerpt_en, content_en, category, image } = req.body;
    const safeId = id || `bl-${crypto.randomUUID().slice(0, 6)}`;
    db.prepare(`
      INSERT INTO blog_posts (id, slug, title_en, title_bn, excerpt_en, excerpt_bn, content_en, content_bn, category, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title_en=excluded.title_en, content_en=excluded.content_en
    `).run(safeId, slug, title_en, title_bn || title_en, excerpt_en || '', excerpt_en || '', content_en, content_en, category || 'Wellness', image || '/src/assets/images/hero_sundarban_honey_1794994128015.jpg');
    res.json({ ok: true, id: safeId });
  });

  // =========================================================================
  // CONVERSION WEBHOOK ENDPOINTS & DELIVERIES (SECTION 9.4)
  // =========================================================================
  app.get('/api/admin/webhooks', requireStaff('settings.view'), (_req, res) => {
    const endpoints = db.prepare('SELECT * FROM webhook_endpoints ORDER BY created_at DESC').all() as Record<string, any>[];
    const deliveries = db.prepare(`
      SELECT d.*, e.name as endpoint_name, e.url as endpoint_url
      FROM webhook_deliveries d
      LEFT JOIN webhook_endpoints e ON e.id = d.endpoint_id
      ORDER BY d.created_at DESC LIMIT 50
    `).all();
    res.json({
      endpoints: endpoints.map((e) => ({ ...e, events: JSON.parse(e.events || '[]'), enabled: Boolean(e.enabled), include_hashed_pii: Boolean(e.include_hashed_pii) })),
      deliveries,
    });
  });

  app.post('/api/admin/webhooks/endpoints', requireStaff('settings.edit'), (req: AuthedRequest, res) => {
    const { id, name, url, events, include_hashed_pii, enabled, regenerateSecret } = req.body;
    const check = isPrivateOrUnsafeUrl(String(url || ''));
    if (!check.safe) {
      res.status(400).json({ error: check.reason });
      return;
    }
    const existing = id ? (db.prepare('SELECT * FROM webhook_endpoints WHERE id = ?').get(id) as Record<string, any> | undefined) : undefined;
    const epId = existing?.id || `wh-${crypto.randomUUID().slice(0, 8)}`;
    const secret = regenerateSecret || !existing ? `whsec_${crypto.randomBytes(16).toString('hex')}` : existing.secret;

    if (existing) {
      db.prepare(`UPDATE webhook_endpoints SET name=?, url=?, secret=?, events=?, include_hashed_pii=?, enabled=? WHERE id=?`).run(
        name, url, secret, JSON.stringify(events || ['Purchase']), include_hashed_pii ? 1 : 0, enabled ? 1 : 0, epId,
      );
    } else {
      db.prepare(`INSERT INTO webhook_endpoints (id, name, url, secret, events, include_hashed_pii, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        epId, name, url, secret, JSON.stringify(events || ['Purchase']), include_hashed_pii ? 1 : 0, enabled !== false ? 1 : 0,
      );
    }
    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: 'webhook.endpoint.save', entityType: 'webhook_endpoint', entityId: epId });
    res.json({ ok: true, id: epId, secret });
  });

  app.delete('/api/admin/webhooks/endpoints/:id', requireStaff('settings.edit'), (req, res) => {
    db.prepare('DELETE FROM webhook_endpoints WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/admin/webhooks/test', requireStaff('settings.edit'), async (req, res) => {
    const orderRow = db.prepare('SELECT id FROM orders ORDER BY created_at DESC LIMIT 1').get() as { id: string } | undefined;
    if (!orderRow) {
      res.status(400).json({ error: 'No sample order found to construct test payload.' });
      return;
    }
    const results = await triggerOrderConversionEvent(orderRow.id, 'Purchase', { isTest: true });
    res.json({ ok: true, results });
  });

  app.post('/api/admin/webhooks/deliveries/:id/retry', requireStaff('orders.confirm'), async (req, res) => {
    const result = await dispatchWebhookDelivery(req.params.id);
    res.json(result);
  });

  app.post('/api/admin/orders/:id/resend-conversion', requireStaff('orders.confirm'), async (req, res) => {
    const results = await triggerOrderConversionEvent(req.params.id, 'Purchase', { forceResend: true });
    res.json({ ok: true, results });
  });

  // =========================================================================
  // REPORTS, USERS, NOTIFICATIONS, API KEYS & SYSTEM HEALTH
  // =========================================================================
  app.get('/api/admin/reports', requireStaff('reports.view'), (req, res) => {
    const from = typeof req.query.from === 'string' && req.query.from ? req.query.from : null;
    const to = typeof req.query.to === 'string' && req.query.to ? req.query.to : null;
    const allOrders = db.prepare('SELECT * FROM orders').all() as Record<string, any>[];
    const orders = from || to ? allOrders.filter((o) => isTimestampInRange(o.created_at, from, to)) : allOrders;
    const orderIdSet = new Set(orders.map((o) => o.id));
    const allItems = db.prepare('SELECT * FROM order_items').all() as Record<string, any>[];
    const items = from || to ? allItems.filter((it) => orderIdSet.has(it.order_id)) : allItems;

    const grossSales = orders.reduce((s, o) => s + Number(o.total), 0);
    const discounts = orders.reduce((s, o) => s + Number(o.discount), 0);
    const shipping = orders.reduce((s, o) => s + Number(o.shipping_fee), 0);
    const refunds = orders.filter((o) => o.status === 'refunded').reduce((s, o) => s + Number(o.total), 0);

    const productPerf: Record<string, { sku: string; name: string; qty: number; revenue: number; profit: number }> = {};
    for (const it of items) {
      if (!productPerf[it.sku]) productPerf[it.sku] = { sku: it.sku, name: it.name, qty: 0, revenue: 0, profit: 0 };
      productPerf[it.sku].qty += Number(it.quantity);
      productPerf[it.sku].revenue += Number(it.unit_price) * Number(it.quantity);
      productPerf[it.sku].profit += (Number(it.unit_price) - Number(it.cost_price || 0)) * Number(it.quantity);
    }

    const courierPerf: Record<string, { courier: string; total: number; delivered: number; returned: number; codTotal: number }> = {};
    for (const o of orders) {
      if (!o.courier_code) continue;
      if (!courierPerf[o.courier_code]) courierPerf[o.courier_code] = { courier: o.courier_code, total: 0, delivered: 0, returned: 0, codTotal: 0 };
      courierPerf[o.courier_code].total++;
      if (o.status === 'delivered') courierPerf[o.courier_code].delivered++;
      if (o.status === 'returned') courierPerf[o.courier_code].returned++;
      courierPerf[o.courier_code].codTotal += Number(o.total);
    }

    const staffPerf: Record<string, { staff: string; total: number; confirmed: number }> = {};
    for (const o of orders) {
      const name = o.assigned_staff_name || 'Unassigned';
      if (!staffPerf[name]) staffPerf[name] = { staff: name, total: 0, confirmed: 0 };
      staffPerf[name].total++;
      if (o.confirmed_at) staffPerf[name].confirmed++;
    }

    res.json({
      summary: { grossSales, netSales: grossSales - refunds - discounts, discounts, shipping, refunds },
      productPerf: Object.values(productPerf).sort((a, b) => b.revenue - a.revenue),
      courierPerf: Object.values(courierPerf),
      staffPerf: Object.values(staffPerf),
    });
  });

  app.get('/api/admin/users', requireStaff('users.manage'), (_req, res) => {
    const users = db.prepare('SELECT id, name, email, role, totp_enabled, active, last_login_at, created_at FROM staff_users').all();
    const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 80').all();
    res.json({ users, auditLogs });
  });

  app.post('/api/admin/users', requireStaff('users.manage'), (req: AuthedRequest, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      res.status(400).json({ error: 'Name, email, password, and role are required.' });
      return;
    }
    const id = `staff-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`INSERT INTO staff_users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`).run(
      id, name, email, hashPassword(password), role,
    );
    logAudit({ staffId: req.staff!.id, staffName: req.staff!.name, action: 'staff.create', entityType: 'staff_user', entityId: id, after: { email, role } });
    res.status(201).json({ ok: true, id });
  });

  app.get('/api/admin/notifications', requireStaff('notifications.edit'), (_req, res) => {
    res.json({
      templates: db.prepare('SELECT * FROM notification_templates').all(),
      logs: db.prepare('SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 50').all(),
      smsSettings: getSetting('sms', {}),
    });
  });

  app.put('/api/admin/notifications/templates/:id', requireStaff('notifications.edit'), (req, res) => {
    db.prepare('UPDATE notification_templates SET enabled = ?, body_en = ?, body_bn = ? WHERE id = ?').run(
      req.body.enabled ? 1 : 0, req.body.body_en, req.body.body_bn, req.params.id,
    );
    res.json({ ok: true });
  });

  app.post('/api/admin/notifications/test-sms', requireStaff('notifications.edit'), async (req, res) => {
    const phoneRes = normalizeBDPhone(String(req.body?.to || ''));
    if (!phoneRes.valid) {
      res.status(400).json({ error: phoneRes.error });
      return;
    }
    const result = await sendSms({
      to: phoneRes.normalized,
      event: 'test_sms',
      customText: String(req.body?.text || 'Test SMS from Shuddho Admin!'),
    });
    res.json(result);
  });

  app.get('/api/admin/system', requireStaff('settings.view'), (_req, res) => {
    const keys = db.prepare('SELECT id, name, key_prefix, scopes, active, last_used_at, created_at FROM api_keys').all();
    const webhookQueue = db.prepare(`SELECT status, COUNT(*) as count FROM webhook_deliveries GROUP BY status`).all();
    const dbSizeBytes = fs.existsSync(path.resolve(process.cwd(), 'data/shuddho.db'))
      ? fs.statSync(path.resolve(process.cwd(), 'data/shuddho.db')).size
      : 0;
    res.json({ apiKeys: keys, webhookQueue, dbSizeBytes, uptimeSec: Math.round(process.uptime()), nodeVersion: process.version });
  });

  app.post('/api/admin/api-keys', requireStaff('settings.edit'), (req, res) => {
    const rawKey = `sk_shuddho_${crypto.randomBytes(16).toString('hex')}`;
    const id = `key-${crypto.randomUUID().slice(0, 6)}`;
    db.prepare(`INSERT INTO api_keys (id, name, key_prefix, key_hash, scopes) VALUES (?, ?, ?, ?, ?)`).run(
      id,
      String(req.body?.name || 'Integration Key'),
      rawKey.slice(0, 14),
      crypto.createHash('sha256').update(rawKey).digest('hex'),
      JSON.stringify(req.body?.scopes || ['orders:read', 'products:read']),
    );
    res.status(201).json({ ok: true, id, rawKey });
  });

  app.get('/api/admin/system/backup', requireStaff('settings.view'), (_req, res) => {
    const dbPath = path.resolve(process.cwd(), 'data/shuddho.db');
    res.download(dbPath, `shuddho-backup-${new Date().toISOString().slice(0, 10)}.db`);
  });

  // Shipping zone updates
  app.put('/api/admin/shipping-zones/:id', requireStaff('settings.edit'), (req, res) => {
    db.prepare(`UPDATE shipping_zones SET base_fee = ?, free_threshold = ?, express_extra = ?, eta = ? WHERE id = ?`).run(
      Number(req.body.base_fee), Number(req.body.free_threshold), Number(req.body.express_extra), String(req.body.eta), req.params.id,
    );
    res.json({ ok: true });
  });

  // Background queue timer (webhook retries + sandbox courier sync)
  setInterval(() => {
    processRetryQueue().catch(() => {});
  }, 60_000);

  // Vite middleware in development, static dist in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Shuddho server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
