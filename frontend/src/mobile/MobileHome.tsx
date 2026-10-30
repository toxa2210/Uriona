import { ChevronLeft, ChevronRight, Heart, ShoppingBag, Sparkles } from "lucide-react";
import type { ApiCategory, ApiProduct } from "../api";
import { formatUzs } from "../api";

type MobileHomeCopy = {
  best: string;
  forYou: string;
  details: string;
  seeAll: string;
  discount: string;
  popular: string;
  newProduct: string;
  buy: string;
  loading: string;
  noGoods: string;
  retry: string;
  categories: string;
  allCategories: string;
  addedToFavorites: string;
  removeFromFavorites: string;
  sellerComingSoon: string;
  loadingMore: string;
  allLoaded: string;
};

type MobileHomeProps = {
  language: "ru" | "en" | "uz";
  products: ApiProduct[];
  heroProducts: ApiProduct[];
  heroSlide: number;
  liked: string[];
  categories: ApiCategory[];
  catalogLoading: boolean;
  catalogError: string;
  catalogMoreLoading: boolean;
  catalogMoreError: string;
  catalogHasMore: boolean;
  copy: MobileHomeCopy;
  productTitle: (product: Pick<ApiProduct, "titleRu" | "titleUz">) => string | null | undefined;
  categoryLabel: (category?: ApiCategory | null) => string | undefined;
  categoryPhoto: (category?: ApiCategory | null, index?: number) => string;
  onHeroChange: (index: number) => void;
  onOpenProduct: (product: ApiProduct) => void;
  onToggleFavorite: (productId: string) => void;
  onAddToCart: (productId: string) => void;
  onOpenCatalog: () => void;
  onSelectCategory: (categoryId: string) => void;
  onRetry: () => void;
  onRetryMore: () => void;
  sentinelRef: (node: HTMLDivElement | null) => void;
};

