import React, { useEffect, useState } from 'react';
import { MessageCircle, ShoppingBag, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatBDT } from '../../lib/bd-validation';
import { t } from '../../lib/i18n';

export const StoreOverlays: React.FC = () => {
  const { bootstrap, lang, cart, navigate, setAppliedCouponCode, currentPath } = useStore();
  const [consentDismissed, setConsentDismissed] = useState(() => {
    try {
      return localStorage.getItem('shuddho_consent') !== null;
    } catch {
      return false;
    }
  });
  const [activePopup, setActivePopup] = useState<any | null>(null);

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  // Timed popup (respecting >= 12s dwell & session dismissal)
  useEffect(() => {
    const popup = bootstrap?.popups?.find((p) => p.active);
    if (!popup) return;
    try {
      if (sessionStorage.getItem(`popup_seen_${popup.id}`)) return;
    } catch {}
    const delayMs = Math.max(12, popup.delaySeconds || 15) * 1000;
    const timer = setTimeout(() => {
      if (!window.location.pathname.startsWith('/admin') && !window.location.pathname.startsWith('/checkout')) {
        setActivePopup(popup);
        try { sessionStorage.setItem(`popup_seen_${popup.id}`, '1'); } catch {}
      }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [bootstrap]);

  const handleConsent = (granted: boolean) => {
    try {
      localStorage.setItem('shuddho_consent', granted ? 'granted' : 'denied');
    } catch {}
    setConsentDismissed(true);
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        ad_storage: granted ? 'granted' : 'denied',
        ad_user_data: granted ? 'granted' : 'denied',
        ad_personalization: granted ? 'granted' : 'denied',
        analytics_storage: granted ? 'granted' : 'denied',
      });
    }
  };

  const whatsappNum = bootstrap?.general?.whatsapp || '8801711004455';
  const showMobileBar = totalItems > 0 && !currentPath.startsWith('/checkout');

  return (
    <>
      {/* Floating WhatsApp Button */}
      <a
        href={`https://wa.me/${whatsappNum}?text=${encodeURIComponent('Hello Shuddho, I would like to place an order.')}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className={`fixed right-4 z-30 w-12 h-12 rounded-full bg-[#1E9E6A] text-white shadow-lg flex items-center justify-center hover:scale-105 transition ${
          showMobileBar ? 'bottom-20 sm:bottom-6' : 'bottom-6'
        }`}
      >
        <MessageCircle className="w-6 h-6" />
      </a>

      {/* Mobile Sticky Bottom Cart Bar (<= 64px height, <10% mobile viewport) */}
      {showMobileBar && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 sm:hidden border-t px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[var(--muted)]">{totalItems} items</div>
              <div className="text-sm font-bold text-[var(--ink)] tabular-nums">{formatBDT(subtotal, lang)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/checkout')}
            className="px-5 py-2.5 rounded-[12px] text-sm font-semibold text-white shrink-0"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {t('checkout', lang)}
          </button>
        </div>
      )}

      {/* Cookie & Google Consent Mode v2 Banner */}
      {bootstrap?.tracking?.consentBannerEnabled && !consentDismissed && (
        <div
          className="fixed bottom-3 left-3 right-3 sm:right-auto sm:max-w-lg z-40 rounded-[14px] border px-3.5 py-2.5 shadow-lg flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
        >
          <p className="text-[11px] text-[var(--muted)] leading-snug">
            Cookies enabled for cart & Consent Mode v2 analytics.
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleConsent(true)}
              className="px-3 py-1 rounded-[9px] text-[11px] font-semibold text-white"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => handleConsent(false)}
              className="px-2.5 py-1 rounded-[9px] border border-[var(--line)] text-[11px] font-medium text-[var(--ink)]"
            >
              Essential
            </button>
          </div>
        </div>
      )}

      {/* Timed Offer Popup */}
      {activePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div
            className="relative w-full max-w-md rounded-[18px] border p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
          >
            <button
              type="button"
              aria-label="Close offer"
              onClick={() => setActivePopup(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--muted)]"
            >
              <X className="w-4 h-4" />
            </button>
            <span
              className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold mb-2"
              style={{ backgroundColor: 'var(--chip-bg)', color: 'var(--chip-fg)' }}
            >
              Welcome Offer
            </span>
            <h3 className="text-xl font-bold text-[var(--ink)]">
              {lang === 'bn' ? activePopup.titleBn : activePopup.titleEn}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {lang === 'bn' ? activePopup.bodyBn : activePopup.bodyEn}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activePopup.couponCode) setAppliedCouponCode(activePopup.couponCode);
                  setActivePopup(null);
                  navigate('/shop');
                }}
                className="flex-1 py-2.5 px-4 rounded-[12px] text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Apply {activePopup.couponCode} & Shop
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
