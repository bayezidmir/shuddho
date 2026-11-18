import React, { useState } from 'react';
import { Package, CheckCircle2, Truck, Search } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatBDT } from '../../lib/bd-validation';

const STEPS = [
  { key: 'pending', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'processing', label: 'Packed' },
  { key: 'shipped', label: 'Handed to Courier' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

function getStepIndex(status: string): number {
  if (status === 'pending' || status === 'on_hold') return 0;
  if (status === 'confirmed') return 1;
  if (status === 'processing' || status === 'ready_to_ship') return 2;
  if (status === 'shipped') return 3;
  if (status === 'out_for_delivery') return 4;
  if (status === 'delivered' || status === 'partially_delivered') return 5;
  return 0;
}

export const TrackOrderPage: React.FC = () => {
  const { lang, currentPath } = useStore();
  const params = new URLSearchParams(currentPath.split('?')[1] || '');
  const [orderNum, setOrderNum] = useState(params.get('order') || '10250');
  const [phone, setPhone] = useState('01912345678');
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await fetch(`/api/store/orders/track?order=${encodeURIComponent(orderNum)}&phone=${encodeURIComponent(phone)}`);
      const data = await resp.json();
      if (!resp.ok) {
        setResult(null);
        setError(data.error || 'Order not found.');
      } else {
        setResult(data.order);
      }
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = result ? getStepIndex(result.status) : 0;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">Track Your Order</h1>
        <p className="text-sm text-[var(--muted)]">
          Enter your Order Number and Mobile Number to see live parcel & courier updates.
        </p>
      </div>

      <form
        onSubmit={handleTrack}
        className="rounded-[18px] border p-5 grid grid-cols-1 sm:grid-cols-12 gap-3"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <input
          type="text"
          required
          value={orderNum}
          onChange={(e) => setOrderNum(e.target.value)}
          placeholder="Order # (e.g. 10250)"
          aria-label="Order Number"
          className="sm:col-span-4 px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm"
        />
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Mobile (e.g. 01912345678)"
          aria-label="Mobile Number"
          className="sm:col-span-5 px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="sm:col-span-3 py-2.5 px-4 rounded-[12px] text-white text-sm font-bold inline-flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Search className="w-4 h-4" />
          <span>{loading ? 'Checking...' : 'Track'}</span>
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-[14px] border border-[var(--sale)] bg-[var(--chip-bg)] text-[var(--chip-fg)] text-sm">
          {error}
        </div>
      )}

      {result && (
        <div
          className="rounded-[18px] border p-6 space-y-6"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
            <div>
              <div className="text-xs text-[var(--muted)]">Order #{result.order_number}</div>
              <h2 className="text-xl font-bold text-[var(--ink)] capitalize">
                Status: {String(result.status).replace(/_/g, ' ')}
              </h2>
            </div>
            {result.tracking_code && (
              <div className="text-right text-sm">
                <div className="text-xs text-[var(--muted)] uppercase">{result.courier_code} Courier</div>
                <div className="font-mono font-bold text-[var(--primary)]">{result.tracking_code}</div>
              </div>
            )}
          </div>

          {/* 6-step Visual Timeline */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {STEPS.map((st, idx) => {
              const done = idx <= stepIndex;
              return (
                <div key={st.key} className="flex flex-col items-center text-center gap-1.5">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                      done ? 'bg-[var(--success)] text-white' : 'bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)]'
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>
                  <span className={`text-xs font-medium ${done ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Items */}
          <div className="space-y-2 pt-2 border-t border-[var(--line)]">
            <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[var(--primary)]" /> Items in Parcel
            </h3>
            {(result.items || []).map((it: any) => (
              <div key={it.id} className="flex justify-between text-sm">
                <span>{it.name} ({it.variant_label || 'Std'}) × {it.quantity}</span>
                <span className="font-semibold tabular-nums">{formatBDT(it.unit_price * it.quantity, lang)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-[var(--line)] font-bold">
              <span>Order Total</span>
              <span className="tabular-nums">{formatBDT(result.total, lang)}</span>
            </div>
          </div>

          {result.courier_status && (
            <div className="p-3 rounded-xl bg-[var(--bg)] text-xs text-[var(--muted)] flex items-center gap-2">
              <Truck className="w-4 h-4 text-[var(--primary)]" />
              <span>Latest Courier Status: <strong className="text-[var(--ink)]">{result.courier_status}</strong></span>
            </div>
          )}
        </div>
      )}
    </main>
  );
};
