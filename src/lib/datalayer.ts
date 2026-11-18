export interface GA4Item {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  discount?: number;
  quantity: number;
  index?: number;
}

export interface DataLayerUserData {
  phone_number?: string;
  email?: string;
  address?: {
    first_name?: string;
    last_name?: string;
    city?: string;
    country?: string;
  };
}

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

const firedPurchases = new Set<string>();

export function createEventId(event: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${event}.${Date.now()}.${rand}`;
}

function getDataLayer(): Record<string, unknown>[] {
  if (typeof window === 'undefined') return [];
  window.dataLayer = window.dataLayer || [];
  return window.dataLayer;
}

export function pushEcommerceEvent(
  event: string,
  ecommerce: Record<string, unknown>,
  options: { event_id?: string; user_data?: DataLayerUserData; extra?: Record<string, unknown> } = {},
): Record<string, unknown> {
  const dl = getDataLayer();
  // Mandatory GA4 reset before every ecommerce event
  dl.push({ ecommerce: null });

  const payload: Record<string, unknown> = {
    event,
    event_id: options.event_id ?? createEventId(event),
    ecommerce: {
      currency: 'BDT',
      ...ecommerce,
    },
    ...(options.user_data ? { user_data: options.user_data } : {}),
    ...(options.extra ?? {}),
  };

  dl.push(payload);
  return payload;
}

export function trackPageView(params: {
  page_type: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'page' | 'search';
  page_location: string;
  page_title: string;
  user_id?: string;
  customer_type?: 'new' | 'returning';
}) {
  const dl = getDataLayer();
  const payload = {
    event: 'page_view',
    event_id: createEventId('page_view'),
    ...params,
  };
  dl.push(payload);
  return payload;
}

export function trackViewItem(item: GA4Item) {
  return pushEcommerceEvent('view_item', {
    currency: 'BDT',
    value: item.price,
    items: [item],
  });
}

export function trackViewItemList(listName: string, items: GA4Item[]) {
  return pushEcommerceEvent('view_item_list', {
    item_list_name: listName,
    items,
  });
}

export function trackSelectItem(listName: string, item: GA4Item) {
  return pushEcommerceEvent('select_item', {
    item_list_name: listName,
    items: [item],
  });
}

export function trackAddToCart(items: GA4Item[]) {
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return pushEcommerceEvent('add_to_cart', {
    currency: 'BDT',
    value,
    items,
  });
}

export function trackViewCart(items: GA4Item[]) {
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return pushEcommerceEvent('view_cart', {
    currency: 'BDT',
    value,
    items,
  });
}

export function trackRemoveFromCart(items: GA4Item[]) {
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return pushEcommerceEvent('remove_from_cart', {
    currency: 'BDT',
    value,
    items,
  });
}

export function trackBeginCheckout(items: GA4Item[], coupon = '') {
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return pushEcommerceEvent('begin_checkout', {
    currency: 'BDT',
    value,
    coupon,
    items,
  });
}

export function trackAddShippingInfo(items: GA4Item[], shippingTier: string, coupon = '') {
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return pushEcommerceEvent('add_shipping_info', {
    currency: 'BDT',
    value,
    coupon,
    shipping_tier: shippingTier,
    items,
  });
}

export function trackAddPaymentInfo(items: GA4Item[], paymentType: string, coupon = '') {
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return pushEcommerceEvent('add_payment_info', {
    currency: 'BDT',
    value,
    coupon,
    payment_type: paymentType,
    items,
  });
}

export function trackPurchaseOnce(params: {
  orderId: string;
  value: number;
  shipping: number;
  discount: number;
  tax?: number;
  coupon?: string;
  items: GA4Item[];
  user_data?: DataLayerUserData;
}): Record<string, unknown> | null {
  const guardKey = `shuddho_purchase_fired_${params.orderId}`;
  if (firedPurchases.has(params.orderId)) return null;
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(guardKey)) return null;
      window.sessionStorage.setItem(guardKey, '1');
    } catch {
      // ignore storage errors
    }
  }
  firedPurchases.add(params.orderId);

  return pushEcommerceEvent(
    'purchase',
    {
      transaction_id: params.orderId,
      value: params.value,
      tax: params.tax ?? 0,
      shipping: params.shipping,
      discount: params.discount,
      currency: 'BDT',
      coupon: params.coupon ?? '',
      items: params.items,
    },
    {
      event_id: `order_${params.orderId}_purchase`,
      user_data: params.user_data,
    },
  );
}

export function trackSearch(searchTerm: string) {
  const dl = getDataLayer();
  const payload = { event: 'search', event_id: createEventId('search'), search_term: searchTerm };
  dl.push(payload);
  return payload;
}

export function trackAddToWishlist(item: GA4Item) {
  return pushEcommerceEvent('add_to_wishlist', {
    currency: 'BDT',
    value: item.price,
    items: [item],
  });
}

export function trackLead(source: string) {
  const dl = getDataLayer();
  const payload = { event: 'generate_lead', event_id: createEventId('generate_lead'), lead_source: source };
  dl.push(payload);
  return payload;
}