export function MobileHome({
  language,
  products,
  heroProducts,
  heroSlide,
  liked,
  categories,
  catalogLoading,
  catalogError,
  catalogMoreLoading,
  catalogMoreError,
  catalogHasMore,
  copy,
  productTitle,
  categoryLabel,
  categoryPhoto,
  onHeroChange,
  onOpenProduct,
  onToggleFavorite,
  onAddToCart,
  onOpenCatalog,
  onSelectCategory,
  onRetry,
  onRetryMore,
  sentinelRef,
}: MobileHomeProps) {
  const hero = heroProducts[heroSlide] ?? heroProducts[0];
  const tagFor = (product: ApiProduct) => product.status === "sale"
    ? copy.discount
    : product.status === "popular" ? copy.popular : copy.newProduct;

  return (
    <div className="mobile-home">
      <section className="mobile-home-hero" aria-label={copy.best}>
        {hero ? (
          <>
            <button
              type="button"
              className="mobile-home-hero-image"
              onClick={() => onOpenProduct(hero)}
              aria-label={copy.details + ": " + productTitle(hero)}
            >
              {hero.imageUrl && <img src={hero.imageUrl} alt={productTitle(hero) || ""} fetchPriority="high" decoding="async" referrerPolicy="no-referrer" />}
            </button>
            <div className="mobile-home-hero-shade" />
            <div className="mobile-home-hero-copy">
              <span className="mobile-home-kicker"><Sparkles size={13} /> URIONA · {copy.forYou}</span>
              <span className="mobile-home-hero-category">{categoryLabel(hero.category) || "URIONA"}</span>
              <h1>{productTitle(hero)}</h1>
              <strong>{formatUzs(hero.priceMinor)}</strong>
              <button type="button" onClick={() => onOpenProduct(hero)}>
                {copy.details}<ChevronRight size={16} />
              </button>
            </div>
            {heroProducts.length > 1 && (
              <div className="mobile-home-hero-controls">
                <button type="button" aria-label={language === "en" ? "Previous product" : language === "uz" ? "Oldingi mahsulot" : "Предыдущий товар"} onClick={() => onHeroChange((heroSlide - 1 + heroProducts.length) % heroProducts.length)}>
                  <ChevronLeft size={17} />
                </button>
                <div className="mobile-home-hero-dots">
                  {heroProducts.map((product, index) => (
                    <button key={product.id} type="button" className={index === heroSlide ? "active" : ""} aria-label={String(index + 1)} aria-current={index === heroSlide ? "true" : undefined} onClick={() => onHeroChange(index)} />
                  ))}
                </div>
                <button type="button" aria-label={language === "en" ? "Next product" : language === "uz" ? "Keyingi mahsulot" : "Следующий товар"} onClick={() => onHeroChange((heroSlide + 1) % heroProducts.length)}>
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mobile-home-hero-empty" role="status">
            <ShoppingBag size={30} />
            <span>{catalogLoading ? copy.loading : catalogError || copy.noGoods}</span>
            {catalogError && <button type="button" onClick={onRetry}>{copy.retry}</button>}
          </div>
        )}
      </section>

      {categories.length > 0 && (
        <section className="mobile-home-categories" aria-label={copy.categories}>
          <div className="mobile-home-section-heading">
            <h2>{copy.categories}</h2>
            <button type="button" onClick={onOpenCatalog}>{copy.allCategories}<ChevronRight size={15} /></button>
          </div>
          <div className="mobile-home-category-rail">
            {categories.slice(0, 10).map((category, index) => (
              <button type="button" className="mobile-home-category" key={category.id} onClick={() => onSelectCategory(category.id)}>
                <img src={categoryPhoto(category, index)} alt="" loading="lazy" />
                <span>{categoryLabel(category)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mobile-home-products">
        <div className="mobile-home-section-heading">
          <div>
            <span>{copy.best}</span>
            <h2>{copy.forYou}</h2>
          </div>
          <button type="button" onClick={onOpenCatalog}>{copy.seeAll}<ChevronRight size={15} /></button>
        </div>

        {catalogLoading && products.length === 0 ? (
          <div className="mobile-home-product-grid" role="status" aria-label={copy.loading}>
            {Array.from({ length: 6 }, (_, index) => <div className="mobile-home-product-skeleton" key={index} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="mobile-home-empty" role={catalogError ? "alert" : "status"}>
            <ShoppingBag size={28} />
            <p>{catalogError || copy.noGoods}</p>
            {catalogError && <button type="button" onClick={onRetry}>{copy.retry}</button>}
          </div>
        ) : (
          <div className="mobile-home-product-grid">
            {products.map((product) => {
              const isLiked = liked.includes(product.id);
              const isSellerProduct = Boolean(product.sellerId);
              return (
                <article className="mobile-home-product-card" key={product.id}>
                  <div className="mobile-home-product-media">
                    <button type="button" className="mobile-home-product-image" onClick={() => onOpenProduct(product)} aria-label={copy.details + ": " + productTitle(product)}>
                      {product.imageUrl
                        ? <img src={product.imageUrl} alt={productTitle(product) || ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                        : <ShoppingBag size={30} />}
                    </button>
                    <span className={product.status === "sale" ? "mobile-home-product-tag sale" : "mobile-home-product-tag"}>{tagFor(product)}</span>
                    <button type="button" className={isLiked ? "mobile-home-favorite active" : "mobile-home-favorite"} onClick={() => onToggleFavorite(product.id)} aria-label={isLiked ? copy.removeFromFavorites : copy.addedToFavorites} aria-pressed={isLiked}>
                      <Heart size={17} fill={isLiked ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <div className="mobile-home-product-info">
                    <span className="mobile-home-product-category">{categoryLabel(product.category) || "URIONA"}</span>
                    <button type="button" className="mobile-home-product-title" onClick={() => onOpenProduct(product)}>{productTitle(product)}</button>
                    <strong className="mobile-home-product-price">{formatUzs(product.priceMinor)}</strong>
                    <button type="button" className="mobile-home-add" onClick={() => isSellerProduct ? onOpenProduct(product) : onAddToCart(product.id)}>
                      <ShoppingBag size={15} />{isSellerProduct ? copy.details : copy.buy}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div ref={sentinelRef} className="mobile-home-infinite-sentinel" aria-hidden="true" />
        {catalogMoreLoading && <p className="mobile-home-load-note" role="status">{copy.loadingMore}</p>}
        {catalogMoreError && <div className="mobile-home-load-error" role="alert"><span>{catalogMoreError}</span><button type="button" onClick={onRetryMore}>{copy.retry}</button></div>}
        {!catalogHasMore && products.length > 0 && <p className="mobile-home-load-note">{copy.allLoaded}</p>}
      </section>
    </div>
  );
}
