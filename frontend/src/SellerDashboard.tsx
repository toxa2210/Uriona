import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Archive, ArrowDown, ArrowUp, ImagePlus, Plus, Save, Store, Trash2, Upload, X, Package, BarChart3, RefreshCw } from "lucide-react";
import { ApiRequestError, api, formatUzs, type ApiCategory, type ApiProduct, type ApiShippingBranch } from "./api";
import "./SellerDashboard.css";

interface SellerDashboardProps {
  token: string;
  onClose: () => void;
}

interface SellerDraft {
  id: string;
  titleUz: string;
  titleRu: string;
  descriptionUz: string;
  descriptionRu: string;
  categoryId: string;
  priceUzs: string;
  stock: string;
  discountPercent: string;
  city: string;
  district: string;
  pickupMethod: string;
  shippingCarrier: "EMU_EXPRESS" | "UZPOST";
  shippingPayer: "SENDER" | "RECIPIENT";
  dispatchBranchId: string;
  dispatchPointName: string;
  dispatchPointAddress: string;
  photos: string[];
  attributes: Record<string, string>;
  variants: string;
  publicationRulesAccepted: boolean;
  restrictedGoodsConfirmed: boolean;
}

const emptyDraft = (): SellerDraft => ({
  id: "", titleUz: "", titleRu: "", descriptionUz: "", descriptionRu: "", categoryId: "",
  priceUzs: "", stock: "1", discountPercent: "", city: "", district: "", pickupMethod: "SELLER_DELIVERY",
  shippingCarrier: "EMU_EXPRESS", shippingPayer: "RECIPIENT", dispatchBranchId: "", dispatchPointName: "", dispatchPointAddress: "",
  photos: [], attributes: {}, variants: "", publicationRulesAccepted: false, restrictedGoodsConfirmed: false,
});

function draftFromProduct(product: ApiProduct): SellerDraft {
  return {
    ...emptyDraft(), id: product.id, titleUz: product.titleUz, titleRu: product.titleRu ?? "",
    descriptionUz: product.descriptionUz ?? "", descriptionRu: product.descriptionRu ?? "",
    categoryId: product.categoryId ?? "", priceUzs: String(Math.round(product.priceMinor / 100)),
    stock: String(product.stock ?? 1), discountPercent: product.discountPercent ? String(product.discountPercent) : "",
    city: product.sellerCity ?? "", district: product.sellerDistrict ?? "", pickupMethod: product.pickupMethod ?? "SELLER_DELIVERY",
    shippingCarrier: product.shippingCarrier ?? "EMU_EXPRESS", shippingPayer: product.shippingPayer ?? "RECIPIENT",
    dispatchBranchId: product.dispatchBranchId ?? "", dispatchPointName: product.dispatchPointName ?? "", dispatchPointAddress: product.dispatchPointAddress ?? "",
    photos: product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [],
    attributes: product.attributes && typeof product.attributes === "object" ? product.attributes : {},
    variants: (product.variants ?? []).map((variant) => `${variant.label}|${variant.stock}`).join("\n"),
    publicationRulesAccepted: Boolean(product.id), restrictedGoodsConfirmed: Boolean(product.id),
  };
}

