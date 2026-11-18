import React from 'react';
import { Plus, Minus, Trash2, ArrowRight, Truck } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatBDT } from '../../lib/bd-validation';
import { calculateCartTotals } from '../../lib/pricing';
import { t } from '../../lib/i18n';

export const CartPage: React.FC = () => {
  const { bootstrap, lang, cart, updateQty, removeFromCart, appliedCouponCode, navigate } = useStore();
  const zone = bootstrap?.shippingZones[0] || { id: 'inside_dhaka', name: 'Inside Dhaka', base_fee: 70, free_threshold: 2000 };
  const activeCoupon = bootstrap?.activeCoupons.find((c) => c.code.toUpperCase() === appliedCouponCode.toUpperCase());

  const totals = calculateCartTotals({
    items: cart.map((c) => ({ productId: c.productId, unitPrice: c.unitPrice, quantity: c.quantity })),
    coupon: activeCoupon
      ? {
          code: activeCoupon.code,
          type: activeCoupon.type,
          value: activeCoupon.value,
          minSpend: activeCoupon.min_spend,
          maxDiscount: activeCoupon.max_discount,
        }
      : null,
    shipping: {
      zoneId: zone.id,
      zoneName: zone.name,
      baseFee: zone.base_fee,
      freeThreshold: zone.free_threshold,
    },
  });

  return (
    <main className="max-w-[1240px] mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">{t('cart', lang)}</h1>

      {cart.length === 0 ? (
        <div
          className="rounded-[18px] border p-12 text-center space-y-4"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
        >
          <p className="text-[var(--muted)]">Your shopping cart is empty.</p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="px-6 py-3 rounded-[12px] text-sm font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div
            className="lg:col-span-8 rounded-[18px] border divide-y divide-[var(--line)] overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            {cart.map((item) => (
              <div key={item.key} className="p-4 flex items-center gap-4">
                <img src={item.image} alt={item.name_en} className="w-20 h-20 rounded-xl object-cover bg-[var(--image-bg)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-[var(--ink)]">
                    {lang === 'bn' ? item.name_bn : item.name_en}
                  </h3>
                  <div className="text-xs text-[var(--muted)]">{item.variantLabel} · {formatBDT(item.unitPrice, lang)}</div>
                </div>
                <div className="inline-flex items-center border border-[var(--line)] rounded-lg">
                  <button type="button" onClick={() => updateQty(item.key, item.quantity - 1)} className="p-2"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="px-3 text-sm font-bold tabular-nums">{item.quantity}</span>
                  <button type="button" onClick={() => updateQty(item.key, item.quantity + 1)} className="p-2"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                <div className="font-bold text-sm sm:text-base tabular-nums w-24 text-right">
                  {formatBDT(item.unitPrice * item.quantity, lang)}
                </div>
                <button type="button" aria-label="Remove item" onClick={() => removeFromCart(item.key)} className="text-[var(--muted)] hover:text-[var(--sale)] p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div
            className="lg:col-span-4 rounded-[18px] border p-5 space-y-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--primary)]">
              <Truck className="w-4 h-4" />
              <span>
                {totals.freeShippingProgress.unlocked
                  ? t('freeDeliveryUnlocked', lang)
                  : t('addMoreForFree', lang, { amount: formatBDT(totals.freeShippingProgress.remaining, lang) })}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><span className="font-semibold tabular-nums">{formatBDT(totals.subtotal, lang)}</span></div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-[var(--success)]"><span>Discount</span><span className="tabular-nums">−{formatBDT(totals.discount, lang)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-[var(--muted)]">Estimated Delivery</span><span className="font-semibold tabular-nums">{formatBDT(totals.shipping, lang)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-[var(--line)]"><span>Total</span><span className="tabular-nums">{formatBDT(totals.total, lang)}</span></div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="w-full py-3 rounded-[12px] text-white font-bold inline-flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
