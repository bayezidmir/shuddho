export type Lang = 'en' | 'bn';

const DICT: Record<string, { en: string; bn: string }> = {
  searchPlaceholder: {
    en: 'Search Sundarban honey, deshi ghee, mustard oil, dates...',
    bn: 'সুন্দরবনের মধু, দেশি ঘি, সরিষার তেল, খেজুর খুঁজুন...',
  },
  searchBtn: { en: 'Search', bn: 'খুঁজুন' },
  cart: { en: 'Cart', bn: 'কার্ট' },
  orderNow: { en: 'Order now', bn: 'অর্ডার করুন' },
  addToCart: { en: 'Add to cart', bn: 'কার্টে যোগ করুন' },
  checkout: { en: 'Checkout', bn: 'চেকআউট' },
  trackOrder: { en: 'Track Order', bn: 'অর্ডার ট্র্যাক' },
  myAccount: { en: 'Account', bn: 'অ্যাকাউন্ট' },
  inStock: { en: 'In stock', bn: 'স্টকে আছে' },
  outOfStock: { en: 'Out of stock', bn: 'স্টক শেষ' },
  onlyLeft: { en: 'Only {n} left', bn: 'মাত্র {n}টি বাকি' },
  allProducts: { en: 'All Products', bn: 'সব পণ্য' },
  categories: { en: 'Categories', bn: 'ক্যাটাগরি' },
  viewAll: { en: 'View all', bn: 'সব দেখুন' },
  subtotal: { en: 'Subtotal', bn: 'মোট মূল্য' },
  discount: { en: 'Discount', bn: 'ছাড়' },
  deliveryCharge: { en: 'Delivery Charge', bn: 'ডেলিভারি চার্জ' },
  total: { en: 'Total', bn: 'সর্বমোট' },
  placeOrder: { en: 'Place Order', bn: 'অর্ডার কনফার্ম করুন' },
  freeDeliveryUnlocked: { en: 'Free delivery unlocked!', bn: 'ফ্রি ডেলিভারি আনলক হয়েছে!' },
  addMoreForFree: { en: 'Add {amount} more for free delivery', bn: 'ফ্রি ডেলিভারির জন্য আরও {amount} যোগ করুন' },
  applyCoupon: { en: 'Apply', bn: 'প্রয়োগ করুন' },
  couponPlaceholder: { en: 'Coupon code (e.g. PURE10)', bn: 'কুপন কোড (যেমন PURE10)' },
  whatsappOrder: { en: 'Order on WhatsApp', bn: 'হোয়াটসঅ্যাপে অর্ডার' },
  callToOrder: { en: 'Call to Order', bn: 'কল করে অর্ডার' },
};

export function t(key: string, lang: Lang, vars?: Record<string, string | number>): string {
  const entry = DICT[key];
  let str = entry ? entry[lang] : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}
