import React, { useState } from 'react';
import { Phone, Award, Heart, Printer, LogOut, RotateCcw } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatBDT } from '../../lib/bd-validation';

export const AccountPage: React.FC = () => {
  const { bootstrap, lang, wishlist, addToCart, navigate } = useStore();
  const [phone, setPhone] = useState(() => {
    try { return localStorage.getItem('shuddho_cust_phone') || '01711482910'; } catch { return ''; }
  });
  const [otpSent, setOtpSent] = useState(false);
  const [sandboxOtp, setSandboxOtp] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [account, setAccount] = useState<{ customer: any; orders: any[] } | null>(null);
  const [error, setError] = useState('');

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const r = await fetch('/api/store/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || 'Could not send OTP.');
      return;
    }
    setOtpSent(true);
    if (d.sandboxOtp) {
      setSandboxOtp(d.sandboxOtp);
      setOtpCode(d.sandboxOtp);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const r = await fetch('/api/store/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: otpCode }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || 'Invalid OTP');
      return;
    }
    try { localStorage.setItem('shuddho_cust_phone', d.customer.phone); } catch {}
    const accResp = await fetch(`/api/store/account?phone=${encodeURIComponent(d.customer.phone)}`);
    if (accResp.ok) {
      setAccount(await accResp.json());
    }
  };

  const wishedProducts = (bootstrap?.products || []).filter((p) => wishlist.includes(p.id));

  if (!account) {
    return (
      <main className="max-w-md mx-auto px-4 py-12">
        <div
          className="rounded-[18px] border p-6 space-y-5"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
        >
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--ink)]">Customer Login (OTP)</h1>
            <p className="text-xs text-[var(--muted)] mt-1">
              Sign in with your Bangladeshi mobile number to view orders, invoices, and loyalty points.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-[var(--chip-bg)] text-[var(--chip-fg)] text-xs">{error}</div>
          )}

          {!otpSent ? (
            <form onSubmit={requestOtp} className="space-y-3">
              <label className="block text-xs font-semibold text-[var(--ink)]">Mobile Number</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01711482910"
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-[12px] text-sm font-bold text-white inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Phone className="w-4 h-4" /> Send Verification OTP
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-3">
              {sandboxOtp && (
                <div className="p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-xs text-[var(--primary)]">
                  Sandbox SMS OTP: <strong className="font-mono">{sandboxOtp}</strong>
                </div>
              )}
              <label className="block text-xs font-semibold text-[var(--ink)]">6-Digit OTP</label>
              <input
                type="text"
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] text-sm font-mono tracking-widest"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-[12px] text-sm font-bold text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Verify & Sign In
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[1240px] mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)]">{account.customer.name}</h1>
          <p className="text-sm text-[var(--muted)]">{account.customer.phone} · {account.customer.district}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-[12px] border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold inline-flex items-center gap-2">
            <Award className="w-4 h-4 text-[var(--accent)]" />
            <span className="tabular-nums">{account.customer.loyalty_points} pts</span>
          </div>
          <button
            type="button"
            onClick={() => setAccount(null)}
            className="px-3 py-2 rounded-[12px] border border-[var(--line)] text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <h2 className="text-lg font-bold text-[var(--ink)]">My Orders ({account.orders.length})</h2>
          {account.orders.map((ord) => (
            <div
              key={ord.id}
              className="rounded-[18px] border p-5 space-y-3"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--line)]">
                <div>
                  <span className="font-bold text-[var(--ink)]">Order #{ord.order_number}</span>
                  <span className="mx-2 text-[var(--muted)]">·</span>
                  <span className="text-xs uppercase font-semibold text-[var(--primary)]">{ord.status}</span>
                </div>
                <span className="font-bold tabular-nums">{formatBDT(ord.total, lang)}</span>
              </div>
              <div className="text-xs text-[var(--muted)] space-y-1">
                {ord.items.map((it: any) => (
                  <div key={it.id}>{it.name} ({it.variant_label}) × {it.quantity}</div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigate(`/track?order=${ord.order_number}`)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold hover:bg-[var(--bg)]"
                >
                  Track Parcel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    for (const it of ord.items) {
                      const prod = bootstrap?.products.find((p) => p.id === it.product_id);
                      if (prod) {
                        const v = prod.variants.find((vr) => vr.id === it.variant_id) || null;
                        addToCart(prod, v, it.quantity, false);
                      }
                    }
                    navigate('/checkout');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white inline-flex items-center gap-1"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Re-order
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Receipt
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div
            className="rounded-[18px] border p-5 space-y-3"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <h2 className="text-base font-bold text-[var(--ink)] flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-[var(--accent)]" /> Saved Wishlist ({wishedProducts.length})
            </h2>
            {wishedProducts.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">No saved items yet.</p>
            ) : (
              wishedProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 border-[var(--line)]">
                  <button type="button" onClick={() => navigate(`/products/${p.slug}`)} className="font-medium hover:text-[var(--primary)] text-left">
                    {p.name_en}
                  </button>
                  <span className="font-bold tabular-nums">{formatBDT(p.price, lang)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
