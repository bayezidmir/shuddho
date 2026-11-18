import React from 'react';
import { ShoppingCart, Star, Heart } from 'lucide-react';
import type { Product } from '../../types';
import { useStore, toGA4Item } from '../../context/StoreContext';
import { formatBDT, toBanglaDigits } from '../../lib/bd-validation';
import { t } from '../../lib/i18n';
import { trackSelectItem, trackAddToWishlist } from '../../lib/datalayer';

export const ProductCard: React.FC<{ product: Product; listName?: string; index?: number }> = ({
  product,
  listName = 'Catalog',
  index = 0,
}) => {
  const { lang, addToCart, navigate, wishlist, toggleWishlist, bootstrap } = useStore();
  const defaultVariant = product.variants?.length > 0 ? product.variants[0] : null;
  const displayPrice = defaultVariant ? defaultVariant.price : product.price;
  const displayRegular = defaultVariant ? defaultVariant.regular_price : product.regular_price;
  const displayStock = defaultVariant ? defaultVariant.stock : product.stock;
  const discountPct = displayRegular > displayPrice
    ? Math.round(((displayRegular - displayPrice) / displayRegular) * 100)
    : 0;
  const isWished = wishlist.includes(product.id);
  const showRating = bootstrap?.theme?.showRatingOnCard !== false;
  const showOrderNow = product.order_now_enabled && bootstrap?.theme?.showOrderNowOnCard !== false;

  const sizeLabel = defaultVariant ? defaultVariant.label : `${product.weight_grams} g`;
  const catName = product.category
    ? lang === 'bn'
      ? product.category.name_bn
      : product.category.name_en
    : 'Natural Food';

  const openDetail = () => {
    trackSelectItem(listName, toGA4Item(product, defaultVariant, 1, index));
    navigate(`/products/${product.slug}`);
  };

  return (
    <article
      className="group flex flex-col rounded-[18px] border overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--line)' }}
    >
      {/* Square image on --image-bg */}
      <div
        className="relative aspect-square w-full overflow-hidden cursor-pointer"
        style={{ backgroundColor: 'var(--image-bg)' }}
        onClick={openDetail}
      >
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={lang === 'bn' ? product.name_bn : product.name_en}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-[var(--muted)] p-4 text-center">
            {product.name_en}
          </div>
        )}

        {/* Discount & low stock badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {discountPct > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white tabular-nums"
              style={{ backgroundColor: 'var(--sale)' }}
            >
              −{lang === 'bn' ? toBanglaDigits(discountPct) : discountPct}%
            </span>
          )}
          {displayStock > 0 && displayStock <= product.low_stock_threshold && (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
              style={{ backgroundColor: 'var(--chip-bg)', color: 'var(--chip-fg)' }}
            >
              {t('onlyLeft', lang, { n: lang === 'bn' ? toBanglaDigits(displayStock) : displayStock })}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
            if (!isWished) trackAddToWishlist(toGA4Item(product, defaultVariant, 1, index));
          }}
          aria-label={isWished ? `Remove ${product.name_en} from wishlist` : `Save ${product.name_en} to wishlist`}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 dark:bg-black/50 flex items-center justify-center text-[var(--ink)] hover:scale-105 transition"
        >
          <Heart className={`w-4 h-4 ${isWished ? 'fill-[var(--accent)] text-[var(--accent)]' : ''}`} />
        </button>
      </div>

      {/* Card Body */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1 gap-1.5">
        <div className="text-[12px] text-[var(--muted)] truncate">
          <span>{catName}</span>
          <span className="mx-1.5" aria-hidden="true">·</span>
          <span>{sizeLabel}</span>
        </div>

        <h3 className="text-[15px] sm:text-[16px] font-semibold text-[var(--ink)] leading-snug line-clamp-2">
          <a
            href={`/products/${product.slug}`}
            onClick={(e) => {
              e.preventDefault();
              openDetail();
            }}
            className="hover:text-[var(--primary)] transition-colors"
          >
            {lang === 'bn' ? product.name_bn : product.name_en}
          </a>
        </h3>

        {showRating && (
          <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-[var(--ink)] tabular-nums">{product.rating_avg.toFixed(1)}</span>
            <span className="tabular-nums">({product.review_count})</span>
          </div>
        )}

        <div className="mt-auto pt-2 flex items-baseline gap-2">
          <span className="text-[17px] font-bold text-[var(--ink)] tabular-nums">
            {formatBDT(displayPrice, lang)}
          </span>
          {displayRegular > displayPrice && (
            <span className="text-xs text-[var(--muted)] line-through tabular-nums">
              {formatBDT(displayRegular, lang)}
            </span>
          )}
        </div>

        {/* Action Row: Full-width Order now + Icon Add to cart */}
        <div className="pt-2 flex items-center gap-2">
          {showOrderNow ? (
            <button
              type="button"
              disabled={displayStock <= 0}
              onClick={() => {
                addToCart(product, defaultVariant, 1, false);
                navigate('/checkout');
              }}
              className="flex-1 py-2.5 px-3 rounded-[12px] text-xs sm:text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {displayStock <= 0 ? t('outOfStock', lang) : t('orderNow', lang)}
            </button>
          ) : null}
          <button
            type="button"
            disabled={displayStock <= 0}
            aria-label={`Add ${product.name_en} to cart`}
            onClick={() => addToCart(product, defaultVariant, 1, true)}
            className={`${showOrderNow ? 'w-10 shrink-0' : 'flex-1 px-3'} h-10 rounded-[12px] border flex items-center justify-center gap-2 text-sm font-semibold transition hover:bg-[var(--bg)] disabled:opacity-50`}
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            <ShoppingCart className="w-4 h-4" />
            {!showOrderNow && <span>{t('addToCart', lang)}</span>}
          </button>
        </div>
      </div>
    </article>
  );
};
