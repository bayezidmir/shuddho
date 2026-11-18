import React, { useState } from 'react';
import { Phone, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { PWAInstallButton } from './PWAInstallButton';
import { trackLead } from '../../lib/datalayer';

export const StoreFooter: React.FC = () => {
  const { bootstrap, lang, navigate } = useStore();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const g = bootstrap?.general;
  const footerLinks = bootstrap?.menus.footer || [];

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    const r = await fetch('/api/store/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (r.ok) {
      setSubscribed(true);
      setEmail('');
      trackLead('footer_newsletter');
    }
  };

  return (
    <footer
      className="w-full mt-16 pt-12 pb-24 sm:pb-10"
      style={{ backgroundColor: 'var(--footer-bg)', color: 'var(--footer-fg)' }}
    >
      <div className="max-w-[1240px] mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Brand & About */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white font-bold">
              S
            </span>
            <span className="text-xl font-extrabold text-white">
              {lang === 'bn' ? g?.storeNameBn || 'শুদ্ধ' : g?.storeName || 'Shuddho'}
            </span>
          </div>
          <p className="text-sm leading-relaxed opacity-90">
            {lang === 'bn' ? g?.taglineBn : g?.taglineEn}
          </p>
          <div className="text-xs space-y-1 opacity-80 pt-1">
            <div>BIN: {g?.binNumber || '004519283-0102'}</div>
            <div>Trade Licence: {g?.tradeLicence || 'TRAD/DNCC/098412/2026'}</div>
          </div>
          <div className="pt-2">
            <PWAInstallButton />
          </div>
        </div>

        {/* Quick & Policy Links */}
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
            {lang === 'bn' ? 'দরকারি লিংক' : 'Store & Policies'}
          </h3>
          <ul className="space-y-2 text-sm">
            {footerLinks.map((link) => (
              <li key={link.id}>
                <a
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(link.href);
                  }}
                  className="hover:text-white transition-colors"
                >
                  {lang === 'bn' ? link.labelBn : link.labelEn}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact & Hotline */}
        <div className="space-y-2.5 text-sm">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
            {lang === 'bn' ? 'যোগাযোগ' : 'Customer Care'}
          </h3>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 shrink-0 text-[var(--accent)]" />
            <a href={`tel:${g?.hotline || '+8809612004455'}`} className="hover:text-white font-medium tabular-nums">
              {g?.hotline || '+8809612-004455'}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 shrink-0 text-[var(--accent)]" />
            <span>{g?.email || 'care@shuddho.com.bd'}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-[var(--accent)]" />
            <span className="opacity-90">{g?.address}</span>
          </div>
          <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="px-2 py-1 rounded bg-white/10">Cash on Delivery</span>
            <span className="px-2 py-1 rounded bg-white/10">bKash</span>
            <span className="px-2 py-1 rounded bg-white/10">Nagad</span>
            <span className="px-2 py-1 rounded bg-white/10">SSLCommerz</span>
          </div>
        </div>

        {/* Newsletter */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {lang === 'bn' ? 'অফার ও আপডেট' : 'Harvest Alerts'}
          </h3>
          <p className="text-xs opacity-90">
            {lang === 'bn'
              ? 'নতুন মধু, ঘি ও বিশেষ ছাড়ের খবর পেতে ইমেইল দিন।'
              : 'Get notified when fresh Sundarban honey and seasonal harvests arrive.'}
          </p>
          {subscribed ? (
            <div className="p-3 rounded-xl bg-white/10 text-xs font-medium text-white">
              Thank you for subscribing!
            </div>
          ) : (
            <form onSubmit={handleNewsletter} className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 min-w-0 px-3 py-2 rounded-[10px] bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/60 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-[10px] text-xs font-semibold text-white shrink-0"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Join
              </button>
            </form>
          )}
          <div className="pt-2">
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                navigate('/admin');
              }}
              className="inline-flex items-center gap-1.5 text-xs opacity-75 hover:opacity-100 underline"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Merchant Admin Panel</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-[1240px] mx-auto px-4 mt-10 pt-6 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-80">
        <span>© {new Date().getFullYear()} {g?.storeName || 'Shuddho'} ({g?.domain || 'shuddho.com.bd'}). All rights reserved.</span>
        <span>Delivered across all 64 districts of Bangladesh</span>
      </div>
    </footer>
  );
};
