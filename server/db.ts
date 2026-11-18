import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(DATA_DIR, 'shuddho.db');
export const db = new DatabaseSync(DB_PATH);

// Enable WAL and foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// AES-256-GCM encryption for stored API secrets
const ENC_KEY = crypto
  .createHash('sha256')
  .update(process.env.APP_SECRET || 'shuddho-coast-default-secret-key-2026')
  .digest();

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  if (plain.startsWith('enc:v1:')) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith('enc:v1:')) return stored;
  const [, , ivHex, tagHex, dataHex] = stored.split(':');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function maskSecret(val: string): string {
  if (!val) return '';
  const plain = decryptSecret(val);
  if (plain.length <= 6) return '••••••';
  return `${plain.slice(0, 3)}••••${plain.slice(-3)}`;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff_sessions (
      token TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      district TEXT DEFAULT 'Dhaka',
      area TEXT DEFAULT '',
      address TEXT DEFAULT '',
      loyalty_points INTEGER DEFAULT 0,
      wallet_balance INTEGER DEFAULT 0,
      customer_group TEXT DEFAULT 'retail',
      tags TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      blocked INTEGER DEFAULT 0,
      first_source TEXT DEFAULT 'direct',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT DEFAULT 'login',
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      description_en TEXT DEFAULT '',
      description_bn TEXT DEFAULT '',
      image TEXT DEFAULT '',
      banner_image TEXT DEFAULT '',
      parent_id TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      logo TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS attributes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      terms TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'variable',
      status TEXT DEFAULT 'published',
      featured INTEGER DEFAULT 0,
      name_en TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      short_desc_en TEXT DEFAULT '',
      short_desc_bn TEXT DEFAULT '',
      desc_en TEXT DEFAULT '',
      desc_bn TEXT DEFAULT '',
      category_id TEXT,
      brand_id TEXT,
      tags TEXT DEFAULT '[]',
      badges TEXT DEFAULT '[]',
      price INTEGER NOT NULL,
      regular_price INTEGER NOT NULL,
      cost_price INTEGER DEFAULT 0,
      sale_start TEXT,
      sale_end TEXT,
      stock INTEGER DEFAULT 0,
      reserved_stock INTEGER DEFAULT 0,
      low_stock_threshold INTEGER DEFAULT 5,
      weight_grams INTEGER DEFAULT 500,
      images TEXT DEFAULT '[]',
      video_url TEXT DEFAULT '',
      specs TEXT DEFAULT '[]',
      faqs TEXT DEFAULT '[]',
      bundle_items TEXT DEFAULT '[]',
      order_now_enabled INTEGER DEFAULT 1,
      min_qty INTEGER DEFAULT 1,
      max_qty INTEGER DEFAULT 20,
      meta_title TEXT DEFAULT '',
      meta_desc TEXT DEFAULT '',
      rating_avg REAL DEFAULT 4.8,
      review_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      label TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      price INTEGER NOT NULL,
      regular_price INTEGER NOT NULL,
      cost_price INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 0,
      reserved_stock INTEGER DEFAULT 0,
      weight_grams INTEGER DEFAULT 500,
      image TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_library (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      alt_text TEXT DEFAULT '',
      mime_type TEXT DEFAULT 'image/jpeg',
      size_bytes INTEGER DEFAULT 0,
      width INTEGER DEFAULT 800,
      height INTEGER DEFAULT 800,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      reference_id TEXT,
      staff_name TEXT DEFAULT 'System',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      batch_code TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      expiry_date TEXT NOT NULL,
      received_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      location TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      status TEXT DEFAULT 'ordered',
      items TEXT NOT NULL DEFAULT '[]',
      total_cost INTEGER DEFAULT 0,
      expected_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      photos TEXT DEFAULT '[]',
      verified_buyer INTEGER DEFAULT 1,
      status TEXT DEFAULT 'approved',
      reply TEXT DEFAULT '',
      helpful_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_questions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      value INTEGER NOT NULL,
      min_spend INTEGER DEFAULT 0,
      max_discount INTEGER DEFAULT 0,
      usage_limit INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      first_order_only INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shipping_zones (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      base_fee INTEGER NOT NULL,
      free_threshold INTEGER DEFAULT 0,
      express_extra INTEGER DEFAULT 60,
      eta TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incomplete_orders (
      id TEXT PRIMARY KEY,
      name TEXT DEFAULT '',
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      district TEXT DEFAULT 'Dhaka',
      area TEXT DEFAULT '',
      address TEXT DEFAULT '',
      items TEXT NOT NULL DEFAULT '[]',
      subtotal INTEGER DEFAULT 0,
      attribution TEXT DEFAULT '{}',
      contacted INTEGER DEFAULT 0,
      recovery_sms_sent INTEGER DEFAULT 0,
      ip TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      invoice_number TEXT,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      alt_phone TEXT DEFAULT '',
      customer_email TEXT DEFAULT '',
      district TEXT NOT NULL,
      area TEXT DEFAULT '',
      address TEXT NOT NULL,
      delivery_zone TEXT DEFAULT 'inside_dhaka',
      is_express INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT NOT NULL DEFAULT 'cod',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      transaction_id TEXT DEFAULT '',
      subtotal INTEGER NOT NULL,
      discount INTEGER DEFAULT 0,
      shipping_fee INTEGER NOT NULL,
      tax INTEGER DEFAULT 0,
      total INTEGER NOT NULL,
      paid_amount INTEGER DEFAULT 0,
      coupon_code TEXT DEFAULT '',
      order_note TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      assigned_staff_id TEXT,
      assigned_staff_name TEXT,
      courier_code TEXT DEFAULT '',
      consignment_id TEXT DEFAULT '',
      tracking_code TEXT DEFAULT '',
      courier_status TEXT DEFAULT '',
      courier_charge INTEGER DEFAULT 0,
      attribution TEXT DEFAULT '{}',
      client_ip TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      confirmed_at TEXT,
      confirmed_by TEXT,
      shipped_at TEXT,
      delivered_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      variant_label TEXT DEFAULT '',
      unit_price INTEGER NOT NULL,
      cost_price INTEGER DEFAULT 0,
      quantity INTEGER NOT NULL,
      image TEXT DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_notes (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'private',
      content TEXT NOT NULL,
      staff_name TEXT DEFAULT 'System',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      note TEXT DEFAULT '',
      staff_name TEXT NOT NULL,
      next_call_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      gateway TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      trx_id TEXT DEFAULT '',
      raw_payload TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courier_accounts (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      sandbox INTEGER DEFAULT 1,
      credentials_enc TEXT DEFAULT '{}',
      pickup_store_id TEXT DEFAULT '',
      status TEXT DEFAULT 'connected',
      last_tested_at TEXT
    );

    CREATE TABLE IF NOT EXISTS courier_location_maps (
      id TEXT PRIMARY KEY,
      courier_code TEXT NOT NULL,
      district TEXT NOT NULL,
      area TEXT DEFAULT '',
      remote_city_id TEXT NOT NULL,
      remote_zone_id TEXT DEFAULT '',
      remote_area_id TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS courier_logs (
      id TEXT PRIMARY KEY,
      courier_code TEXT NOT NULL,
      order_id TEXT,
      action TEXT NOT NULL,
      request_masked TEXT DEFAULT '{}',
      response_body TEXT DEFAULT '{}',
      success INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '["Purchase"]',
      include_hashed_pii INTEGER DEFAULT 1,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      endpoint_id TEXT NOT NULL,
      order_id TEXT,
      event_name TEXT NOT NULL,
      event_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      http_status INTEGER,
      response_body TEXT DEFAULT '',
      duration_ms INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      next_retry_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS outgoing_webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '["order.created","order.status_changed"]',
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '["orders:read","products:read"]',
      active INTEGER DEFAULT 1,
      last_used_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_templates (
      id TEXT PRIMARY KEY,
      event TEXT UNIQUE NOT NULL,
      channel TEXT DEFAULT 'sms',
      enabled INTEGER DEFAULT 1,
      body_en TEXT NOT NULL,
      body_bn TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      event TEXT NOT NULL,
      message TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      response_body TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title_en TEXT NOT NULL,
      title_bn TEXT NOT NULL,
      content_en TEXT NOT NULL,
      content_bn TEXT NOT NULL,
      meta_title TEXT DEFAULT '',
      meta_desc TEXT DEFAULT '',
      status TEXT DEFAULT 'published',
      is_landing INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title_en TEXT NOT NULL,
      title_bn TEXT NOT NULL,
      excerpt_en TEXT NOT NULL,
      excerpt_bn TEXT NOT NULL,
      content_en TEXT NOT NULL,
      content_bn TEXT NOT NULL,
      category TEXT DEFAULT 'Wellness',
      author TEXT DEFAULT 'Shuddho Editorial',
      image TEXT DEFAULT '',
      status TEXT DEFAULT 'published',
      published_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      message TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS redirects (
      id TEXT PRIMARY KEY,
      from_path TEXT UNIQUE NOT NULL,
      to_path TEXT NOT NULL,
      status_code INTEGER DEFAULT 301
    );

    CREATE TABLE IF NOT EXISTS block_list (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      value TEXT UNIQUE NOT NULL,
      reason TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      staff_id TEXT,
      staff_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT DEFAULT '',
      before_json TEXT DEFAULT '',
      after_json TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loyalty_ledger (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      order_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function getSetting<T = unknown>(key: string, fallback: T): T {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, JSON.stringify(value));
}

export function logAudit(params: {
  staffId?: string | null;
  staffName: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}) {
  db.prepare(`
    INSERT INTO audit_logs (id, staff_id, staff_name, action, entity_type, entity_id, before_json, after_json, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    params.staffId ?? null,
    params.staffName,
    params.action,
    params.entityType,
    params.entityId ?? '',
    params.before !== undefined ? JSON.stringify(params.before) : '',
    params.after !== undefined ? JSON.stringify(params.after) : '',
    params.ip ?? '',
  );
}

export function seedIfEmpty() {
  // Ensure requested admin user exists even on already-seeded databases
  const existingRequested = db
    .prepare('SELECT id FROM staff_users WHERE lower(email) = ?')
    .get('warner.roman@gmail.com') as { id: string } | undefined;
  if (!existingRequested) {
    db.prepare(`INSERT INTO staff_users (id, name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 'owner', 1)`).run(
      'staff-warner',
      'Warner Roman (Admin)',
      'warner.roman@gmail.com',
      hashPassword('123456789@BD.com'),
    );
  } else {
    db.prepare(`UPDATE staff_users SET password_hash = ?, role = 'owner', active = 1 WHERE id = ?`).run(
      hashPassword('123456789@BD.com'),
      existingRequested.id,
    );
  }

  const staffCount = (db.prepare('SELECT COUNT(*) as c FROM staff_users').get() as { c: number }).c;
  if (staffCount > 1) return;

  // 1. Settings defaults
  setSetting('general', {
    storeName: 'Shuddho',
    storeNameBn: 'শুদ্ধ',
    domain: 'shuddho.com.bd',
    taglineEn: 'Pure from Nature, Direct to Your Kitchen',
    taglineBn: 'প্রকৃতির খাঁটি স্বাদ, সরাসরি আপনার ঘরে',
    hotline: '+8809612-004455',
    whatsapp: '8801711004455',
    email: 'care@shuddho.com.bd',
    address: 'House 24, Road 11, Banani, Dhaka 1213, Bangladesh',
    binNumber: '004519283-0102',
    tradeLicence: 'TRAD/DNCC/098412/2026',
    orderPrefix: 'SH',
    nextOrderSeq: 10255,
    maintenanceMode: false,
    defaultLanguage: 'en',
  });

  setSetting('theme', {
    '--bg': '#EEF5F5',
    '--surface': '#FFFFFF',
    '--ink': '#0E2A30',
    '--muted': '#557077',
    '--primary': '#0E5E6F',
    '--primary-ink': '#FFFFFF',
    '--accent': '#FF6B5B',
    '--accent-ink': '#FFFFFF',
    '--line': '#D3E3E5',
    '--image-bg': '#E0EDEE',
    '--chip-bg': '#FFE3DF',
    '--chip-fg': '#A3271B',
    '--sale': '#E5483A',
    '--success': '#1E9E6A',
    '--footer-bg': '#0B3A44',
    '--footer-fg': '#CBE3E6',
    '--topbar-bg': '#0E5E6F',
    '--topbar-fg': '#D9F0F2',
    radiusCard: '18px',
    radiusControl: '12px',
    fontDisplay: 'Outfit',
    showRatingOnCard: true,
    showOrderNowOnCard: true,
    customCss: '',
    headCode: '',
    bodyOpenCode: '',
    bodyEndCode: '',
  });

  setSetting('tracking', {
    gtmEnabled: false,
    gtmContainerId: '',
    overrideHeadCode: '',
    overrideBodyCode: '',
    ga4Id: '',
    metaPixelId: '',
    tiktokPixelId: '',
    googleAdsId: '',
    msUetId: '',
    consentBannerEnabled: true,
    consentDefaultAnalytics: 'granted',
    consentDefaultAds: 'granted',
    metaCapiEnabled: false,
    metaCapiPixelId: '',
    metaCapiTokenEnc: '',
    metaCapiTestCode: '',
    tiktokEventsEnabled: false,
    tiktokEventsCode: '',
    tiktokEventsTokenEnc: '',
  });

  setSetting('checkout', {
    guestCheckout: true,
    termsRequired: false,
    minOrderAmount: 0,
    codOtpThreshold: 5000,
    codOtpEnabled: false,
    advanceDeliveryFeeRequired: false,
    advanceDeliveryFeeAmount: 130,
    duplicateWindowMinutes: 15,
    maxOrdersPerPhoneHour: 4,
    fields: [
      { key: 'name', labelEn: 'Full Name', labelBn: 'আপনার সম্পূর্ণ নাম', visible: true, required: true },
      { key: 'phone', labelEn: 'Mobile Number (01XXXXXXXXX)', labelBn: 'মোবাইল নম্বর', visible: true, required: true },
      { key: 'district', labelEn: 'District', labelBn: 'জেলা', visible: true, required: true },
      { key: 'area', labelEn: 'Thana / Area', labelBn: 'থানা / এলাকা', visible: true, required: false },
      { key: 'address', labelEn: 'Full Delivery Address', labelBn: 'বিস্তারিত ঠিকানা', visible: true, required: true },
      { key: 'email', labelEn: 'Email (optional for invoice)', labelBn: 'ইমেইল (ঐচ্ছিক)', visible: true, required: false },
      { key: 'note', labelEn: 'Order Note', labelBn: 'অর্ডার নোট', visible: true, required: false },
    ],
  });

  setSetting('payments', {
    cod: { enabled: true, extraFee: 0, maxAmount: 25000 },
    bkash: { enabled: true, sandbox: true, appKey: 'sandbox_bkash_key', appSecretEnc: encryptSecret('sandbox_bkash_secret'), username: 'sandboxTokenizedUser', passwordEnc: encryptSecret('sandboxPass') },
    nagad: { enabled: true, sandbox: true, merchantId: '683002007104225', publicKey: 'sandbox_pub', privateKeyEnc: encryptSecret('sandbox_priv') },
    sslcommerz: { enabled: true, sandbox: true, storeId: 'shudd6601sandbox', storePassEnc: encryptSecret('shudd6601sandbox@ssl') },
    bankTransfer: { enabled: false, instructions: 'Dutch-Bangla Bank Banani Branch, A/C 1161100049281' },
  });

  setSetting('sms', {
    provider: 'sandbox',
    senderId: 'SHUDDHO',
    masking: true,
    apiKeyEnc: encryptSecret('sandbox_sms_key_2026'),
    customUrl: '',
    balance: 4820,
  });

  setSetting('announcements', [
    { id: 'ann-1', textEn: 'Free delivery across Dhaka on orders over ৳2,000 · Use code PURE10 for 10% off', textBn: '২,০০০ টাকার বেশি অর্ডারে ঢাকায় ফ্রি ডেলিভারি · ১০% ছাড়ের কোড PURE10', link: '/shop', active: true },
    { id: 'ann-2', textEn: 'Fresh Winter Harvest: Sundarban Raw Khalisha Honey & Pabna Deshi Ghee now in stock', textBn: 'শীতের নতুন সংগ্রহ: সুন্দরবনের খলিশা মধু ও পাবনার খাঁটি ঘি স্টকে আছে', link: '/category/honey', active: true },
  ]);

  setSetting('homepage_sections', [
    { id: 'sec-hero', type: 'hero_grid', titleEn: 'Hero Banner', visible: true, order: 1, config: {
      eyebrowEn: 'WINTER HARVEST 2026', eyebrowBn: 'শীতকালীন তাজা সংগ্রহ ২০২৬',
      headlineEn: 'Pure Bangladeshi food, direct from trusted farms', headlineBn: 'খাঁটি দেশি খাবার, সরাসরি নির্ভরযোগ্য খামার থেকে',
      subtextEn: 'Lab-tested Sundarban honey, artisanal Pabna cow ghee, and wood-pressed mustard oil delivered in 24–72 hours.',
      subtextBn: 'ল্যাব-পরীক্ষিত সুন্দরবনের মধু, পাবনার খাঁটি গাওয়া ঘি ও ঘানিতে ভাঙা সরিষার তেল ২৪–৭২ ঘণ্টায় পৌঁছে যাবে।',
      ctaEn: 'Shop Pure Foods', ctaBn: 'সব পণ্য দেখুন', ctaLink: '/shop',
      heroImage: '/src/assets/images/hero_sundarban_honey_1794994128015.jpg',
      tile1TitleEn: 'Pabna Cow Ghee', tile1SubEn: 'Slow-churned bilona method', tile1Link: '/category/ghee', tile1Image: '/src/assets/images/product_deshi_ghee_1794994127438.jpg',
      tile2TitleEn: 'Cold-Pressed Oils', tile2SubEn: '100% Kachi Ghani mustard', tile2Link: '/category/oils', tile2Image: '/src/assets/images/product_mustard_oil_1794994128254.jpg',
    }},
    { id: 'sec-usp', type: 'usp_row', titleEn: 'Trust Guarantees', visible: true, order: 2, config: {
      items: [
        { icon: 'banknote', titleEn: 'Cash on Delivery', titleBn: 'ক্যাশ অন ডেলিভারি', descEn: 'Inspect your parcel before paying across 64 districts', descBn: 'পণ্য হাতে পেয়ে যাচাই করে মূল্য পরিশোধের সুবিধা' },
        { icon: 'shield', titleEn: 'Lab-Tested Purity', titleBn: 'ল্যাব-পরীক্ষিত বিশুদ্ধতা', descEn: 'Zero adulteration, no artificial color or preservatives', descBn: 'কোনো ভেজাল বা কৃত্রিম উপাদান ছাড়া শতভাগ খাঁটি' },
        { icon: 'rotate', titleEn: '7-Day Easy Return', titleBn: '৭ দিনের সহজ রিটার্ন', descEn: 'Instant replacement or refund if quality disappoints', descBn: 'মানে সন্তুষ্ট না হলে দ্রুত পরিবর্তন বা রিফান্ড' },
        { icon: 'truck', titleEn: '24–72h Express Delivery', titleBn: '২৪–৭২ ঘণ্টায় ডেলিভারি', descEn: '24h inside Dhaka, 48–72h nationwide via Steadfast & Pathao', descBn: 'ঢাকায় ২৪ ঘণ্টা ও সারাদেশে ৪৮–৭২ ঘণ্টায় হোম ডেলিভারি' },
      ]
    }},
    { id: 'sec-cats', type: 'category_tiles', titleEn: 'Shop by Category', visible: true, order: 3, config: {} },
    { id: 'sec-featured', type: 'product_grid', titleEn: 'Customer Favorites', titleBn: 'গ্রাহকদের সেরা পছন্দ', visible: true, order: 4, config: { filter: 'featured', limit: 8 } },
    { id: 'sec-promo', type: 'promo_band', titleEn: 'Winter Pantry Offer', visible: true, order: 5, config: {
      eyebrowEn: 'BUNDLE & SAVE', titleEn: 'Save 10% on orders above ৳1,000', titleBn: '১,০০০ টাকার বেশি অর্ডারে ১০% ছাড়',
      code: 'PURE10', ctaEn: 'Apply Coupon & Shop', link: '/shop?coupon=PURE10'
    }},
    { id: 'sec-just-landed', type: 'product_grid', titleEn: 'Just Landed', titleBn: 'নতুন এসেছে', visible: true, order: 6, config: { filter: 'newest', limit: 4 } },
    { id: 'sec-testimonials', type: 'testimonials', titleEn: 'What Bangladeshi Families Say', visible: true, order: 7, config: {} },
    { id: 'sec-faq', type: 'faq', titleEn: 'Frequently Asked Questions', visible: true, order: 8, config: {} },
  ]);

  setSetting('menus', {
    header: [
      { id: 'm1', labelEn: 'All Products', labelBn: 'সব পণ্য', href: '/shop' },
      { id: 'm2', labelEn: 'Honey', labelBn: 'মধু', href: '/category/honey' },
      { id: 'm3', labelEn: 'Deshi Ghee', labelBn: 'গাওয়া ঘি', href: '/category/ghee' },
      { id: 'm4', labelEn: 'Oils', labelBn: 'সরিষার তেল', href: '/category/oils' },
      { id: 'm5', labelEn: 'Dates & Nuts', labelBn: 'খেজুর ও বাদাম', href: '/category/dates-nuts' },
      { id: 'm6', labelEn: 'Spices & Tea', labelBn: 'মসলা ও চা', href: '/category/spices-tea' },
    ],
    footer: [
      { id: 'f1', labelEn: 'About Us', labelBn: 'আমাদের সম্পর্কে', href: '/pages/about' },
      { id: 'f2', labelEn: 'Track Order', labelBn: 'অর্ডার ট্র্যাক', href: '/track' },
      { id: 'f3', labelEn: 'Shipping Policy', labelBn: 'ডেলিভারি নীতি', href: '/pages/shipping-policy' },
      { id: 'f4', labelEn: 'Return & Refund', labelBn: 'রিটার্ন ও রিফান্ড', href: '/pages/return-policy' },
      { id: 'f5', labelEn: 'Privacy Policy', labelBn: 'গোপনীয়তা নীতি', href: '/pages/privacy-policy' },
      { id: 'f6', labelEn: 'Blog', labelBn: 'ব্লগ', href: '/blog' },
      { id: 'f7', labelEn: 'Contact', labelBn: 'যোগাযোগ', href: '/pages/contact' },
    ],
  });

  setSetting('popups', [
    {
      id: 'pop-welcome',
      titleEn: 'Get ৳100 Off Your First Pure Pantry Order',
      titleBn: 'প্রথম অর্ডারে পাচ্ছেন ১০০ টাকা ছাড়',
      bodyEn: 'Use coupon WELCOME100 at checkout or click below to apply it automatically.',
      bodyBn: 'চেকআউটে WELCOME100 কোড ব্যবহার করুন অথবা নিচে ক্লিক করুন।',
      couponCode: 'WELCOME100',
      trigger: 'exit_or_timer',
      delaySeconds: 18,
      active: true,
    }
  ]);

  setSetting('testimonials', [
    { id: 't1', name: 'Nusrat Jahan', city: 'Dhanmondi, Dhaka', rating: 5, textEn: 'The Sundarban Khalisha honey has that unmistakable wild floral aroma. Lab certificate QR on the jar gave real peace of mind.', textBn: 'সুন্দরবনের খলিশা মধুর ঘ্রাণটাই বলে দেয় এটা একদম খাঁটি।' },
    { id: 't2', name: 'Mahmudul Hasan', city: 'Agrabad, Chattogram', rating: 5, textEn: 'Ordered Pabna Ghee and Kachi Ghani Mustard Oil on Tuesday, received via Steadfast Thursday morning with zero leakage.', textBn: 'মঙ্গলবার অর্ডার করে বৃহস্পতিবার সকালেই হাতে পেয়েছি। প্যাকিং অসাধারণ।' },
    { id: 't3', name: 'Farhana Yasmin', city: 'Zindabazar, Sylhet', rating: 5, textEn: 'My parents love the Arabian Medjool dates and roasted cashew mix. Always fresh and neatly packed.', textBn: 'মেডজুল খেজুর আর বাদামের মান খুবই ভালো, বাসার সবাই পছন্দ করেছে।' },
  ]);

  setSetting('faqs', [
    { id: 'q1', qEn: 'How do you verify honey and ghee purity?', qBn: 'মধু ও ঘিয়ের বিশুদ্ধতা কীভাবে যাচাই করা হয়?', aEn: 'Every harvest batch undergoes moisture, pollen, and adulteration testing before bottling. Batch numbers are printed on each jar.', aBn: 'প্রতিটি ব্যাচ বোতলজাত করার আগে আর্দ্রতা ও বিশুদ্ধতা পরীক্ষা করা হয়।' },
    { id: 'q2', qEn: 'How long does delivery take across Bangladesh?', qBn: 'সারাদেশে ডেলিভারি হতে কত সময় লাগে?', aEn: 'Inside Dhaka deliveries arrive within 24 hours. Dhaka suburbs take 24–48 hours, and all 64 districts outside Dhaka take 48–72 hours.', aBn: 'ঢাকায় ২৪ ঘণ্টা এবং ঢাকার বাইরে ৪৮–৭২ ঘণ্টায় ডেলিভারি হয়।' },
    { id: 'q3', qEn: 'Can I check the parcel before paying Cash on Delivery?', qBn: 'ক্যাশ অন ডেলিভারিতে পণ্য দেখে টাকা দেওয়া যাবে?', aEn: 'Yes, you can inspect the outer packaging and jar seals in front of the delivery rider before paying.', aBn: 'হ্যাঁ, রাইডারের সামনে পার্সেল ও সিল যাচাই করে টাকা পরিশোধ করতে পারবেন।' },
  ]);

  setSetting('courier_settings', {
    defaultCourier: 'steadfast',
    autoBookDhaka: 'pathao',
    autoBookOutside: 'steadfast',
    autoBookOnConfirm: false,
    fraudHoldThresholdPercent: 50,
    labelFormat: '4x6',
    statusMap: {
      pending: 'shipped',
      in_review: 'shipped',
      picked_up: 'shipped',
      in_transit: 'shipped',
      out_for_delivery: 'out_for_delivery',
      delivered: 'delivered',
      partial_delivered: 'partially_delivered',
      cancelled: 'returned',
      returned: 'returned',
      hold: 'on_hold',
    },
  });

  // 2. Staff Users (all RBAC roles)
  const staffInsert = db.prepare(`INSERT INTO staff_users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`);
  staffInsert.run('staff-owner', 'Tariqul Islam (Owner)', 'owner@shuddho.com.bd', hashPassword('Shuddho@2026'), 'owner');
  staffInsert.run('staff-manager', 'Sadia Rahman (Manager)', 'manager@shuddho.com.bd', hashPassword('Manager@2026'), 'manager');
  staffInsert.run('staff-agent1', 'Rafiul Karim (Agent)', 'agent@shuddho.com.bd', hashPassword('Agent@2026'), 'agent');
  staffInsert.run('staff-packer', 'Kamrul Hasan (Packer)', 'packer@shuddho.com.bd', hashPassword('Packer@2026'), 'packer');
  staffInsert.run('staff-marketing', 'Nabila Chowdhury (Marketing)', 'marketing@shuddho.com.bd', hashPassword('Marketing@2026'), 'marketing');
  staffInsert.run('staff-accountant', 'Faisal Mahmud (Accountant)', 'accountant@shuddho.com.bd', hashPassword('Accountant@2026'), 'accountant');

  // 3. Categories & Brands & Attributes
  const catInsert = db.prepare(`INSERT INTO categories (id, slug, name_en, name_bn, description_en, description_bn, image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  catInsert.run('cat-honey', 'honey', 'Raw Honey', 'খাঁটি মধু', 'Unheated wildflower honey harvested ethically from the Sundarbans & Madhupur.', 'সুন্দরবন ও মধুপুর থেকে সংগৃহীত প্রাকৃতিক কাঁচা মধু।', '/src/assets/images/hero_sundarban_honey_1794994128015.jpg', 1);
  catInsert.run('cat-ghee', 'ghee', 'Deshi Ghee', 'খাঁটি গাওয়া ঘি', 'Slow-simmered grass-fed cow ghee from Pabna and Sirajganj dairy artisans.', 'পাবনা ও সিরাজগঞ্জের খাঁটি গরুর দুধের গাওয়া ঘি।', '/src/assets/images/product_deshi_ghee_1794994127438.jpg', 2);
  catInsert.run('cat-oils', 'oils', 'Cold-Pressed Oils', 'ঘানি ভাঙা তেল', 'Wooden ghani cold-pressed mustard and black seed oils with pungent natural aroma.', 'কাঠের ঘানিতে ভাঙা খাঁটি সরিষা ও কালোজিরার তেল।', '/src/assets/images/product_mustard_oil_1794994128254.jpg', 3);
  catInsert.run('cat-dates-nuts', 'dates-nuts', 'Dates, Nuts & Seeds', 'খেজুর, বাদাম ও বীজ', 'Premium Arabian Ajwa & Medjool dates, jumbo almonds, walnuts, chia & pumpkin seeds.', 'প্রিমিয়াম আজওয়া ও মেডজুল খেজুর, কাঠবাদাম, আখরোট ও চিয়া সিড।', '/src/assets/images/product_medjool_dates_1794994128520.jpg', 4);
  catInsert.run('cat-spices-tea', 'spices-tea', 'Spices, Rice & Tea', 'মসলা, চাল ও চা', 'Single-origin Sylhet spices, Dinajpur Chinigura rice, and organic garden tea.', 'সিলেটের খাঁটি মসলা, দিনাজপুরের চিনিগুঁড়া চাল ও অর্গানিক চা।', '/src/assets/images/product_spices_tea_1794994129555.jpg', 5);

  const brandInsert = db.prepare(`INSERT INTO brands (id, slug, name) VALUES (?, ?, ?)`);
  brandInsert.run('br-shuddho', 'shuddho-apiary', 'Shuddho Apiary');
  brandInsert.run('br-pabna', 'pabna-dairy', 'Pabna Dairy Craft');
  brandInsert.run('br-bogura', 'bogura-ghani', 'Bogura Ghani');
  brandInsert.run('br-madina', 'madina-harvest', 'Madina Harvest');
  brandInsert.run('br-sylhet', 'sylhet-estates', 'Sylhet Tea Estates');

  const attrInsert = db.prepare(`INSERT INTO attributes (id, name, slug, terms) VALUES (?, ?, ?, ?)`);
  attrInsert.run('attr-weight', 'Weight / Pack Size', 'weight', JSON.stringify(['250 g', '500 g', '1 kg', '500 ml', '1 L', 'Combo']));
  attrInsert.run('attr-origin', 'Origin', 'origin', JSON.stringify(['Sundarban', 'Pabna', 'Bogura', 'Madinah', 'Sylhet', 'Dinajpur']));

  // 4. Products & Variants
  const prodInsert = db.prepare(`
    INSERT INTO products (
      id, slug, sku, type, status, featured, name_en, name_bn, short_desc_en, short_desc_bn,
      desc_en, desc_bn, category_id, brand_id, tags, badges, price, regular_price, cost_price,
      stock, reserved_stock, low_stock_threshold, weight_grams, images, specs, faqs, bundle_items,
      meta_title, meta_desc, rating_avg, review_count
    ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 5, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const varInsert = db.prepare(`
    INSERT INTO product_variants (id, product_id, label, sku, price, regular_price, cost_price, stock, reserved_stock, weight_grams, image, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `);

  // P1: Sundarban Natural Honey
  prodInsert.run(
    'prod-honey-1', 'sundarban-natural-honey', 'HN-500', 'variable', 1,
    'Sundarban Natural Honey', 'সুন্দরবনের প্রাকৃতিক খলিশা মধু',
    'Unfiltered raw Khalisha wildflower honey collected by traditional Mouals in Satkhira.',
    'সাতক্ষীরার সুন্দরবন থেকে সংগৃহীত খাঁটি প্রাকৃতিক খলিশা ফুলের মধু।',
    'Harvested once a year during the spring Khalisha bloom in the Sundarbans mangrove forest. Never heated or micro-filtered, preserving live enzymes, natural pollen, and rich floral notes.',
    'প্রতি বছর বসন্তকালে সুন্দরবনের খলিশা ফুল থেকে ঐতিহ্যবাহী মৌয়ালদের মাধ্যমে সংগৃহীত। কোনো তাপ প্রয়োগ ছাড়াই বোতলজাত করা হয়।',
    'cat-honey', 'br-shuddho', JSON.stringify(['honey', 'sundarban', 'organic', 'immunity']), JSON.stringify(['Best Seller', 'Lab Tested']),
    850, 990, 520, 42, 500,
    JSON.stringify(['/src/assets/images/hero_sundarban_honey_1794994128015.jpg']),
    JSON.stringify([{ key: 'Origin', value: 'Satkhira Range, Sundarbans' }, { key: 'Moisture', value: '18.6% (Lab verified)' }, { key: 'Harvest', value: 'Spring 2026' }]),
    JSON.stringify([{ q: 'Does raw honey crystallize in winter?', a: 'Yes, pure raw honey naturally thickens or crystallizes in cool weather, proving zero sugar syrup adulteration.' }]),
    '[]',
    'Sundarban Natural Honey (250g / 500g / 1kg) | Shuddho', 'Buy lab-tested pure Sundarban Khalisha raw honey in Bangladesh.', 4.9, 128
  );
  varInsert.run('var-hn-250', 'prod-honey-1', '250 g', 'HN-250', 460, 520, 270, 28, 250, '/src/assets/images/hero_sundarban_honey_1794994128015.jpg', 1);
  varInsert.run('var-hn-500', 'prod-honey-1', '500 g', 'HN-500', 850, 990, 520, 42, 500, '/src/assets/images/hero_sundarban_honey_1794994128015.jpg', 2);
  varInsert.run('var-hn-1kg', 'prod-honey-1', '1 kg', 'HN-1000', 1620, 1900, 980, 16, 1000, '/src/assets/images/hero_sundarban_honey_1794994128015.jpg', 3);

  // P2: Pabna Pure Deshi Cow Ghee
  prodInsert.run(
    'prod-ghee-1', 'pabna-deshi-cow-ghee', 'GH-500', 'variable', 1,
    'Pabna Pure Deshi Cow Ghee', 'পাবনার খাঁটি দেশি গরুর গাওয়া ঘি',
    'Granular, aromatic bilona-churned cow ghee from free-grazing Pabna cattle.',
    'পাবনার বাথানের দেশি গরুর দুধ থেকে তৈরি দানাদার খাঁটি গাওয়া ঘি।',
    'Prepared using traditional cultured curd churning in small copper vessels over a slow flame. Rich granular texture and unmistakable nutty aroma for biryani, dal, and daily breakfast.',
    'ঐতিহ্যবাহী দই মন্থন পদ্ধতিতে তৈরি দানাদার ও সুগন্ধি খাঁটি গাওয়া ঘি।',
    'cat-ghee', 'br-pabna', JSON.stringify(['ghee', 'dairy', 'pabna']), JSON.stringify(['Artisanal']),
    950, 1080, 650, 4, 500,
    JSON.stringify(['/src/assets/images/product_deshi_ghee_1794994127438.jpg']),
    JSON.stringify([{ key: 'Origin', value: 'Bera, Pabna' }, { key: 'Method', value: 'Traditional Curd Bilona' }, { key: 'Shelf Life', value: '9 Months' }]),
    '[]', '[]',
    'Pabna Pure Deshi Cow Ghee | Shuddho', 'Authentic Pabna grass-fed cow ghee delivered across Bangladesh.', 4.9, 94
  );
  varInsert.run('var-gh-250', 'prod-ghee-1', '250 g', 'GH-250', 510, 560, 340, 19, 250, '/src/assets/images/product_deshi_ghee_1794994127438.jpg', 1);
  varInsert.run('var-gh-500', 'prod-ghee-1', '500 g', 'GH-500', 950, 1080, 650, 4, 500, '/src/assets/images/product_deshi_ghee_1794994127438.jpg', 2);
  varInsert.run('var-gh-1kg', 'prod-ghee-1', '1 kg', 'GH-1000', 1840, 2100, 1260, 11, 1000, '/src/assets/images/product_deshi_ghee_1794994127438.jpg', 3);

  // P3: Cold-Pressed Kachi Ghani Mustard Oil
  prodInsert.run(
    'prod-oil-1', 'kachi-ghani-mustard-oil', 'MO-1000', 'variable', 1,
    'Kachi Ghani Mustard Oil', 'কাঠের ঘানিতে ভাঙা খাঁটি সরিষার তেল',
    'First-press unrefined deshi Rai mustard oil pressed in wooden kolhu mills.',
    'দেশি রাই সরিষা থেকে কাঠের ঘানিতে ভাঙা প্রথম প্রেসের খাঁটি তেল।',
    'Pressed below 42°C in traditional Bogura wooden kolhu presses using sun-dried local Maghi & Rai mustard seeds. Zero hexane, zero palm mixing.',
    'কোনো কেমিক্যাল বা রিফাইনিং ছাড়া বগুড়ার কাঠের ঘানিতে ভাঙা খাঁটি সরিষার তেল।',
    'cat-oils', 'br-bogura', JSON.stringify(['oil', 'mustard', 'cold-pressed']), JSON.stringify(['Wood Pressed']),
    390, 450, 240, 55, 1000,
    JSON.stringify(['/src/assets/images/product_mustard_oil_1794994128254.jpg']),
    JSON.stringify([{ key: 'Seed Type', value: 'Deshi Rai & Maghi Mustard' }, { key: 'Extraction', value: 'Wooden Kolhu Cold-Press' }]),
    '[]', '[]',
    'Kachi Ghani Mustard Oil | Shuddho', 'Cold-pressed pure mustard oil in glass and food-grade bottles.', 4.8, 76
  );
  varInsert.run('var-mo-500', 'prod-oil-1', '500 ml', 'MO-500', 210, 240, 130, 34, 500, '/src/assets/images/product_mustard_oil_1794994128254.jpg', 1);
  varInsert.run('var-mo-1l', 'prod-oil-1', '1 L', 'MO-1000', 390, 450, 240, 55, 1000, '/src/assets/images/product_mustard_oil_1794994128254.jpg', 2);
  varInsert.run('var-mo-5l', 'prod-oil-1', '5 L Jar', 'MO-5000', 1850, 2150, 1180, 12, 5000, '/src/assets/images/product_mustard_oil_1794994128254.jpg', 3);

  // P4: Madinah Ajwa & Medjool Dates
  prodInsert.run(
    'prod-dates-1', 'madinah-ajwa-medjool-dates', 'DT-500', 'variable', 1,
    'Madinah Ajwa & Medjool Dates', 'মদিনার প্রিমিয়াম আজওয়া ও মেডজুল খেজুর',
    'Soft, caramel-rich Grade-A dates stored in temperature-controlled freshness.',
    'তাপমাত্রা-নিয়ন্ত্রিত তাজা গ্রেড-এ মদিনার আজওয়া ও মেডজুল খেজুর।',
    'Hand-sorted jumbo Medjool and authentic Madinah Ajwa dates. Naturally sweet energy source with zero glucose coating.',
    'কোনো কৃত্রিম সিরাপ ছাড়া সরাসরি আমদানিকৃত প্রিমিয়াম আজওয়া ও মেডজুল খেজুর।',
    'cat-dates-nuts', 'br-madina', JSON.stringify(['dates', 'ajwa', 'medjool', 'ramadan']), JSON.stringify(['Grade A']),
    790, 920, 510, 27, 500,
    JSON.stringify(['/src/assets/images/product_medjool_dates_1794994128520.jpg']),
    JSON.stringify([{ key: 'Origin', value: 'Al-Madinah / Jordan' }, { key: 'Grade', value: 'Jumbo Grade A' }]),
    '[]', '[]',
    'Madinah Ajwa & Medjool Dates | Shuddho', 'Fresh Grade-A Ajwa and Medjool dates online in Bangladesh.', 4.9, 63
  );
  varInsert.run('var-dt-500', 'prod-dates-1', '500 g', 'DT-500', 790, 920, 510, 27, 500, '/src/assets/images/product_medjool_dates_1794994128520.jpg', 1);
  varInsert.run('var-dt-1kg', 'prod-dates-1', '1 kg', 'DT-1000', 1520, 1780, 980, 14, 1000, '/src/assets/images/product_medjool_dates_1794994128520.jpg', 2);

  // P5: Honey & Nuts Power Mix (Nuts & Seeds)
  prodInsert.run(
    'prod-nuts-1', 'royal-mixed-nuts-seeds', 'NS-500', 'variable', 1,
    'Royal Almonds, Cashews & Seeds Mix', 'প্রিমিয়াম কাঠবাদাম, কাজু, আখরোট ও বীজ মিক্স',
    'Crunchy California almonds, W240 cashews, Kashmiri walnuts, chia & pumpkin seeds.',
    'ক্যালিফোর্নিয়া কাঠবাদাম, কাজুবাদাম, আখরোট, চিয়া ও কুমড়ো বীজের পুষ্টিকর মিশ্রণ।',
    'Vacuum-sealed weekly in small batches for maximum crunch. Ideal for honey-nut soaking, smoothies, and healthy snacking.',
    'প্রতি সপ্তাহে তাজা প্যাক করা বাদাম ও সুপারফুড বীজের মিশ্রণ।',
    'cat-dates-nuts', 'br-madina', JSON.stringify(['nuts', 'seeds', 'chia', 'almonds']), JSON.stringify(['Fresh Batch']),
    680, 780, 440, 31, 500,
    JSON.stringify(['/src/assets/images/product_nuts_seeds_1794994128599.jpg']),
    JSON.stringify([{ key: 'Ingredients', value: 'Almond, W240 Cashew, Walnut, Pumpkin & Chia Seeds' }]),
    '[]', '[]',
    'Royal Mixed Nuts & Seeds | Shuddho', 'Buy fresh almonds, cashews, walnuts, and chia seeds in Bangladesh.', 4.8, 52
  );
  varInsert.run('var-ns-250', 'prod-nuts-1', '250 g', 'NS-250', 360, 420, 230, 30, 250, '/src/assets/images/product_nuts_seeds_1794994128599.jpg', 1);
  varInsert.run('var-ns-500', 'prod-nuts-1', '500 g', 'NS-500', 680, 780, 440, 31, 500, '/src/assets/images/product_nuts_seeds_1794994128599.jpg', 2);

  // P6: Sylhet Organic Spices & Green Tea
  prodInsert.run(
    'prod-spice-1', 'sylhet-turmeric-cardamom-pack', 'SP-500', 'variable', 1,
    'Whole Green Cardamom & Deshi Turmeric', 'সিলেটের সবুজ এলাচ ও দেশি হলুদ গুঁড়া',
    'Sun-dried whole green cardamom pods and stone-ground high-curcumin deshi turmeric.',
    'সুবাসযুক্ত সবুজ এলাচ এবং ঢেঁকি/পাথরে ভাঙা দেশি হলুদের গুঁড়া।',
    'Single-origin spices free from artificial dye and fillers. Vibrant aroma and deep natural color.',
    'কোনো কৃত্রিম রং ছাড়া শতভাগ খাঁটি মসলা।',
    'cat-spices-tea', 'br-sylhet', JSON.stringify(['spices', 'turmeric', 'cardamom']), JSON.stringify(['New']),
    420, 490, 260, 3, 500,
    JSON.stringify(['/src/assets/images/product_spices_tea_1794994129555.jpg']),
    JSON.stringify([{ key: 'Origin', value: 'Sreemangal & Khagrachhari' }]),
    '[]', '[]',
    'Whole Green Cardamom & Deshi Turmeric | Shuddho', 'Pure Bangladeshi spices online.', 4.7, 39
  );
  varInsert.run('var-sp-250', 'prod-spice-1', '250 g', 'SP-250', 230, 270, 140, 18, 250, '/src/assets/images/product_spices_tea_1794994129555.jpg', 1);
  varInsert.run('var-sp-500', 'prod-spice-1', '500 g', 'SP-500', 420, 490, 260, 3, 500, '/src/assets/images/product_spices_tea_1794994129555.jpg', 2);

  // P7: Black Seed (Kalojira) Honey
  prodInsert.run(
    'prod-honey-2', 'kalojira-flower-honey', 'KJ-500', 'simple', 1,
    'Black Seed (Kalojira) Flower Honey', 'কালোজিরা ফুলের খাঁটি মধু',
    'Dark, mineral-rich honey collected from Shariatpur & Faridpur black seed fields.',
    'শরীয়তপুর ও ফরিদপুরের কালোজিরা ক্ষেত থেকে সংগৃহীত গাঢ় খাঁটি মধু।',
    'Prized in Bangladeshi households for its bold, slightly spiced finish and traditional wellness benefits.',
    'শীতকালীন কালোজিরা ফুলের খাঁটি ও পুষ্টিসমৃদ্ধ মধু।',
    'cat-honey', 'br-shuddho', JSON.stringify(['honey', 'kalojira', 'black-seed']), JSON.stringify(['Winter Harvest']),
    980, 1150, 610, 22, 500,
    JSON.stringify(['/src/assets/images/hero_sundarban_honey_1794994128015.jpg']),
    JSON.stringify([{ key: 'Origin', value: 'Shariatpur, Bangladesh' }]),
    '[]', '[]',
    'Black Seed Flower Honey | Shuddho', 'Authentic Kalojira flower honey in Bangladesh.', 4.9, 44
  );

  // P8: Organic Black Seed Oil (Kalojira Tel)
  prodInsert.run(
    'prod-oil-2', 'cold-pressed-kalojira-oil', 'KO-250', 'simple', 1,
    'Cold-Pressed Kalojira (Black Seed) Oil', 'খাঁটি কালোজিরার তেল (কোল্ড প্রেসড)',
    '100% pure virgin black cumin seed oil pressed fresh in small glass bottles.',
    '১০০% খাঁটি প্রথম প্রেসের কালোজিরার তেল কাঁচের বোতলে।',
    'Rich in thymoquinone. Cold-pressed without heat or solvents to protect delicate volatile oils.',
    'তাপ প্রয়োগ ছাড়া ভাঙানো খাঁটি কালোজিরার তেল।',
    'cat-oils', 'br-bogura', JSON.stringify(['oil', 'kalojira', 'wellness']), JSON.stringify(['Pure']),
    540, 620, 330, 19, 250,
    JSON.stringify(['/src/assets/images/product_mustard_oil_1794994128254.jpg']),
    JSON.stringify([{ key: 'Volume', value: '250 ml Glass Bottle' }]),
    '[]', '[]',
    'Cold-Pressed Kalojira Oil | Shuddho', 'Pure cold-pressed black seed oil in Bangladesh.', 4.8, 31
  );

  // P9: Sylhet Estate Loose Leaf Green Tea
  prodInsert.run(
    'prod-tea-1', 'sylhet-organic-green-tea', 'GT-250', 'simple', 0,
    'Sylhet Organic Whole Leaf Green Tea', 'সিলেট টি এস্টেটের অর্গানিক গ্রিন টি',
    'Hand-plucked two-leaves-and-a-bud orthodox tea from Sreemangal.',
    'শ্রীমঙ্গলের বাগান থেকে হাতে তোলা অর্গানিক গ্রিন টি।',
    'Light floral liquor without bitterness. Packed in aroma-lock tins.',
    'হালকা সুগন্ধি ও তিতাভাবমুক্ত অর্গানিক গ্রিন টি।',
    'cat-spices-tea', 'br-sylhet', JSON.stringify(['tea', 'sylhet', 'green-tea']), JSON.stringify(['Organic']),
    320, 380, 180, 40, 250,
    JSON.stringify(['/src/assets/images/product_spices_tea_1794994129555.jpg']),
    JSON.stringify([{ key: 'Estate', value: 'Sreemangal, Moulvibazar' }]),
    '[]', '[]',
    'Sylhet Organic Green Tea | Shuddho', 'Organic Sylhet whole-leaf green tea.', 4.7, 28
  );

  // P10: Sunnah Wellness Combo Bundle
  prodInsert.run(
    'prod-bundle-1', 'sunnah-pantry-combo', 'BND-SUNNAH', 'bundle', 1,
    'Family Wellness Pantry Combo (Honey + Ghee + Dates)', 'ফ্যামিলি ওয়েলনেস কম্বো (মধু + ঘি + খেজুর)',
    'Save ৳380 with 500g Sundarban Honey + 500g Pabna Ghee + 500g Madinah Dates.',
    'সুন্দরবনের মধু ৫০০ গ্রাম + পাবনার ঘি ৫০০ গ্রাম + মদিনার খেজুর ৫০০ গ্রাম কম্বো।',
    'Our #1 Bangladeshi household gift and daily nutrition bundle. Includes free Dhaka delivery!',
    'আমাদের সবচেয়ে জনপ্রিয় পারিবারিক প্যাকেজ — সাথে থাকছে আকর্ষণীয় ছাড়।',
    'cat-honey', 'br-shuddho', JSON.stringify(['bundle', 'combo', 'gift']), JSON.stringify(['Bundle Save']),
    2290, 2670, 1680, 15, 1500,
    JSON.stringify(['/src/assets/images/hero_sundarban_honey_1794994128015.jpg', '/src/assets/images/product_deshi_ghee_1794994127438.jpg', '/src/assets/images/product_medjool_dates_1794994128520.jpg']),
    JSON.stringify([{ key: 'Includes', value: '500g Honey + 500g Ghee + 500g Dates' }]),
    '[]',
    JSON.stringify([
      { productId: 'prod-honey-1', variantId: 'var-hn-500', qty: 1 },
      { productId: 'prod-ghee-1', variantId: 'var-gh-500', qty: 1 },
      { productId: 'prod-dates-1', variantId: 'var-dt-500', qty: 1 },
    ]),
    'Family Wellness Pantry Combo | Shuddho', 'Save on Sundarban Honey, Pabna Ghee, and Madinah Dates combo.', 5.0, 41
  );

  // Media Library entries
  const mediaInsert = db.prepare(`INSERT INTO media_library (id, filename, url, alt_text, size_bytes) VALUES (?, ?, ?, ?, ?)`);
  mediaInsert.run('med-1', 'hero_sundarban_honey.jpg', '/src/assets/images/hero_sundarban_honey_1794994128015.jpg', 'Sundarban Raw Wildflower Honey Glass Jar', 142000);
  mediaInsert.run('med-2', 'product_deshi_ghee.jpg', '/src/assets/images/product_deshi_ghee_1794994127438.jpg', 'Pabna Pure Deshi Cow Ghee Jar', 118000);
  mediaInsert.run('med-3', 'product_mustard_oil.jpg', '/src/assets/images/product_mustard_oil_1794994128254.jpg', 'Cold-Pressed Kachi Ghani Mustard Oil', 121000);
  mediaInsert.run('med-4', 'product_medjool_dates.jpg', '/src/assets/images/product_medjool_dates_1794994128520.jpg', 'Madinah Ajwa and Medjool Dates', 135000);
  mediaInsert.run('med-5', 'product_nuts_seeds.jpg', '/src/assets/images/product_nuts_seeds_1794994128599.jpg', 'Royal Mixed Nuts and Seeds', 129000);
  mediaInsert.run('med-6', 'product_spices_tea.jpg', '/src/assets/images/product_spices_tea_1794994129555.jpg', 'Sylhet Organic Spices and Green Tea', 126000);

  // Inventory batches & suppliers & PO
  db.prepare(`INSERT INTO suppliers (id, name, phone, location, notes) VALUES (?, ?, ?, ?, ?)`).run('sup-1', 'Satkhira Moual Cooperative', '+8801712334455', 'Shyamnagar, Satkhira', 'Primary wildflower honey supplier');
  db.prepare(`INSERT INTO suppliers (id, name, phone, location, notes) VALUES (?, ?, ?, ?, ?)`).run('sup-2', 'Bera Bilona Dairy Collective', '+8801819556677', 'Bera, Pabna', 'Grass-fed cow ghee');
  db.prepare(`INSERT INTO inventory_batches (id, product_id, variant_id, batch_code, quantity, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`).run('bat-1', 'prod-honey-1', 'var-hn-500', 'SH-HN-2604', 42, '2028-04-30');
  db.prepare(`INSERT INTO inventory_batches (id, product_id, variant_id, batch_code, quantity, expiry_date) VALUES (?, ?, ?, ?, ?, ?)`).run('bat-2', 'prod-ghee-1', 'var-gh-500', 'SH-GH-2610', 4, '2027-06-15');
  db.prepare(`INSERT INTO purchase_orders (id, supplier_id, status, items, total_cost, expected_date) VALUES (?, ?, ?, ?, ?, ?)`).run('po-101', 'sup-2', 'ordered', JSON.stringify([{ productId: 'prod-ghee-1', name: 'Pabna Deshi Ghee (500 g)', qty: 30, unitCost: 650 }]), 19500, '2026-11-24');

  // Reviews
  const revInsert = db.prepare(`INSERT INTO reviews (id, product_id, customer_name, customer_phone, rating, comment, verified_buyer, status, helpful_count) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`);
  revInsert.run('rev-1', 'prod-honey-1', 'Rahim Uddin', '+8801711482910', 5, 'Thick, fragrant, and genuinely raw. Passed our home test and the jar arrived tightly bubble-wrapped.', 'approved', 14);
  revInsert.run('rev-2', 'prod-ghee-1', 'Nusrat Jahan', '+8801819223344', 5, 'Just like homemade Pabna ghee! Grainy texture and rich smell on hot steamed rice.', 'approved', 9);
  revInsert.run('rev-3', 'prod-oil-1', 'Tanvir Ahmed', '+8801911667788', 5, 'Real sharp jhanj in this Kachi Ghani mustard oil—makes bhorta taste incredible.', 'pending', 2);

  // Shipping Zones
  const zoneInsert = db.prepare(`INSERT INTO shipping_zones (id, name, name_bn, base_fee, free_threshold, express_extra, eta) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  zoneInsert.run('inside_dhaka', 'Inside Dhaka', 'ঢাকার ভেতরে', 70, 2000, 50, '24 hours');
  zoneInsert.run('dhaka_suburbs', 'Dhaka Suburbs (Gazipur, Narayanganj, Savar)', 'ঢাকার পার্শ্ববর্তী এলাকা', 100, 2500, 70, '24–48 hours');
  zoneInsert.run('outside_dhaka', 'Outside Dhaka (All 64 Districts)', 'ঢাকার বাইরে (সারাদেশ)', 130, 3000, 90, '48–72 hours');

  // Coupons
  const coupInsert = db.prepare(`INSERT INTO coupons (id, code, type, value, min_spend, max_discount, usage_limit, used_count, first_order_only, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);
  coupInsert.run('cp-1', 'PURE10', 'percentage', 10, 1000, 500, 1000, 28, 0);
  coupInsert.run('cp-2', 'WELCOME100', 'fixed', 100, 700, 100, 500, 14, 1);
  coupInsert.run('cp-3', 'FREEDEL', 'free_shipping', 0, 500, 0, 500, 9, 0);

  // Customers
  const custInsert = db.prepare(`INSERT INTO customers (id, name, phone, email, district, area, address, loyalty_points, tags, first_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  custInsert.run('cust-1', 'Rahim Uddin', '+8801711482910', 'rahim@gmail.com', 'Dhaka', 'Mirpur 10', 'House 18, Lane 4, Block C, Mirpur 10, Dhaka', 240, JSON.stringify(['repeat', 'vip']), 'facebook');
  custInsert.run('cust-2', 'Nusrat Jahan', '+8801819223344', 'nusrat.j@yahoo.com', 'Dhaka', 'Dhanmondi', 'Apt 4B, Road 9A, Dhanmondi, Dhaka', 150, JSON.stringify(['repeat']), 'google');
  custInsert.run('cust-3', 'Mahmudul Hasan', '+8801912345678', 'mahmud@ctg.bd', 'Chattogram', 'Agrabad', '21 CDA Avenue, Agrabad, Chattogram', 85, JSON.stringify(['new']), 'tiktok');
  custInsert.run('cust-4', 'Farhana Yasmin', '+8801615987654', 'farhana@sylhet.bd', 'Sylhet', 'Zindabazar', 'Blue Water Road, Zindabazar, Sylhet', 110, JSON.stringify(['repeat']), 'direct');
  custInsert.run('cust-5', 'Kamal Hossain', '+8801755001122', '', 'Bogura', 'Satmatha', 'Thana Road, Satmatha, Bogura', 0, JSON.stringify(['cod_risk']), 'facebook');

  // Seed Orders (with realistic BD data, statuses, click IDs, courier records)
  const ordInsert = db.prepare(`
    INSERT INTO orders (
      id, order_number, invoice_number, customer_id, customer_name, customer_phone, customer_email,
      district, area, address, delivery_zone, status, payment_method, payment_status,
      subtotal, discount, shipping_fee, tax, total, paid_amount, coupon_code,
      assigned_staff_id, assigned_staff_name, courier_code, consignment_id, tracking_code, courier_status, courier_charge,
      attribution, confirmed_at, confirmed_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const itemInsert = db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, variant_id, sku, name, category, variant_label, unit_price, cost_price, quantity, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Order 10249 (Delivered)
  ordInsert.run(
    'ord-10249', '10249', 'INV-10249', 'cust-1', 'Rahim Uddin', '+8801711482910', 'rahim@gmail.com',
    'Dhaka', 'Mirpur 10', 'House 18, Lane 4, Block C, Mirpur 10, Dhaka', 'inside_dhaka',
    'delivered', 'cod', 'paid', 1800, 0, 70, 1870, 1870, '',
    'staff-agent1', 'Rafiul Karim (Agent)', 'pathao', 'PTH-998210', 'PTH-TRK-10249', 'Delivered', 70,
    JSON.stringify({ click_ids: { fbc: 'fb.1.1763455648123.IwAR2xYzDemo01', fbp: 'fb.1.1763196448000.1234567890', fbclid: 'IwAR2xYzDemo01' }, utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'winter_honey' }),
    '2026-11-16T09:20:03Z', 'agent@shuddho.com.bd', '2026-11-16T08:56:15Z'
  );
  itemInsert.run('oi-1', 'ord-10249', 'prod-honey-1', 'var-hn-500', 'HN-500', 'Sundarban Natural Honey', 'Raw Honey', '500 g', 850, 520, 1, '/src/assets/images/hero_sundarban_honey_1794994128015.jpg');
  itemInsert.run('oi-2', 'ord-10249', 'prod-ghee-1', 'var-gh-500', 'GH-500', 'Pabna Pure Deshi Cow Ghee', 'Deshi Ghee', '500 g', 950, 650, 1, '/src/assets/images/product_deshi_ghee_1794994127438.jpg');

  // Order 10250 (Shipped via Steadfast)
  ordInsert.run(
    'ord-10250', '10250', 'INV-10250', 'cust-3', 'Mahmudul Hasan', '+8801912345678', 'mahmud@ctg.bd',
    'Chattogram', 'Agrabad', '21 CDA Avenue, Agrabad, Chattogram', 'outside_dhaka',
    'shipped', 'cod', 'unpaid', 1620, 0, 130, 1750, 0, '',
    'staff-agent1', 'Rafiul Karim (Agent)', 'steadfast', 'SF-552198', 'SF9910250BD', 'In Transit', 120,
    JSON.stringify({ click_ids: { ttclid: 'TT-CLICK-9981', ttp: 'ttp_demo_991' }, utm_source: 'tiktok', utm_medium: 'paid_video', utm_campaign: 'ghee_reel' }),
    '2026-11-17T10:15:00Z', 'agent@shuddho.com.bd', '2026-11-17T09:42:00Z'
  );
  itemInsert.run('oi-3', 'ord-10250', 'prod-honey-1', 'var-hn-1kg', 'HN-1000', 'Sundarban Natural Honey', 'Raw Honey', '1 kg', 1620, 980, 1, '/src/assets/images/hero_sundarban_honey_1794994128015.jpg');

  // Order 10251 (Confirmed, Ready to ship)
  ordInsert.run(
    'ord-10251', '10251', 'INV-10251', 'cust-2', 'Nusrat Jahan', '+8801819223344', 'nusrat.j@yahoo.com',
    'Dhaka', 'Dhanmondi', 'Apt 4B, Road 9A, Dhanmondi, Dhaka', 'inside_dhaka',
    'confirmed', 'bkash', 'paid', 1340, 134, 70, 1276, 1276, 'PURE10',
    'staff-agent1', 'Rafiul Karim (Agent)', '', '', '', '', 0,
    JSON.stringify({ click_ids: { gclid: 'Cj0KCQiA_gclid_demo', fbp: 'fb.1.1763300000000.9876543210' }, utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'brand_search' }),
    '2026-11-18T05:12:00Z', 'agent@shuddho.com.bd', '2026-11-18T04:50:00Z'
  );
  itemInsert.run('oi-4', 'ord-10251', 'prod-ghee-1', 'var-gh-500', 'GH-500', 'Pabna Pure Deshi Cow Ghee', 'Deshi Ghee', '500 g', 950, 650, 1, '/src/assets/images/product_deshi_ghee_1794994127438.jpg');
  itemInsert.run('oi-5', 'ord-10251', 'prod-oil-1', 'var-mo-1l', 'MO-1000', 'Kachi Ghani Mustard Oil', 'Cold-Pressed Oils', '1 L', 390, 240, 1, '/src/assets/images/product_mustard_oil_1794994128254.jpg');

  // Order 10252 (Pending confirmation - ready to demo Confirm button!)
  ordInsert.run(
    'ord-10252', '10252', '', 'cust-4', 'Farhana Yasmin', '+8801615987654', 'farhana@sylhet.bd',
    'Sylhet', 'Zindabazar', 'Blue Water Road, Zindabazar, Sylhet', 'outside_dhaka',
    'pending', 'cod', 'unpaid', 1470, 0, 130, 1600, 0, '',
    'staff-agent1', 'Rafiul Karim (Agent)', '', '', '', '', 0,
    JSON.stringify({ click_ids: { fbc: 'fb.1.1763460000123.IwAR9HoneySylhet', fbp: 'fb.1.1763460000123.4455667788', fbclid: 'IwAR9HoneySylhet' }, utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'sylhet_dates' }),
    null, null, '2026-11-18T08:30:00Z'
  );
  itemInsert.run('oi-6', 'ord-10252', 'prod-dates-1', 'var-dt-500', 'DT-500', 'Madinah Ajwa & Medjool Dates', 'Dates, Nuts & Seeds', '500 g', 790, 510, 1, '/src/assets/images/product_medjool_dates_1794994128520.jpg');
  itemInsert.run('oi-7', 'ord-10252', 'prod-nuts-1', 'var-ns-500', 'NS-500', 'Royal Almonds, Cashews & Seeds Mix', 'Dates, Nuts & Seeds', '500 g', 680, 440, 1, '/src/assets/images/product_nuts_seeds_1794994128599.jpg');

  // Order 10253 (Pending confirmation - Dhaka)
  ordInsert.run(
    'ord-10253', '10253', '', 'cust-1', 'Rahim Uddin', '+8801711482910', 'rahim@gmail.com',
    'Dhaka', 'Mirpur 10', 'House 18, Lane 4, Block C, Mirpur 10, Dhaka', 'inside_dhaka',
    'pending', 'cod', 'unpaid', 2290, 0, 0, 2290, 0, '',
    'staff-agent1', 'Rafiul Karim (Agent)', '', '', '', '', 0,
    JSON.stringify({ click_ids: { fbp: 'fb.1.1763196448000.1234567890' }, utm_source: 'direct', utm_medium: 'none' }),
    null, null, '2026-11-18T09:05:00Z'
  );
  itemInsert.run('oi-8', 'ord-10253', 'prod-bundle-1', null, 'BND-SUNNAH', 'Family Wellness Pantry Combo (Honey + Ghee + Dates)', 'Raw Honey', 'Combo', 2290, 1680, 1, '/src/assets/images/hero_sundarban_honey_1794994128015.jpg');

  // Order 10254 (On Hold - high risk / no answer)
  ordInsert.run(
    'ord-10254', '10254', '', 'cust-5', 'Kamal Hossain', '+8801755001122', '',
    'Bogura', 'Satmatha', 'Thana Road, Satmatha, Bogura', 'outside_dhaka',
    'on_hold', 'cod', 'unpaid', 850, 0, 130, 980, 0, '',
    'staff-agent1', 'Rafiul Karim (Agent)', '', '', '', '', 0,
    JSON.stringify({ click_ids: { fbc: 'fb.1.1763450000000.IwAR3Bogura', fbclid: 'IwAR3Bogura' }, utm_source: 'facebook', utm_campaign: 'honey_broad' }),
    null, null, '2026-11-18T07:20:00Z'
  );
  itemInsert.run('oi-9', 'ord-10254', 'prod-honey-1', 'var-hn-500', 'HN-500', 'Sundarban Natural Honey', 'Raw Honey', '500 g', 850, 520, 1, '/src/assets/images/hero_sundarban_honey_1794994128015.jpg');

  db.prepare(`INSERT INTO order_notes (id, order_id, type, content, staff_name) VALUES (?, ?, ?, ?, ?)`).run('on-1', 'ord-10254', 'system', 'Order auto-held: Customer phone has 1/3 (33%) courier delivery ratio.', 'Fraud Guard');
  db.prepare(`INSERT INTO call_logs (id, order_id, outcome, note, staff_name) VALUES (?, ?, ?, ?, ?)`).run('cl-1', 'ord-10254', 'no_answer', 'Rang 4 times, will try again at 4 PM.', 'Rafiul Karim (Agent)');

  // Incomplete Orders (abandoned checkouts)
  db.prepare(`
    INSERT INTO incomplete_orders (id, name, phone, district, area, address, items, subtotal, attribution)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'inc-1', 'Mehedi Hasan', '+8801718998877', 'Dhaka', 'Uttara Sector 11', 'Road 14, House 9, Uttara',
    JSON.stringify([{ productId: 'prod-honey-1', variantId: 'var-hn-500', sku: 'HN-500', name: 'Sundarban Natural Honey', variantLabel: '500 g', unitPrice: 850, quantity: 2, image: '/src/assets/images/hero_sundarban_honey_1794994128015.jpg' }]),
    1700,
    JSON.stringify({ click_ids: { fbc: 'fb.1.1763462000100.IwAR7Abandoned', fbclid: 'IwAR7Abandoned' }, utm_source: 'facebook', utm_campaign: 'winter_honey' })
  );

  // Couriers (all 6 adapters in sandbox mode)
  const courInsert = db.prepare(`INSERT INTO courier_accounts (code, name, enabled, sandbox, credentials_enc, pickup_store_id, status) VALUES (?, ?, 1, 1, ?, ?, 'connected')`);
  courInsert.run('steadfast', 'Steadfast Courier', encryptSecret(JSON.stringify({ apiKey: 'sf_sandbox_key_99', secretKey: 'sf_sandbox_sec_88' })), 'SHUDDHO-DHAKA-1');
  courInsert.run('pathao', 'Pathao Courier', encryptSecret(JSON.stringify({ clientId: 'pathao_sandbox_client', clientSecret: 'pathao_sandbox_secret', username: 'merchant@shuddho.com.bd', password: 'demo' })), '14892');
  courInsert.run('redx', 'RedX Logistics', encryptSecret(JSON.stringify({ apiToken: 'redx_sandbox_jwt_token' })), 'Banani Hub');
  courInsert.run('paperfly', 'Paperfly', encryptSecret(JSON.stringify({ username: 'shuddho_pf', password: 'demo', apiKey: 'pf_sandbox' })), 'Dhaka North');
  courInsert.run('ecourier', 'eCourier', encryptSecret(JSON.stringify({ apiKey: 'ec_sandbox', apiSecret: 'ec_sec', userId: 'shuddho' })), 'Banani');
  courInsert.run('manual', 'Manual / Other Courier', encryptSecret(JSON.stringify({ trackingUrlTemplate: 'https://track.shuddho.com.bd/{tracking_id}' })), 'Main Warehouse');

  // Location maps sample
  db.prepare(`INSERT INTO courier_location_maps (id, courier_code, district, area, remote_city_id, remote_zone_id, remote_area_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('lm-1', 'pathao', 'Dhaka', 'Mirpur 10', '1', '14', '210');
  db.prepare(`INSERT INTO courier_location_maps (id, courier_code, district, area, remote_city_id, remote_zone_id, remote_area_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).run('lm-2', 'redx', 'Dhaka', 'Dhanmondi', '1', '12', '105');

  // Notification Templates
  const tplInsert = db.prepare(`INSERT INTO notification_templates (id, event, channel, enabled, body_en, body_bn) VALUES (?, ?, 'sms', 1, ?, ?)`);
  tplInsert.run('tpl-1', 'order_placed', 'Thank you {name}! Your Shuddho order #{order_id} (৳{total}) is received. We will call shortly to confirm.', 'ধন্যবাদ {name}! আপনার শুদ্ধ অর্ডার #{order_id} (৳{total}) গৃহীত হয়েছে।');
  tplInsert.run('tpl-2', 'order_confirmed', 'Confirmed! Order #{order_id} is being packed at Shuddho. Track anytime: {tracking_url}', 'অর্ডার #{order_id} কনফার্ম হয়েছে এবং প্যাকিং চলছে। ট্র্যাক করুন: {tracking_url}');
  tplInsert.run('tpl-3', 'order_shipped', 'Shipped! Your Shuddho parcel #{order_id} is on the way via {courier} (Tracking: {tracking_id}). {tracking_url}', 'আপনার অর্ডার #{order_id} কুরিয়ারে পাঠানো হয়েছে ({tracking_id})। ট্র্যাক: {tracking_url}');
  tplInsert.run('tpl-4', 'order_delivered', 'Delivered! Hope you love your pure foods from Shuddho. Order #{order_id}.', 'অর্ডার #{order_id} ডেলিভারি সম্পন্ন হয়েছে। শুদ্ধ-এর সাথে থাকার জন্য ধন্যবাদ!');
  tplInsert.run('tpl-5', 'order_cancelled', 'Your Shuddho order #{order_id} has been cancelled. Need help? Call +8809612-004455.', 'আপনার অর্ডার #{order_id} বাতিল করা হয়েছে। সহায়তার জন্য কল করুন +8809612-004455।');
  tplInsert.run('tpl-6', 'otp', 'Your Shuddho login verification code is {otp}. Valid for 5 minutes.', 'আপনার শুদ্ধ লগইন ওটিপি কোড: {otp}। ৫ মিনিটের মধ্যে ব্যবহার করুন।');
  tplInsert.run('tpl-7', 'abandoned_cart', 'Hi {name}, your pure foods are waiting in your Shuddho cart! Complete order: {cart_url}', 'হ্যালো {name}, আপনার শুদ্ধ কার্টে থাকা পণ্যগুলো অর্ডার করতে ক্লিক করুন: {cart_url}');

  // Conversion Webhook Endpoint (1 enabled local loopback sandbox receiver for instant testing + verifiable deliveries!)
  db.prepare(`
    INSERT INTO webhook_endpoints (id, name, url, secret, events, include_hashed_pii, enabled)
    VALUES (?, ?, ?, ?, ?, 1, 1)
  `).run(
    'wh-1',
    'Server-Side GTM / CAPI Relay (Demo)',
    'https://httpbin.org/post',
    'whsec_shuddho_9f8a7b6c5d4e3f2a1b',
    JSON.stringify(['Purchase', 'OrderDelivered', 'OrderCancelled']),
  );

  // Pages
  const pageInsert = db.prepare(`INSERT INTO pages (id, slug, title_en, title_bn, content_en, content_bn, is_landing) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  pageInsert.run('pg-about', 'about', 'About Shuddho', 'আমাদের সম্পর্কে', 'Shuddho partners directly with rural Bangladeshi beekeepers in Satkhira, dairy collectives in Pabna, and traditional wooden kolhu mills in Bogura. Every batch is tested for moisture, purity, and zero adulteration before reaching your table.', 'শুদ্ধ সরাসরি সাতক্ষীরার মৌয়াল, পাবনার খামারি এবং বগুড়ার কাঠের ঘানি শিল্পীদের সাথে কাজ করে আপনার হাতে পৌঁছে দেয় শতভাগ খাঁটি খাবার।', 0);
  pageInsert.run('pg-ship', 'shipping-policy', 'Shipping & Delivery Policy', 'ডেলিভারি নীতিমালা', 'Inside Dhaka: ৳70 (24h, Free over ৳2,000). Dhaka Suburbs: ৳100 (24–48h, Free over ৳2,500). Outside Dhaka across all 64 districts: ৳130 (48–72h, Free over ৳3,000).', 'ঢাকার ভেতরে ডেলিভারি চার্জ ৭০ টাকা (২,০০০ টাকার উপরে ফ্রি), ঢাকার বাইরে ১৩০ টাকা।', 0);
  pageInsert.run('pg-ret', 'return-policy', 'Return & Refund Policy', 'রিটার্ন ও রিফান্ড নীতিমালা', 'If any jar arrives damaged or does not meet our purity promise, contact our hotline within 7 days for a hassle-free replacement or full bKash/bank refund.', 'পণ্য ক্ষতিগ্রস্ত হলে বা মানে সন্তুষ্ট না হলে ৭ দিনের মধ্যে সম্পূর্ণ রিফান্ড বা পরিবর্তনের সুবিধা।', 0);
  pageInsert.run('pg-priv', 'privacy-policy', 'Privacy & Data Protection', 'গোপনীয়তা নীতিমালা', 'We respect your privacy and adhere to Google Consent Mode v2. You may export or delete your account data anytime from My Account.', 'আমরা আপনার ব্যক্তিগত তথ্যের সর্বোচ্চ নিরাপত্তা নিশ্চিত করি।', 0);
  pageInsert.run('pg-terms', 'terms', 'Terms & Conditions', 'শর্তাবলী', 'All prices are listed in Bangladeshi Taka (৳ BDT). Cash on Delivery orders are confirmed via phone call before dispatch.', 'সকল পণ্যের মূল্য বাংলাদেশি টাকায় প্রদর্শিত।', 0);
  pageInsert.run('pg-contact', 'contact', 'Contact Us', 'যোগাযোগ করুন', 'Visit our Banani Experience Center or call +8809612-004455 daily from 9 AM to 10 PM.', 'আমাদের বনানী অফিসে আসুন অথবা প্রতিদিন সকাল ৯টা থেকে রাত ১০টার মধ্যে কল করুন।', 0);

  // Blog Posts
  const blogInsert = db.prepare(`INSERT INTO blog_posts (id, slug, title_en, title_bn, excerpt_en, excerpt_bn, content_en, content_bn, category, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  blogInsert.run('bl-1', 'how-to-spot-raw-sundarban-honey', 'How to Spot Genuine Raw Sundarban Honey', 'আসল সুন্দরবনের মধু চেনার উপায়', 'Why crystallization, floral aroma, and moisture content matter more than internet tricks.', 'মধু জমে যাওয়া কেন খাঁটি মধুর লক্ষণ—জানুন বৈজ্ঞানিক ব্যাখ্যা।', 'Many popular water-glass tests fail to distinguish pure raw honey from thick syrup. Real Sundarban Khalisha honey carries an unmistakable wild mangrove floral note, low moisture (<20%), and naturally thickens in winter temperatures.', 'ইন্টারনেটের অনেক ঘরোয়া পরীক্ষাই বৈজ্ঞানিকভাবে সঠিক নয়। আসল খলিশা মধুতে প্রাকৃতিক ফুলের সুবাস থাকে এবং শীতে দানাদার হয়ে জমে যেতে পারে।', 'Honey Guide', '/src/assets/images/hero_sundarban_honey_1794994128015.jpg');
  blogInsert.run('bl-2', 'why-wooden-ghani-mustard-oil-matters', 'Why Wooden Kolhu Mustard Oil Tastes Different', 'কাঠের ঘানির সরিষার তেল কেন আলাদা', 'Cold-pressing below 42°C preserves natural pungency and heart-healthy antioxidants.', 'কম তাপমাত্রায় তেল ভাঙালে কেন পুষ্টিগুণ অক্ষুণ্ণ থাকে।', 'Industrial solvent-extracted oils strip out natural isothiocyanates and vitamin E. Our Bogura wooden kolhu presses slowly crush sun-dried Rai mustard seeds without excess heat.', 'রিফাইন্ড তেলে তাপ ও কেমিক্যালের কারণে প্রাকৃতিক গুণ নষ্ট হয়। কাঠের ঘানিতে ধীরে ভাঙানো তেলে ঝাঁজ ও পুষ্টি অটুট থাকে।', 'Kitchen Craft', '/src/assets/images/product_mustard_oil_1794994128254.jpg');

  // Seed default API key for /api/v1 testing (raw key: sk_shuddho_demo_api_key_2026)
  const rawApiKey = 'sk_shuddho_demo_api_key_2026';
  db.prepare(`INSERT INTO api_keys (id, name, key_prefix, key_hash, scopes) VALUES (?, ?, ?, ?, ?)`)
    .run('key-1', 'Default ERP Sync Key', 'sk_shuddho_de', crypto.createHash('sha256').update(rawApiKey).digest('hex'), JSON.stringify(['orders:read', 'products:read', 'orders:write']));

  logAudit({ staffName: 'System', action: 'database.seeded', entityType: 'system', entityId: 'init' });
}
