import type { KeyboardEvent, ReactNode } from "react";
import { Home, LayoutGrid, MapPin, Moon, Search, ShoppingBag, Sun, UserRound } from "lucide-react";

type MobileView = "Главная" | "Каталог" | "Корзина" | "Профиль";
type MobileHomeSort = "deals" | "cheaper" | "popular";

type MobileShellProps = {
  children: ReactNode;
  activeView: string;
  searchValue: string;
  searchPlaceholder: string;
  cartCount: number;
  language: "ru" | "en" | "uz";
  languageLabel: string;
  locationLabel: string;
  locationPending: boolean;
  lightMode: boolean;
  themeLabel: string;
  homeSort: MobileHomeSort;
  onLocate: () => void;
  onToggleTheme: () => void;
  onHomeSortChange: (sort: MobileHomeSort) => void;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onNavigate: (view: MobileView) => void;
  onLanguageChange: (language: "ru" | "en" | "uz") => void;
};

const items = [
  { view: "Главная", label: { ru: "Главная", en: "Home", uz: "Bosh sahifa" }, Icon: Home },
  { view: "Каталог", label: { ru: "Каталог", en: "Catalog", uz: "Katalog" }, Icon: LayoutGrid },
  { view: "Корзина", label: { ru: "Корзина", en: "Cart", uz: "Savat" }, Icon: ShoppingBag },
  { view: "Профиль", label: { ru: "Профиль", en: "Profile", uz: "Profil" }, Icon: UserRound },
] as const;

function isActive(view: string, activeView: string): boolean {
  if (view === "Каталог") {
    return ["Каталог", "Категории", "Международный каталог", "Скидки"].includes(activeView);
  }
  return view === activeView;
}

/**
 * Independent mobile commerce frame: compact search header, page viewport and
 * fixed bottom navigation. It deliberately does not reuse the desktop header.
 */
export function MobileShell({
  children,
  activeView,
  searchValue,
  searchPlaceholder,
  cartCount,
  language,
  languageLabel,
  locationLabel,
  locationPending,
  lightMode,
  themeLabel,
  homeSort,
  onLocate,
  onToggleTheme,
  onHomeSortChange,
  onSearchChange,
  onSearchSubmit,
  onNavigate,
  onLanguageChange,
}: MobileShellProps) {
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearchSubmit();
    }
  };

  return (
    <div className="mobile-app-layout" data-app-layout="mobile">
      <header className="mobile-header">
        <div className="mobile-header-top">
          <button
            type="button"
            className="mobile-brand"
            aria-label="URIONA — главная"
            onClick={() => onNavigate("Главная")}
          >
            <span className="mobile-brand-mark">U</span>
            <span>URIONA</span>
          </button>
          <div className="mobile-header-actions">
            <button
              type="button"
              className="mobile-location"
              onClick={onLocate}
              disabled={locationPending}
              aria-label={locationLabel}
              title={locationLabel}
            >
              <MapPin size={16} />
            </button>
            <button type="button" className="mobile-theme" onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
              {lightMode ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
          <label className="mobile-language">
            <span className="visually-hidden">{languageLabel}</span>
            <select
              aria-label={languageLabel}
              value={language}
              onChange={(event) => onLanguageChange(event.target.value as "ru" | "en" | "uz")}
            >
              <option value="ru">RU</option>
              <option value="uz">UZ</option>
              <option value="en">EN</option>
            </select>
          </label>
        </div>

        <form
          className="mobile-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit();
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          <button type="submit" aria-label={searchPlaceholder}>
            <Search size={18} aria-hidden="true" />
          </button>
        </form>
      </header>

      {activeView === "Главная" && (
        <nav className="mobile-promo-tabs" aria-label="Предложения">
          {([
            ["deals", "Дни выгоды"],
            ["cheaper", "Сейчас дешевле"],
            ["popular", "Топ-товары"],
          ] as const).map(([sort, label]) => (
            <button
              key={sort}
              type="button"
              className={homeSort === sort ? "active" : ""}
              aria-pressed={homeSort === sort}
              onClick={() => onHomeSortChange(sort)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      <div className="mobile-page-content">{children}</div>

      <nav className="mobile-bottom-nav" aria-label="Основная навигация">
        {items.map(({ view, label, Icon }) => {
          const active = isActive(view, activeView);
          return (
            <button
              key={view}
              type="button"
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(view)}
            >
              <span className="mobile-nav-icon-wrap">
                <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
                {view === "Корзина" && cartCount > 0 && (
                  <span className="mobile-cart-badge">{cartCount > 99 ? "99+" : cartCount}</span>
                )}
              </span>
              <span>{label[language]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
