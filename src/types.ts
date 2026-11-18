import type { DistrictInfo } from './lib/districts';

export interface ProductVariant {
  id: string;
  product_id: string;
  label: string;
  sku: string;
  price: number;
  regular_price: number;
  cost_price: number;
  stock: number;
  reserved_stock: number;
  weight_grams: number;
  image: string;
  sort_order: number;
}

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_bn: string;
  description_en: string;
  description_bn: string;
  image: string;
  banner_image?: string;
  sort_order: number;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
}

export interface Product {
  id: string;
  slug: string;
  sku: string;
  type: 'simple' | 'variable' | 'bundle';
  status: string;
  featured: boolean;
  name_en: string;
  name_bn: string;
  short_desc_en: string;
  short_desc_bn: string;
  desc_en: string;
  desc_bn: string;
  category_id: string;
  brand_id: string;
  tags: string[];
  badges: string[];
  price: number;
  regular_price: number;
  cost_price: number;
  stock: number;
  reserved_stock: number;
  low_stock_threshold: number;
  weight_grams: number;
  images: string[];
  video_url?: string;
  specs: Array<{ key: string; value: string }>;
  faqs: Array<{ q: string; a: string }>;
  bundle_items: Array<{ productId: string; variantId?: string; qty: number }>;
  order_now_enabled: boolean;
  min_qty: number;
  max_qty: number;
  meta_title: string;
  meta_desc: string;
  rating_avg: number;
  review_count: number;
  variants: ProductVariant[];
  category?: Category;
  brand?: Brand;
}

export interface CartItem {
  key: string; // productId + ':' + (variantId || '')
  productId: string;
  variantId: string | null;
  sku: string;
  name_en: string;
  name_bn: string;
  category: string;
  variantLabel: string;
  unitPrice: number;
  regularPrice: number;
  quantity: number;
  image: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  name_bn: string;
  base_fee: number;
  free_threshold: number;
  express_extra: number;
  eta: string;
}

export interface CouponItem {
  code: string;
  type: 'fixed' | 'percentage' | 'free_shipping';
  value: number;
  min_spend: number;
  max_discount: number;
  first_order_only: number;
}

export interface StoreBootstrap {
  general: {
    storeName: string;
    storeNameBn: string;
    domain: string;
    taglineEn: string;
    taglineBn: string;
    hotline: string;
    whatsapp: string;
    email: string;
    address: string;
    binNumber: string;
    tradeLicence: string;
    defaultLanguage: 'en' | 'bn';
  };
  theme: Record<string, any>;
  tracking: {
    gtmEnabled: boolean;
    gtmContainerId: string;
    overrideHeadCode: string;
    overrideBodyCode: string;
    ga4Id: string;
    metaPixelId: string;
    tiktokPixelId: string;
    googleAdsId: string;
    msUetId: string;
    consentBannerEnabled: boolean;
    consentDefaultAnalytics: string;
    consentDefaultAds: string;
  };
  checkout: {
    guestCheckout: boolean;
    termsRequired: boolean;
    minOrderAmount: number;
    advanceDeliveryFeeRequired: boolean;
    advanceDeliveryFeeAmount: number;
    fields: Array<{ key: string; labelEn: string; labelBn: string; visible: boolean; required: boolean }>;
  };
  payments: {
    cod: boolean;
    bkash: boolean;
    nagad: boolean;
    sslcommerz: boolean;
    bankTransfer: boolean;
  };
  announcements: Array<{ id: string; textEn: string; textBn: string; link: string; active: boolean }>;
  homepageSections: Array<{ id: string; type: string; titleEn: string; titleBn?: string; visible: boolean; order: number; config: Record<string, any> }>;
  menus: {
    header: Array<{ id: string; labelEn: string; labelBn: string; href: string }>;
    footer: Array<{ id: string; labelEn: string; labelBn: string; href: string }>;
  };
  popups: Array<{ id: string; titleEn: string; titleBn: string; bodyEn: string; bodyBn: string; couponCode: string; delaySeconds: number; active: boolean }>;
  testimonials: Array<{ id: string; name: string; city: string; rating: number; textEn: string; textBn: string }>;
  faqs: Array<{ id: string; qEn: string; qBn: string; aEn: string; aBn: string }>;
  categories: Category[];
  brands: Brand[];
  shippingZones: ShippingZone[];
  products: Product[];
  pages: Array<{ id: string; slug: string; title_en: string; title_bn: string; is_landing: number }>;
  posts: Array<{ id: string; slug: string; title_en: string; title_bn: string; excerpt_en: string; excerpt_bn: string; category: string; author: string; image: string; published_at: string }>;
  activeCoupons: CouponItem[];
  districts: DistrictInfo[];
}
