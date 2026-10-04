import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Box,
  ChevronDown,
  CircleDollarSign,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Plus,
  Search,
  Settings2,
  Truck,
  Users,
  X,
} from "lucide-react";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "@firebase/auth";
import { getApp, getApps, initializeApp } from "@firebase/app";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

const API_URL = (import.meta.env.VITE_API_URL ?? "https://uriona-api.onrender.com/api/v1").replace(/\/$/, "");
const SESSION_KEY = "uriona.crm.session";
type User = { id: string; name?: string | null; email?: string | null; role: string };
type Page = "overview" | "orders" | "customers" | "finance";
type Order = {
  id: string;
  status: string;
  totalMinor: number;
  currency: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  trackingNumber?: string | null;
  shippingCarrier?: string | null;
  createdAt: string;
  user?: { name?: string | null; email?: string | null; phone?: string | null };
  _count?: { items: number; trackingEvents: number };
};
type Customer = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  createdAt: string;
  _count: { orders: number };
  orders: Array<{ createdAt: string; totalMinor: number; currency: string; status: string }>;
};
type Overview = {
  customers: number;
  orders: number;
  activeOrders: number;
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
  currency: string;
  recentOrders: Order[];
};
type FinanceEntry = {
  id: string;
  type: "INCOME" | "EXPENSE";
  source: string;
  category: string;
  description: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  order?: { id: string; status: string } | null;
};
type PageResult<T> = { items: T[]; total: number; pages: number; page: number };

const navItems: Array<{ id: Page; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard },
  { id: "orders", label: "Заказы", icon: Box },
  { id: "customers", label: "Клиенты", icon: Users },
  { id: "finance", label: "Финансы", icon: CircleDollarSign },
];

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function authClient() {
  return getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
}

function currency(value: number, code = "UZS") {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: code, maximumFractionDigits: 0 })
    .format(value / 100);
}

