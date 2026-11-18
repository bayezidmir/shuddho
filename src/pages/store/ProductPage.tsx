import React, { useEffect, useState } from 'react';
import {
  Star,
  Truck,
  Phone,
  MessageCircle,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { useStore, toGA4Item } from '../../context/StoreContext';
import type { Product, ProductVariant } from '../../types';
import { formatBDT } from '../../lib/bd-validation';
import { t } from '../../lib/i18n';
import { trackViewItem } from '../../lib/datalayer';
import { ProductCard } from '../../components/store/ProductCard';

export const ProductPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { bootstrap, lang, addToCart, navigate } = useStore();
  const [detail, setDetail] = useState<{
    product: Product;
    reviews: any[];
    questions: any[];
    related: Product[];
  } | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'reviews' | 'qa'>('desc');
  const [selectedDistrict, setSelectedDistrict] = useState('Dhaka');
  const [revForm, setRevForm] = useState({ name: '', rating: 5, comment: '' });
  const [revMsg, setRevMsg] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/store/products/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setDetail(data);
        const v0 = data.product.variants?.[0] || null;
        setSelectedVariant(v0);
        setActiveImage(0);
        trackViewItem(toGA4Item(data.product, v0, 1));
      });
    return () => { active = false; };
  }, [slug]);

  if (!detail) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 py-12">
        <div className="h-96 rounded-[18px] bg-[var(--image-bg)] animate-pulse" />
      </div>
    );
  }

  const { product, reviews, questions, related } = detail;
  const price = selectedVariant ? selectedVariant.price : product.price;
  const regularPrice = selectedVariant ? selectedVariant.regular_price : product.regular_price;
  const stock = selectedVariant ? selectedVariant.stock : product.stock;
  const sku = selectedVariant ? selectedVariant.sku : product.sku;
  const savings = Math.max(0, regularPrice - price);
  const discountPct = regularPrice > price ? Math.round((savings / regularPrice) * 100) : 0;

  const images = Array.from(
    new Set([selectedVariant?.image, ...product.images].filter(Boolean) as string[]),
  );

  const zoneEta =
    selectedDistrict === 'Dhaka'
      ? 'Inside Dhaka: ৳70 (24h delivery, Free over ৳2,000)'
      : ['Gazipur', 'Narayanganj', 'Munshiganj'].includes(selectedDistrict)
        ? 'Dhaka Suburbs: ৳100 (24–48h delivery)'
        : 'Outside Dhaka: ৳130 (48–72h nationwide delivery)';

  const whatsappNum = bootstrap?.general?.whatsapp || '8801711004455';
  const waText = encodeURIComponent(
    `Assalamu Alaikum, I want to order: ${product.name_en} (${selectedVariant?.label || 'Standard'}) - ${formatBDT(price)}. Link: ${window.location.href}`,
  );

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/store/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        customerName: revForm.name,
        rating: revForm.rating,
        comment: revForm.comment,
      }),
    });
    const d = await r.json();
    setRevMsg(d.message || d.error);
    if (r.ok) setRevForm({ name: '', rating: 5, comment: '' });
  };

  return (
    <main className="max-w-[1240px] mx-auto px-4 py-6 space-y-12">
      {/* Schema.org Product JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name_en,
            sku,
            description: product.short_desc_en,
            image: images,
            brand: { '@type': 'Brand', name: product.brand?.name || 'Shuddho' },
            offers: {
              '@type': 'Offer',
              priceCurrency: 'BDT',
              price,
              availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: product.rating_avg,
              reviewCount: Math.max(1, product.review_count),
            },
          }),
        }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--muted)] flex items-center gap-2">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="hover:text-[var(--primary)]">Home</a>
        <span>/</span>
        {product.category && (
          <>
            <a
              href={`/category/${product.category.slug}`}
              onClick={(e) => { e.preventDefault(); navigate(`/category/${product.category!.slug}`); }}
              className="hover:text-[var(--primary)]"
            >
              {lang === 'bn' ? product.category.name_bn : product.category.name_en}
            </a>
            <span>/</span>
          </>
        )}
        <span className="text-[var(--ink)] font-medium">{lang === 'bn' ? product.name_bn : product.name_en}</span>
      </nav>

      {/* Main Split: Sticky Gallery Left + Purchase Module Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Gallery */}
        <div className="lg:col-span-6 space-y-3">
          <div
            className="aspect-square rounded-[18px] border overflow-hidden group relative"
            style={{ backgroundColor: 'var(--image-bg)', borderColor: 'var(--line)' }}
          >
            <img
              src={images[activeImage] || images[0]}
              alt={product.name_en}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
            {discountPct > 0 && (
              <span
                className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold text-white tabular-nums"
                style={{ backgroundColor: 'var(--sale)' }}
              >
                Save {discountPct}% ({formatBDT(savings, lang)})
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 ${activeImage === i ? 'border-[var(--primary)]' : 'border-transparent'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover bg-[var(--image-bg)]" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Module */}
        <div
          className="lg:col-span-6 rounded-[18px] border p-6 space-y-5"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
            <span>
              {product.brand?.name || 'Shuddho'} · SKU: <span className="font-mono text-[var(--ink)]">{sku}</span>
            </span>
            <span
              className="font-semibold"
              style={{ color: stock > 0 ? 'var(--success)' : 'var(--sale)' }}
            >
              {stock <= 0
                ? t('outOfStock', lang)
                : stock <= product.low_stock_threshold
                  ? t('onlyLeft', lang, { n: stock })
                  : t('inStock', lang)}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] leading-tight">
            {lang === 'bn' ? product.name_bn : product.name_en}
          </h1>

          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 font-bold text-[var(--ink)]">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              {product.rating_avg.toFixed(1)}
            </span>
            <span className="text-[var(--muted)]">{product.review_count} verified reviews</span>
          </div>

          <p className="text-sm text-[var(--muted)] leading-relaxed">
            {lang === 'bn' ? product.short_desc_bn : product.short_desc_en}
          </p>

          {/* Price */}
          <div className="flex items-baseline gap-3 pt-1">
            <span className="text-3xl font-extrabold text-[var(--ink)] tabular-nums">
              {formatBDT(price, lang)}
            </span>
            {regularPrice > price && (
              <span className="text-lg text-[var(--muted)] line-through tabular-nums">
                {formatBDT(regularPrice, lang)}
              </span>
            )}
          </div>

          {/* Variants */}
          {product.variants?.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Select Pack Size
              </div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const active = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`px-4 py-2 rounded-[12px] border text-sm font-semibold transition ${
                        active
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {v.label} · {formatBDT(v.price, lang)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity + Primary CTAs */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center border border-[var(--line)] rounded-[12px] bg-[var(--bg)]">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="p-3 hover:opacity-75"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-bold tabular-nums">{qty}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty((q) => Math.min(20, q + 1))}
                  className="p-3 hover:opacity-75"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={stock <= 0}
                onClick={() => addToCart(product, selectedVariant, qty, true)}
                className="flex-1 py-3 px-5 rounded-[12px] border border-[var(--primary)] text-[var(--primary)] font-bold text-sm inline-flex items-center justify-center gap-2 hover:bg-[var(--bg)] disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{t('addToCart', lang)}</span>
              </button>
            </div>

            <button
              type="button"
              disabled={stock <= 0}
              onClick={() => {
                addToCart(product, selectedVariant, qty, false);
                navigate('/checkout');
              }}
              className="w-full py-3.5 px-6 rounded-[12px] text-white font-bold text-base transition hover:opacity-95 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {t('orderNow', lang)} — Cash on Delivery ({formatBDT(price * qty, lang)})
            </button>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/${whatsappNum}?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-[12px] border border-[var(--line)] text-xs sm:text-sm font-semibold text-[var(--ink)] inline-flex items-center justify-center gap-2 hover:bg-[var(--bg)]"
              >
                <MessageCircle className="w-4 h-4 text-[#1E9E6A]" />
                <span>{t('whatsappOrder', lang)}</span>
              </a>
              <a
                href={`tel:${bootstrap?.general?.hotline || '+8809612004455'}`}
                className="py-2.5 px-3 rounded-[12px] border border-[var(--line)] text-xs sm:text-sm font-semibold text-[var(--ink)] inline-flex items-center justify-center gap-2 hover:bg-[var(--bg)]"
              >
                <Phone className="w-4 h-4 text-[var(--primary)]" />
                <span>{t('callToOrder', lang)}</span>
              </a>
            </div>
          </div>

          {/* District Delivery Estimate Box */}
          <div className="rounded-[14px] p-4 bg-[var(--bg)] border border-[var(--line)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--ink)] inline-flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[var(--primary)]" />
                Delivery Estimate
              </span>
              <select
                aria-label="Select district for delivery estimate"
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="text-xs px-2.5 py-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"
              >
                {(bootstrap?.districts || []).map((d) => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-[var(--muted)]">{zoneEta}</p>
            <div className="flex items-center gap-3 text-[11px] text-[var(--ink)] pt-1">
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" /> 100% Pure Guarantee</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(window.location.href)}
                className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline ml-auto"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Description, Specs, Reviews, Q&A */}
      <section
        className="rounded-[18px] border overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div className="flex border-b border-[var(--line)] overflow-x-auto">
          {[
            { id: 'desc', label: 'Description' },
            { id: 'specs', label: 'Origin & Specs' },
            { id: 'reviews', label: `Reviews (${reviews.length})` },
            { id: 'qa', label: `Q&A (${questions.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'desc' && (
            <div className="prose max-w-none text-sm text-[var(--ink)] leading-relaxed space-y-3">
              <p>{lang === 'bn' ? product.desc_bn : product.desc_en}</p>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {product.specs.map((sp, i) => (
                <div key={i} className="flex justify-between p-3 rounded-xl bg-[var(--bg)] text-sm">
                  <span className="font-medium text-[var(--muted)]">{sp.key}</span>
                  <span className="font-semibold text-[var(--ink)]">{sp.value}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-3">
                {reviews.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No reviews yet. Be the first to review!</p>
                ) : (
                  reviews.map((r) => (
                    <div key={r.id} className="p-4 rounded-xl border border-[var(--line)] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[var(--ink)]">{r.customer_name}</span>
                        <span className="text-xs text-[var(--success)] font-medium">Verified Buyer</span>
                      </div>
                      <div className="flex gap-0.5 text-amber-400">
                        {Array.from({ length: r.rating }).map((_, idx) => (
                          <Star key={idx} className="w-3.5 h-3.5 fill-amber-400" />
                        ))}
                      </div>
                      <p className="text-sm text-[var(--muted)]">{r.comment}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={submitReview} className="lg:col-span-5 p-4 rounded-xl bg-[var(--bg)] space-y-3">
                <h3 className="font-bold text-sm text-[var(--ink)]">Write a Review</h3>
                <input
                  type="text"
                  required
                  placeholder="Your Name"
                  value={revForm.name}
                  onChange={(e) => setRevForm({ ...revForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm"
                />
                <select
                  value={revForm.rating}
                  onChange={(e) => setRevForm({ ...revForm, rating: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm"
                >
                  <option value={5}>5 Stars — Excellent</option>
                  <option value={4}>4 Stars — Very Good</option>
                  <option value={3}>3 Stars — Average</option>
                </select>
                <textarea
                  required
                  rows={3}
                  placeholder="Share your experience..."
                  value={revForm.comment}
                  onChange={(e) => setRevForm({ ...revForm, comment: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-[10px] text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  Submit Review
                </button>
                {revMsg && <p className="text-xs text-[var(--success)]">{revMsg}</p>}
              </form>
            </div>
          )}

          {activeTab === 'qa' && (
            <div className="space-y-3">
              {questions.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No customer questions yet.</p>
              ) : (
                questions.map((q) => (
                  <div key={q.id} className="p-3 rounded-xl bg-[var(--bg)] text-sm space-y-1">
                    <div className="font-bold text-[var(--ink)]">Q: {q.question}</div>
                    {q.answer && <div className="text-[var(--muted)]">A: {q.answer}</div>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--ink)]">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p, idx) => (
              <ProductCard key={p.id} product={p} listName="Related Products" index={idx} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
};
