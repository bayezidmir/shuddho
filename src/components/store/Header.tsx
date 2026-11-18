import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ShoppingBag,
  Menu,
  X,
  Sun,
  Moon,
  MapPin,
  User,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatBDT, toBanglaDigits } from '../../lib/bd-validation';
import { t } from '../../lib/i18n';
import { trackSearch } from '../../lib/datalayer';

export const StoreHeader: React.FC = () => {
  const {
    bootstrap,
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
    cart,
    setCartOpen,
    navigate,
  } = useStore();

  const [annIndex, setAnnIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const activeAnnouncements = useMemo(
    () => (bootstrap?.announcements || []).filter((a) => a.active),
    [bootstrap],
  );

  useEffect(() => {
    if (activeAnnouncements.length <= 1) return;
    const timer = setInterval(() => {
      setAnnIndex((prev) => (prev + 1) % activeAnnouncements.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeAnnouncements.length]);

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const currentAnn = activeAnnouncements[annIndex % Math.max(1, activeAnnouncements.length)];

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !bootstrap) return [];
    return bootstrap.products
      .filter(
        (p) =>
          p.name_en.toLowerCase().includes(q) ||
          p.name_bn.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          (p.category?.name_en || '').toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [searchQuery, bootstrap]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    trackSearch(q);
    setSearchFocused(false);
    navigate(`/shop?q=${encodeURIComponent(q)}`);
  };

  const storeName = lang === 'bn'
    ? bootstrap?.general.storeNameBn || 'শুদ্ধ'
    : bootstrap?.general.storeName || 'Shuddho';

  const navItems = bootstrap?.menus.header || [];

  return (
    <header className="w-full relative z-30">
      {/* Announcement Bar */}
      {currentAnn && (
        <div
          className="w-full py-2 px-4 text-center text-xs sm:text-sm font-medium"
          style={{ backgroundColor: 'var(--topbar-bg)', color: 'var(--topbar-fg)' }}
        >
          <a
            href={currentAnn.link || '/shop'}
            onClick={(e) => {
              e.preventDefault();
              navigate(currentAnn.link || '/shop');
            }}
            className="hover:underline inline-flex items-center gap-1.5"
          >
            <span>{lang === 'bn' ? currentAnn.textBn : currentAnn.textEn}</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </a>
        </div>
      )}

      {/* Main Header Container */}
      <div className="max-w-[1240px] mx-auto px-4 pt-4 pb-2 space-y-3">
        {/* Floating Pill Header */}
        <div
          className="flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5 rounded-full border transition-colors"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--line)',
          }}
        >
          {/* Left: Mobile Menu + Brand Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open category menu"
              className="lg:hidden p-2 rounded-full hover:bg-[var(--bg)] text-[var(--ink)]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--primary)] rounded-full"
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: 'var(--primary)' }}
                aria-hidden="true"
              >
                S
              </span>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[var(--ink)]">
                {storeName}
              </span>
            </a>
          </div>

          {/* Center: Inline Category Menu */}
          <nav aria-label="Primary categories" className="hidden lg:flex items-center gap-6 text-[14.5px] font-medium text-[var(--ink)]">
            {navItems.slice(0, 6).map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.href);
                }}
                className="hover:text-[var(--primary)] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:border-[var(--primary)]"
              >
                {lang === 'bn' ? item.labelBn : item.labelEn}
              </a>
            ))}
          </nav>

          {/* Right: Language, Theme, Track, Account, Cart Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              aria-label="Switch language"
              className="px-2.5 py-1.5 rounded-full text-xs font-semibold border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)] transition whitespace-nowrap"
            >
              {lang === 'en' ? 'বাং' : 'EN'}
            </button>

            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-full border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)] transition"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <a
              href="/track"
              onClick={(e) => {
                e.preventDefault();
                navigate('/track');
              }}
              aria-label="Track order"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{t('trackOrder', lang)}</span>
            </a>

            <a
              href="/account"
              onClick={(e) => {
                e.preventDefault();
                navigate('/account');
              }}
              aria-label="My account"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition whitespace-nowrap"
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('myAccount', lang)}</span>
            </a>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Open cart (${totalItems} items)`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white transition hover:opacity-95 whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">{t('cart', lang)}</span>
              <span
                className="min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center tabular-nums"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                {lang === 'bn' ? toBanglaDigits(totalItems) : totalItems}
              </span>
            </button>
          </div>
        </div>

        {/* Rounded Search Field Below Header Pill */}
        <div className="relative max-w-2xl mx-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-4 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder', lang)}
              aria-label="Search products"
              className="w-full pl-11 pr-24 py-2.5 rounded-full border text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
            />
            <button
              type="submit"
              className="absolute right-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white transition hover:opacity-95"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {t('searchBtn', lang)}
            </button>
          </form>

          {/* Live Search Suggestions */}
          {searchFocused && searchResults.length > 0 && (
            <div
              className="absolute left-0 right-0 mt-2 rounded-[18px] border overflow-hidden z-40 shadow-lg"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
            >
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearchFocused(false);
                    navigate(`/products/${p.slug}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg)] transition border-b last:border-b-0 border-[var(--line)]"
                >
                  <img
                    src={p.images[0]}
                    alt={p.name_en}
                    className="w-10 h-10 rounded-lg object-cover bg-[var(--image-bg)] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--ink)] truncate">
                      {lang === 'bn' ? p.name_bn : p.name_en}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {p.category ? (lang === 'bn' ? p.category.name_bn : p.category.name_en) : ''}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[var(--ink)] tabular-nums shrink-0">
                    {formatBDT(p.price, lang)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Slide-Out Category Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div
            className="relative w-72 max-w-[85vw] h-full p-5 flex flex-col gap-4 overflow-y-auto"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <span className="text-lg font-extrabold text-[var(--ink)]">{storeName}</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-[var(--bg)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    navigate(item.href);
                  }}
                  className="px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--ink)] hover:bg-[var(--bg)]"
                >
                  {lang === 'bn' ? item.labelBn : item.labelEn}
                </a>
              ))}
              <hr className="my-2 border-[var(--line)]" />
              <a
                href="/track"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  navigate('/track');
                }}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--ink)] hover:bg-[var(--bg)]"
              >
                {t('trackOrder', lang)}
              </a>
              <a
                href="/account"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  navigate('/account');
                }}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--ink)] hover:bg-[var(--bg)]"
              >
                {t('myAccount', lang)}
              </a>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};
