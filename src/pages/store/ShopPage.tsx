import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, LayoutGrid, List } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../../components/store/ProductCard';
import { formatBDT } from '../../lib/bd-validation';

export const ShopPage: React.FC<{ categorySlug?: string }> = ({ categorySlug }) => {
  const { bootstrap, lang, navigate, currentPath } = useStore();
  const params = new URLSearchParams(currentPath.split('?')[1] || '');
  const initialQuery = params.get('q') || '';

  const [selectedCat, setSelectedCat] = useState(categorySlug || 'all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [maxPrice, setMaxPrice] = useState(3000);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'price_asc' | 'price_desc'>('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const activeCategory = bootstrap?.categories.find((c) => c.slug === (categorySlug || selectedCat));

  const filtered = useMemo(() => {
    if (!bootstrap) return [];
    let list = [...bootstrap.products];

    const catSlug = categorySlug || (selectedCat !== 'all' ? selectedCat : '');
    if (catSlug) {
      list = list.filter((p) => p.category?.slug === catSlug);
    }
    if (selectedBrand !== 'all') {
      list = list.filter((p) => p.brand?.slug === selectedBrand);
    }
    if (initialQuery) {
      const q = initialQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name_en.toLowerCase().includes(q) ||
          p.name_bn.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.tags.some((tg) => tg.toLowerCase().includes(q)),
      );
    }
    list = list.filter((p) => p.price <= maxPrice);
    if (inStockOnly) list = list.filter((p) => p.stock > 0);
    if (onSaleOnly) list = list.filter((p) => p.regular_price > p.price);

    if (sortBy === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') list.sort((a, b) => b.price - a.price);
    else if (sortBy === 'popular') list.sort((a, b) => b.review_count - a.review_count);

    return list;
  }, [bootstrap, categorySlug, selectedCat, selectedBrand, initialQuery, maxPrice, inStockOnly, onSaleOnly, sortBy]);

  if (!bootstrap) return null;

  return (
    <main className="max-w-[1240px] mx-auto px-4 py-6 space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-[var(--muted)] flex items-center gap-2">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="hover:text-[var(--primary)]">
          Home
        </a>
        <span>/</span>
        <span className="text-[var(--ink)] font-medium">
          {activeCategory ? (lang === 'bn' ? activeCategory.name_bn : activeCategory.name_en) : initialQuery ? `Search: "${initialQuery}"` : 'All Pure Foods'}
        </span>
      </nav>

      {/* Header Banner */}
      <div
        className="rounded-[18px] border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            {activeCategory
              ? lang === 'bn'
                ? activeCategory.name_bn
                : activeCategory.name_en
              : initialQuery
                ? `Results for "${initialQuery}"`
                : lang === 'bn'
                  ? 'সকল খাঁটি পণ্য'
                  : 'All Pure Bangladeshi Foods'}
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {activeCategory
              ? lang === 'bn'
                ? activeCategory.description_bn
                : activeCategory.description_en
              : `${filtered.length} lab-tested products available for 24–72h nationwide delivery.`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            aria-label="Sort products"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-[10px] border border-[var(--line)] text-xs font-medium bg-[var(--bg)] text-[var(--ink)]"
          >
            <option value="popular">Sort: Popular</option>
            <option value="newest">Sort: Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
          <button
            type="button"
            aria-label="Grid view"
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-[10px] border ${viewMode === 'grid' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--line)]'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="List view"
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-[10px] border ${viewMode === 'list' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--line)]'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Filter Sidebar */}
        <aside
          className="lg:col-span-3 rounded-[18px] border p-5 space-y-5"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
        >
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--ink)]">
            <SlidersHorizontal className="w-4 h-4 text-[var(--primary)]" />
            <span>Filters</span>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--muted)] uppercase">Category</div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => { setSelectedCat('all'); navigate('/shop'); }}
                className={`text-left px-3 py-1.5 rounded-lg text-sm ${!categorySlug && selectedCat === 'all' ? 'bg-[var(--primary)] text-white font-semibold' : 'hover:bg-[var(--bg)] text-[var(--ink)]'}`}
              >
                All Categories
              </button>
              {bootstrap.categories.map((c) => {
                const active = (categorySlug || selectedCat) === c.slug;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedCat(c.slug); navigate(`/category/${c.slug}`); }}
                    className={`text-left px-3 py-1.5 rounded-lg text-sm ${active ? 'bg-[var(--primary)] text-white font-semibold' : 'hover:bg-[var(--bg)] text-[var(--ink)]'}`}
                  >
                    {lang === 'bn' ? c.name_bn : c.name_en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-[var(--muted)]">
              <span>MAX PRICE</span>
              <span className="tabular-nums text-[var(--ink)]">{formatBDT(maxPrice, lang)}</span>
            </div>
            <input
              type="range"
              min={200}
              max={3000}
              step={50}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--muted)] uppercase">Brand</div>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-3 py-2 rounded-[10px] border border-[var(--line)] text-sm bg-[var(--bg)] text-[var(--ink)]"
            >
              <option value="all">All Brands</option>
              {bootstrap.brands.map((b) => (
                <option key={b.id} value={b.slug}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 pt-1 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              <span>In stock only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={onSaleOnly} onChange={(e) => setOnSaleOnly(e.target.checked)} />
              <span>On sale</span>
            </label>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9">
          {filtered.length === 0 ? (
            <div
              className="rounded-[18px] border p-12 text-center space-y-3"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
            >
              <h2 className="text-lg font-bold text-[var(--ink)]">No matching products found</h2>
              <p className="text-sm text-[var(--muted)]">Try clearing filters or searching for honey, ghee, oil, or dates.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCat('all');
                  setSelectedBrand('all');
                  setMaxPrice(3000);
                  setInStockOnly(false);
                  setOnSaleOnly(false);
                  navigate('/shop');
                }}
                className="px-5 py-2.5 rounded-[12px] text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Reset Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map((p, idx) => (
                <ProductCard key={p.id} product={p} listName="Shop Grid" index={idx} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="rounded-[18px] border p-4 flex flex-col sm:flex-row gap-4 items-center"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
                >
                  <img
                    src={p.images[0]}
                    alt={p.name_en}
                    className="w-28 h-28 rounded-[14px] object-cover bg-[var(--image-bg)] shrink-0 cursor-pointer"
                    onClick={() => navigate(`/products/${p.slug}`)}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-xs text-[var(--muted)]">{p.category?.name_en} · {p.sku}</div>
                    <h3 className="text-lg font-bold text-[var(--ink)] cursor-pointer hover:text-[var(--primary)]" onClick={() => navigate(`/products/${p.slug}`)}>
                      {lang === 'bn' ? p.name_bn : p.name_en}
                    </h3>
                    <p className="text-sm text-[var(--muted)] line-clamp-2">{lang === 'bn' ? p.short_desc_bn : p.short_desc_en}</p>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
                    <div className="text-xl font-bold text-[var(--ink)] tabular-nums">{formatBDT(p.price, lang)}</div>
                    <button
                      type="button"
                      onClick={() => navigate(`/products/${p.slug}`)}
                      className="px-4 py-2 rounded-[12px] text-sm font-semibold text-white"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      View Product
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
