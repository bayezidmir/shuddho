export interface CartPricingItem {
  productId: string;
  categoryId?: string;
  unitPrice: number; // regular or sale unit price in BDT
  quantity: number;
}

export interface CouponRule {
  code: string;
  type: 'fixed' | 'percentage' | 'free_shipping';
  value: number;
  minSpend?: number;
  maxDiscount?: number;
  firstOrderOnly?: boolean;
  active?: boolean;
}

export interface ShippingRule {
  zoneId: string;
  zoneName: string;
  baseFee: number;
  freeThreshold: number;
  expressExtra?: number;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  freeShippingProgress: {
    threshold: number;
    remaining: number;
    percent: number;
    unlocked: boolean;
  };
  couponError?: string;
  appliedCoupon?: string;
}

export function calculateCartTotals(params: {
  items: CartPricingItem[];
  coupon?: CouponRule | null;
  shipping: ShippingRule;
  isExpress?: boolean;
  taxRatePercent?: number;
  taxInclusive?: boolean;
  isFirstOrder?: boolean;
}): CartTotals {
  const subtotal = params.items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice) * Math.max(0, Math.round(item.quantity)),
    0,
  );

  let discount = 0;
  let couponError: string | undefined;
  let appliedCoupon: string | undefined;
  let freeShippingFromCoupon = false;

  if (params.coupon) {
    const c = params.coupon;
    if (c.active === false) {
      couponError = 'This coupon is currently inactive.';
    } else if (c.firstOrderOnly && params.isFirstOrder === false) {
      couponError = 'This coupon is valid for first orders only.';
    } else if (c.minSpend && subtotal < c.minSpend) {
      couponError = `Minimum spend of ৳${c.minSpend} required for coupon ${c.code}.`;
    } else {
      appliedCoupon = c.code;
      if (c.type === 'fixed') {
        discount = Math.min(subtotal, Math.round(c.value));
      } else if (c.type === 'percentage') {
        const raw = Math.round((subtotal * c.value) / 100);
        discount = c.maxDiscount ? Math.min(raw, Math.round(c.maxDiscount), subtotal) : Math.min(raw, subtotal);
      } else if (c.type === 'free_shipping') {
        freeShippingFromCoupon = true;
      }
    }
  }

  const threshold = Math.max(0, Math.round(params.shipping.freeThreshold));
  const afterDiscount = Math.max(0, subtotal - discount);
  const unlockedByThreshold = threshold > 0 && afterDiscount >= threshold;
  const baseShipping =
    subtotal === 0 || unlockedByThreshold || freeShippingFromCoupon ? 0 : Math.round(params.shipping.baseFee);
  const expressFee = params.isExpress && subtotal > 0 ? Math.round(params.shipping.expressExtra ?? 50) : 0;
  const shipping = baseShipping + expressFee;

  const rate = params.taxRatePercent ?? 0;
  const tax =
    rate > 0 && !params.taxInclusive ? Math.round((afterDiscount * rate) / 100) : 0;

  const total = Math.max(0, afterDiscount + shipping + tax);
  const remaining = threshold > 0 ? Math.max(0, threshold - afterDiscount) : 0;
  const percent = threshold > 0 ? Math.min(100, Math.round((afterDiscount / threshold) * 100)) : 100;

  return {
    subtotal,
    discount,
    shipping,
    tax,
    total,
    freeShippingProgress: {
      threshold,
      remaining,
      percent,
      unlocked: unlockedByThreshold || freeShippingFromCoupon,
    },
    couponError,
    appliedCoupon,
  };
}