function productToPayload(draft: SellerDraft, publish: boolean) {
  const variants = draft.variants.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label, stock] = line.split("|");
    return { label: label.trim(), stock: Math.max(0, Number(stock) || 0) };
  });
  return {
    ...(draft.id ? { id: draft.id } : {}), categoryId: draft.categoryId || null,
    titleUz: draft.titleUz.trim(), titleRu: draft.titleRu.trim() || undefined,
    descriptionUz: draft.descriptionUz.trim() || undefined, descriptionRu: draft.descriptionRu.trim() || undefined,
    currency: "UZS", priceMinor: Math.round(Number(draft.priceUzs) * 100), imageUrls: draft.photos,
    imageUrl: draft.photos[0], attributes: draft.attributes, variants,
    stock: Math.max(1, Number(draft.stock) || 1),
    ...(draft.discountPercent ? { discountPercent: Number(draft.discountPercent) } : {}),
    sellerCity: draft.city.trim(), sellerDistrict: draft.district.trim() || undefined,
    pickupMethod: draft.pickupMethod, shippingCarrier: draft.shippingCarrier, shippingPayer: draft.shippingPayer,
    dispatchBranchId: draft.dispatchBranchId || undefined,
    dispatchPointName: draft.dispatchPointName || undefined,
    dispatchPointAddress: draft.dispatchPointAddress || undefined,
    status: publish ? "PENDING_REVIEW" as const : "DRAFT" as const,
    publicationRulesAccepted: draft.publicationRulesAccepted,
    restrictedGoodsConfirmed: draft.restrictedGoodsConfirmed,
  };
}

type SellerTab = "publish" | "products" | "analytics";
const SELLER_TAB_STORAGE_KEY = "uriona-seller-active-tab";
function readStoredSellerTab(): SellerTab {
  const stored = localStorage.getItem(SELLER_TAB_STORAGE_KEY);
  return stored === "products" || stored === "analytics" ? stored : "publish";
}

