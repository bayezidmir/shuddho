import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { CartItem, Product, ProductVariant, StoreBootstrap } from '../types';
import type { Lang } from '../lib/i18n';
import { captureAttributionOnLanding, type AttributionData } from '../lib/attribution';
import {
  trackAddToCart,
  trackRemoveFromCart,
  trackViewCart,
  trackPageView,
  type GA4Item,
} from '../lib/datalayer';
import {
  computeTrackingSignature,
  buildGtmInitScriptBody,
  normalizeHeadOverrideHtml,
  normalizeBodyOverrideHtml,
  isValidGtmId,
  normalizeGtmId,
} from '../lib/gtm-injection';

interface StoreContextValue {
  bootstrap: StoreBootstrap | null;
  loading: boolean;
  refreshBootstrap: () => Promise<void>;
  lang: Lang;
  setLang: (l: Lang) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  cart: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (product: Product, variant?: ProductVariant | null, qty?: number, openDrawer?: boolean) => void;
  updateQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  appliedCouponCode: string;
  setAppliedCouponCode: (code: string) => void;
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  attribution: AttributionData;
  navigate: (to: string) => void;
  currentPath: string;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function toGA4Item(product: Product, variant?: ProductVariant | null, quantity = 1, index = 0): GA4Item {
  const price = variant ? variant.price : product.price;
  const regular = variant ? variant.regular_price : product.regular_price;
  return {
    item_id: variant ? variant.sku : product.sku,
    item_name: product.name_en,
    item_brand: product.brand?.name || 'Shuddho',
    item_category: product.category?.name_en || 'Natural Food',
    item_variant: variant ? variant.label : 'Standard',
    price,
    discount: Math.max(0, regular - price),
    quantity,
    index,
  };
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bootstrap, setBootstrap] = useState<StoreBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('shuddho_lang') as Lang) || 'en';
    } catch {
      return 'en';
    }
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('shuddho_dark');
      if (saved !== null) return saved === '1';
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem('shuddho_cart');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>(() => {
    try {
      return localStorage.getItem('shuddho_coupon') || '';
    } catch {
      return '';
    }
  });
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('shuddho_wishlist');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [attribution, setAttribution] = useState<AttributionData>(() => captureAttributionOnLanding());
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname + window.location.search);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('shuddho_lang', l); } catch {}
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      try { localStorage.setItem('shuddho_dark', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    try { localStorage.setItem('shuddho_cart', JSON.stringify(cart)); } catch {}
  }, [cart]);

  useEffect(() => {
    try { localStorage.setItem('shuddho_coupon', appliedCouponCode); } catch {}
  }, [appliedCouponCode]);

  useEffect(() => {
    try { localStorage.setItem('shuddho_wishlist', JSON.stringify(wishlist)); } catch {}
  }, [wishlist]);

  const refreshBootstrap = useCallback(async () => {
    try {
      const resp = await fetch('/api/store/bootstrap');
      if (resp.ok) {
        const data = (await resp.json()) as StoreBootstrap;
        setBootstrap(data);

        // Apply Coast theme CSS tokens dynamically
        if (data.theme && !darkMode) {
          const tokenKeys = [
            '--bg', '--surface', '--ink', '--muted', '--primary', '--primary-ink',
            '--accent', '--accent-ink', '--line', '--image-bg', '--chip-bg', '--chip-fg',
            '--sale', '--success', '--footer-bg', '--footer-fg', '--topbar-bg', '--topbar-fg',
          ];
          for (const tk of tokenKeys) {
            if (data.theme[tk]) document.documentElement.style.setProperty(tk, data.theme[tk]);
          }
          if (data.theme.radiusCard) document.documentElement.style.setProperty('--radius-card', data.theme.radiusCard);
          if (data.theme.radiusControl) document.documentElement.style.setProperty('--radius-control', data.theme.radiusControl);
          if (data.theme.fontDisplay) {
            document.documentElement.style.setProperty(
              '--font-display',
              `'${data.theme.fontDisplay}', 'Hind Siliguri', system-ui, sans-serif`,
            );
          }
        }
      }
    } catch {
      // keep existing bootstrap on transient error
    } finally {
      setLoading(false);
    }
  }, [darkMode]);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap]);

  // Inject GTM / Consent Mode v2 / Custom CSS when bootstrap tracking loads or updates
  useEffect(() => {
    if (!bootstrap) return;
    const isAdminRoute = currentPath.startsWith('/admin');
    if (isAdminRoute) return;

    const tr = bootstrap.tracking;
    window.dataLayer = window.dataLayer || [];

    // Google Consent Mode v2 defaults (skip if already injected by SSR)
    if (!document.getElementById('shuddho-consent-default')) {
      const cs = document.createElement('script');
      cs.id = 'shuddho-consent-default';
      cs.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('consent', 'default', {
          ad_storage: '${tr.consentDefaultAds || 'granted'}',
          ad_user_data: '${tr.consentDefaultAds || 'granted'}',
          ad_personalization: '${tr.consentDefaultAds || 'granted'}',
          analytics_storage: '${tr.consentDefaultAnalytics || 'granted'}'
        });
      `;
      document.head.prepend(cs);
    }

    const expectedSig = computeTrackingSignature(tr);
    const existingHeadNode = document.getElementById('shuddho-gtm-head');
    const existingSig = existingHeadNode?.getAttribute('data-gtm-sig');

    if (existingSig !== expectedSig) {
      // Remove previous dynamic/SSR GTM snippets before re-injecting on live setting updates
      document.getElementById('shuddho-gtm-head')?.remove();
      document.getElementById('shuddho-gtm-start')?.remove();
      document.querySelectorAll('[data-shuddho-override="head"]').forEach((el) => el.remove());
      document.getElementById('shuddho-gtm-noscript')?.remove();

      const cid = normalizeGtmId(tr.gtmContainerId);
      const overrideHead = String(tr.overrideHeadCode || '').trim();
      const shouldInject = Boolean(tr.gtmEnabled) && (Boolean(overrideHead) || isValidGtmId(cid));

      if (shouldInject) {
        if (overrideHead) {
          const marker = document.createElement('meta');
          marker.id = 'shuddho-gtm-head';
          marker.setAttribute('name', 'shuddho-gtm');
          marker.setAttribute('content', 'client');
          marker.setAttribute('data-gtm-sig', expectedSig);
          document.head.prepend(marker);

          const tpl = document.createElement('template');
          tpl.innerHTML = normalizeHeadOverrideHtml(overrideHead);
          const nodes = Array.from(tpl.content.childNodes);
          for (const node of nodes) {
            if (node instanceof HTMLScriptElement) {
              const s = document.createElement('script');
              for (const attr of Array.from(node.attributes)) {
                s.setAttribute(attr.name, attr.value);
              }
              if (node.textContent) s.textContent = node.textContent;
              s.setAttribute('data-shuddho-override', 'head');
              document.head.appendChild(s);
            } else if (node instanceof Element) {
              node.setAttribute('data-shuddho-override', 'head');
              document.head.appendChild(node);
            }
          }
        } else {
          const initScript = document.createElement('script');
          initScript.id = 'shuddho-gtm-start';
          initScript.textContent = buildGtmInitScriptBody();
          document.head.prepend(initScript);

          const headScript = document.createElement('script');
          headScript.id = 'shuddho-gtm-head';
          headScript.async = true;
          headScript.src = `https://www.googletagmanager.com/gtm.js?id=${cid}`;
          headScript.setAttribute('data-gtm-sig', expectedSig);
          document.head.prepend(headScript);
        }

        const overrideBody = String(tr.overrideBodyCode || '').trim();
        if (overrideBody || isValidGtmId(cid)) {
          const noscript = document.createElement('noscript');
          noscript.id = 'shuddho-gtm-noscript';
          if (overrideBody) {
            noscript.innerHTML = normalizeBodyOverrideHtml(overrideBody).replace(/<\/?noscript[^>]*>/gi, '');
          } else {
            noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${cid}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
          }
          document.body.prepend(noscript);
        }
      }
    }

    // Custom CSS injection from Appearance
    document.getElementById('shuddho-custom-css')?.remove();
    if (bootstrap.theme?.customCss?.trim()) {
      const st = document.createElement('style');
      st.id = 'shuddho-custom-css';
      st.textContent = bootstrap.theme.customCss;
      document.head.appendChild(st);
    }
  }, [bootstrap, currentPath]);

  // Capture click IDs and ?coupon=CODE on URL changes
  useEffect(() => {
    const attr = captureAttributionOnLanding();
    setAttribution(attr);
    const params = new URLSearchParams(window.location.search);
    const couponParam = params.get('coupon');
    if (couponParam) {
      setAppliedCouponCode(couponParam.trim().toUpperCase());
    }
  }, [currentPath]);

  // Push GA4 page_view on storefront route changes
  useEffect(() => {
    const pathname = currentPath.split('?')[0];
    if (pathname.startsWith('/admin')) return;
    let pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'page' | 'search' = 'page';
    if (pathname === '/') pageType = 'home';
    else if (pathname.startsWith('/category') || pathname === '/shop') pageType = 'category';
    else if (pathname.startsWith('/products/')) pageType = 'product';
    else if (pathname === '/cart') pageType = 'cart';
    else if (pathname === '/checkout') pageType = 'checkout';
    else if (pathname.startsWith('/thank-you')) pageType = 'thank_you';
    else if (pathname === '/search') pageType = 'search';

    trackPageView({
      page_type: pageType,
      page_location: window.location.href,
      page_title: document.title,
      customer_type: 'new',
    });
  }, [currentPath]);

  useEffect(() => {
    const onPop = () => setCurrentPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname + window.location.search) return;
    window.history.pushState({}, '', to);
    setCurrentPath(to);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const addToCart = useCallback(
    (product: Product, variant?: ProductVariant | null, qty = 1, openDrawer = true) => {
      const v = variant ?? (product.variants?.length > 0 ? product.variants[0] : null);
      const key = `${product.id}:${v?.id || ''}`;
      const unitPrice = v ? v.price : product.price;
      const regularPrice = v ? v.regular_price : product.regular_price;

      setCart((prev) => {
        const existing = prev.find((i) => i.key === key);
        if (existing) {
          return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + qty } : i));
        }
        return [
          ...prev,
          {
            key,
            productId: product.id,
            variantId: v?.id || null,
            sku: v ? v.sku : product.sku,
            name_en: product.name_en,
            name_bn: product.name_bn,
            category: product.category?.name_en || 'Natural Food',
            variantLabel: v ? v.label : 'Standard',
            unitPrice,
            regularPrice,
            quantity: qty,
            image: v?.image || product.images[0] || '',
          },
        ];
      });

      trackAddToCart([toGA4Item(product, v, qty)]);
      if (openDrawer) {
        setCartOpen(true);
      }
    },
    [],
  );

  const updateQty = useCallback((key: string, nextQty: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.key === key);
      if (!item) return prev;
      if (nextQty <= 0) {
        trackRemoveFromCart([
          {
            item_id: item.sku,
            item_name: item.name_en,
            item_category: item.category,
            item_variant: item.variantLabel,
            price: item.unitPrice,
            quantity: item.quantity,
          },
        ]);
        return prev.filter((i) => i.key !== key);
      }
      const delta = nextQty - item.quantity;
      if (delta > 0) {
        trackAddToCart([
          {
            item_id: item.sku,
            item_name: item.name_en,
            item_category: item.category,
            item_variant: item.variantLabel,
            price: item.unitPrice,
            quantity: delta,
          },
        ]);
      } else if (delta < 0) {
        trackRemoveFromCart([
          {
            item_id: item.sku,
            item_name: item.name_en,
            item_category: item.category,
            item_variant: item.variantLabel,
            price: item.unitPrice,
            quantity: Math.abs(delta),
          },
        ]);
      }
      return prev.map((i) => (i.key === key ? { ...i, quantity: nextQty } : i));
    });
  }, []);

  const removeFromCart = useCallback((key: string) => {
    updateQty(key, 0);
  }, [updateQty]);

  const clearCart = useCallback(() => {
    setCart([]);
    setAppliedCouponCode('');
  }, []);

  const openCartDrawer = useCallback(
    (open: boolean) => {
      setCartOpen(open);
      if (open && cart.length > 0) {
        trackViewCart(
          cart.map((c, idx) => ({
            item_id: c.sku,
            item_name: c.name_en,
            item_category: c.category,
            item_variant: c.variantLabel,
            price: c.unitPrice,
            quantity: c.quantity,
            index: idx,
          })),
        );
      }
    },
    [cart],
  );

  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  }, []);

  return (
    <StoreContext.Provider
      value={{
        bootstrap,
        loading,
        refreshBootstrap,
        lang,
        setLang,
        darkMode,
        toggleDarkMode,
        cart,
        cartOpen,
        setCartOpen: openCartDrawer,
        addToCart,
        updateQty,
        removeFromCart,
        clearCart,
        appliedCouponCode,
        setAppliedCouponCode,
        wishlist,
        toggleWishlist,
        attribution,
        navigate,
        currentPath,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