function date(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    CREATED: "Новый",
    AWAITING_PAYMENT: "Ожидает оплаты",
    PAID: "Оплачен",
    PROCESSING: "В обработке",
    SHIPPED: "В пути",
    DELIVERED: "Доставлен",
    CANCELLED: "Отменён",
  };
  return labels[status] ?? status;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Не удалось выполнить запрос";
}

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_KEY) ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>("overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [modal, setModal] = useState<"shipping" | "status" | "income" | "expense" | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [form, setForm] = useState({ carrier: "", trackingNumber: "", status: "PROCESSING", category: "", description: "", amount: "" });

  const api = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const data = await response.json().catch(() => null) as { message?: string | string[] } | null;
    if (!response.ok) {
      const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
      throw new Error(message || `Ошибка API (${response.status})`);
    }
    return data as T;
  }, [token]);

  const loadPage = useCallback(async (activePage: Page, query = "") => {
    setBusy(true);
    setError("");
    try {
      if (activePage === "overview") {
        const result = await api<Overview>("/crm/overview");
        setOverview(result);
        setOrders(result.recentOrders);
      } else if (activePage === "orders") {
        const result = await api<PageResult<Order>>(`/crm/orders?limit=100${query ? `&search=${encodeURIComponent(query)}` : ""}`);
        setOrders(result.items);
      } else if (activePage === "customers") {
        const result = await api<PageResult<Customer>>(`/crm/customers?limit=100${query ? `&search=${encodeURIComponent(query)}` : ""}`);
        setCustomers(result.items);
      } else {
        const [summary, result] = await Promise.all([
          api<{ incomeMinor: number; expenseMinor: number; balanceMinor: number; currency: string }>("/crm/finance/summary"),
          api<PageResult<FinanceEntry>>("/crm/finance/entries?limit=100"),
        ]);
        setOverview((current) => ({
          customers: current?.customers ?? 0,
          orders: current?.orders ?? 0,
          activeOrders: current?.activeOrders ?? 0,
          incomeMinor: summary.incomeMinor,
          expenseMinor: summary.expenseMinor,
          balanceMinor: summary.balanceMinor,
          currency: summary.currency,
          recentOrders: current?.recentOrders ?? [],
        }));
        setEntries(result.items);
      }
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    if (!token) return;
    void api<User>("/auth/profile").then((profile) => {
      if (profile.role !== "ADMIN") throw new Error("У этой учётной записи нет прав CRM.");
      setUser(profile);
    }).catch((reason: unknown) => {
      localStorage.removeItem(SESSION_KEY);
      setToken("");
      setUser(null);
      setError(getErrorMessage(reason));
    });
  }, [token, api]);

  useEffect(() => {
    if (token) void loadPage(page, search);
  }, [token, page, loadPage]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const currentTitle = navItems.find((item) => item.id === page)?.label ?? "Обзор";
  const filteredOrders = useMemo(() => orders, [orders]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const auth = authClient();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!credential.user.emailVerified) {
        throw new Error("Подтвердите email в Firebase, затем войдите снова.");
      }
      const response = await fetch(`${API_URL}/auth/firebase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: await credential.user.getIdToken(true) }),
      });
      const data = await response.json() as { accessToken?: string; user?: User; message?: string | string[] };
      if (!response.ok) {
        const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
        throw new Error(message || `Ошибка входа (${response.status})`);
      }
      if (!data.accessToken || !data.user) throw new Error("Сервер не вернул данные сессии");
      if (data.user.role !== "ADMIN") throw new Error("У этой учётной записи нет прав CRM. Назначьте роль ADMIN.");
      localStorage.setItem(SESSION_KEY, data.accessToken);
      setToken(data.accessToken);
      setUser(data.user);
      setPassword("");
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await signOut(authClient());
    localStorage.removeItem(SESSION_KEY);
    setToken("");
    setUser(null);
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder && (modal === "shipping" || modal === "status")) return;
    setBusy(true);
    setError("");
    try {
      if (modal === "shipping" && selectedOrder) {
        await api(`/crm/orders/${selectedOrder.id}/shipping`, {
          method: "PATCH",
          body: JSON.stringify({ carrier: form.carrier, trackingNumber: form.trackingNumber }),
        });
      } else if (modal === "status" && selectedOrder) {
        await api(`/crm/orders/${selectedOrder.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: form.status }),
        });
      } else if (modal === "income" || modal === "expense") {
        const amount = Number(form.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Укажите сумму больше нуля");
        await api(`/crm/finance/${modal === "income" ? "income" : "expenses"}`, {
          method: "POST",
          body: JSON.stringify({
            category: form.category,
            description: form.description,
            amountMinor: Math.round(amount * 100),
          }),
        });
      }
      setModal(null);
      setSelectedOrder(null);
      setForm({ carrier: "", trackingNumber: "", status: "PROCESSING", category: "", description: "", amount: "" });
      setNotice("Изменения сохранены");
      await loadPage(page, search);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function openOrderAction(order: Order, action: "shipping" | "status") {
    setError("");
    setSelectedOrder(order);
    setForm((current) => ({
      ...current,
      carrier: order.shippingCarrier ?? "",
      trackingNumber: order.trackingNumber ?? "",
      status: order.status === "PAID" ? "PROCESSING" : order.status === "PROCESSING" ? "SHIPPED" : "DELIVERED",
    }));
    setModal(action);
  }

  if (!token) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="brand-mark"><Command size={22} /><span>URIONA</span></div>
          <p className="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ</p>
          <h1>Вход в CRM</h1>
          <p className="login-copy">Управляйте клиентами, заказами, доставкой и финансами магазина.</p>
          {error && <div className="alert">{error}</div>}
          <form onSubmit={handleLogin} className="login-form">
            <label>Email<input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Пароль<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <button className="primary-button wide" disabled={busy}>{busy ? "Входим..." : "Войти в систему"}</button>
          </form>
          <p className="login-footnote">Вход доступен сотрудникам с ролью администратора.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-mark"><Command size={22} /><span>URIONA</span><small>CRM</small><button className="mobile-close icon-button" aria-label="Закрыть меню" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
        <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <div className="workspace-picker"><div className="workspace-avatar">U</div><div><b>Uriona Store</b><small>Основной магазин</small></div><ChevronDown size={16} /></div>
        <div className="nav-caption">МЕНЮ</div>
        <nav className="main-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${page === id ? "active" : ""}`} onClick={() => { setPage(id); setSearch(""); setMobileNav(false); setError(""); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{id === "orders" && overview?.activeOrders ? <i>{overview.activeOrders}</i> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note"><Settings2 size={17} /><span>Защищённый доступ</span></div>
          <div className="user-row">
            <div className="user-avatar">{(user?.name ?? user?.email ?? "A").slice(0, 1).toUpperCase()}</div>
            <div className="user-copy"><b>{user?.name || "Администратор"}</b><small>{user?.email}</small></div>
            <button onClick={() => void logout()} className="icon-button" title="Выйти"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      {mobileNav && <button className="mobile-backdrop" aria-label="Закрыть меню" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Открыть меню" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Uriona Store</span><b>/</b><strong>{currentTitle}</strong></div>
          <div className="topbar-right"><span className="status-dot" />CRM активна<button className="topbar-user" title="Выйти" onClick={() => void logout()}><LogOut size={17} /></button></div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div><p className="eyebrow">УПРАВЛЕНИЕ МАГАЗИНОМ</p><h1>{page === "overview" ? "Добро пожаловать" : currentTitle}</h1><p>{page === "overview" ? "Краткая сводка по работе вашего магазина." : page === "orders" ? "Заказы, статусы и информация о доставке." : page === "customers" ? "Клиентская база вашего магазина." : "Доходы, расходы и движение средств."}</p></div>
            {page === "finance" && <div className="heading-actions"><button className="secondary-button" onClick={() => { setForm({ carrier: "", trackingNumber: "", status: "PROCESSING", category: "", description: "", amount: "" }); setModal("expense"); }}><ArrowUpRight size={16} /> Добавить расход</button><button className="primary-button" onClick={() => { setForm({ carrier: "", trackingNumber: "", status: "PROCESSING", category: "", description: "", amount: "" }); setModal("income"); }}><Plus size={17} /> Добавить доход</button></div>}
          </div>
          {error && <div className="alert page-alert">{error}<button className="icon-button" onClick={() => setError("")} aria-label="Закрыть"><X size={16} /></button></div>}
          {notice && <div className="notice">{notice}</div>}
          {page === "overview" && <OverviewPage overview={overview} orders={orders} currency={currency} date={date} onOrders={() => setPage("orders")} />}
          {page === "orders" && <OrdersPage orders={filteredOrders} search={search} setSearch={setSearch} onSearch={() => void loadPage(page, search)} busy={busy} currency={currency} date={date} onShipping={(order) => openOrderAction(order, "shipping")} onStatus={(order) => openOrderAction(order, "status")} />}
          {page === "customers" && <CustomersPage customers={customers} search={search} setSearch={setSearch} onSearch={() => void loadPage(page, search)} busy={busy} date={date} />}
          {page === "finance" && <FinancePage overview={overview} entries={entries} currency={currency} date={date} />}
          {busy && <div className="loading-bar" />}
        </div>
      </main>
      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal">
        <div className="modal-header"><div><p className="eyebrow">{selectedOrder ? `ЗАКАЗ ${selectedOrder.id.slice(0, 8).toUpperCase()}` : "ФИНАНСОВАЯ ОПЕРАЦИЯ"}</p><h2>{modal === "shipping" ? "Обновить доставку" : modal === "status" ? "Изменить статус" : modal === "income" ? "Новый доход" : "Новый расход"}</h2></div><button className="icon-button" aria-label="Закрыть" onClick={() => setModal(null)}><X size={19} /></button></div>
        <form className="modal-form" onSubmit={(event) => void submitAction(event)}>
          {modal === "shipping" && <><label>Перевозчик<input value={form.carrier} onChange={(event) => setForm({ ...form, carrier: event.target.value })} placeholder="Например, Cainiao" required /></label><label>Трек-номер<input value={form.trackingNumber} onChange={(event) => setForm({ ...form, trackingNumber: event.target.value })} required /></label></>}
          {modal === "status" && <label>Новый статус<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{["AWAITING_PAYMENT", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>}
          {(modal === "income" || modal === "expense") && <><label>Категория<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder={modal === "income" ? "Например, продажа" : "Например, реклама"} required /></label><label>Описание<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label><label>Сумма, UZS<input type="number" min="1" step="any" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label></>}
          {error && <div className="alert">{error}</div>}
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModal(null)}>Отмена</button><button className="primary-button" disabled={busy}>{busy ? "Сохраняем..." : "Сохранить"}</button></div>
        </form>
      </section></div>}
    </div>
  );
}

