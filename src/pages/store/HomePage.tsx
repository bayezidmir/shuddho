import React, { useEffect, useState } from 'react';
import {
  Banknote,
  ShieldCheck,
  RotateCcw,
  Truck,
  ArrowRight,
  ChevronDown,
  Star,
  Copy,
  Check,
} from 'lucide-react';
import { useStore, toGA4Item } from '../../context/StoreContext';
import { ProductCard } from '../../components/store/ProductCard';
import { trackViewItemList } from '../../lib/datalayer';

function renderHeadlineWithCoralComma(text: string) {
  const idx = text.indexOf(',');
  if (idx === -1) return text;
  const before = text.slice(0, idx + 1);
  const after = text.slice(idx + 1);
  return (
    <>
      <span>{before}</span>
      <span style={{ color: 'var(--accent)' }}>{after}</span>
    </>
  );
}

export const HomePage: React.FC = () => {
  const { bootstrap, lang, navigate, setAppliedCouponCode } = useStore();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const sections = (bootstrap?.homepageSections || [])
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (bootstrap?.products?.length) {
      trackViewItemList(
        'Home Featured',
        bootstrap.products.slice(0, 8).map((p, idx) => toGA4Item(p, p.variants?.[0], 1, idx)),
      );
    }
  }, [bootstrap?.products]);

  if (!bootstrap) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 py-10 space-y-6">
        <div className="h-80 rounded-[18px] bg-[var(--image-bg)] animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-[18px] bg-[var(--image-bg)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-[1240px] mx-auto px-4 py-4 sm:py-6 space-y-10 sm:space-y-14">
      {sections.map((sec) => {
        // 1. HERO GRID
        if (sec.type === 'hero_grid') {
          const c = sec.config || {};
          const eyebrow = lang === 'bn' ? c.eyebrowBn || c.eyebrowEn : c.eyebrowEn;
          const headline = lang === 'bn' ? c.headlineBn || c.headlineEn : c.headlineEn;
          const subtext = lang === 'bn' ? c.subtextBn || c.subtextEn : c.subtextEn;
          const cta = lang === 'bn' ? c.ctaBn || c.ctaEn : c.ctaEn;

          return (
            <section key={sec.id} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Large Teal Gradient Hero Banner */}
              <div
                className="lg:col-span-8 rounded-[18px] p-6 sm:p-10 text-white grid grid-cols-1 md:grid-cols-12 gap-6 items-center overflow-hidden relative"
                style={{
                  background: `linear-gradient(135deg, var(--primary) 0%, #093C47 100%)`,
                }}
              >
                <div className="md:col-span-7 space-y-4 relative z-10">
                  <div className="text-xs font-bold tracking-[0.14em] uppercase text-[#CBE3E6]">
                    {eyebrow}
                  </div>
                  <h1 className="text-[clamp(32px,4.5vw,52px)] font-extrabold leading-[1.08] tracking-tight">
                    {renderHeadlineWithCoralComma(headline || 'Pure Bangladeshi food, direct from farms')}
                  </h1>
                  <p className="text-sm sm:text-[15.5px] text-[#D9F0F2] leading-relaxed max-w-lg">
                    {subtext}
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(c.ctaLink || '/shop')}
                      className="px-6 py-3 rounded-[12px] text-sm font-bold text-white inline-flex items-center gap-2 transition hover:opacity-95"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <span>{cta}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/track')}
                      className="px-4 py-3 rounded-[12px] text-sm font-semibold text-white border border-white/25 hover:bg-white/10 transition"
                    >
                      {lang === 'bn' ? 'অর্ডার ট্র্যাক' : 'Track Order'}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-5 flex justify-center">
                  <div className="w-full max-w-[280px] aspect-[4/3] md:aspect-square rounded-[16px] overflow-hidden border border-white/15 bg-white/10">
                    <img
                      src={c.heroImage || '/src/assets/images/hero_sundarban_honey_1794994128015.jpg'}
                      alt="Sundarban Raw Wildflower Honey"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* Two Stacked Promo Tiles on the Right */}
              <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <a
                  href={c.tile1Link || '/category/ghee'}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(c.tile1Link || '/category/ghee');
                  }}
                  className="group rounded-[18px] border p-4 flex items-center gap-4 transition hover:-translate-y-0.5"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
                >
                  <img
                    src={c.tile1Image || '/src/assets/images/product_deshi_ghee_1794994127438.jpg'}
                    alt={c.tile1TitleEn || 'Pabna Cow Ghee'}
                    className="w-24 h-24 rounded-[14px] object-cover bg-[var(--image-bg)] shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-semibold text-[var(--accent)]">Artisanal Dairy</div>
                    <h2 className="text-base font-bold text-[var(--ink)] group-hover:text-[var(--primary)]">
                      {c.tile1TitleEn || 'Pabna Cow Ghee'}
                    </h2>
                    <p className="text-xs text-[var(--muted)]">{c.tile1SubEn}</p>
                  </div>
                </a>

                <a
                  href={c.tile2Link || '/category/oils'}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(c.tile2Link || '/category/oils');
                  }}
                  className="group rounded-[18px] border p-4 flex items-center gap-4 transition hover:-translate-y-0.5"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
                >
                  <img
                    src={c.tile2Image || '/src/assets/images/product_mustard_oil_1794994128254.jpg'}
                    alt={c.tile2TitleEn || 'Cold-Pressed Oils'}
                    className="w-24 h-24 rounded-[14px] object-cover bg-[var(--image-bg)] shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-semibold text-[var(--primary)]">Wooden Kolhu</div>
                    <h2 className="text-base font-bold text-[var(--ink)] group-hover:text-[var(--primary)]">
                      {c.tile2TitleEn || 'Cold-Pressed Oils'}
                    </h2>
                    <p className="text-xs text-[var(--muted)]">{c.tile2SubEn}</p>
                  </div>
                </a>
              </div>
            </section>
          );
        }

        // 2. USP ROW
        if (sec.type === 'usp_row') {
          const items = sec.config?.items || [];
          const IconMap: Record<string, any> = {
            banknote: Banknote,
            shield: ShieldCheck,
            rotate: RotateCcw,
            truck: Truck,
          };
          return (
            <section key={sec.id} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {items.map((it: any, idx: number) => {
                const Icon = IconMap[it.icon] || ShieldCheck;
                return (
                  <div
                    key={idx}
                    className="rounded-[18px] border p-4 flex items-start gap-3"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--image-bg)', color: 'var(--primary)' }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--ink)]">
                        {lang === 'bn' ? it.titleBn || it.titleEn : it.titleEn}
                      </h3>
                      <p className="text-xs text-[var(--muted)] mt-0.5 leading-snug">
                        {lang === 'bn' ? it.descBn || it.descEn : it.descEn}
                      </p>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        }

        // 3. CATEGORY TILES
        if (sec.type === 'category_tiles') {
          return (
            <section key={sec.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-[26px] font-bold text-[var(--ink)]">
                  {lang === 'bn' ? 'ক্যাটাগরি অনুযায়ী কিনুন' : 'Shop by Category'}
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/shop')}
                  className="text-sm font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                >
                  <span>{lang === 'bn' ? 'সব দেখুন' : 'View all'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {bootstrap.categories.map((cat) => (
                  <a
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/category/${cat.slug}`);
                    }}
                    className="group rounded-[18px] border p-3 flex flex-col items-center text-center gap-2.5 transition hover:-translate-y-0.5"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
                  >
                    <div className="w-full aspect-[4/3] rounded-[12px] overflow-hidden bg-[var(--image-bg)]">
                      <img
                        src={cat.image}
                        alt={cat.name_en}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="text-sm font-bold text-[var(--ink)] group-hover:text-[var(--primary)]">
                      {lang === 'bn' ? cat.name_bn : cat.name_en}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          );
        }

        // 4. PRODUCT GRID (Featured / Newest)
        if (sec.type === 'product_grid') {
          const filter = sec.config?.filter || 'featured';
          const limit = sec.config?.limit || 8;
          const list =
            filter === 'newest'
              ? [...bootstrap.products].slice(0, limit)
              : bootstrap.products.filter((p) => p.featured).slice(0, limit);

          return (
            <section key={sec.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-[26px] font-bold text-[var(--ink)]">
                  {lang === 'bn' ? sec.titleBn || sec.titleEn : sec.titleEn}
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/shop')}
                  className="text-sm font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                >
                  <span>{lang === 'bn' ? 'সব পণ্য' : 'Explore shop'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                {list.map((p, idx) => (
                  <ProductCard key={p.id} product={p} listName={sec.titleEn} index={idx} />
                ))}
              </div>
            </section>
          );
        }

        // 5. PROMO BAND WITH COUPON CODE
        if (sec.type === 'promo_band') {
          const c = sec.config || {};
          return (
            <section
              key={sec.id}
              className="rounded-[18px] p-6 sm:p-8 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              style={{ background: 'linear-gradient(90deg, var(--primary) 0%, #0B3A44 100%)' }}
            >
              <div className="space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-widest text-[#CBE3E6]">
                  {c.eyebrowEn || 'LIMITED OFFER'}
                </div>
                <h2 className="text-2xl sm:text-[30px] font-extrabold">
                  {lang === 'bn' ? c.titleBn || c.titleEn : c.titleEn}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(c.code || 'PURE10');
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="px-4 py-2.5 rounded-[12px] border border-dashed border-white/50 bg-white/10 text-sm font-mono font-bold inline-flex items-center gap-2 hover:bg-white/20"
                >
                  <span>{c.code || 'PURE10'}</span>
                  {copiedCode ? <Check className="w-4 h-4 text-[#29B87E]" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCouponCode(c.code || 'PURE10');
                    navigate('/shop');
                  }}
                  className="px-5 py-2.5 rounded-[12px] text-sm font-bold text-white"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {c.ctaEn || 'Apply & Shop'}
                </button>
              </div>
            </section>
          );
        }

        // 6. TESTIMONIALS
        if (sec.type === 'testimonials') {
          return (
            <section key={sec.id} className="space-y-4">
              <h2 className="text-xl sm:text-[26px] font-bold text-[var(--ink)]">
                {lang === 'bn' ? 'গ্রাহকদের মতামত' : sec.titleEn}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {bootstrap.testimonials.map((tm) => (
                  <div
                    key={tm.id}
                    className="rounded-[18px] border p-5 space-y-3"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
                  >
                    <div className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: tm.rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm text-[var(--ink)] leading-relaxed">
                      “{lang === 'bn' ? tm.textBn : tm.textEn}”
                    </p>
                    <div className="text-xs text-[var(--muted)] font-medium">
                      {tm.name} · {tm.city}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // 7. FAQ
        if (sec.type === 'faq') {
          return (
            <section key={sec.id} className="space-y-4">
              <h2 className="text-xl sm:text-[26px] font-bold text-[var(--ink)]">
                {lang === 'bn' ? 'সচরাচর জিজ্ঞাসিত প্রশ্ন' : sec.titleEn}
              </h2>
              <div
                className="rounded-[18px] border divide-y divide-[var(--line)] overflow-hidden"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
              >
                {bootstrap.faqs.map((f) => {
                  const isOpen = openFaq === f.id;
                  return (
                    <div key={f.id}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenFaq(isOpen ? null : f.id)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left text-sm sm:text-base font-semibold text-[var(--ink)] hover:bg-[var(--bg)] transition"
                      >
                        <span>{lang === 'bn' ? f.qBn : f.qEn}</span>
                        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 text-sm text-[var(--muted)] leading-relaxed">
                          {lang === 'bn' ? f.aBn : f.aEn}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        }

        return null;
      })}
    </main>
  );
};