export function SellerDashboard({ token, onClose }: SellerDashboardProps) {
  const [activeTab, setActiveTab] = useState<SellerTab>(readStoredSellerTab);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [billing, setBilling] = useState<{ orderItems: number; grossMinor: number; awaitingPaymentMinor: number; confirmedSalesMinor: number; deliveredSalesMinor: number; currency: string } | null>(null);
  const [financialActions, setFinancialActions] = useState<Array<{ id: string; type: string; status: string; amountMinor: number; currency: string; description: string; reviewNote?: string | null; createdAt: string }>>([]);
  const [shippingBranches, setShippingBranches] = useState<ApiShippingBranch[]>([]);
  const [shippingBranchesState, setShippingBranchesState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [draft, setDraft] = useState<SellerDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutDescription, setPayoutDescription] = useState("");
  const [payoutBusy, setPayoutBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      api.seller.products(token), api.categories(), api.seller.billing(token), api.seller.financialActions(token),
    ]);
    const failures: string[] = [];
    const failureMessage = (reason: unknown, fallback: string) => reason instanceof ApiRequestError ? reason.message : fallback;
    if (results[0].status === "fulfilled") setProducts(results[0].value);
    else failures.push(failureMessage(results[0].reason, "Не удалось загрузить товары."));
    if (results[1].status === "fulfilled") setCategories(results[1].value);
    else failures.push(failureMessage(results[1].reason, "Не удалось загрузить категории."));
    if (results[2].status === "fulfilled") setBilling(results[2].value);
    else failures.push(failureMessage(results[2].reason, "Не удалось загрузить баланс."));
    if (results[3].status === "fulfilled") setFinancialActions(results[3].value);
    else failures.push("История финансовых операций временно недоступна.");
    setError(failures.join(" "));
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    setShippingBranchesState("loading");
    void api.shippingBranches(draft.shippingCarrier).then((branches) => {
      if (!active) return;
      setShippingBranches(branches);
      setShippingBranchesState(branches.length ? "ready" : "empty");
    }).catch(() => {
      if (!active) return;
      setShippingBranches([]);
      setShippingBranchesState("error");
    });
    return () => { active = false; };
  }, [draft.shippingCarrier]);

  useEffect(() => { void refresh(); }, [token]);

  useEffect(() => { localStorage.setItem(SELLER_TAB_STORAGE_KEY, activeTab); }, [activeTab]);

  const selectedCategory = categories.find((category) => category.id === draft.categoryId);
  const categoryFields = Object.entries(selectedCategory?.attributes ?? {});
  const subcategories = categories.filter((category) => category.parentId === draft.categoryId);
  const topCategories = categories.filter((category) => !category.parentId);

  const uploadPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (draft.photos.length + files.length > 10) {
      setError("Можно добавить не более 10 фотографий.");
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    const uploadedUrls: string[] = [];
    const failedFiles: string[] = [];
    try {
      for (const file of files) {
        try {
          const upload = await api.seller.uploadImage(token, file);
          uploadedUrls.push(upload.imageUrl);
        } catch (reason) {
          const message = reason instanceof Error ? reason.message : "ошибка загрузки";
          failedFiles.push(`${file.name}: ${message}`);
        }
      }
      if (uploadedUrls.length) {
        setDraft((current) => ({ ...current, photos: [...current.photos, ...uploadedUrls] }));
        setNotice(`Загружено фотографий: ${uploadedUrls.length}.`);
      }
      if (failedFiles.length) setError(`Не удалось загрузить: ${failedFiles.join("; ")}`);
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>, publish: boolean) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const previousProduct = products.find((product) => product.id === draft.id);
      const previousPhotos = previousProduct?.imageUrls?.length ? previousProduct.imageUrls : previousProduct?.imageUrl ? [previousProduct.imageUrl] : [];
      const saved = await api.seller.saveProduct(token, productToPayload(draft, publish));
      setProducts((current) => [saved, ...current.filter((product) => product.id !== saved.id)]);
      await Promise.allSettled(previousPhotos.filter((url) => !draft.photos.includes(url)).map((url) => api.seller.deleteImage(token, url)));
      setDraft(emptyDraft());
      setNotice(publish ? "Товар отправлен на модерацию." : "Черновик сохранён.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить товар.");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (product: ApiProduct) => {
    try {
      await api.seller.archiveProduct(token, product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setNotice("Объявление перемещено в архив.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось архивировать товар.");
    }
  };

  const requestPayout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPayoutBusy(true);
    setError("");
    try {
      await api.seller.requestFinancialAction(token, { type: "PAYOUT", amountMinor: Math.round(Number(payoutAmount) * 100), description: payoutDescription.trim() });
      setFinancialActions(await api.seller.financialActions(token));
      setPayoutAmount("");
      setPayoutDescription("");
      setNotice("Запрос выплаты отправлен администратору на подтверждение.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить запрос выплаты.");
    } finally {
      setPayoutBusy(false);
    }
  };

  const removePhoto = (index: number) => {
    const imageUrl = draft.photos[index];
    setDraft((current) => ({ ...current, photos: current.photos.filter((_, currentIndex) => currentIndex !== index) }));
    const savedProduct = products.find((product) => product.id === draft.id);
    const savedPhotos = savedProduct?.imageUrls?.length ? savedProduct.imageUrls : savedProduct?.imageUrl ? [savedProduct.imageUrl] : [];
    if (!savedPhotos.includes(imageUrl)) {
      void api.seller.deleteImage(token, imageUrl).catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось удалить фотографию."));
    }
  };

  return (
    <section className="seller-dashboard seller-workspace screen-panel" role="dialog" aria-modal="true" aria-label="Кабинет продавца">
      <header className="seller-dashboard-heading"><div><small>URIONA / МАГАЗИН</small><h2><Store size={23} /> Кабинет продавца</h2><span className="seller-condition">Управление вашим магазином</span></div><div className="seller-workspace-header-actions"><button type="button" className="seller-workspace-refresh" onClick={() => void refresh()} disabled={loading} aria-label="Обновить данные продавца"><RefreshCw size={17} className={loading ? "seller-refresh-spinning" : ""} /><span>{loading ? "Обновляем…" : "Обновить"}</span></button><button type="button" className="seller-workspace-close" onClick={onClose} aria-label="Закрыть кабинет"><X size={20} /><span>Закрыть</span></button></div></header>
      <nav className="seller-workspace-tabs" aria-label="Разделы кабинета продавца">
        <button type="button" className={activeTab === "publish" ? "active" : ""} aria-pressed={activeTab === "publish"} onClick={() => setActiveTab("publish")}><Plus size={17} />Опубликовать товар</button>
        <button type="button" className={activeTab === "products" ? "active" : ""} aria-pressed={activeTab === "products"} onClick={() => setActiveTab("products")}><Package size={17} />Мои товары <span>{products.length}</span></button>
        <button type="button" className={activeTab === "analytics" ? "active" : ""} aria-pressed={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}><BarChart3 size={17} />Аналитика</button>
      </nav>
      <div className="seller-dashboard-layout">
        <aside className={`seller-product-list ${activeTab !== "products" ? "seller-tab-hidden" : ""}`}>
          <div className="seller-list-heading"><h3>Мои товары</h3><button type="button" className="icon-btn" title="Новый товар" onClick={() => setDraft(emptyDraft())}><Plus size={18} /></button></div>
          {loading ? <p>Загрузка…</p> : products.length ? products.map((product) => <button type="button" className="seller-product-row" key={product.id} onClick={() => { setDraft(draftFromProduct(product)); setActiveTab("publish"); }}>
            <img src={product.imageUrl ?? ""} alt="" /><span><b>{product.titleRu || product.titleUz}</b><small>{product.status === "ACTIVE" ? "Опубликован" : product.status === "PENDING_REVIEW" ? "На модерации" : "Черновик"} · {formatUzs(product.priceMinor)}</small>{product.moderationNote && <small className="seller-review-note">Замечание: {product.moderationNote}</small>}</span>
          </button>) : <p className="seller-empty">Пока нет товаров</p>}
        </aside>
        <form className={`seller-product-form ${activeTab !== "publish" ? "seller-tab-hidden" : ""}`} onSubmit={(event) => void save(event, false)}>
          <div className="seller-form-heading"><h3>{draft.id ? "Редактировать товар" : "Новый товар"}</h3><span>Состояние: новый</span></div>
          <div className="seller-form-grid">
            <label>Название товара<input required maxLength={200} value={draft.titleRu} onChange={(event) => setDraft({ ...draft, titleRu: event.target.value, titleUz: draft.titleUz || event.target.value })} /></label>
            <label>Название на узбекском<input required maxLength={200} value={draft.titleUz} onChange={(event) => setDraft({ ...draft, titleUz: event.target.value })} /></label>
            <label>Категория<select required value={topCategories.some((category) => category.id === draft.categoryId) ? draft.categoryId : categories.find((category) => category.id === draft.categoryId)?.parentId ?? ""} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value, attributes: {} })}><option value="">{categories.length ? "Выберите категорию" : "Категории пока недоступны"}</option>{topCategories.map((category) => <option key={category.id} value={category.id}>{category.nameRu}</option>)}</select></label>
            <label>Подкатегория<select value={subcategories.some((category) => category.id === draft.categoryId) ? draft.categoryId : ""} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value || draft.categoryId, attributes: {} })} disabled={!subcategories.length}><option value="">Без подкатегории</option>{subcategories.map((category) => <option key={category.id} value={category.id}>{category.nameRu}</option>)}</select></label>
            <label>Цена, UZS<input required type="number" min="1" step="100" value={draft.priceUzs} onChange={(event) => setDraft({ ...draft, priceUzs: event.target.value })} /></label>
            <label>Наличие, шт.<input required type="number" min="1" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} /></label>
            <label>Скидка, % <span>(необязательно)</span><input type="number" min="1" max="90" value={draft.discountPercent} onChange={(event) => setDraft({ ...draft, discountPercent: event.target.value })} /></label>
            <label>Город или область<input required maxLength={120} value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></label>
            <label>Район <span>(необязательно)</span><input maxLength={120} value={draft.district} onChange={(event) => setDraft({ ...draft, district: event.target.value })} /></label>
            <label>Получение товара<select value={draft.pickupMethod} onChange={(event) => setDraft({ ...draft, pickupMethod: event.target.value })}><option value="PICKUP">Самовывоз</option><option value="SELLER_DELIVERY">Доставка продавцом</option><option value="URIONA_PARTNER">Партнёр Uriona</option><option value="OTHER">Другой способ</option></select></label>
            <label>Почтовая служба<select value={draft.shippingCarrier} onChange={(event) => setDraft({ ...draft, shippingCarrier: event.target.value as "EMU_EXPRESS" | "UZPOST", dispatchBranchId: "", dispatchPointName: "", dispatchPointAddress: "" })}><option value="EMU_EXPRESS">EMU Express</option><option value="UZPOST">UzPost</option></select></label>
            <label>Кто оплачивает доставку<select value={draft.shippingPayer} onChange={(event) => setDraft({ ...draft, shippingPayer: event.target.value as "SENDER" | "RECIPIENT" })}><option value="SENDER">Отправитель</option><option value="RECIPIENT">Получатель</option></select></label>
            {draft.shippingCarrier === "EMU_EXPRESS" ? <label>Пункт отправки<select value={draft.dispatchBranchId} onChange={(event) => setDraft({ ...draft, dispatchBranchId: event.target.value })}><option value="">{shippingBranchesState === "loading" ? "Загружаем филиалы…" : shippingBranchesState === "error" ? "Не удалось загрузить филиалы" : shippingBranchesState === "empty" ? "Филиалы EMU не добавлены" : "Выберите филиал EMU"}</option>{shippingBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.region} / {branch.locality} / {branch.name}</option>)}</select></label> : <><label>Название отделения UzPost<input value={draft.dispatchPointName} onChange={(event) => setDraft({ ...draft, dispatchPointName: event.target.value })} placeholder="Отделение UzPost" /></label><label>Адрес отделения UzPost<input value={draft.dispatchPointAddress} onChange={(event) => setDraft({ ...draft, dispatchPointAddress: event.target.value })} placeholder="Адрес отделения" /></label></>}
          </div>
          {categoryFields.length > 0 && <fieldset className="seller-attributes"><legend>Характеристики · {selectedCategory?.nameRu}</legend><div className="seller-form-grid">{categoryFields.map(([key, label]) => <label key={key}>{label}<input value={draft.attributes[key] ?? ""} onChange={(event) => setDraft({ ...draft, attributes: { ...draft.attributes, [key]: event.target.value } })} /></label>)}</div></fieldset>}
          <label className="seller-description">Описание<textarea required maxLength={5000} rows={4} value={draft.descriptionRu} onChange={(event) => setDraft({ ...draft, descriptionRu: event.target.value, descriptionUz: draft.descriptionUz || event.target.value })} /></label>
          <label className="seller-description">Варианты размера, цвета или комплектации <span>(необязательно, по одному на строку: Название|Количество)</span><textarea rows={2} value={draft.variants} onChange={(event) => setDraft({ ...draft, variants: event.target.value })} placeholder="Чёрный, 128 ГБ|3" /></label>
          <div className="seller-photos-heading"><div><h4>Фотографии</h4><span>Минимум 1 · рекомендуется 3–5</span></div><label className="seller-upload-button"><ImagePlus size={17} />{uploading ? "Загружаем…" : "Добавить"}<input type="file" accept="image/*" multiple hidden onChange={(event) => void uploadPhotos(event)} disabled={uploading || draft.photos.length >= 10} /></label></div>
          <div className="seller-photo-grid">{draft.photos.map((url, index) => <figure key={`${url}-${index}`} className={index === 0 ? "main-photo" : ""}><img src={url} alt={`Фото товара ${index + 1}`} /><figcaption>{index === 0 ? "Главное фото" : `Фото ${index + 1}`}</figcaption><div><button type="button" title="Переместить выше / сделать главным" disabled={index === 0} onClick={() => setDraft({ ...draft, photos: draft.photos.map((item, current) => current === index - 1 ? url : current === index ? draft.photos[index - 1] : item) })}><ArrowUp size={15} /></button><button type="button" title="Переместить ниже" disabled={index === draft.photos.length - 1} onClick={() => setDraft({ ...draft, photos: draft.photos.map((item, current) => current === index + 1 ? url : current === index ? draft.photos[index + 1] : item) })}><ArrowDown size={15} /></button><label title="Заменить фото"><Upload size={15} /><input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const replacement = event.target.files?.[0]; if (!replacement) return; void api.seller.uploadImage(token, replacement).then(({ imageUrl }) => setDraft((current) => ({ ...current, photos: current.photos.map((photo, currentIndex) => currentIndex === index ? imageUrl : photo) }))).catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось заменить фото.")); event.target.value = ""; }} /></label><button type="button" title="Удалить фото" onClick={() => removePhoto(index)}><Trash2 size={15} /></button></div></figure>)}</div>
          <div className="seller-confirmations"><label><input type="checkbox" checked={draft.publicationRulesAccepted} onChange={(event) => setDraft({ ...draft, publicationRulesAccepted: event.target.checked })} />Подтверждаю соответствие информации товару и правилам Uriona.</label><label><input type="checkbox" checked={draft.restrictedGoodsConfirmed} onChange={(event) => setDraft({ ...draft, restrictedGoodsConfirmed: event.target.checked })} />Подтверждаю, что товар разрешён к продаже.</label></div>
          {error && <p className="seller-error" role="alert">{error}</p>}{notice && <p className="seller-notice" role="status">{notice}</p>}
          <footer className="seller-form-actions"><button type="submit" disabled={saving || uploading}><Save size={16} />Сохранить черновик</button><button type="button" disabled={saving || uploading || !draft.photos.length || !draft.city || !draft.publicationRulesAccepted || !draft.restrictedGoodsConfirmed} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) void save({ preventDefault: () => undefined } as FormEvent<HTMLFormElement>, true); }}><Store size={16} />Отправить на модерацию</button>{draft.id && <button type="button" className="seller-archive-button" onClick={() => { const product = products.find((item) => item.id === draft.id); if (product) void archive(product); setDraft(emptyDraft()); }}><Archive size={16} />В архив</button>}</footer>
        </form>
      </div>
      <section className={`seller-billing ${activeTab !== "analytics" ? "seller-tab-hidden" : ""}`} aria-labelledby="seller-billing-title"><div className="seller-list-heading"><div><small>Заказы только по вашим товарам</small><h3 id="seller-billing-title">Продажи и биллинг</h3></div></div><div className="seller-billing-grid"><div><span>Всего заказано</span><strong>{billing ? formatUzs(billing.grossMinor) : "—"}</strong><small>{billing?.orderItems ?? 0} позиций</small></div><div><span>Ожидает оплаты</span><strong>{billing ? formatUzs(billing.awaitingPaymentMinor) : "—"}</strong></div><div><span>Подтверждённые продажи</span><strong>{billing ? formatUzs(billing.confirmedSalesMinor) : "—"}</strong></div><div><span>Доставлено</span><strong>{billing ? formatUzs(billing.deliveredSalesMinor) : "—"}</strong></div></div><p>Запрос выплаты уйдёт администратору на подтверждение; перевод денег автоматически не выполняется.</p><form className="seller-payout-request" onSubmit={(event) => void requestPayout(event)}><label>Запросить выплату, UZS<input type="number" min="1" step="100" required value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} /></label><label>Комментарий <span>(не указывайте банковские реквизиты)</span><input required maxLength={1000} value={payoutDescription} onChange={(event) => setPayoutDescription(event.target.value)} placeholder="Комментарий для администратора" /></label><button type="submit" disabled={payoutBusy}>{payoutBusy ? "Отправляем…" : "Запросить подтверждение"}</button></form>{financialActions.length > 0 && <div className="seller-financial-history"><h4>Запросы на выплату</h4>{financialActions.map((action) => <div key={action.id}><span>{formatUzs(action.amountMinor)} · {action.description}</span><b>{action.status === "PENDING" ? "На проверке" : action.status === "APPROVED" ? "Одобрено" : "Отклонено"}</b>{action.reviewNote && <small>{action.reviewNote}</small>}</div>)}</div>}</section>
    </section>
  );
}