function OverviewPage({ overview, orders, currency: money, date: formatDate, onOrders }: {
  overview: Overview | null; orders: Order[]; currency: (value: number, code?: string) => string; date: (value: string) => string; onOrders: () => void;
}) {
  if (!overview) return <div className="empty-state"><Activity size={24} /><h3>Загружаем данные</h3><p>CRM подключается к данным магазина.</p></div>;
  const stats = [
    { title: "Все клиенты", value: overview.customers.toLocaleString("ru-RU"), hint: "Зарегистрировано в магазине", icon: Users, tone: "violet" },
    { title: "Всего заказов", value: overview.orders.toLocaleString("ru-RU"), hint: `${overview.activeOrders} активных заказов`, icon: Box, tone: "blue" },
    { title: "Доходы", value: money(overview.incomeMinor), hint: "Подтверждённые поступления", icon: ArrowDownLeft, tone: "green" },
    { title: "Баланс", value: money(overview.balanceMinor), hint: `Расходы: ${money(overview.expenseMinor)}`, icon: CircleDollarSign, tone: "orange" },
  ];
  return <>
    <div className="stats-grid">{stats.map(({ title, value, hint, icon: Icon, tone }) => <article className="stat-card" key={title}><div className={`stat-icon ${tone}`}><Icon size={19} /></div><span className="stat-title">{title}</span><strong>{value}</strong><small>{hint}</small></article>)}</div>
    <section className="panel">
      <div className="panel-heading"><div><h2>Последние заказы</h2><p>Недавно оформленные заказы в магазине</p></div><button className="text-button" onClick={onOrders}>Все заказы <span>→</span></button></div>
      <OrdersTable orders={orders.slice(0, 6)} currency={money} date={formatDate} />
    </section>
    <div className="info-strip"><div className="info-icon"><Truck size={19} /></div><div><b>Отслеживание доставки</b><p>Добавляйте перевозчика и трек-номер в карточке заказа, чтобы команда видела актуальный статус отправки.</p></div></div>
  </>;
}

