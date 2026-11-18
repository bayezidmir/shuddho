import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Truck, CreditCard, Lock, AlertCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatBDT, normalizeBDPhone } from '../../lib/bd-validation';
import { calculateCartTotals } from '../../lib/pricing';
import { trackBeginCheckout, trackAddShippingInfo, trackAddPaymentInfo, type GA4Item } from '../../lib/datalayer';

export const CheckoutPage: React.FC = () => {
  const {
    bootstrap,
    lang,
    cart,
    appliedCouponCode,
    setAppliedCouponCode,
    clearCart,
    attribution,
    navigate,
  } = useStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [area, setArea] = useState('Mirpur 10');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [isExpress, setIsExpress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bkash' | 'nagad' | 'sslcommerz'>('cod');
  const [trxIdInput, setTrxIdInput] = useState('');
  const [couponInput, setCouponInput] = useState(appliedCouponCode);
  const [couponFeedback, setCouponFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const districts = bootstrap?.districts || [];
  const selectedDistObj = districts.find((d) => d.name === district);
  const deliveryZone = selectedDistObj?.zone || 'inside_dhaka';
  const zoneInfo =
    bootstrap?.shippingZones.find((z) => z.id === deliveryZone) || {
      id: 'inside_dhaka',
      name: 'Inside Dhaka',
      name_bn: 'ঢাকার ভেতরে',
      base_fee: 70,
      free_threshold: 2000,
      express_extra: 50,
      eta: '24 hours',
    };

  const ga4Items: GA4Item[] = useMemo(
    () =>
      cart.map((c, idx) => ({
        item_id: c.sku,
        item_name: c.name_en,
        item_brand: bootstrap?.general?.storeName || 'Shuddho',
        item_category: c.category,
        item_variant: c.variantLabel,
        price: c.unitPrice,
        discount: Math.max(0, c.regularPrice - c.unitPrice),
        quantity: c.quantity,
        index: idx,
      })),
    [cart, bootstrap?.general?.storeName],
  );

  // Fire begin_checkout on open
  useEffect(() => {
    if (ga4Items.length > 0) {
      trackBeginCheckout(ga4Items, appliedCouponCode);
    }
  }, []); // fire once on checkout mount

  // Fire add_shipping_info when district/delivery zone changes
  useEffect(() => {
    if (ga4Items.length > 0) {
      trackAddShippingInfo(ga4Items, zoneInfo.name, appliedCouponCode);
    }
  }, [deliveryZone, isExpress]);

  // Incomplete Order Auto-Capture as soon as valid BD phone is entered
  useEffect(() => {
    if (cart.length === 0) return;
    const phoneCheck = normalizeBDPhone(phone);
    if (!phoneCheck.valid) return;

    const timer = setTimeout(() => {
      fetch('/api/store/incomplete-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: phoneCheck.normalized,
          email,
          district,
          area,
          address,
          items: cart,
          attribution,
        }),
      }).catch(() => {});
    }, 450);

    return () => clearTimeout(timer);
  }, [phone, name, district, area, address, email, cart, attribution]);

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
      zoneId: zoneInfo.id,
      zoneName: zoneInfo.name,
      baseFee: zoneInfo.base_fee,
      freeThreshold: zoneInfo.free_threshold,
      expressExtra: zoneInfo.express_extra,
    },
    isExpress,
  });

  const handleDistrictChange = (nextDist: string) => {
    setDistrict(nextDist);
    const obj = districts.find((d) => d.name === nextDist);
    setArea(obj?.areas[0] || '');
  };

  const handlePaymentSelect = (method: 'cod' | 'bkash' | 'nagad' | 'sslcommerz') => {
    setPaymentMethod(method);
    if (ga4Items.length > 0) {
      trackAddPaymentInfo(
        ga4Items,
        method === 'cod' ? 'Cash on delivery' : method.toUpperCase(),
        appliedCouponCode,
      );
    }
  };

  const applyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setAppliedCouponCode('');
      setCouponFeedback('');
      return;
    }
    const r = await fetch('/api/store/coupon/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal: totals.subtotal }),
    });
    const d = await r.json();
    if (r.ok && d.valid) {
      setAppliedCouponCode(d.coupon.code);
      setCouponFeedback(`Coupon ${d.coupon.code} applied!`);
    } else {
      setCouponFeedback(d.error || 'Invalid coupon');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (cart.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    const phoneCheck = normalizeBDPhone(phone);
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || 'Enter a valid Bangladeshi phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch('/api/store/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: phoneCheck.normalized,
          district,
          area,
          address,
          email,
          note,
          website_hp: honeypot,
          deliveryZone,
          isExpress,
          paymentMethod,
          trxIdInput,
          couponCode: totals.appliedCoupon || '',
          items: cart.map((c) => ({
            productId: c.productId,
            variantId: c.variantId,
            quantity: c.quantity,
          })),
          attribution,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'Could not place order. Please review your details.');
        setSubmitting(false);
        return;
      }

      // Save snapshot for Thank-You page + GA4 purchase firing
      try {
        sessionStorage.setItem(`shuddho_order_${data.order.order_number}`, JSON.stringify(data.order));
      } catch {}

      clearCart();
      navigate(`/thank-you/${data.order.order_number}`);
    } catch {
      setError('Network error while placing order. Please try again.');
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Your Cart is Empty</h1>
        <p className="text-sm text-[var(--muted)]">Add pure honey, ghee, or oils to proceed with checkout.</p>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-6 py-3 rounded-[12px] text-sm font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Return to Shop
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-[1240px] mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            {lang === 'bn' ? 'দ্রুত চেকআউট' : 'Fast Guest Checkout'}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {lang === 'bn' ? 'কোনো অ্যাকাউন্ট ছাড়াই ১ মিনিটে অর্ডার করুন।' : 'No account required. Cash on delivery available across 64 districts.'}
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--success)]">
          <Lock className="w-4 h-4" /> Secure Checkout
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-[14px] border border-[var(--sale)] bg-[var(--chip-bg)] text-[var(--chip-fg)] text-sm flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Customer & Shipping & Payment */}
        <div className="lg:col-span-7 space-y-6">
          {/* Honeypot */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="hidden"
            aria-hidden="true"
          />

          {/* Customer & Address Card */}
          <div
            className="rounded-[18px] border p-5 sm:p-6 space-y-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <h2 className="text-lg font-bold text-[var(--ink)]">1. Delivery Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="chk-name" className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Full Name *
                </label>
                <input
                  id="chk-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahim Uddin"
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm text-[var(--ink)]"
                />
              </div>

              <div>
                <label htmlFor="chk-phone" className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Mobile Number (BD) *
                </label>
                <input
                  id="chk-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01711482910"
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm text-[var(--ink)] tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="chk-district" className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  District *
                </label>
                <select
                  id="chk-district"
                  value={district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm text-[var(--ink)]"
                >
                  {districts.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name} ({d.bn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="chk-area" className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Thana / Area
                </label>
                <select
                  id="chk-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm text-[var(--ink)]"
                >
                  {(selectedDistObj?.areas || ['Sadar']).map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                  <option value="Other Area">Other Area</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="chk-address" className="block text-xs font-semibold text-[var(--ink)] mb-1">
                Full Street Address *
              </label>
              <textarea
                id="chk-address"
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House, Road, Block / Village, Landmark..."
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm text-[var(--ink)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="chk-email" className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Email (optional for PDF invoice)
                </label>
                <input
                  id="chk-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahim@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm text-[var(--ink)]"
                />
              </div>
              <div>
                <label htmlFor="chk-note" className="block text-xs font-semibold text-[var(--ink)] mb-1">
                  Delivery Note (optional)
                </label>
                <input
                  id="chk-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Call before arriving..."
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm text-[var(--ink)]"
                />
              </div>
            </div>
          </div>

          {/* Delivery Zone & Express */}
          <div
            className="rounded-[18px] border p-5 sm:p-6 space-y-3"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <h2 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
              <Truck className="w-5 h-5 text-[var(--primary)]" />
              2. Shipping Method
            </h2>
            <div className="p-3.5 rounded-[12px] bg-[var(--bg)] border border-[var(--primary)] flex items-center justify-between text-sm">
              <div>
                <div className="font-bold text-[var(--ink)]">{zoneInfo.name}</div>
                <div className="text-xs text-[var(--muted)]">Estimated delivery: {zoneInfo.eta}</div>
              </div>
              <div className="font-bold text-[var(--ink)] tabular-nums">
                {totals.shipping - (isExpress ? zoneInfo.express_extra : 0) === 0
                  ? 'Free'
                  : formatBDT(zoneInfo.base_fee, lang)}
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isExpress}
                onChange={(e) => setIsExpress(e.target.checked)}
              />
              <span>Same-day / Priority Express Dispatch (+{formatBDT(zoneInfo.express_extra, lang)})</span>
            </label>
          </div>

          {/* Payment Method */}
          <div
            className="rounded-[18px] border p-5 sm:p-6 space-y-3"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <h2 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[var(--primary)]" />
              3. Payment Method
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'cod', label: 'Cash on Delivery (COD)', sub: 'Pay in cash when parcel arrives', enabled: bootstrap?.payments.cod !== false },
                { id: 'bkash', label: 'bKash (Tokenized / PGW)', sub: 'Instant mobile wallet (Sandbox)', enabled: bootstrap?.payments.bkash !== false },
                { id: 'nagad', label: 'Nagad Payment', sub: 'Fast Nagad checkout (Sandbox)', enabled: bootstrap?.payments.nagad !== false },
                { id: 'sslcommerz', label: 'SSLCommerz (Cards / MFS)', sub: 'Visa, Mastercard, Rocket', enabled: bootstrap?.payments.sslcommerz !== false },
              ]
                .filter((m) => m.enabled)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handlePaymentSelect(m.id as any)}
                    className={`p-3.5 rounded-[12px] border text-left transition ${
                      paymentMethod === m.id
                        ? 'border-[var(--primary)] bg-[var(--bg)] ring-1 ring-[var(--primary)]'
                        : 'border-[var(--line)] hover:bg-[var(--bg)]'
                    }`}
                  >
                    <div className="text-sm font-bold text-[var(--ink)]">{m.label}</div>
                    <div className="text-xs text-[var(--muted)]">{m.sub}</div>
                  </button>
                ))}
            </div>

            {paymentMethod !== 'cod' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                  Optional Sandbox/Reference TrxID (leave blank to auto-verify in sandbox)
                </label>
                <input
                  type="text"
                  value={trxIdInput}
                  onChange={(e) => setTrxIdInput(e.target.value)}
                  placeholder="e.g. BKS89210XYZ"
                  className="w-full px-3.5 py-2 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div
            className="rounded-[18px] border p-5 sm:p-6 space-y-4 sticky top-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <h2 className="text-lg font-bold text-[var(--ink)]">Order Summary</h2>
            <div className="divide-y divide-[var(--line)] max-h-72 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.key} className="py-2.5 flex items-center gap-3 text-sm">
                  <img src={item.image} alt={item.name_en} className="w-12 h-12 rounded-lg object-cover bg-[var(--image-bg)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--ink)] truncate">{lang === 'bn' ? item.name_bn : item.name_en}</div>
                    <div className="text-xs text-[var(--muted)]">{item.variantLabel} × {item.quantity}</div>
                  </div>
                  <div className="font-bold tabular-nums text-[var(--ink)]">{formatBDT(item.unitPrice * item.quantity, lang)}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Coupon code (PURE10)"
                className="flex-1 px-3 py-2 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] text-xs"
              />
              <button
                type="button"
                onClick={applyCoupon}
                className="px-4 py-2 rounded-[10px] text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Apply
              </button>
            </div>
            {couponFeedback && <p className="text-xs text-[var(--success)]">{couponFeedback}</p>}

            <div className="space-y-1.5 text-sm pt-2 border-t border-[var(--line)]">
              <div className="flex justify-between text-[var(--muted)]">
                <span>Subtotal</span>
                <span className="tabular-nums text-[var(--ink)] font-medium">{formatBDT(totals.subtotal, lang)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-[var(--success)]">
                  <span>Discount ({totals.appliedCoupon})</span>
                  <span className="tabular-nums">−{formatBDT(totals.discount, lang)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--muted)]">
                <span>Delivery ({zoneInfo.name})</span>
                <span className="tabular-nums text-[var(--ink)] font-medium">
                  {totals.shipping === 0 ? 'Free' : formatBDT(totals.shipping, lang)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-extrabold text-[var(--ink)] pt-2 border-t border-[var(--line)]">
                <span>Total Payable</span>
                <span className="tabular-nums">{formatBDT(totals.total, lang)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-5 rounded-[12px] text-white font-bold text-base transition hover:opacity-95 disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {submitting ? 'Placing Order...' : `Place Order — ${formatBDT(totals.total, lang)}`}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
              <ShieldCheck className="w-4 h-4 text-[var(--success)]" />
              <span>We will call you shortly to confirm dispatch.</span>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
};
