import React, { useEffect, useState } from 'react';
import { CheckCircle2, PhoneCall, MapPin, ArrowRight } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatBDT } from '../../lib/bd-validation';
import { trackPurchaseOnce } from '../../lib/datalayer';

export const ThankYouPage: React.FC<{ orderNumber: string }> = ({ orderNumber }) => {
  const { lang, navigate } = useStore();
  const [order, setOrder] = useState<any | null>(() => {
    try {
      const raw = sessionStorage.getItem(`shuddho_order_${orderNumber}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!order) return;
    const nameParts = String(order.customer_name || '').trim().split(/\s+/);
    trackPurchaseOnce({
      orderId: order.order_number,
      value: order.total,
      shipping: order.shipping_fee,
      discount: order.discount || 0,
      tax: order.tax || 0,
      coupon: order.coupon_code || '',
      items: (order.items || []).map((it: any, idx: number) => ({
        item_id: it.sku,
        item_name: it.name,
        item_category: it.category || 'Natural Food',
        item_variant: it.variantLabel || it.variant_label || 'Standard',
        price: it.unitPrice ?? it.unit_price,
        quantity: it.quantity,
        index: idx,
      })),
      user_data: {
        phone_number: order.customer_phone,
        email: order.customer_email || undefined,
        address: {
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          city: order.district,
          country: 'BD',
        },
      },
    });
  }, [order]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div
        className="rounded-[18px] border p-6 sm:p-8 text-center space-y-4"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: 'var(--success)' }}
        >
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--primary)]">
          Order #{orderNumber} Received
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
          {lang === 'bn' ? 'আপনার অর্ডার সফলভাবে সম্পন্ন হয়েছে!' : 'Thank You for Your Order!'}
        </h1>
        <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
          We have sent an SMS confirmation. Our order confirmation team will call you shortly to verify your delivery address and dispatch your parcel.
        </p>

        {order && (
          <div className="text-left rounded-[14px] bg-[var(--bg)] border border-[var(--line)] p-4 space-y-2 text-sm mt-4">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Customer</span>
              <span className="font-semibold text-[var(--ink)]">{order.customer_name} ({order.customer_phone})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Delivery Address</span>
              <span className="font-semibold text-[var(--ink)] text-right">{order.address}, {order.district}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Payment</span>
              <span className="font-semibold uppercase text-[var(--ink)]">{order.payment_method} ({order.payment_status})</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[var(--line)] text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatBDT(order.total, lang)}</span>
            </div>
          </div>
        )}

        <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/track?order=${orderNumber}`)}
            className="px-5 py-2.5 rounded-[12px] text-sm font-bold text-white inline-flex items-center gap-2"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <MapPin className="w-4 h-4" />
            <span>Track Order</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="px-5 py-2.5 rounded-[12px] border border-[var(--line)] text-sm font-semibold text-[var(--ink)] inline-flex items-center gap-2 hover:bg-[var(--bg)]"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-2 text-xs text-[var(--muted)] inline-flex items-center gap-1.5">
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Questions? Call +8809612-004455</span>
        </div>
      </div>
    </main>
  );
};