function OrdersPage({ orders, search, setSearch, onSearch, busy, currency: money, date: formatDate, onShipping, onStatus }: {
  orders: Order[]; search: string; setSearch: (value: string) => void; onSearch: () => void; busy: boolean; currency: (value: number, code?: string) => string; date: (value: string) => string; onShipping: (order: Order) => void; onStatus: (order: Order) => void;
}) {
  return <section className="panel"><div className="toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }} placeholder="Поиск по заказу, клиенту, трек-номеру" /><button onClick={onSearch} aria-label="Искать"><Search size={16} /></button></div><span className="result-count">{busy ? "Обновляем..." : `${orders.length} заказов`}</span></div>
    {orders.length ? <OrdersTable orders={orders} currency={money} date={formatDate} onShipping={onShipping} onStatus={onStatus} /> : <EmptyTable icon={PackageSearch} title="Заказов пока нет" copy="Когда появятся заказы, они отобразятся здесь." />}
  </section>;
}

function OrdersTable({ orders, currency: money, date: formatDate, onShipping, onStatus }: {
  orders: Order[]; currency: (value: number, code?: string) => string; date: (value: string) => string; onShipping?: (order: Order) => void; onStatus?: (order: Order) => void;
}) {
  return <div className="table-wrap"><table><thead><tr><th>ЗАКАЗ</th><th>КЛИЕНТ</th><th>ДАТА</th><th>СТАТУС</th><th>ДОСТАВКА</th><th>СУММА</th>{onShipping && <th />}</tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><b className="order-id">#{order.id.slice(0, 8).toUpperCase()}</b><small>{order._count?.items ?? 0} товаров</small></td><td><b>{order.recipientName || order.user?.name || "Клиент"}</b><small>{order.recipientPhone || order.user?.email || order.user?.phone || "—"}</small></td><td>{formatDate(order.createdAt)}</td><td><span className={`badge ${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span></td><td>{order.trackingNumber ? <><b>{order.shippingCarrier || "Перевозчик"}</b><small>{order.trackingNumber}</small></> : <span className="muted">Не назначена</span>}</td><td><b>{money(order.totalMinor, order.currency)}</b></td>{onShipping && <td><div className="row-actions"><button className="small-button" onClick={() => onShipping(order)} title="Добавить перевозчика и трек-номер"><Truck size={15} /></button>{onStatus && <button className="small-button" onClick={() => onStatus(order)} title="Изменить статус"><Settings2 size={15} /></button>}</div></td>}</tr>)}</tbody></table></div>;
}

