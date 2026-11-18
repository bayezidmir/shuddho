import React, { useState } from 'react';
import { X, Plus, Minus, Trash2, Truck, ArrowRight } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatBDT } from '../../lib/bd-validation';
import { calculateCartTotals } from '../../lib/pricing';
import { t } from '../../lib/i18n';

export const CartDrawer: React.FC = () => {
  const {
    bootstrap,
    lang,
    cart,
    cartOpen,
    setCartOpen,
    updateQty,
    removeFromCart,
    appliedCouponCode,
    setAppliedCouponCode,
    navigate,
  } = useStore();

  const [couponInput, setCouponInput] = useState(appliedCouponCode);
  const [couponMsg, setCouponMsg] = useState('');

  if (!cartOpen) return null;

  const zone = bootstrap?.shippingZones[0] || {
    id: 'inside_dhaka',
    name: 'Inside Dhaka',
    name_bn: 'ঢাকার ভেতরে',
    base_fee: 70,
    free_threshold: 2000,
    express_extra: 50,
    eta: '24 hours',
  };

  const activeCoupon = bootstrap?.activeCoupons.find(
    (c) => c.code.toUpperCase() === appliedCouponCode.toUpperCase(),
  );

  const totals = calculateCartTotals({
    items: cart.map((c) => ({ productId: c.productId, unitPrice: c.unitPrice, quantity: c.quantity })),
    coupon: activeCoupon
      ? {
          code: activeCoupon.code,
          type: activeCoupon.type,
          value: activeCoupon.value,
          minSpend: activeCoupon.min_spend,
          maxDiscount: activeCoupon.max_discount,
          firstOrderOnly: Boolean(activeCoupon.first_order_only),
        }
      : null,
    shipping: {
      zoneId: zone.id,
      zoneName: zone.name,
      baseFee: zone.base_fee,
      freeThreshold: zone.free_threshold,
    },
  });

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setAppliedCouponCode('');
      setCouponMsg('');
      return;
    }
    const resp = await fetch('/api/store/coupon/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal: totals.subtotal }),
    });
    const data = await resp.json();
    if (resp.ok && data.valid) {
      setAppliedCouponCode(data.coupon.code);
      setCouponMsg(`Applied ${data.coupon.code}`);
    } else {
      setCouponMsg(data.error || 'Invalid coupon');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="fixed inset-0 bg-black/45" onClick={() => setCartOpen(false)} />
      <div
        className="relative w-full max-w-md h-full flex flex-col border-l shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--ink)]">
            {t('cart', lang)} ({cart.reduce((s, i) => s + i.quantity, 0)})
          </h2>
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
            className="p-2 rounded-lg hover:bg-[var(--bg)] text-[var(--ink)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Delivery Progress Bar */}
        <div className="px-5 py-3 border-b border-[var(--line)] bg-[var(--bg)]">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink)] mb-1.5">
            <Truck className="w-4 h-4 text-[var(--primary)] shrink-0" />
            <span>
              {totals.freeShippingProgress.unlocked
                ? t('freeDeliveryUnlocked', lang)
                : t('addMoreForFree', lang, {
                    amount: formatBDT(totals.freeShippingProgress.remaining, lang),
                  })}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--line)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${totals.freeShippingProgress.percent}%`,
                backgroundColor: totals.freeShippingProgress.unlocked ? 'var(--success)' : 'var(--primary)',
              }}
            />
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-[var(--muted)]">Your shopping bag is currently empty.</p>
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  navigate('/shop');
                }}
                className="px-5 py-2.5 rounded-[12px] text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Explore Pure Foods
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.key}
                className="flex gap-3 p-3 rounded-[14px] border border-[var(--line)]"
              >
                <img
                  src={item.image}
                  alt={item.name_en}
                  className="w-16 h-16 rounded-xl object-cover bg-[var(--image-bg)] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--ink)] leading-snug line-clamp-1">
                      {lang === 'bn' ? item.name_bn : item.name_en}
                    </h4>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name_en}`}
                      onClick={() => removeFromCart(item.key)}
                      className="text-[var(--muted)] hover:text-[var(--sale)] p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-[var(--muted)]">{item.variantLabel}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center border border-[var(--line)] rounded-lg">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => updateQty(item.key, item.quantity - 1)}
                        className="p-1.5 hover:bg-[var(--bg)]"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2.5 text-xs font-semibold tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => updateQty(item.key, item.quantity + 1)}
                        className="p-1.5 hover:bg-[var(--bg)]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-[var(--ink)] tabular-nums">
                      {formatBDT(item.unitPrice * item.quantity, lang)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Totals & Checkout CTA */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-[var(--line)] space-y-3 bg-[var(--surface)]">
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder={t('couponPlaceholder', lang)}
                className="flex-1 px-3 py-2 rounded-[10px] border border-[var(--line)] text-xs bg-[var(--bg)] text-[var(--ink)]"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-[10px] text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {t('applyCoupon', lang)}
              </button>
            </form>
            {(couponMsg || totals.couponError) && (
              <p className={`text-xs ${totals.couponError ? 'text-[var(--sale)]' : 'text-[var(--success)]'}`}>
                {totals.couponError || couponMsg}
              </p>
            )}

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-[var(--muted)]">
                <span>{t('subtotal', lang)}</span>
                <span className="tabular-nums font-medium text-[var(--ink)]">{formatBDT(totals.subtotal, lang)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-[var(--success)]">
                  <span>{t('discount', lang)} ({totals.appliedCoupon})</span>
                  <span className="tabular-nums font-medium">−{formatBDT(totals.discount, lang)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-[var(--ink)] pt-1 border-t border-[var(--line)]">
                <span>{t('total', lang)}</span>
                <span className="tabular-nums">{formatBDT(totals.total, lang)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  navigate('/cart');
                }}
                className="py-2.5 px-3 rounded-[12px] border border-[var(--line)] text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg)]"
              >
                View Cart
              </button>
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  navigate('/checkout');
                }}
                className="py-2.5 px-3 rounded-[12px] text-sm font-semibold text-white inline-flex items-center justify-center gap-1.5"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span>{t('checkout', lang)}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