function CustomersPage({ customers, search, setSearch, onSearch, busy, date: formatDate }: {
  customers: Customer[]; search: string; setSearch: (value: string) => void; onSearch: () => void; busy: boolean; date: (value: string) => string;
}) {
  return <section className="panel"><div className="toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }} placeholder="Имя, email или телефон" /><button onClick={onSearch} aria-label="Искать"><Search size={16} /></button></div><span className="result-count">{busy ? "Обновляем..." : `${customers.length} клиентов`}</span></div>
    {customers.length ? <div className="table-wrap"><table><thead><tr><th>КЛИЕНТ</th><th>КОНТАКТЫ</th><th>ГОРОД</th><th>ЗАКАЗОВ</th><th>ПОСЛЕДНИЙ ЗАКАЗ</th><th>С НАМИ С</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><div className="customer-cell"><div className="customer-avatar">{(customer.name || customer.email || "К").slice(0, 1).toUpperCase()}</div><div><b>{customer.name || "Без имени"}</b><small>#{customer.id.slice(0, 8)}</small></div></div></td><td><b>{customer.email || "—"}</b><small>{customer.phone || "Телефон не указан"}</small></td><td>{customer.city || "—"}</td><td><span className="count-pill">{customer._count.orders}</span></td><td>{customer.orders[0] ? formatDate(customer.orders[0].createdAt) : <span className="muted">Пока нет</span>}</td><td>{formatDate(customer.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyTable icon={Users} title="Клиенты не найдены" copy="Попробуйте изменить запрос или проверьте подключение к базе." />}
  </section>;
}

function FinancePage({ overview, entries, currency: money, date: formatDate }: {
  overview: Overview | null; entries: FinanceEntry[]; currency: (value: number, code?: string) => string; date: (value: string) => string;
}) {
  return <><div className="finance-stats"><article className="finance-card positive"><div className="finance-card-title"><span><ArrowDownLeft size={18} /></span>Доходы</div><strong>{money(overview?.incomeMinor ?? 0)}</strong><small>Включая оплаченные заказы</small></article><article className="finance-card negative"><div className="finance-card-title"><span><ArrowUpRight size={18} /></span>Расходы</div><strong>{money(overview?.expenseMinor ?? 0)}</strong><small>Возвраты и ручные расходы</small></article><article className="finance-card neutral"><div className="finance-card-title"><span><CircleDollarSign size={18} /></span>Текущий баланс</div><strong>{money(overview?.balanceMinor ?? 0)}</strong><small>Операционная сводка в UZS</small></article></div>
    <section className="panel"><div className="panel-heading"><div><h2>Журнал операций</h2><p>Платежи, возвраты и ручные записи</p></div><span className="result-count">{entries.length} операций</span></div>
      {entries.length ? <div className="table-wrap"><table><thead><tr><th>ОПЕРАЦИЯ</th><th>ТИП</th><th>ИСТОЧНИК</th><th>ДАТА</th><th>СВЯЗАННЫЙ ЗАКАЗ</th><th>СУММА</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td><b>{entry.category}</b><small>{entry.description}</small></td><td><span className={`finance-type ${entry.type.toLowerCase()}`}>{entry.type === "INCOME" ? "Доход" : "Расход"}</span></td><td><span className="source-label">{entry.source === "PAYMENT" ? "Оплата" : entry.source === "REFUND" ? "Возврат" : "Вручную"}</span></td><td>{formatDate(entry.occurredAt)}</td><td>{entry.order ? <span className="order-id">#{entry.order.id.slice(0, 8).toUpperCase()}</span> : "—"}</td><td><b className={entry.type === "INCOME" ? "amount-positive" : "amount-negative"}>{entry.type === "INCOME" ? "+" : "−"}{money(entry.amountMinor, entry.currency)}</b></td></tr>)}</tbody></table></div> : <EmptyTable icon={CircleDollarSign} title="Операций пока нет" copy="Поступления и расходы будут отображаться здесь." />}
    </section></>;
}

function EmptyTable({ icon: Icon, title, copy }: { icon: typeof Users; title: string; copy: string }) {
  return <div className="empty-state"><Icon size={25} /><h3>{title}</h3><p>{copy}</p></div>;
}
