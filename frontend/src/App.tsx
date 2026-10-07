import { cloneElement, isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronRight,
  CreditCard,
  Heart,
  HelpCircle,
  Languages,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Ticket,
  Truck,
  UserRound,
  X,
  Zap,
  Moon,
  Sun,
} from "lucide-react";
import { createUserWithEmailAndPassword, getIdToken, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "@firebase/auth";
import type { User as FirebaseUser } from "@firebase/auth";
import { ApiRequestError, api, formatUzs, mapMarketplaceCategories, mapMarketplaceGoods, type ApiCategory, type ApiOrder, type ApiProduct, type ApiUser } from "./api";
import { firebaseAuth, firebaseConfigReady } from "./firebase";

const navItems = ["Главная", "Категории", "Корзина", "Профиль"] as const;
type Language = "ru" | "en" | "uz";
const HOME_RECOMMENDATION_KEYWORDS = ["phone", "home decor", "kitchen", "women fashion", "watch", "toys", "bag", "beauty"];

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

const uiTranslations: Record<string, Partial<Record<Language, string>>> = Object.assign({}, {
  "Личный кабинет": { en: "My account", uz: "Shaxsiy kabinet" },
  "Обзор": { en: "Overview", uz: "Umumiy ma’lumot" },
  "Мои заказы": { en: "My orders", uz: "Buyurtmalarim" },
  "Избранное": { en: "Wishlist", uz: "Saralanganlar" },
  "Любимые магазины": { en: "Favorite stores", uz: "Sevimli do‘konlar" },
  "Мои отзывы": { en: "My reviews", uz: "Sharhlarim" },
  "Вопросы и ответы": { en: "Q&A", uz: "Savol-javoblar" },
  "Купоны": { en: "Coupons", uz: "Kuponlar" },
  "Адреса доставки": { en: "Delivery addresses", uz: "Yetkazib berish manzillari" },
  "Способы оплаты": { en: "Payment methods", uz: "To‘lov usullari" },
  "Настройки": { en: "Settings", uz: "Sozlamalar" },
  "Служба поддержки": { en: "Customer support", uz: "Yordam xizmati" },
  "Выйти": { en: "Sign out", uz: "Chiqish" },
  "Подтвердите email": { en: "Verify your email", uz: "Email manzilingizni tasdiqlang" },
  "Войти в URIONA": { en: "Sign in to URIONA", uz: "URIONA’ga kiring" },
  "Создать аккаунт": { en: "Create an account", uz: "Hisob yaratish" },
  "Сбросить пароль": { en: "Reset password", uz: "Parolni tiklash" },
  "Для защиты аккаунта подтвердите адрес электронной почты по ссылке в письме. До подтверждения доступ к профилю и заказам не выдаётся.": {
    en: "To protect your account, verify your email using the link we sent. Profile and order access is unavailable until verification.",
    uz: "Hisobingizni himoya qilish uchun xatdagi havola orqali emailingizni tasdiqlang. Tasdiqlamaguningizcha profil va buyurtmalarga kirish yopiq.",
  },
  "Я подтвердил email": { en: "I verified my email", uz: "Emailimni tasdiqladim" },
  "Отправить письмо ещё раз": { en: "Resend verification email", uz: "Tasdiqlash xatini qayta yuborish" },
  "Вернуться ко входу": { en: "Back to sign in", uz: "Kirishga qaytish" },
  "Войдите, чтобы управлять заказами, адресами и избранным.": {
    en: "Sign in to manage your orders, addresses, and wishlist.",
    uz: "Buyurtmalar, manzillar va saralangan mahsulotlarni boshqarish uchun kiring.",
  },
  "Создайте аккаунт. Для завершения регистрации нужно подтвердить email.": {
    en: "Create an account. You will need to verify your email to finish registration.",
    uz: "Hisob yarating. Ro‘yxatdan o‘tishni yakunlash uchun emailingizni tasdiqlang.",
  },
  "Укажите email — отправим ссылку для создания нового пароля.": {
    en: "Enter your email and we’ll send a password reset link.",
    uz: "Email manzilingizni kiriting, parolni tiklash havolasini yuboramiz.",
  },
  "Пароль": { en: "Password", uz: "Parol" },
  "Минимум 8 символов": { en: "At least 8 characters", uz: "Kamida 8 ta belgi" },
  "Подождите…": { en: "Please wait…", uz: "Kuting…" },
  "Войти": { en: "Sign in", uz: "Kirish" },
  "Зарегистрироваться": { en: "Create account", uz: "Ro‘yxatdan o‘tish" },
  "Отправить ссылку": { en: "Send link", uz: "Havolani yuborish" },
  "Уже есть аккаунт": { en: "Already have an account", uz: "Hisobingiz bormi?" },
  "Забыли пароль?": { en: "Forgot password?", uz: "Parolni unutdingizmi?" },
  "Firebase не настроен для этого сайта: кнопки входа временно отключены. Нужны настройки Web App из Firebase Console и включённый метод Email/Password.": {
    en: "Firebase is not configured for this site, so sign-in is temporarily disabled. Configure the Firebase Web App and enable Email/Password sign-in.",
    uz: "Bu sayt uchun Firebase sozlanmagan, shu sababli kirish vaqtincha ishlamaydi. Firebase Web App sozlamalarini kiriting va Email/Password usulini yoqing.",
  },
  "Разделы профиля": { en: "Profile sections", uz: "Profil bo‘limlari" },
  "Активные заказы": { en: "Active orders", uz: "Faol buyurtmalar" },
  "Оплата": { en: "Payment", uz: "To‘lov" },
  "Настроить": { en: "Set up", uz: "Sozlash" },
  "Ваш аккаунт": { en: "Your account", uz: "Hisobingiz" },
  "Личные данные": { en: "Personal details", uz: "Shaxsiy ma’lumotlar" },
  "Имя": { en: "Name", uz: "Ism" },
  "Ваше имя": { en: "Your name", uz: "Ismingiz" },
  "Телефон": { en: "Phone", uz: "Telefon" },
  "Добавить номер позже": { en: "Add a phone number later", uz: "Telefon raqamini keyinroq qo‘shish" },
  "Город": { en: "City", uz: "Shahar" },
  "Адрес": { en: "Address", uz: "Manzil" },
  "Сохранить изменения": { en: "Save changes", uz: "O‘zgarishlarni saqlash" },
  "Сохранить профиль": { en: "Save profile", uz: "Profilni saqlash" },
  "Заказы": { en: "Orders", uz: "Buyurtmalar" },
  "Все": { en: "All", uz: "Barchasi" },
  "Активные": { en: "Active", uz: "Faol" },
  "Архив": { en: "Archive", uz: "Arxiv" },
  "Повторить": { en: "Retry", uz: "Qayta urinish" },
  "Загрузка…": { en: "Loading…", uz: "Yuklanmoqda…" },
  "Заказов пока нет": { en: "No orders yet", uz: "Hozircha buyurtmalar yo‘q" },
  "В этом разделе пока нет заказов": { en: "There are no orders in this section yet", uz: "Bu bo‘limda hozircha buyurtmalar yo‘q" },
  "Оформленные покупки и их статусы появятся здесь.": { en: "Your purchases and their statuses will appear here.", uz: "Xaridlaringiz va ularning holati shu yerda ko‘rinadi." },
  "Перейти в каталог": { en: "Go to catalog", uz: "Katalogga o‘tish" },
  "Избранное пока пусто": { en: "Your wishlist is empty", uz: "Saralanganlar ro‘yxati bo‘sh" },
  "Нажимайте на сердечко в карточке товара — товары сохранятся на этом устройстве.": {
    en: "Tap the heart on a product card to save products on this device.",
    uz: "Mahsulotni ushbu qurilmada saqlash uchun uning kartasidagi yurakchani bosing.",
  },
  "Найти товары": { en: "Find products", uz: "Mahsulotlarni topish" },
  "В текущем каталоге Uriona AliExpress не передаёт данные продавцов, необходимые для подписки на магазин. Раздел заработает после подтверждения доступа к данным магазинов.": {
    en: "The current URIONA catalog does not receive the seller data needed to follow stores from AliExpress. This section will be available once access to store data is approved.",
    uz: "URIONA katalogi do‘konlarga obuna bo‘lish uchun kerakli AliExpress sotuvchi ma’lumotlarini olmayapti. Do‘kon ma’lumotlariga ruxsat berilgach, bu bo‘lim ishlaydi.",
  },
  "Вернуться в каталог": { en: "Back to catalog", uz: "Katalogga qaytish" },
  "Язык интерфейса": { en: "Interface language", uz: "Interfeys tili" },
  "Русский": { en: "Russian", uz: "Ruscha" },
  "O‘zbekcha": { en: "Uzbek", uz: "O‘zbekcha" },
  "Профиль": { en: "Profile", uz: "Profil" },
  "Корзина": { en: "Cart", uz: "Savat" },
  "Каталог": { en: "Catalog", uz: "Katalog" },
  "Категории": { en: "Categories", uz: "Kategoriyalar" },
  "Все категории": { en: "All categories", uz: "Barcha kategoriyalar" },
  "Категория AliExpress": { en: "AliExpress category", uz: "AliExpress kategoriyasi" },
  "Категория каталога": { en: "Catalog category", uz: "Katalog kategoriyasi" },
  "Товары": { en: "Products", uz: "Mahsulotlar" },
  "Все товары": { en: "All products", uz: "Barcha mahsulotlar" },
  "Категория": { en: "Category", uz: "Kategoriya" },
  "Скидка": { en: "Sale", uz: "Chegirma" },
  "Популярно": { en: "Popular", uz: "Ommabop" },
  "Новинка": { en: "New", uz: "Yangi" },
  "Добавить": { en: "Add", uz: "Qo‘shish" },
  "Купить": { en: "Buy", uz: "Sotib olish" },
  "Подробнее": { en: "Details", uz: "Batafsil" },
  "Удалить из избранного": { en: "Remove from wishlist", uz: "Saralanganlardan olib tashlash" },
  "Добавить в избранное": { en: "Add to wishlist", uz: "Saralanganlarga qo‘shish" },
  "Международный каталог": { en: "Global catalog", uz: "Xalqaro katalog" },
  "Товары каталога URIONA": { en: "URIONA catalog products", uz: "URIONA katalogi mahsulotlari" },
  "Горячие товары": { en: "Trending products", uz: "Ommabop mahsulotlar" },
  "Показать всё": { en: "Show all", uz: "Barchasini ko‘rsatish" },
  "Скидки": { en: "Deals", uz: "Chegirmalar" },
  "Акции недели": { en: "This week's deals", uz: "Hafta aksiyalari" },
  "Спецпредложение": { en: "Special offer", uz: "Maxsus taklif" },
  "Скидка до 50% на популярные категории": { en: "Up to 50% off popular categories", uz: "Mashhur kategoriyalarga 50% gacha chegirma" },
  "Тестовый промокод SAVE10 действует на заказы от 500 000 сум.": {
    en: "The test promo code SAVE10 applies to orders over UZS 500,000.",
    uz: "SAVE10 sinov promo-kodi 500 000 so‘mdan yuqori buyurtmalarga amal qiladi.",
  },
  "Как заказать": { en: "How to order", uz: "Qanday buyurtma berish" },
  "3 простых шага": { en: "3 easy steps", uz: "3 ta oddiy qadam" },
  "1. Выберите товар": { en: "1. Choose a product", uz: "1. Mahsulotni tanlang" },
  "Откройте каталог или подборки": { en: "Browse the catalog or collections", uz: "Katalog yoki to‘plamlarni oching" },
  "2. Добавьте в корзину": { en: "2. Add it to your cart", uz: "2. Savatga qo‘shing" },
  "Проверьте цену и количество": { en: "Check the price and quantity", uz: "Narx va miqdorni tekshiring" },
  "3. Оформите заказ": { en: "3. Place your order", uz: "3. Buyurtmani rasmiylashtiring" },
  "Оплата и доставка в Узбекистан": { en: "Payment and delivery to Uzbekistan", uz: "O‘zbekistonga to‘lov va yetkazib berish" },
  "Как мы доставляем": { en: "How delivery works", uz: "Yetkazib berish tartibi" },
  "Срок": { en: "Delivery time", uz: "Muddat" },
  "От 7 до 21 дня": { en: "7 to 21 days", uz: "7 kundan 21 kungacha" },
  "Зависит от продавца, типа товара и логистики до Ташкента.": {
    en: "It depends on the seller, product type, and shipping to Tashkent.",
    uz: "Muddat sotuvchi, mahsulot turi va Toshkentgacha bo‘lgan logistika xizmatiga bog‘liq.",
  },
  "Отслеживание": { en: "Tracking", uz: "Kuzatuv" },
  "По треку и статусам": { en: "Track your parcel and its status", uz: "Trek raqami va holatlar orqali" },
  "Получаете уведомления о перемещении посылки и готовности к выдаче.": {
    en: "Get updates as your parcel moves and when it is ready for pickup.",
    uz: "Jo‘natma harakati va olib ketishga tayyorligi haqida xabarlar olasiz.",
  },
  "Поддержка": { en: "Support", uz: "Yordam" },
  "Как связаться с поддержкой?": { en: "How can I contact support?", uz: "Yordam xizmatiga qanday bog‘lanaman?" },
  "Контактный канал поддержки Uriona ещё не настроен. Мы не показываем фиктивный телефон или неработающий чат.": {
    en: "URIONA support contact details are not configured yet. We do not display a fake phone number or a non-working chat.",
    uz: "URIONA yordam xizmati aloqa ma’lumotlari hali sozlanmagan. Soxta telefon raqami yoki ishlamaydigan chat ko‘rsatilmaydi.",
  },
  "Раздел помощи": { en: "Help center", uz: "Yordam bo‘limi" },
  "Почему каталог может быть недоступен?": { en: "Why might the catalog be unavailable?", uz: "Nega katalog ishlamasligi mumkin?" },
  "Каталог зависит от разрешений AliExpress Open Platform. При отказе API Uriona показывает сообщение и кнопку повтора запроса.": {
    en: "The catalog depends on AliExpress Open Platform permissions. If the API request fails, URIONA shows a message and a retry button.",
    uz: "Katalog AliExpress Open Platform ruxsatlariga bog‘liq. API so‘rovi bajarilmasa, URIONA xabar va qayta urinish tugmasini ko‘rsatadi.",
  },
  "Ташкент": { en: "Tashkent", uz: "Toshkent" },
  "Доставка в": { en: "Deliver to", uz: "Yetkazish manzili" },
  "Главное меню": { en: "Main menu", uz: "Asosiy menyu" },
  "Нижняя навигация": { en: "Bottom navigation", uz: "Quyi navigatsiya" },
  "Закрыть": { en: "Close", uz: "Yopish" },
  "Товар AliExpress": { en: "AliExpress product", uz: "AliExpress mahsuloti" },
  "Загружаем описание товара…": { en: "Loading product description…", uz: "Mahsulot tavsifi yuklanmoqda…" },
  "Описание не предоставлено API.": { en: "No description was provided by the API.", uz: "API mahsulot tavsifini taqdim etmadi." },
  "Загружаем данные AliExpress…": { en: "Loading AliExpress data…", uz: "AliExpress ma’lumotlari yuklanmoqda…" },
  "Статус": { en: "Status", uz: "Holat" },
  "ID категории": { en: "Category ID", uz: "Kategoriya ID raqami" },
  "Магазин": { en: "Store", uz: "Do‘kon" },
  "Вес брутто": { en: "Gross weight", uz: "Brutto vazni" },
  "Размер упаковки": { en: "Package dimensions", uz: "Qadoq o‘lchamlari" },
  "Срок отправки": { en: "Shipping time", uz: "Jo‘natish muddati" },
  "Фотографии товара": { en: "Product photos", uz: "Mahsulot rasmlari" },
  "Видео товара": { en: "Product video", uz: "Mahsulot videosi" },
  "Варианты товара": { en: "Product options", uz: "Mahsulot variantlari" },
  "Цена не указана": { en: "Price not provided", uz: "Narx ko‘rsatilmagan" },
  "Дата не указана": { en: "Date not provided", uz: "Sana ko‘rsatilmagan" },
  "Оформление заказа ещё не подключено": { en: "Checkout is not available yet", uz: "Buyurtmani rasmiylashtirish hali mavjud emas" },
  "Перейти к оформлению": { en: "Proceed to checkout", uz: "Rasmiylashtirishga o‘tish" },
  "Оформление заказа пока недоступно.": { en: "Checkout is not available yet.", uz: "Buyurtmani rasmiylashtirish hozircha mavjud emas." },
  "Итого": { en: "Total", uz: "Jami" },
  "Корзина пуста": { en: "Your cart is empty", uz: "Savatingiz bo‘sh" },
  "Добавьте товары из каталога и вернитесь сюда.": { en: "Add products from the catalog and come back here.", uz: "Katalogdan mahsulot qo‘shib, bu yerga qayting." },
  "Промокод": { en: "Promo code", uz: "Promo-kod" },
  "Применить": { en: "Apply", uz: "Qo‘llash" },
  "Доставка от 1-3 дней": { en: "Delivery from 1–3 days", uz: "Yetkazib berish 1–3 kundan" },
  "Платежи": { en: "Payments", uz: "To‘lovlar" },
  "Готово к оплате местными картами и будущим провайдерам.": {
    en: "Ready for local bank cards and future payment providers.",
    uz: "Mahalliy bank kartalari va kelajakdagi to‘lov provayderlari uchun tayyor.",
  },
  "Посылки из Китая": { en: "Parcels from China", uz: "Xitoydan jo‘natmalar" },
  "Проверка, сборка и отслеживание по пути до Ташкента.": {
    en: "Inspection, consolidation, and tracking on the way to Tashkent.",
    uz: "Toshkentga yetib kelguncha tekshirish, jamlash va kuzatish.",
  },
}, {
  "Логотип URIONA": { en: "URIONA logo", uz: "URIONA logotipi" },
  "Основное меню": { en: "Main menu", uz: "Asosiy menyu" },
  "Нижняя навигация": { en: "Bottom navigation", uz: "Quyi navigatsiya" },
  "Доставка в": { en: "Deliver to", uz: "Yetkazish manzili" },
  "Ташкент": { en: "Tashkent", uz: "Toshkent" },
}, {
  "История покупок": { en: "Purchase history", uz: "Xaridlar tarixi" },
  "Мои заказы": { en: "My orders", uz: "Buyurtmalarim" },
  "Фильтр заказов": { en: "Order filter", uz: "Buyurtmalar filtri" },
  "Обновить": { en: "Refresh", uz: "Yangilash" },
  "Загружаем заказы…": { en: "Loading orders…", uz: "Buyurtmalar yuklanmoqda…" },
  "Не удалось загрузить заказы": { en: "Could not load orders", uz: "Buyurtmalarni yuklab bo‘lmadi" },
  "Создан": { en: "Created", uz: "Yaratildi" },
  "Ожидает оплаты": { en: "Awaiting payment", uz: "To‘lov kutilmoqda" },
  "Оплачен": { en: "Paid", uz: "To‘langan" },
  "Собирается": { en: "Processing", uz: "Tayyorlanmoqda" },
  "Отправлен": { en: "Shipped", uz: "Jo‘natildi" },
  "Доставлен": { en: "Delivered", uz: "Yetkazildi" },
  "Отменён": { en: "Cancelled", uz: "Bekor qilindi" },
  "Уже есть аккаунт": { en: "Already have an account", uz: "Hisobingiz bormi?" },
  "Забыли пароль?": { en: "Forgot password?", uz: "Parolni unutdingizmi?" },
  "Обзор": { en: "Overview", uz: "Umumiy ma’lumot" },
  "Мои отзывы": { en: "My reviews", uz: "Sharhlarim" },
  "Вопросы и ответы": { en: "Questions and answers", uz: "Savol-javoblar" },
  "Купоны": { en: "Coupons", uz: "Kuponlar" },
  "Адреса доставки": { en: "Delivery addresses", uz: "Yetkazib berish manzillari" },
  "Способы оплаты": { en: "Payment methods", uz: "To‘lov usullari" },
  "Настройки": { en: "Settings", uz: "Sozlamalar" },
  "Служба поддержки": { en: "Customer support", uz: "Yordam xizmati" },
  "Выйти": { en: "Sign out", uz: "Chiqish" },
  "Активные заказы": { en: "Active orders", uz: "Faol buyurtmalar" },
  "Настроить": { en: "Set up", uz: "Sozlash" },
  "Ваш аккаунт": { en: "Your account", uz: "Hisobingiz" },
  "Личные данные": { en: "Personal details", uz: "Shaxsiy ma’lumotlar" },
  "Имя": { en: "Name", uz: "Ism" },
  "Ваше имя": { en: "Your name", uz: "Ismingiz" },
  "Телефон": { en: "Phone", uz: "Telefon" },
  "Добавить номер позже": { en: "Add a phone number later", uz: "Telefon raqamini keyinroq qo‘shish" },
  "Город": { en: "City", uz: "Shahar" },
  "Адрес доставки": { en: "Delivery address", uz: "Yetkazib berish manzili" },
  "Сохранить профиль": { en: "Save profile", uz: "Profilni saqlash" },
}, {
  "История покупок": { en: "Purchase history", uz: "Xaridlar tarixi" },
  "Все": { en: "All", uz: "Barchasi" },
  "Активные": { en: "Active", uz: "Faol" },
  "Архив": { en: "Archive", uz: "Arxiv" },
  "Заказов пока нет": { en: "No orders yet", uz: "Hozircha buyurtmalar yo‘q" },
  "В этом разделе пока нет заказов": { en: "There are no orders in this section yet", uz: "Bu bo‘limda hozircha buyurtmalar yo‘q" },
  "Оформленные покупки и их статусы появятся здесь.": { en: "Your purchases and their statuses will appear here.", uz: "Xaridlaringiz va ularning holati shu yerda ko‘rinadi." },
  "Перейти в каталог": { en: "Go to catalog", uz: "Katalogga o‘tish" },
  "Избранное пока пусто": { en: "Your wishlist is empty", uz: "Saralanganlar ro‘yxati bo‘sh" },
  "Нажимайте на сердечко в карточке товара — товары сохранятся на этом устройстве.": {
    en: "Tap the heart on a product card to save products on this device.",
    uz: "Mahsulotni ushbu qurilmada saqlash uchun uning kartasidagi yurakchani bosing.",
  },
  "Найти товары": { en: "Find products", uz: "Mahsulotlarni topish" },
  "Любимые магазины": { en: "Favorite stores", uz: "Sevimli do‘konlar" },
  "В текущем каталоге Uriona AliExpress не передаёт данные продавцов, необходимые для подписки на магазин. Раздел заработает после подтверждения доступа к данным магазинов.": {
    en: "The current URIONA catalog does not receive the seller data needed to follow stores from AliExpress. This section will be available once access to store data is approved.",
    uz: "URIONA katalogi do‘konlarga obuna bo‘lish uchun kerakli AliExpress sotuvchi ma’lumotlarini olmayapti. Do‘kon ma’lumotlariga ruxsat berilgach, bu bo‘lim ishlaydi.",
  },
  "Вернуться в каталог": { en: "Back to catalog", uz: "Katalogga qaytish" },
  "Язык интерфейса": { en: "Interface language", uz: "Interfeys tili" },
  "Русский": { en: "Russian", uz: "Ruscha" },
  "O‘zbekcha": { en: "Uzbek", uz: "O‘zbekcha" },
  "Тема оформления": { en: "Theme", uz: "Mavzu" },
  "Включить тёмную тему": { en: "Enable dark theme", uz: "Qorong‘i mavzuni yoqish" },
  "Включить светлую тему": { en: "Enable light theme", uz: "Yorug‘ mavzuni yoqish" },
  "Язык и тема сохраняются на этом устройстве. Email используется для входа; смена пароля пока не подключена.": {
    en: "Your language and theme are saved on this device. Your email is used to sign in; password changes are not available yet.",
    uz: "Til va mavzu ushbu qurilmada saqlanadi. Email kirish uchun ishlatiladi; parolni o‘zgartirish hozircha mavjud emas.",
  },
  "Оплата картой пока не подключена": { en: "Card payments are not available yet", uz: "Karta orqali to‘lov hozircha ishlamaydi" },
  "Не вводите и не отправляйте данные банковской карты в профиль. Подключение UZCARD/HUMO появится после настройки платёжного провайдера.": {
    en: "Do not enter or send bank card details in your profile. UZCARD/HUMO payments will be added after a payment provider is configured.",
    uz: "Profilga bank karta ma’lumotlarini kiritmang yoki yubormang. To‘lov provayderi sozlangach, UZCARD/HUMO qo‘shiladi.",
  },
  "Как связаться с поддержкой?": { en: "How can I contact support?", uz: "Yordam xizmatiga qanday bog‘lanaman?" },
  "Есть вопросы?": { en: "Questions?", uz: "Savollaringiz bormi?" },
  "Сохранить изменения": { en: "Save changes", uz: "O‘zgarishlarni saqlash" },
  "Введите промокод": { en: "Enter a promo code", uz: "Promo-kodni kiriting" },
  "Промокод не найден": { en: "Promo code not found", uz: "Promo-kod topilmadi" },
  "Нет соединения. Проверьте интернет и повторите попытку.": { en: "No connection. Check your internet and try again.", uz: "Internet aloqasi yo‘q. Internetni tekshirib, qayta urinib ko‘ring." },
  "Проверьте правильность email.": { en: "Check that your email address is correct.", uz: "Email manzilingiz to‘g‘riligini tekshiring." },
  "Неверный email или пароль.": { en: "Incorrect email or password.", uz: "Email yoki parol noto‘g‘ri." },
  "Аккаунт не найден. Проверьте email или создайте аккаунт.": { en: "Account not found. Check your email or create an account.", uz: "Hisob topilmadi. Emailni tekshiring yoki hisob yarating." },
  "Пароль должен содержать не менее 8 символов.": { en: "Password must be at least 8 characters.", uz: "Parol kamida 8 ta belgidan iborat bo‘lishi kerak." },
  "Слишком много попыток. Попробуйте позже.": { en: "Too many attempts. Try again later.", uz: "Urinishlar soni juda ko‘p. Keyinroq urinib ko‘ring." },
  "В Firebase Console не включён вход по email и паролю.": { en: "Email and password sign-in is not enabled in Firebase Console.", uz: "Firebase Console'da email va parol orqali kirish yoqilmagan." },
  "Домен сайта не добавлен в список Authorized domains Firebase.": { en: "The website domain is not listed in Firebase Authorized domains.", uz: "Sayt domeni Firebase Authorized domains ro‘yxatiga qo‘shilmagan." },
  "Firebase Authentication не настроен в проекте.": { en: "Firebase Authentication is not configured for this project.", uz: "Loyihada Firebase Authentication sozlanmagan." },
  "Сохранённые товары": { en: "Saved products", uz: "Saqlangan mahsulotlar" },
  "Избранное ·": { en: "Wishlist ·", uz: "Saralanganlar ·" },
  "В корзину": { en: "Add to cart", uz: "Savatga qo‘shish" },
  "Убрать": { en: "Remove", uz: "Olib tashlash" },
  "Отзывы можно оставить после доставки заказа. Публикация и хранение отзывов пока не подключены.": {
    en: "You can leave a review after your order is delivered. Review submission and storage are not available yet.",
    uz: "Buyurtma yetkazilgandan keyin sharh qoldirishingiz mumkin. Sharh yuborish va saqlash hozircha ishlamaydi.",
  },
  "Открыть справку": { en: "Open help center", uz: "Yordam markazini ochish" },
  "Вопросы продавцам и история ответов пока не подключены: для этого нужен разрешённый API продавцов и отдельный раздел товара.": {
    en: "Seller questions and answer history are not available yet. They require approved seller API access and a dedicated product section.",
    uz: "Sotuvchilarga savollar va javoblar tarixi hozircha ishlamaydi. Buning uchun sotuvchi API ruxsati va mahsulot bo‘limi kerak.",
  },
  "Купон Uriona": { en: "URIONA coupon", uz: "URIONA kuponi" },
  "Действует на товары при сумме от 500 000 сум. Применение будет доступно в корзине.": {
    en: "Valid on orders over UZS 500,000. It can be applied in the cart.",
    uz: "500 000 so‘mdan yuqori buyurtmalarga amal qiladi. Kuponni savatda qo‘llash mumkin.",
  },
  "Перейти в корзину": { en: "Go to cart", uz: "Savatga o‘tish" },
  "Промокод добавлен в корзину": { en: "Promo code added to cart", uz: "Promo-kod savatga qo‘shildi" },
  "Для оформления заказа": { en: "For checkout", uz: "Buyurtmani rasmiylashtirish uchun" },
  "Основной адрес доставки": { en: "Primary delivery address", uz: "Asosiy yetkazib berish manzili" },
  "Получатель": { en: "Recipient", uz: "Qabul qiluvchi" },
  "Имя получателя": { en: "Recipient name", uz: "Qabul qiluvchining ismi" },
  "Улица, дом, квартира": { en: "Street, building, apartment", uz: "Ko‘cha, uy, xonadon" },
  "Сохранить адрес": { en: "Save address", uz: "Manzilni saqlash" },
  "Сейчас профиль поддерживает один основной адрес. Несколько адресов добавим вместе с оформлением заказа.": {
    en: "Your profile currently supports one primary address. Multiple addresses will be available with checkout.",
    uz: "Hozircha profilda bitta asosiy manzilni saqlash mumkin. Buyurtmani rasmiylashtirish qo‘shilganda bir nechta manzil ham bo‘ladi.",
  },
}, {
  "Оплата картой пока не подключена": { en: "Card payments are not available yet", uz: "Karta orqali to‘lov hozircha ishlamaydi" },
  "Не вводите и не отправляйте данные банковской карты в профиль. Подключение UZCARD/HUMO появится после настройки платёжного провайдера.": {
    en: "Do not enter or send bank card details in your profile. UZCARD/HUMO payments will be added after a payment provider is configured.",
    uz: "Profilga bank karta ma’lumotlarini kiritmang yoki yubormang. To‘lov provayderi sozlangach, UZCARD/HUMO qo‘shiladi.",
  },
  "Персональные настройки": { en: "Personal settings", uz: "Shaxsiy sozlamalar" },
  "Настройки аккаунта": { en: "Account settings", uz: "Hisob sozlamalari" },
  "Тема оформления": { en: "Theme", uz: "Mavzu" },
  "Включить тёмную тему": { en: "Enable dark theme", uz: "Qorong‘i mavzuni yoqish" },
  "Включить светлую тему": { en: "Enable light theme", uz: "Yorug‘ mavzuni yoqish" },
  "Язык и тема сохраняются на этом устройстве. Email используется для входа; смена пароля пока не подключена.": {
    en: "Your language and theme are saved on this device. Your email is used to sign in; password changes are not available yet.",
    uz: "Til va mavzu ushbu qurilmada saqlanadi. Email kirish uchun ishlatiladi; parolni o‘zgartirish hozircha mavjud emas.",
  },
  "Помощь по Uriona": { en: "URIONA help", uz: "URIONA yordami" },
  "Частые вопросы": { en: "Frequently asked questions", uz: "Ko‘p so‘raladigan savollar" },
  "Как найти товар?": { en: "How do I find a product?", uz: "Mahsulotni qanday topaman?" },
  "Откройте каталог и воспользуйтесь строкой поиска. Доступность реального каталога зависит от ответа AliExpress API.": {
    en: "Open the catalog and use the search bar. Real catalog availability depends on the AliExpress API response.",
    uz: "Katalogni ochib, qidiruv satridan foydalaning. Haqiqiy katalog mavjudligi AliExpress API javobiga bog‘liq.",
  },
  "Где проверить заказ?": { en: "Where can I check my order?", uz: "Buyurtmani qayerdan tekshirish mumkin?" },
  "После оформления заказа его статус появится в разделе «Мои заказы» профиля.": {
    en: "After placing an order, its status will appear under “My orders” in your profile.",
    uz: "Buyurtma rasmiylashtirilgach, uning holati profildagi “Buyurtmalarim” bo‘limida ko‘rinadi.",
  },
  "Как сохранить товар?": { en: "How do I save a product?", uz: "Mahsulotni qanday saqlayman?" },
  "Нажмите на значок сердца на карточке товара. Избранное сохраняется в браузере на этом устройстве.": {
    en: "Tap the heart icon on a product card. Your wishlist is saved in this browser on this device.",
    uz: "Mahsulot kartasidagi yurak belgisini bosing. Saralanganlar ro‘yxati shu qurilmadagi brauzerda saqlanadi.",
  },
  "Открыть профиль": { en: "Open profile", uz: "Profilni ochish" },
  "Открыть корзину": { en: "Open cart", uz: "Savatni ochish" },
}, {
  "Контактный канал поддержки Uriona ещё не настроен. Мы не показываем фиктивный телефон или неработающий чат.": {
    en: "URIONA support contact details are not configured yet. We do not show a fake phone number or a non-working chat.",
    uz: "URIONA yordam xizmati aloqa ma’lumotlari hali sozlanmagan. Soxta telefon raqami yoki ishlamaydigan chat ko‘rsatilmaydi.",
  },
  "Раздел помощи": { en: "Help center", uz: "Yordam bo‘limi" },
  "Профиль сохранён": { en: "Profile saved", uz: "Profil saqlandi" },
  "Промокод добавлен в корзину": { en: "Promo code added to cart", uz: "Promo-kod savatga qo‘shildi" },
  "Вход выполнен": { en: "Signed in", uz: "Tizimga kirildi" },
  "Товар удалён из избранного": { en: "Product removed from wishlist", uz: "Mahsulot saralanganlardan olib tashlandi" },
  "Товар добавлен в избранное": { en: "Product added to wishlist", uz: "Mahsulot saralanganlarga qo‘shildi" },
  "Товар добавлен в корзину": { en: "Product added to cart", uz: "Mahsulot savatga qo‘shildi" },
  "Промокод не найден": { en: "Promo code not found", uz: "Promo-kod topilmadi" },
  "Введите промокод": { en: "Enter a promo code", uz: "Promo-kodni kiriting" },
  "Промокод SAVE10 применён": { en: "Promo code SAVE10 applied", uz: "SAVE10 promo-kodi qo‘llandi" },
  "Как это работает — скоро": { en: "How it works — coming soon", uz: "Bu qanday ishlaydi — tez orada" },
  "Оформление заказа ещё не подключено": { en: "Checkout is not available yet", uz: "Buyurtmani rasmiylashtirish hali mavjud emas" },
  "Письмо отправлено повторно на": { en: "Verification email resent to", uz: "Tasdiqlash xati qayta yuborildi:" },
  "Создан": { en: "Created", uz: "Yaratildi" },
  "Ожидает оплаты": { en: "Awaiting payment", uz: "To‘lov kutilmoqda" },
  "Оплачен": { en: "Paid", uz: "To‘langan" },
  "Собирается": { en: "Processing", uz: "Tayyorlanmoqda" },
  "Отправлен": { en: "Shipped", uz: "Jo‘natildi" },
  "Доставлен": { en: "Delivered", uz: "Yetkazildi" },
  "Отменён": { en: "Cancelled", uz: "Bekor qilindi" },
}, {
}, {
  "Доставка": { en: "Delivery", uz: "Yetkazib berish" },
  "Как это работает": { en: "How it works", uz: "Bu qanday ishlaydi" },
  "Центр помощи": { en: "Help center", uz: "Yordam markazi" },
  "Как оформить заказ?": { en: "How do I place an order?", uz: "Buyurtmani qanday rasmiylashtiraman?" },
  "Добавьте доступные товары в корзину и перейдите к оформлению. Сейчас оформление и приём оплаты ещё не подключены.": {
    en: "Add available products to your cart and proceed to checkout. Checkout and payment processing are not available yet.",
    uz: "Mavjud mahsulotlarni savatga qo‘shing va rasmiylashtirishga o‘ting. Buyurtma rasmiylashtirish va to‘lov hozircha ishlamaydi.",
  },
  "Где посмотреть статус заказа?": { en: "Where can I check my order status?", uz: "Buyurtma holatini qayerdan ko‘raman?" },
  "Статус оформленного заказа будет доступен в профиле, в разделе «Мои заказы».": {
    en: "Your order status will be available in the Profile under “My orders”.",
    uz: "Buyurtma holati Profilning “Buyurtmalarim” bo‘limida ko‘rinadi.",
  },
  "Открыть профиль": { en: "Open profile", uz: "Profilni ochish" },
  "Открыть корзину": { en: "Open cart", uz: "Savatni ochish" },
  "Контактный канал поддержки пока не настроен. Здесь не указан фиктивный телефон или неработающий чат.": {
    en: "Support contact details are not configured yet. We do not show a fake phone number or a non-working chat.",
    uz: "Yordam xizmati aloqa ma’lumotlari hali sozlanmagan. Soxta telefon raqami yoki ishlamaydigan chat ko‘rsatilmaydi.",
  },
  "Доставка по Узбекистану": { en: "Delivery across Uzbekistan", uz: "O‘zbekiston bo‘ylab yetkazib berish" },
  "Открыт международный каталог": { en: "Global catalog opened", uz: "Xalqaro katalog ochildi" },
  "Акции и скидки": { en: "Deals and discounts", uz: "Aksiya va chegirmalar" },
  "Поддержка открыта": { en: "Support opened", uz: "Yordam bo‘limi ochildi" },
  "Профиль открыт": { en: "Profile opened", uz: "Profil ochildi" },
  "Корзина открыта": { en: "Cart opened", uz: "Savat ochildi" },
  "Каталог открыт": { en: "Catalog opened", uz: "Katalog ochildi" },
  "Товар добавлен в корзину": { en: "Product added to cart", uz: "Mahsulot savatga qo‘shildi" },
  "Товар удалён из избранного": { en: "Product removed from wishlist", uz: "Mahsulot saralanganlardan olib tashlandi" },
  "Товар добавлен в избранное": { en: "Product added to wishlist", uz: "Mahsulot saralanganlarga qo‘shildi" },
  "Промокод не найден": { en: "Promo code not found", uz: "Promo-kod topilmadi" },
  "Введите промокод": { en: "Enter a promo code", uz: "Promo-kodni kiriting" },
  "SAVE10 действует для заказа от 500 000 сум": { en: "SAVE10 applies to orders over UZS 500,000", uz: "SAVE10 kodi 500 000 so‘mdan yuqori buyurtmalarga amal qiladi" },
  "Промокод SAVE10 применён": { en: "Promo code SAVE10 applied", uz: "SAVE10 promo-kodi qo‘llandi" },
  "Вход выполнен": { en: "Signed in", uz: "Tizimga kirildi" },
  "Профиль сохранён": { en: "Profile saved", uz: "Profil saqlandi" },
  "Как это работает — скоро": { en: "How it works — coming soon", uz: "Bu qanday ishlaydi — tez orada" },
  "Ваш заказ": { en: "Your order", uz: "Buyurtmangiz" },
  "шт.": { en: "items", uz: "dona" },
  "Корзина открыт": { en: "Cart opened", uz: "Savat ochildi" },
  "Категории открыт": { en: "Categories opened", uz: "Kategoriyalar ochildi" },
  "Главная открыт": { en: "Home opened", uz: "Bosh sahifa ochildi" },
  "В корзину": { en: "Add to cart", uz: "Savatga qo‘shish" },
  "Убрать": { en: "Remove", uz: "Olib tashlash" },
  "Сохранённых товаров сейчас отсутствуют в локальном каталоге. Когда каталог загрузится, они появятся здесь.": {
    en: "Saved products are currently missing from the local catalog. They will appear here once the catalog loads.",
    uz: "Saqlangan mahsulotlar hozir mahalliy katalogda yo‘q. Katalog yuklangach, ular shu yerda ko‘rinadi.",
  },
  "Отзывы можно оставить после доставки заказа. Публикация и хранение отзывов пока не подключены.": {
    en: "You can leave a review after your order is delivered. Review submission and storage are not available yet.",
    uz: "Buyurtma yetkazilgandan keyin sharh qoldirishingiz mumkin. Sharh yuborish va saqlash hozircha ishlamaydi.",
  },
  "Открыть справку": { en: "Open help center", uz: "Yordam markazini ochish" },
  "Вопросы продавцам и история ответов пока не подключены: для этого нужен разрешённый API продавцов и отдельный раздел товара.": {
    en: "Seller questions and answer history are not available yet. They require approved seller API access and a dedicated product section.",
    uz: "Sotuvchilarga savollar va javoblar tarixi hozircha ishlamaydi. Buning uchun sotuvchi API ruxsati va mahsulot bo‘limi kerak.",
  },
  "Купон Uriona": { en: "URIONA coupon", uz: "URIONA kuponi" },
  "Действует на товары при сумме от 500 000 сум. Применение будет доступно в корзине.": {
    en: "Valid on orders over UZS 500,000. It can be applied in the cart.",
    uz: "500 000 so‘mdan yuqori buyurtmalarga amal qiladi. Kuponni savatda qo‘llash mumkin.",
  },
  "Перейти в корзину": { en: "Go to cart", uz: "Savatga o‘tish" },
  "Промокод добавлен в корзину": { en: "Promo code added to cart", uz: "Promo-kod savatga qo‘shildi" },
  "Для оформления заказа": { en: "For checkout", uz: "Buyurtmani rasmiylashtirish uchun" },
  "Основной адрес доставки": { en: "Primary delivery address", uz: "Asosiy yetkazib berish manzili" },
  "Получатель": { en: "Recipient", uz: "Qabul qiluvchi" },
  "Имя получателя": { en: "Recipient name", uz: "Qabul qiluvchining ismi" },
  "Улица, дом, квартира": { en: "Street, building, apartment", uz: "Ko‘cha, uy, xonadon" },
  "Сохранить адрес": { en: "Save address", uz: "Manzilni saqlash" },
  "Сейчас профиль поддерживает один основной адрес. Несколько адресов добавим вместе с оформлением заказа.": {
    en: "Your profile currently supports one primary address. Multiple addresses will be available with checkout.",
    uz: "Hozircha profilda bitta asosiy manzilni saqlash mumkin. Buyurtmani rasmiylashtirish qo‘shilganda bir nechta manzil ham bo‘ladi.",
  },
}, {
  "Оплата картой пока не подключена": { en: "Card payments are not available yet", uz: "Karta orqali to‘lov hozircha ishlamaydi" },
  "Не вводите и не отправляйте данные банковской карты в профиль. Подключение UZCARD/HUMO появится после настройки платёжного провайдера.": {
    en: "Do not enter or send bank card details in your profile. UZCARD/HUMO payments will be added after a payment provider is configured.",
    uz: "Profilga bank karta ma’lumotlarini kiritmang yoki yubormang. To‘lov provayderi sozlangach, UZCARD/HUMO qo‘shiladi.",
  },
  "Персональные настройки": { en: "Personal settings", uz: "Shaxsiy sozlamalar" },
  "Настройки аккаунта": { en: "Account settings", uz: "Hisob sozlamalari" },
  "Тема оформления": { en: "Theme", uz: "Mavzu" },
  "Включить тёмную тему": { en: "Enable dark theme", uz: "Qorong‘i mavzuni yoqish" },
  "Включить светлую тему": { en: "Enable light theme", uz: "Yorug‘ mavzuni yoqish" },
  "Язык и тема сохраняются на этом устройстве. Email используется для входа; смена пароля пока не подключена.": {
    en: "Your language and theme are saved on this device. Your email is used to sign in; password changes are not available yet.",
    uz: "Til va mavzu ushbu qurilmada saqlanadi. Email kirish uchun ishlatiladi; parolni o‘zgartirish hozircha mavjud emas.",
  },
  "Помощь по Uriona": { en: "URIONA help", uz: "URIONA yordami" },
  "Частые вопросы": { en: "Frequently asked questions", uz: "Ko‘p so‘raladigan savollar" },
  "Как найти товар?": { en: "How do I find a product?", uz: "Mahsulotni qanday topaman?" },
  "Откройте каталог и воспользуйтесь строкой поиска. Доступность реального каталога зависит от ответа AliExpress API.": {
    en: "Open the catalog and use the search bar. Real catalog availability depends on the AliExpress API response.",
    uz: "Katalogni ochib, qidiruv satridan foydalaning. Haqiqiy katalog mavjudligi AliExpress API javobiga bog‘liq.",
  },
  "Где проверить заказ?": { en: "Where can I check my order?", uz: "Buyurtmani qayerdan tekshirish mumkin?" },
  "После оформления заказа его статус появится в разделе «Мои заказы» профиля.": {
    en: "After placing an order, its status will appear under “My orders” in your profile.",
    uz: "Buyurtma rasmiylashtirilgach, uning holati profildagi “Buyurtmalarim” bo‘limida ko‘rinadi.",
  },
  "Как сохранить товар?": { en: "How do I save a product?", uz: "Mahsulotni qanday saqlayman?" },
  "Нажмите на значок сердца на карточке товара. Избранное сохраняется в браузере на этом устройстве.": {
    en: "Tap the heart icon on a product card. Your wishlist is saved in this browser on this device.",
    uz: "Mahsulot kartasidagi yurak belgisini bosing. Saralanganlar ro‘yxati shu qurilmadagi brauzerda saqlanadi.",
  },
  "История покупок": { en: "Purchase history", uz: "Xaridlar tarixi" },
  "Обновить": { en: "Refresh", uz: "Yangilash" },
  "Фильтр заказов": { en: "Order filter", uz: "Buyurtmalar filtri" },
  "Загружаем заказы…": { en: "Loading orders…", uz: "Buyurtmalar yuklanmoqda…" },
  "Не удалось загрузить заказы": { en: "Could not load orders", uz: "Buyurtmalarni yuklab bo‘lmadi" },
  "Сохранённые товары": { en: "Saved products", uz: "Saqlangan mahsulotlar" },
  "Создан": { en: "Created", uz: "Yaratildi" },
  "Ожидает оплаты": { en: "Awaiting payment", uz: "To‘lov kutilmoqda" },
  "Оплачен": { en: "Paid", uz: "To‘langan" },
  "Собирается": { en: "Processing", uz: "Tayyorlanmoqda" },
  "Отправлен": { en: "Shipped", uz: "Jo‘natildi" },
  "Доставлен": { en: "Delivered", uz: "Yetkazildi" },
  "Отменён": { en: "Cancelled", uz: "Bekor qilindi" },
});

function localizeText(value: string, language: Language): string {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const source = value.trim();
  const exact = uiTranslations[source]?.[language];
  if (exact) return `${leading}${exact}${trailing}`;
  const variant = source.match(/^Вариант (\d+)$/);
  if (variant) {
    const translated = language === "en" ? `Option ${variant[1]}` : language === "uz" ? `${variant[1]}-variant` : source;
    return `${leading}${translated}${trailing}`;
  }
  const productFallback = source.match(/^Товар (.+)$/);
  if (productFallback) {
    const translated = language === "en" ? `Product ${productFallback[1]}` : language === "uz" ? `${productFallback[1]} mahsulot` : source;
    return `${leading}${translated}${trailing}`;
  }
  const orderNumber = source.match(/^Заказ (.+)$/);
  if (orderNumber) {
    const translated = language === "en" ? `Order ${orderNumber[1]}` : language === "uz" ? `Buyurtma ${orderNumber[1]}` : source;
    return `${leading}${translated}${trailing}`;
  }
  const unavailableFavorites = source.match(/^(\d+) сохранённых товаров сейчас отсутствуют в локальном каталоге\. Когда каталог загрузится, они появятся здесь\.$/);
  if (unavailableFavorites) {
    const translated = language === "en"
      ? `${unavailableFavorites[1]} saved products are currently missing from the local catalog. They will appear here once the catalog loads.`
      : `${unavailableFavorites[1]} ta saqlangan mahsulot hozir mahalliy katalogda yo‘q. Katalog yuklangach, ular shu yerda ko‘rinadi.`;
    return `${leading}${translated}${trailing}`;
  }
  const resendNotice = source.match(/^Письмо отправлено повторно на (.+)\.$/);
  if (resendNotice) {
    const translated = language === "en"
      ? `Verification email resent to ${resendNotice[1]}.`
      : `Tasdiqlash xati ${resendNotice[1]} manziliga qayta yuborildi.`;
    return `${leading}${translated}${trailing}`;
  }
  const categoryNotice = source.match(/^(.+) (выбрана|активна)$/);
  if (categoryNotice) {
    const verb = language === "en" ? (categoryNotice[2] === "выбрана" ? "selected" : "active") : language === "uz" ? (categoryNotice[2] === "выбрана" ? "tanlandi" : "faol") : categoryNotice[2];
    return `${leading}${categoryNotice[1]} ${verb}${trailing}`;
  }
  return value;
}

function localizeNode(node: ReactNode, language: Language): ReactNode {
  if (typeof node === "string") return localizeText(node, language);
  if (Array.isArray(node)) return node.map((child) => localizeNode(child, language));
  if (!isValidElement<{ children?: ReactNode } & Record<string, unknown>>(node)) return node;

  const props = { ...node.props };
  props.children = localizeNode(props.children, language);
  for (const attribute of ["alt", "aria-label", "placeholder", "title"]) {
    if (typeof props[attribute] === "string") props[attribute] = localizeText(props[attribute], language);
  }
  return cloneElement(node, props);
}

const translations = {
  ru: {
    home: "Главная", categories: "Категории", cart: "Корзина", profile: "Профиль", catalog: "Каталог",
    global: "Международный каталог", sales: "Скидки", how: "Как заказать", delivery: "Доставка", support: "Поддержка",
    search: "Ищите товары и бренды", profileOpen: "Профиль открыт", cartOpen: "Корзина открыта", start: "Начать покупки",
    heroTitle: "Мировые товары", heroAccent: "по честной цене", heroText: "Выбираем товары у проверенных продавцов и доставляем их в Узбекистан.",
    safe: "Безопасная оплата", deliveryUz: "Доставка в Узбекистан", categoriesQuick: "Быстрый выбор", allCategories: "Все категории",
    best: "Лучшие предложения", popular: "Популярные товары", forYou: "Случайная подборка для вас",
    searchResults: (query: string) => `Товары по запросу «${query}»`, seeAll: "Смотреть всё", payments: "Платежи", shipping: "Доставка",
    catalogPdd: "Категория AliExpress", all: "Все категории", tags: "Все теги", goods: "Товары", allGoods: "Все товары",
    add: "Добавить", buy: "Купить", details: "Подробнее", loading: "Загружаем товары AliExpress...", noGoods: "Реальные товары не найдены.",
    lang: "Язык", light: "Светлая тема", dark: "Тёмная тема", loadingCatalog: "Загружаем каталог", apiError: "Ошибка каталога",
    china: "Международный каталог", hot: "Горячие товары", showAll: "Показать всё", sale: "Акции недели", discount: "Скидка",
    emptyCart: "Корзина пуста", addFromCatalog: "Добавьте товары из каталога и вернитесь сюда.", shop: "К покупкам",
    retry: "Повторить",
    emptyCategories: "Категории пока не загружены.", localCatalogLabel: "Каталог URIONA",
    localCatalogNote: "Показаны товары из каталога URIONA. Данные AliExpress сейчас недоступны.",
    affiliatePermissionError: "AliExpress пока не разрешил приложению доступ к каталогу товаров. Проверьте права Affiliate API в Open Platform.",
    dropshippingAuthorizationError: "Для подробностей товара не подключена авторизация Dropshipping API.",
    dropshippingPermissionError: "У приложения нет разрешения Dropshipping API для поиска и просмотра товаров.",
    catalogUnavailable: "Не удалось загрузить каталог. Проверьте подключение и попробуйте позже.",
    detailsUnavailable: "Не удалось получить подробности товара. Попробуйте позже.",
    localCatalogUnavailable: "Локальный каталог также временно недоступен.",
    sessionExpired: "Сессия истекла. Войдите снова, чтобы открыть профиль и заказы.",
  },
  en: {
    home: "Home", categories: "Categories", cart: "Cart", profile: "Profile", catalog: "Catalog",
    global: "Global catalog", sales: "Deals", how: "How to order", delivery: "Delivery", support: "Support",
    search: "Search products and brands", profileOpen: "Profile opened", cartOpen: "Cart opened", start: "Start shopping",
    heroTitle: "Global products", heroAccent: "at a fair price", heroText: "We select products from trusted sellers and deliver them to Uzbekistan.",
    safe: "Secure payment", deliveryUz: "Delivery to Uzbekistan", categoriesQuick: "Quick pick", allCategories: "All categories",
    best: "Best offers", popular: "Popular products", forYou: "A random selection for you",
    searchResults: (query: string) => `Products for “${query}”`, seeAll: "View all", payments: "Payments", shipping: "Delivery",
    catalogPdd: "AliExpress category", all: "All categories", tags: "All tags", goods: "Products", allGoods: "All products",
    add: "Add", buy: "Buy", details: "Details", loading: "Loading AliExpress products...", noGoods: "No real products found.",
    lang: "Language", light: "Light theme", dark: "Dark theme", loadingCatalog: "Loading catalog", apiError: "Catalog error",
    china: "Global catalog", hot: "Trending products", showAll: "Show all", sale: "Weekly deals", discount: "Sale",
    emptyCart: "Your cart is empty", addFromCatalog: "Add products from the catalog and come back here.", shop: "Start shopping",
    retry: "Retry",
    emptyCategories: "Categories are not available yet.", localCatalogLabel: "URIONA catalog",
    localCatalogNote: "Showing products saved in the URIONA catalog. AliExpress data is currently unavailable.",
    affiliatePermissionError: "AliExpress has not granted this app access to its product catalog. Check Affiliate API permissions in Open Platform.",
    dropshippingAuthorizationError: "Dropshipping API authorization is not connected for product details.",
    dropshippingPermissionError: "This app does not have Dropshipping API permission to search for and view products.",
    catalogUnavailable: "Could not load the catalog. Check your connection and try again later.",
    detailsUnavailable: "Could not load product details. Try again later.",
    localCatalogUnavailable: "The local catalog is also temporarily unavailable.",
    sessionExpired: "Your session expired. Sign in again to view your profile and orders.",
  },
  uz: {
    home: "Bosh sahifa", categories: "Kategoriyalar", cart: "Savat", profile: "Profil", catalog: "Katalog",
    global: "Xalqaro katalog", sales: "Chegirmalar", how: "Qanday buyurtma berish", delivery: "Yetkazib berish", support: "Yordam",
    search: "Mahsulot va brendlarni qidiring", profileOpen: "Profil ochildi", cartOpen: "Savat ochildi", start: "Xaridni boshlash",
    heroTitle: "Dunyo mahsulotlari", heroAccent: "halol narxda", heroText: "Ishonchli sotuvchilardan mahsulotlarni tanlaymiz va O‘zbekistonga yetkazamiz.",
    safe: "Xavfsiz to‘lov", deliveryUz: "O‘zbekistonga yetkazib berish", categoriesQuick: "Tezkor tanlov", allCategories: "Barcha kategoriyalar",
    best: "Eng yaxshi takliflar", popular: "Mashhur mahsulotlar", forYou: "Siz uchun tasodifiy tanlov",
    searchResults: (query: string) => `“${query}” so‘rovi bo‘yicha mahsulotlar`, seeAll: "Barchasini ko‘rish", payments: "To‘lovlar", shipping: "Yetkazib berish",
    catalogPdd: "AliExpress kategoriyasi", all: "Barcha kategoriyalar", tags: "Barcha teglar", goods: "Mahsulotlar", allGoods: "Barcha mahsulotlar",
    add: "Qo‘shish", buy: "Sotib olish", details: "Batafsil", loading: "AliExpress mahsulotlari yuklanmoqda...", noGoods: "Haqiqiy mahsulotlar topilmadi.",
    lang: "Til", light: "Yorug‘ rejim", dark: "Qorong‘i rejim", loadingCatalog: "Katalog yuklanmoqda", apiError: "Katalog xatosi",
    china: "Xalqaro katalog", hot: "Ommabop mahsulotlar", showAll: "Barchasini ko‘rsatish", sale: "Haftalik chegirmalar", discount: "Chegirma",
    emptyCart: "Savat bo‘sh", addFromCatalog: "Katalogdan mahsulot qo‘shing va bu yerga qayting.", shop: "Xaridga o‘tish",
    retry: "Qayta urinish",
    emptyCategories: "Kategoriyalar hozircha mavjud emas.", localCatalogLabel: "URIONA katalogi",
    localCatalogNote: "URIONA katalogida saqlangan mahsulotlar ko‘rsatilmoqda. AliExpress ma’lumotlari hozir mavjud emas.",
    affiliatePermissionError: "AliExpress ilovaga mahsulot katalogidan foydalanishga ruxsat bermagan. Open Platform'da Affiliate API huquqlarini tekshiring.",
    dropshippingAuthorizationError: "Mahsulot tafsilotlari uchun Dropshipping API avtorizatsiyasi ulanmagan.",
    dropshippingPermissionError: "Ilovada mahsulotlarni qidirish va ko‘rish uchun Dropshipping API ruxsati yo‘q.",
    catalogUnavailable: "Katalogni yuklab bo‘lmadi. Ulanishni tekshirib, keyinroq qayta urinib ko‘ring.",
    detailsUnavailable: "Mahsulot tafsilotlarini yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.",
    localCatalogUnavailable: "Mahalliy katalog ham vaqtincha ishlamayapti.",
    sessionExpired: "Sessiya muddati tugadi. Profil va buyurtmalarni ko‘rish uchun qayta kiring.",
  },
} as const;
type View =
  | (typeof navItems)[number]
  | "Каталог"
  | "Международный каталог"
  | "Скидки"
  | "Как заказать"
  | "Доставка"
  | "Поддержка";

const LogoMark = ({ className = "" }: { className?: string }) => (
  <img className={className} src="/uriona-logo.png" alt="Логотип URIONA" />
);

const topMenuItems = [
  { label: "Каталог", view: "Каталог" as View, message: "Каталог открыт" },
  { label: "Международный каталог", view: "Международный каталог" as View, message: "Открыт международный каталог" },
  { label: "Скидки", view: "Скидки" as View, message: "Акции и скидки" },
  { label: "Как заказать", view: "Как заказать" as View, message: "Как заказать" },
  { label: "Доставка", view: "Доставка" as View, message: "Доставка по Узбекистану" },
  { label: "Поддержка", view: "Поддержка" as View, message: "Поддержка открыта" },
];

const CART_STORAGE_KEY = "uriona-cart";
const PRODUCTS_STORAGE_KEY = "uriona-cart-products";
const LIKED_STORAGE_KEY = "uriona-liked-products";
const MIN_PROMO_SUBTOTAL = 500_000 * 100;
type ProfileSection = "overview" | "orders" | "wishlist" | "stores" | "reviews" | "questions" | "coupons" | "addresses" | "payments" | "settings" | "support";

const orderStatusLabels: Record<string, string> = {
  CREATED: "Создан",
  AWAITING_PAYMENT: "Ожидает оплаты",
  PAID: "Оплачен",
  PROCESSING: "Собирается",
  SHIPPED: "Отправлен",
  DELIVERED: "Доставлен",
  CANCELLED: "Отменён",
};

function firebaseErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Аккаунт с таким email уже существует. Войдите или восстановите пароль.",
    "auth/invalid-email": "Проверьте правильность email.",
    "auth/invalid-credential": "Неверный email или пароль.",
    "auth/user-not-found": "Аккаунт не найден. Проверьте email или создайте аккаунт.",
    "auth/wrong-password": "Неверный email или пароль.",
    "auth/weak-password": "Пароль должен содержать не менее 8 символов.",
    "auth/too-many-requests": "Слишком много попыток. Попробуйте позже.",
    "auth/network-request-failed": "Нет соединения. Проверьте интернет и повторите попытку.",
    "auth/operation-not-allowed": "В Firebase Console не включён вход по email и паролю.",
    "auth/unauthorized-domain": "Домен сайта не добавлен в список Authorized domains Firebase.",
    "auth/configuration-not-found": "Firebase Authentication не настроен в проекте.",
  };
  return messages[code] ?? (error instanceof Error ? error.message : "Не удалось выполнить запрос Firebase.");
}

function aliExpressErrorMessage(error: unknown, language: Language, context: "catalog" | "dropshipping" | "details"): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const copy = translations[language];
  if (message.includes("insufficientpermission") || message.includes("does not have permission")) {
    return context === "details" || context === "dropshipping" ? copy.dropshippingPermissionError : copy.affiliatePermissionError;
  }
  if (context !== "catalog" && (message.includes("requires oauth authorization") || message.includes("access token"))) {
    return copy.dropshippingAuthorizationError;
  }
  return context === "details" ? copy.detailsUnavailable : copy.catalogUnavailable;
}

function readStoredValue(key: string): unknown {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as unknown;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    localStorage.removeItem(key);
    return null;
  }
}

function isApiProduct(value: unknown): value is ApiProduct {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const product = value as Record<string, unknown>;
  return typeof product.id === "string"
    && typeof product.titleUz === "string"
    && typeof product.currency === "string"
    && typeof product.priceMinor === "number"
    && Number.isFinite(product.priceMinor)
    && typeof product.status === "string";
}

function readStoredCart(): Record<string, number> {
  const stored = readStoredValue(CART_STORAGE_KEY);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored).filter((entry): entry is [string, number] => {
      const quantity = entry[1];
      return typeof quantity === "number" && Number.isSafeInteger(quantity) && quantity > 0;
    }),
  );
}

function readStoredProducts(): ApiProduct[] {
  const stored = readStoredValue(PRODUCTS_STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter(isApiProduct).slice(-100) : [];
}

function readStoredLiked(): string[] {
  const stored = readStoredValue(LIKED_STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
}

type AliExpressProductDetails = {
  subject: string;
  description: string;
  status: string;
  categoryId: string;
  images: string[];
  videos: string[];
  storeName: string;
  skus: Record<string, unknown>[];
  grossWeight: string;
  dimensions: string;
  deliveryTime: string;
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      if (String(value).trim()) return String(value);
    }
  }
  return "";
}

function readRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(readRecord).filter((item) => Object.keys(item).length > 0);
  const record = readRecord(value);
  if (Object.keys(record).length === 0) return [];
  const nestedList = Object.values(record).find(Array.isArray);
  return Array.isArray(nestedList) ? nestedList.map(readRecord).filter((item) => Object.keys(item).length > 0) : [record];
}

function parseAliExpressProductDetails(payload: unknown): AliExpressProductDetails {
  const root = readRecord(payload);
  const response = readRecord(root.aliexpress_ds_product_get_response ?? root);
  const result = readRecord(response.result ?? response);
  const base = readRecord(result.ae_item_base_info_dto);
  const multimedia = readRecord(result.ae_multimedia_info_dto);
  const store = readRecord(result.ae_store_info);
  const packageInfo = readRecord(result.package_info_dto);
  const logistics = readRecord(result.logistics_info_dto);
  const rawImages = readString(multimedia, "image_urls").split(";").map((image) => image.trim()).filter(Boolean);
  const videos = readRecords(multimedia.ae_video_dtos)
    .map((video) => readString(video, "media_url", "video_url", "url"))
    .filter(Boolean);
  const skus = readRecords(result.ae_item_sku_info_dtos);

  return {
    subject: readString(base, "subject"),
    description: readString(base, "detail", "mobile_detail").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    status: readString(base, "product_status_type"),
    categoryId: readString(base, "category_id"),
    images: rawImages,
    videos,
    storeName: readString(store, "store_name", "shop_name", "ae_store_name", "store_id"),
    skus,
    grossWeight: readString(packageInfo, "gross_weight"),
    dimensions: ["package_length", "package_width", "package_height"].map((key) => readString(packageInfo, key)).every(Boolean)
      ? `${readString(packageInfo, "package_length")} × ${readString(packageInfo, "package_width")} × ${readString(packageInfo, "package_height")}`
      : "",
    deliveryTime: readString(logistics, "delivery_time"),
  };
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("uriona-language") as Language) || "ru");
  const [lightMode, setLightMode] = useState(() => localStorage.getItem("uriona-theme") === "light");
  const text = translations[language];
  const categoryLabel = (category?: ApiCategory | null) => language === "uz"
    ? category?.nameUz || category?.nameRu
    : category?.nameRu || category?.nameUz;
  const productTitle = (product: Pick<ApiProduct, "titleRu" | "titleUz">) => language === "uz"
    ? product.titleUz || product.titleRu
    : product.titleRu || product.titleUz;
  const productDescription = (product: ApiProduct) => language === "uz"
    ? product.descriptionUz || product.descriptionRu
    : product.descriptionRu || product.descriptionUz;
  const [view, setView] = useState<View>("Главная");
  const [search, setSearch] = useState("");
  const [recommendationKeyword] = useState(() => HOME_RECOMMENDATION_KEYWORDS[Math.floor(Math.random() * HOME_RECOMMENDATION_KEYWORDS.length)]);
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [categoryParentId, setCategoryParentId] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [liveCatalog, setLiveCatalog] = useState(false);
  const [catalogSource, setCatalogSource] = useState<"loading" | "aliexpress" | "local" | "unavailable">("loading");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [detailProduct, setDetailProduct] = useState<ApiProduct | null>(null);
  const [detailPayload, setDetailPayload] = useState<unknown>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [liked, setLiked] = useState<string[]>(readStoredLiked);
  const [cartItems, setCartItems] = useState<Record<string, number>>(readStoredCart);
  const [promo, setPromo] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [notice, setNotice] = useState("");
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("uriona-access-token") || "");
  const [profile, setProfile] = useState<ApiUser | null>(null);
  const [knownProducts, setKnownProducts] = useState<ApiProduct[]>(readStoredProducts);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "", city: "", address: "" });
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register" | "reset">("login");
  const [profileSection, setProfileSection] = useState<ProfileSection>("overview");
  const [profileBusy, setProfileBusy] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersAttempt, setOrdersAttempt] = useState(0);
  const [orderFilter, setOrderFilter] = useState<"all" | "active" | "archive">("all");
  const productDetails = useMemo(
    () => detailPayload === null ? null : parseAliExpressProductDetails(detailPayload),
    [detailPayload],
  );

  const clearExpiredSession = (email?: string | null) => {
    localStorage.removeItem("uriona-access-token");
    setAuthToken("");
    setProfile(null);
    setOrders([]);
    setOrdersLoading(false);
    setOrdersError("");
    setAuthEmail(email || "");
    setAuthMode("login");
    setProfileSection("overview");
    setAuthNotice(text.sessionExpired);
    setView("Профиль");
  };

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(knownProducts.slice(-100)));
  }, [knownProducts]);

  useEffect(() => {
    localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(liked));
  }, [liked]);

  useEffect(() => {
    localStorage.setItem("uriona-language", language);
    localStorage.setItem("uriona-theme", lightMode ? "light" : "dark");
    document.documentElement.lang = language === "uz" ? "uz" : language;
  }, [language, lightMode]);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    api.auth.profile(authToken).then((user) => {
      if (!active) return;
      setProfile(user);
      setProfileForm({ name: user.name ?? "", email: user.email ?? "", phone: user.phone ?? "", city: user.city ?? "", address: user.address ?? "" });
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiRequestError && error.status === 401) {
        clearExpiredSession(profile?.email);
        return;
      }
      setNotice(error instanceof Error ? error.message : "Не удалось загрузить профиль");
    });
    return () => { active = false; };
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !profile || profileSection !== "orders") return;
    let active = true;
    setOrdersLoading(true);
    setOrdersError("");
    api.orders.list(authToken)
      .then((result) => {
        if (active) setOrders(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiRequestError && error.status === 401) {
          clearExpiredSession(profile.email);
          return;
        }
        setOrdersError(error instanceof Error ? error.message : "Не удалось загрузить заказы");
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => { active = false; };
  }, [authToken, profile, profileSection, ordersAttempt]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 1500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let active = true;
    setCategoriesLoading(true);
    setCategoriesError("");
    api.aliexpress.dropshippingCategories({ language: language === "ru" ? "ru" : "en" })
      .then((payload) => {
        if (!active) return;
        const liveCategories = mapMarketplaceCategories(payload);
        if (liveCategories.length) {
          setCategories(liveCategories);
          setCategoriesError("");
          return;
        }
        return api.categories().then((localCategories) => {
          if (!active) return;
          setCategories(localCategories);
          setCategoriesError(localCategories.length ? "" : text.emptyCategories);
        });
      })
      .catch(async (error: unknown) => {
        if (!active) return;
        try {
          const localCategories = await api.categories();
          if (!active) return;
          setCategories(localCategories);
          setCategoriesError(localCategories.length ? "" : aliExpressErrorMessage(error, language, "catalog"));
        } catch {
          if (!active) return;
          setCategories([]);
          setCategoriesError(text.localCatalogUnavailable);
        }
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });
    return () => { active = false; };
  }, [language, catalogAttempt]);

  useEffect(() => {
    if (!detailProduct) {
      setDetailPayload(null);
      setDetailError("");
      setDetailLoading(false);
      return;
    }

    let active = true;
    setDetailPayload(null);
    setDetailError("");
    setDetailLoading(true);
    api.aliexpress.productDetails(detailProduct.id, {
      ship_to_country: "UZ",
      target_currency: "USD",
      target_language: "ru_RU",
    })
      .then((payload) => {
        if (active) setDetailPayload(payload);
      })
      .catch((error: unknown) => {
        if (active) setDetailError(aliExpressErrorMessage(error, language, "details"));
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => { active = false; };
  }, [detailProduct, detailAttempt]);

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    setCatalogError("");
    setCatalogSource("loading");
    const timer = window.setTimeout(() => {
      const searchTerm = search.trim();
      const isHomeRecommendations = view === "Главная" && selectedCat === "all" && !searchTerm;
      const useDropshippingSearch = selectedCat !== "all" || Boolean(searchTerm) || isHomeRecommendations;
      const selectedCategory = categories.find((category) => category.id === selectedCat);
      const categoryKeyword = selectedCat !== "all" ? categoryLabel(selectedCategory)?.trim() : "";
      const filters = {
        ...(searchTerm ? { keywords: searchTerm } : {}),
        ...(selectedCat !== "all" ? { category_ids: selectedCat } : {}),
        page_no: 1,
        page_size: 20,
        target_currency: "CNY",
      };
      const useLocalCatalog = async (marketplaceError?: unknown) => {
        try {
          const localResult = await api.products({
            ...(search.trim() ? { search: search.trim() } : {}),
            ...(selectedCat !== "all" ? { categoryId: selectedCat } : {}),
            page: 1,
            limit: 20,
          });
          if (!active) return;
          const localProducts = localResult.items.map((product) => ({
            ...product,
            status: "popular",
            category: product.category ?? categories.find((category) => category.id === product.categoryId) ?? null,
          }));
          setProducts(localProducts);
          setLiveCatalog(false);
          setCatalogSource(localProducts.length ? "local" : "unavailable");
          setCatalogError(localProducts.length
            ? ""
            : marketplaceError
              ? aliExpressErrorMessage(marketplaceError, language, "catalog")
              : text.noGoods);
          if (localProducts.length) {
            setKnownProducts((current) => Array.from(new Map([...current, ...localProducts].map((product) => [product.id, product])).values()).slice(-100));
          }
        } catch {
          if (!active) return;
          setProducts([]);
          setLiveCatalog(false);
          setCatalogSource("unavailable");
          setCatalogError(text.localCatalogUnavailable);
        }
      };
      const load = useDropshippingSearch
        ? api.aliexpress.dropshippingProducts({
            keyWord: searchTerm || categoryKeyword || recommendationKeyword,
            ...(selectedCat !== "all" ? { categoryId: selectedCat } : {}),
            pageIndex: 1,
            pageSize: 20,
            ...(selectedCat !== "all" ? { sortBy: "orders,desc" } : {}),
            currency: "UZS",
          })
        : api.aliexpress.hotProducts(filters);
      load.then((payload) => {
        if (!active) return;
        const mappedProducts = mapMarketplaceGoods(payload, useDropshippingSearch ? "UZS" : "CNY").map((product) => ({
          ...product,
          category: categories.find((category) => category.id === product.categoryId)
            ?? categories.find((category) => category.id === selectedCat)
            ?? null,
        }));
        const liveProducts = isHomeRecommendations ? shuffleItems(mappedProducts) : mappedProducts;
        if (!liveProducts.length) {
          if (useDropshippingSearch) {
            setProducts([]);
            setLiveCatalog(true);
            setCatalogSource("aliexpress");
            setCatalogError("");
            return;
          }
          return useLocalCatalog();
        }
        setProducts(liveProducts);
        setLiveCatalog(true);
        setCatalogSource("aliexpress");
        setCatalogLoading(false);
        setKnownProducts((current) => Array.from(new Map([...current, ...liveProducts].map((product) => [product.id, product])).values()).slice(-100));
      }).catch((error: unknown) => {
        if (!active) return;
        if (useDropshippingSearch) {
          setProducts([]);
          setLiveCatalog(true);
          setCatalogSource("unavailable");
          setCatalogError(aliExpressErrorMessage(error, language, "dropshipping"));
          return;
        }
        return useLocalCatalog(error);
      }).finally(() => {
        if (active) setCatalogLoading(false);
      });
    }, search.trim() ? 400 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, selectedCat, categories, language, catalogAttempt, recommendationKeyword, view]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const title = `${product.titleUz ?? ""} ${product.titleRu ?? ""}`.toLowerCase();
      const categoryName = `${product.category?.nameUz ?? ""} ${product.category?.nameRu ?? ""}`.toLowerCase();
      const matchesQuery = !term || liveCatalog || title.includes(term) || categoryName.includes(term);
      return matchesQuery;
    });
    if (!term) return filtered;

    const terms = term.split(/\s+/).filter(Boolean);
    return filtered
      .map((product, index) => {
        const title = `${product.titleUz ?? ""} ${product.titleRu ?? ""}`.toLowerCase();
        const exactMatch = title.includes(term);
        const matchedTerms = terms.filter((part) => title.includes(part)).length;
        return { product, index, score: (exactMatch ? 1000 : 0) + matchedTerms };
      })
      .sort((first, second) => second.score - first.score || first.index - second.index)
      .map(({ product }) => product);
  }, [products, search, liveCatalog]);

  const categoryChildren = useMemo(() => {
    const byParent = new Map<string, ApiCategory[]>();
    for (const category of categories) {
      const key = category.parentId ?? "root";
      const siblings = byParent.get(key) ?? [];
      siblings.push(category);
      byParent.set(key, siblings);
    }
    return byParent;
  }, [categories]);
  const topLevelCategories = categoryChildren.get("root") ?? categories;
  const categoryPath = useMemo(() => {
    const path: ApiCategory[] = [];
    const visited = new Set<string>();
    let category = categories.find((item) => item.id === categoryParentId);
    while (category && !visited.has(category.id)) {
      visited.add(category.id);
      path.unshift(category);
      const parentId = category.parentId;
      category = parentId ? categories.find((item) => item.id === parentId) : undefined;
    }
    return path;
  }, [categories, categoryParentId]);
  const browsedCategories = useMemo(() => {
    const term = categorySearch.trim().toLocaleLowerCase();
    if (term) {
      return categories.filter((category) =>
        `${category.nameRu} ${category.nameUz}`.toLocaleLowerCase().includes(term)
      );
    }
    return categoryChildren.get(categoryParentId ?? "root") ?? [];
  }, [categories, categoryChildren, categoryParentId, categorySearch]);

  const catalogMessage = catalogLoading
    ? text.loading
    : catalogError || (visibleProducts.length === 0 ? text.noGoods : "");
  const hotProducts = products.filter((product) => product.status === "popular" || product.status === "sale");
  const saleProducts = products.filter((product) => product.status === "sale");
  const hotMessage = catalogLoading ? text.loading : catalogError || (hotProducts.length === 0 ? text.noGoods : "");
  const saleMessage = catalogLoading ? text.loading : catalogError || (saleProducts.length === 0 ? text.noGoods : "");

  const cartEntryList = knownProducts.filter((product) => cartItems[product.id]);
  const cartCount = cartEntryList.reduce((sum, product) => sum + (cartItems[product.id] ?? 0), 0);
  const subtotal = cartEntryList.reduce((sum, product) => sum + product.priceMinor * (cartItems[product.id] ?? 0), 0);
  const shipping = subtotal > 0 ? 35_000 * 100 : 0;
  const discount = appliedPromo === "SAVE10" && subtotal >= MIN_PROMO_SUBTOTAL
    ? Math.round(subtotal * 0.1)
    : 0;
  const total = subtotal + shipping - discount;

  const retryCatalog = () => setCatalogAttempt((attempt) => attempt + 1);
  const renderCatalogState = (message: string, canRetry: boolean) => (
    <div className="catalog-state" role={canRetry ? "alert" : "status"}>
      <span>{message}</span>
      {canRetry && <button type="button" onClick={retryCatalog}>{text.retry}</button>}
    </div>
  );
  const categoryUiLabel = (key: "count" | "search" | "clearSearch" | "all" | "back" | "select" | "selected" | "subcategories" | "noResults", count = 0) => {
    const labels = {
      ru: {
        count: `Категорий: ${count}`, search: "Поиск по всем категориям AliExpress", all: "Все 548 категорий",
        clearSearch: "Очистить поиск",
        back: "Назад", select: "Выбрать категорию", selected: "Выбрана", subcategories: `Подкатегорий: ${count}`,
        noResults: "Категории не найдены",
      },
      en: {
        count: `Categories: ${count}`, search: "Search all AliExpress categories", all: "All 548 categories",
        clearSearch: "Clear search",
        back: "Back", select: "Select category", selected: "Selected", subcategories: `Subcategories: ${count}`,
        noResults: "No categories found",
      },
      uz: {
        count: `Kategoriyalar: ${count}`, search: "Barcha AliExpress kategoriyalaridan qidirish", all: "Barcha 548 kategoriya",
        clearSearch: "Qidiruvni tozalash",
        back: "Orqaga", select: "Kategoriyani tanlash", selected: "Tanlangan", subcategories: `Quyi kategoriyalar: ${count}`,
        noResults: "Kategoriyalar topilmadi",
      },
    } as const;
    return labels[language][key];
  };

  const goTo = (nextView: View, message?: string) => {
    setView(nextView);
    if (message) setNotice(message);
  };

  const handleAddToCart = (productId: string) => {
    setCartItems((items) => ({ ...items, [productId]: (items[productId] ?? 0) + 1 }));
    setNotice("Товар добавлен в корзину");
  };

  const toggleFavorite = (productId: string) => {
    const isSaved = liked.includes(productId);
    setLiked((items) => isSaved ? items.filter((id) => id !== productId) : [...items, productId]);
    setNotice(isSaved ? "Товар удалён из избранного" : "Товар добавлен в избранное");
  };

  const openProductDetails = (product: ApiProduct) => {
    setDetailProduct(product);
  };

  const applyPromo = () => {
    const code = promo.trim().toUpperCase();
    if (code !== "SAVE10") {
      setAppliedPromo("");
      setNotice(code ? "Промокод не найден" : "Введите промокод");
      return;
    }
    if (subtotal < MIN_PROMO_SUBTOTAL) {
      setAppliedPromo("");
      setNotice("SAVE10 действует для заказа от 500 000 сум");
      return;
    }
    setAppliedPromo(code);
    setNotice("Промокод SAVE10 применён");
  };

  const handleQtyChange = (productId: string, delta: number) => {
    setCartItems((items) => {
      const nextQty = (items[productId] ?? 0) + delta;
      if (nextQty <= 0) {
        const { [productId]: _, ...rest } = items;
        return rest;
      }
      return { ...items, [productId]: nextQty };
    });
  };

  const establishFirebaseSession = async (user: FirebaseUser) => {
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      setVerificationPending(true);
      setAuthNotice(`Мы отправили ссылку подтверждения на ${user.email ?? authEmail}. Подтвердите адрес и нажмите «Я подтвердил email».`);
      return;
    }
    const result = await api.auth.firebase(await getIdToken(user, true));
    localStorage.setItem("uriona-access-token", result.accessToken);
    setAuthToken(result.accessToken);
    setProfile(result.user);
    setProfileForm({ name: result.user.name ?? "", email: result.user.email ?? user.email ?? "", phone: result.user.phone ?? "", city: result.user.city ?? "", address: result.user.address ?? "" });
    setVerificationPending(false);
    setAuthNotice("");
    setNotice("Вход выполнен");
  };

  const submitAuth = async () => {
    if (!firebaseAuth) {
      setAuthNotice("Firebase ещё не настроен. Добавьте параметры веб-приложения Firebase в окружение frontend.");
      return;
    }
    setProfileBusy(true);
    setAuthNotice("");
    try {
      if (authMode === "register") {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, authEmail.trim(), authPassword);
        await sendEmailVerification(credential.user);
        setVerificationPending(true);
        setAuthNotice(`Аккаунт создан. Подтвердите email по ссылке, отправленной на ${credential.user.email ?? authEmail}. После этого нажмите «Я подтвердил email».`);
      } else {
        const credential = await signInWithEmailAndPassword(firebaseAuth, authEmail.trim(), authPassword);
        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user);
          setVerificationPending(true);
          setAuthNotice(`Сначала подтвердите email по ссылке, отправленной на ${credential.user.email ?? authEmail}.`);
        } else {
          await establishFirebaseSession(credential.user);
        }
      }
    } catch (error) {
      setAuthNotice(firebaseErrorMessage(error));
    } finally { setProfileBusy(false); }
  };

  const checkEmailVerification = async () => {
    if (!firebaseAuth?.currentUser) {
      setAuthNotice("Войдите снова после подтверждения email.");
      setVerificationPending(false);
      return;
    }
    setProfileBusy(true);
    setAuthNotice("");
    try {
      await reload(firebaseAuth.currentUser);
      const user = firebaseAuth.currentUser;
      if (!user.emailVerified) {
        setAuthNotice("Подтверждение пока не найдено. Откройте ссылку из письма, затем попробуйте ещё раз.");
        return;
      }
      await establishFirebaseSession(user);
    } catch (error) {
      setAuthNotice(firebaseErrorMessage(error));
    } finally { setProfileBusy(false); }
  };

  const resendVerificationEmail = async () => {
    if (!firebaseAuth?.currentUser) {
      setAuthNotice("Сессия регистрации завершена. Войдите в аккаунт, чтобы запросить письмо ещё раз.");
      return;
    }
    setProfileBusy(true);
    setAuthNotice("");
    try {
      await sendEmailVerification(firebaseAuth.currentUser);
      setAuthNotice(`Письмо отправлено повторно на ${firebaseAuth.currentUser.email ?? authEmail}.`);
    } catch (error) {
      setAuthNotice(firebaseErrorMessage(error));
    } finally { setProfileBusy(false); }
  };

  const returnToLogin = async () => {
    try {
      if (firebaseAuth) await signOut(firebaseAuth);
      setVerificationPending(false);
      setAuthNotice("");
      setAuthMode("login");
    } catch (error) {
      setAuthNotice(firebaseErrorMessage(error));
    }
  };

  const logout = async () => {
    localStorage.removeItem("uriona-access-token");
    setAuthToken("");
    setProfile(null);
    if (!firebaseAuth) return;
    try {
      await signOut(firebaseAuth);
    } catch (error) {
      setNotice(firebaseErrorMessage(error));
    }
  };

  const submitPasswordReset = async () => {
    if (!firebaseAuth) {
      setAuthNotice("Firebase ещё не настроен. Добавьте параметры веб-приложения Firebase в окружение frontend.");
      return;
    }
    setProfileBusy(true);
    setAuthNotice("");
    try {
      await sendPasswordResetEmail(firebaseAuth, authEmail.trim());
      setAuthNotice("Если аккаунт с таким email существует, на него отправлена ссылка для сброса пароля.");
    } catch (error) {
      setAuthNotice(firebaseErrorMessage(error));
    } finally { setProfileBusy(false); }
  };

  const saveProfile = async () => {
    if (!authToken) return;
    setProfileBusy(true);
    try {
      const updated = await api.auth.updateProfile(authToken, {
        name: profileForm.name,
        phone: profileForm.phone,
        city: profileForm.city,
        address: profileForm.address,
        language,
      });
      setProfile(updated);
      setNotice("Профиль сохранён");
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        clearExpiredSession(profile?.email);
        return;
      }
      setNotice(error instanceof Error ? error.message : "Не удалось сохранить профиль");
    } finally { setProfileBusy(false); }
  };

  const renderHome = () => (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow"><Zap size={16} />{text.best}</div>
          <h1>{text.heroTitle}<br /><em>{text.heroAccent}</em></h1>
          <p>{text.heroText}</p>
          <div className="hero-actions">
            <button type="button" className="primary-btn" onClick={() => goTo("Категории", "Каталог открыт")}>
              {text.start} <ChevronRight size={18} />
            </button>
            <button type="button" className="secondary-btn" onClick={() => setNotice("Как это работает — скоро")}>Как это работает</button>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={15} />{text.safe}</span>
            <span><Truck size={15} />{text.deliveryUz}</span>
          </div>
        </div>

        <div className="hero-card">
          <span className="sale-tag">URIONA</span>
          <div className="hero-visual">
            <ShoppingBag size={72} />
            <strong>{text.catalog}</strong>
            <small>{catalogLoading ? text.loadingCatalog : catalogError ? text.apiError : liveCatalog ? "AliExpress" : catalogSource === "local" ? text.localCatalogLabel : text.noGoods}</small>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <small>{text.categoriesQuick}</small>
            <h2>{text.categories}</h2>
          </div>
          <button type="button" onClick={() => goTo("Категории", text.allCategories)}>{text.allCategories} <ChevronRight size={16} /></button>
        </div>

        <div className="category-grid">
          {categories.length === 0 && renderCatalogState(categoriesLoading ? text.loadingCatalog : categoriesError || text.noGoods, !categoriesLoading && Boolean(categoriesError))}
          {topLevelCategories.slice(0, 8).map((category, index) => (
            <button
              key={category.id}
              type="button"
              className={`category-item ${selectedCat === category.id ? "active" : ""}`}
              onClick={() => {
                setSelectedCat(selectedCat === category.id ? "all" : category.id);
                goTo("Категории", `${categoryLabel(category)} выбрана`);
              }}
            >
              <span className={`category-icon c${index % 8}`}>◇</span>
              <b>{categoryLabel(category)}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <div>
            <small>{text.best}</small>
            <h2>{search.trim() ? text.searchResults(search.trim()) : text.forYou}</h2>
          </div>
          <button type="button" onClick={() => goTo("Категории", text.catalog)}>{text.seeAll} <ChevronRight size={16} /></button>
        </div>

        {catalogSource === "local" && <p className="catalog-source-note" role="status">{text.localCatalogNote}</p>}
        <div className="product-grid">
          {catalogMessage ? renderCatalogState(catalogMessage, Boolean(catalogError)) : visibleProducts.slice(0, 8).map((product, index) => {
            const isLiked = liked.includes(product.id);
            const price = formatUzs(product.priceMinor);
            const tag = product.status === "sale" ? "Скидка" : product.status === "popular" ? "Популярно" : "Новинка";

            return (
              <article key={product.id} className="product-card">
                <div className={`product-media media-${index % 5}`}>
                  {product.imageUrl && <img src={product.imageUrl} alt={productTitle(product) || ""} loading="lazy" />}
                  <span className="product-tag">{tag}</span>
                  <button
                    type="button"
                    className={`wish-btn ${isLiked ? "active" : ""}`}
                    onClick={() => toggleFavorite(product.id)}
                    aria-label={isLiked ? "Удалить из избранного" : "Добавить в избранное"}
                  >
                    <Heart size={15} fill={isLiked ? "currentColor" : "none"} />
                  </button>
                </div>

                <div className="product-body">
                  <span className="product-category">{categoryLabel(product.category) || "Категория"}</span>
                  <h3>{productTitle(product)}</h3>
                  <p>{productDescription(product)}</p>
                  {catalogSource === "aliexpress" && <button type="button" className="product-details-btn" onClick={() => void openProductDetails(product)}>Подробнее</button>}
                  <div className="price-row">
                    <div>
                      <strong>{price}</strong>
                      <small>Доставка от 1-3 дней</small>
                    </div>
                    <button type="button" className="mini-cart" onClick={() => handleAddToCart(product.id)}>
                      <ShoppingBag size={14} />Купить
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="low-grid">
        <div className="info-card">
          <small>Платежи</small>
          <h3>UZCARD / HUMO</h3>
          <p>Готово к оплате местными картами и будущим провайдерам.</p>
        </div>
        <div className="info-card accent">
          <small>Доставка</small>
          <h3>Посылки из Китая</h3>
          <p>Проверка, сборка и отслеживание по пути до Ташкента.</p>
        </div>
      </section>
    </>
  );

  const renderCatalog = () => (
    <section className="screen-panel">
      <div className="section-head panel-head">
        <div>
          <small>Каталог</small>
          <h2>Категории</h2>
        </div>
        <span className="category-total">{categoryUiLabel("count", categories.length)}</span>
      </div>

      <div className="category-browser-controls">
        <label className="category-search">
          <Search size={17} />
          <input
            value={categorySearch}
            onChange={(event) => setCategorySearch(event.target.value)}
            placeholder={categoryUiLabel("search")}
            aria-label={categoryUiLabel("search")}
          />
          {categorySearch && <button type="button" onClick={() => setCategorySearch("")} aria-label={categoryUiLabel("clearSearch")}><X size={16} /></button>}
        </label>
        {categorySearch ? (
          <button className="category-back-btn" type="button" onClick={() => setCategorySearch("")}>
            {categoryUiLabel("all")}
          </button>
        ) : categoryParentId ? (
          <div className="category-breadcrumbs">
            <button type="button" onClick={() => setCategoryParentId(null)}>{localizeText("Все категории", language)}</button>
            {categoryPath.map((category) => (
              <span key={category.id}>
                <ChevronRight size={14} />
                <button type="button" onClick={() => setCategoryParentId(category.id)}>{categoryLabel(category)}</button>
              </span>
            ))}
            <button className="category-back-btn" type="button" onClick={() => setCategoryParentId(categoryPath.length > 1 ? categoryPath[categoryPath.length - 2].id : null)}>
              <ChevronRight size={14} className="back-chevron" />{categoryUiLabel("back")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="category-grid large-grid category-browser-grid">
        {categories.length === 0 && renderCatalogState(categoriesLoading ? text.loadingCatalog : categoriesError || text.noGoods, !categoriesLoading && Boolean(categoriesError))}
        {browsedCategories.map((category, index) => {
          const children = categoryChildren.get(category.id) ?? [];
          const isSelected = selectedCat === category.id;
          return (
            <article key={category.id} className={`category-browser-card ${isSelected ? "selected" : ""}`}>
              <button
                type="button"
                className={`category-item ${isSelected ? "active" : ""}`}
                onClick={() => {
                  if (categorySearch || children.length === 0) {
                    setSelectedCat(category.id);
                    setNotice(`${categoryLabel(category)} активна`);
                    if (categorySearch) setCategorySearch("");
                  } else {
                    setCategoryParentId(category.id);
                  }
                }}
              >
                <span className={`category-icon c${index % 8}`}>◇</span>
                <b>{categoryLabel(category)}</b>
                {children.length > 0 && <small>{categoryUiLabel("subcategories", children.length)}</small>}
              </button>
              <button
                type="button"
                className="category-select-btn"
                onClick={() => {
                  setSelectedCat(category.id);
                  setNotice(`${categoryLabel(category)} активна`);
                }}
              >
                {categoryUiLabel(isSelected ? "selected" : "select")}
              </button>
            </article>
          );
        })}
        {!categoriesLoading && categories.length > 0 && browsedCategories.length === 0 && (
          <p className="category-empty-state" role="status">{categorySearch ? categoryUiLabel("noResults") : text.emptyCategories}</p>
        )}
      </div>

      {products.length === 0 ? (
        <div className="catalog-products-state">
          {renderCatalogState(
            catalogLoading ? text.loading : catalogError || text.noGoods,
            !catalogLoading && Boolean(catalogError)
          )}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="section-head panel-head">
            <div>
              <small>Товары</small>
              <h2>{selectedCat === "all" ? "Все товары" : categoryLabel(categories.find((item) => item.id === selectedCat))}</h2>
            </div>
          </div>
          {catalogSource === "local" && <p className="catalog-source-note" role="status">{text.localCatalogNote}</p>}
          <div className="product-grid compact-grid">
            {catalogMessage ? renderCatalogState(catalogMessage, Boolean(catalogError)) : visibleProducts.map((product, index) => (
              <article key={product.id} className="product-card compact-card">
                <div className={`product-media media-${index % 5}`}>
                  {product.imageUrl && <img src={product.imageUrl} alt={productTitle(product) || ""} loading="lazy" />}
                  <span className="product-tag">{product.status === "sale" ? "Скидка" : "Новинка"}</span>
                  <button type="button" className={`wish-btn ${liked.includes(product.id) ? "active" : ""}`} onClick={() => toggleFavorite(product.id)} aria-label={liked.includes(product.id) ? "Удалить из избранного" : "Добавить в избранное"}>
                    <Heart size={15} fill={liked.includes(product.id) ? "currentColor" : "none"} />
                  </button>
                </div>
                <div className="product-body">
                  <span className="product-category">{categoryLabel(product.category)}</span>
                  <h3>{productTitle(product)}</h3>
                  {catalogSource === "aliexpress" && <button type="button" className="product-details-btn" onClick={() => void openProductDetails(product)}>Подробнее</button>}
                  <div className="price-row">
                    <strong>{formatUzs(product.priceMinor)}</strong>
                    <button type="button" className="mini-cart" onClick={() => handleAddToCart(product.id)}><Plus size={14} />Добавить</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );

  const renderChinaGoods = () => (
    <section className="screen-panel">
      <div className="section-head panel-head">
        <div>
          <small>{catalogSource === "local" ? text.localCatalogLabel : "Международный каталог"}</small>
          <h2>{catalogSource === "local" ? "Товары каталога URIONA" : "Горячие товары"}</h2>
        </div>
        <button type="button" onClick={() => setSelectedCat("all")}>Показать всё</button>
      </div>

      {catalogSource === "local" && <p className="catalog-source-note" role="status">{text.localCatalogNote}</p>}
      <div className="product-grid compact-grid">
        {hotMessage ? renderCatalogState(hotMessage, Boolean(catalogError)) : hotProducts.map((product, index) => (
            <article key={product.id} className="product-card compact-card">
              <div className={`product-media media-${index % 5}`}>
                {product.imageUrl && <img src={product.imageUrl} alt={productTitle(product) || ""} loading="lazy" />}
                <span className="product-tag">{product.status === "sale" ? "Скидка" : "Популярно"}</span>
              </div>
              <div className="product-body">
                <span className="product-category">{categoryLabel(product.category)}</span>
                <h3>{productTitle(product)}</h3>
                {catalogSource === "aliexpress" && <button type="button" className="product-details-btn" onClick={() => void openProductDetails(product)}>Подробнее</button>}
                <div className="price-row">
                  <strong>{formatUzs(product.priceMinor)}</strong>
                  <button type="button" className="mini-cart" onClick={() => handleAddToCart(product.id)}><Plus size={14} />Добавить</button>
                </div>
              </div>
            </article>
          ))}
      </div>
    </section>
  );

  const renderSales = () => (
    <section className="screen-panel">
      <div className="section-head panel-head">
        <div>
          <small>Скидки</small>
          <h2>Акции недели</h2>
        </div>
      </div>

      <div className="info-card accent" style={{ marginBottom: 18 }}>
        <small>Спецпредложение</small>
        <h3>Скидка до 50% на популярные категории</h3>
        <p>Тестовый промокод SAVE10 действует на заказы от 500 000 сум.</p>
      </div>

      <div className="product-grid compact-grid">
        {saleMessage ? renderCatalogState(saleMessage, Boolean(catalogError)) : saleProducts.map((product, index) => (
          <article key={product.id} className="product-card compact-card">
            <div className={`product-media media-${index % 5}`}>
              {product.imageUrl && <img src={product.imageUrl} alt={productTitle(product) || ""} loading="lazy" />}
              <span className="product-tag">Скидка</span>
            </div>
            <div className="product-body">
              <span className="product-category">{categoryLabel(product.category)}</span>
              <h3>{productTitle(product)}</h3>
              {catalogSource === "aliexpress" && <button type="button" className="product-details-btn" onClick={() => void openProductDetails(product)}>Подробнее</button>}
              <div className="price-row">
                <strong>{formatUzs(product.priceMinor)}</strong>
                <button type="button" className="mini-cart" onClick={() => handleAddToCart(product.id)}><Plus size={14} />Купить</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderHowToOrder = () => (
    <section className="screen-panel">
      <div className="section-head panel-head">
        <div>
          <small>Как заказать</small>
          <h2>3 простых шага</h2>
        </div>
      </div>

      <div className="profile-list">
        <div className="profile-item"><span>1. Выберите товар</span><b>Откройте каталог или подборки</b></div>
        <div className="profile-item"><span>2. Добавьте в корзину</span><b>Проверьте цену и количество</b></div>
        <div className="profile-item"><span>3. Оформите заказ</span><b>Оплата и доставка в Узбекистан</b></div>
      </div>
    </section>
  );

  const renderDelivery = () => (
    <section className="screen-panel">
      <div className="section-head panel-head">
        <div>
          <small>Доставка</small>
          <h2>Как мы доставляем</h2>
        </div>
      </div>

      <div className="low-grid">
        <div className="info-card">
          <small>Срок</small>
          <h3>От 7 до 21 дня</h3>
          <p>Зависит от продавца, типа товара и логистики до Ташкента.</p>
        </div>
        <div className="info-card accent">
          <small>Отслеживание</small>
          <h3>По треку и статусам</h3>
          <p>Получаете уведомления о перемещении посылки и готовности к выдаче.</p>
        </div>
      </div>
    </section>
  );

  const renderSupport = () => (
    <section className="screen-panel">
      <div className="section-head panel-head">
        <div>
          <small>Поддержка</small>
          <h2>Центр помощи</h2>
        </div>
      </div>
      <div className="profile-help">
        <details><summary>Как оформить заказ?</summary><p>Добавьте доступные товары в корзину и перейдите к оформлению. Сейчас оформление и приём оплаты ещё не подключены.</p></details>
        <details><summary>Где посмотреть статус заказа?</summary><p>Статус оформленного заказа будет доступен в профиле, в разделе «Мои заказы».</p></details>
        <details><summary>Почему каталог может быть недоступен?</summary><p>Каталог зависит от разрешений AliExpress Open Platform. При отказе API Uriona показывает сообщение и кнопку повтора запроса.</p></details>
        <div className="profile-help-actions">
          <button type="button" className="secondary-btn" onClick={() => goTo("Профиль")}>Открыть профиль</button>
          <button type="button" className="secondary-btn" onClick={() => goTo("Корзина")}>Открыть корзину</button>
        </div>
        <p className="profile-hint">Контактный канал поддержки пока не настроен. Здесь не указан фиктивный телефон или неработающий чат.</p>
      </div>
    </section>
  );

  const renderCart = () => (
    <section className="screen-panel">
      <div className="section-head panel-head">
        <div>
          <small>Корзина</small>
          <h2>Ваш заказ</h2>
        </div>
        <span className="pill-count">{cartCount} шт.</span>
      </div>

      {cartEntryList.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag size={38} />
          <h3>{text.emptyCart}</h3>
          <p>{text.addFromCatalog}</p>
          <button type="button" className="primary-btn" onClick={() => goTo("Категории", "Каталог открыт")}>{text.shop}</button>
        </div>
      ) : (
        <>
          <div className="cart-list">
            {cartEntryList.map((product) => (
              <div key={product.id} className="cart-item">
                <div className="cart-thumb">
                  {product.imageUrl && <img src={product.imageUrl} alt="" loading="lazy" />}
                </div>
                <div className="cart-copy">
                  <h3>{productTitle(product)}</h3>
                  <p>{formatUzs(product.priceMinor)}</p>
                </div>
                <div className="qty-control">
                  <button type="button" onClick={() => handleQtyChange(product.id, -1)}><Minus size={14} /></button>
                  <span>{cartItems[product.id] ?? 0}</span>
                  <button type="button" onClick={() => handleQtyChange(product.id, 1)}><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="promo-box">
            <label htmlFor="promo-code">Промокод</label>
            <div className="promo-row">
              <input
                id="promo-code"
                value={promo}
                onChange={(event) => {
                  setPromo(event.target.value);
                  setAppliedPromo("");
                }}
                placeholder="SAVE10"
              />
              <button type="button" onClick={applyPromo}>Применить</button>
            </div>
          </div>

          <div className="totals">
            <div><span>Товары</span><b>{formatUzs(subtotal)}</b></div>
            <div><span>Доставка</span><b>{formatUzs(shipping)}</b></div>
            <div><span>Скидка</span><b>-{formatUzs(discount)}</b></div>
            <div className="grand"><span>Итого</span><b>{formatUzs(total)}</b></div>
          </div>

          <button type="button" className="primary-btn checkout-btn" onClick={() => setNotice("Оформление заказа ещё не подключено")}>
            Перейти к оформлению <ArrowRight size={18} />
          </button>
          <p className="checkout-note">Оформление заказа пока недоступно.</p>
        </>
      )}
    </section>
  );

  const renderProfile = () => {
    const savedProducts = liked.flatMap((id) => {
      const product = knownProducts.find((item) => item.id === id);
      return product ? [product] : [];
    });
    const unavailableFavorites = liked.length - savedProducts.length;
    const visibleOrders = orders.filter((order) => {
      const isArchived = order.status === "DELIVERED" || order.status === "CANCELLED";
      return orderFilter === "all" || (orderFilter === "archive" ? isArchived : !isArchived);
    });
    const activeOrderCount = orders.filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELLED").length;
    const orderDate = (value: string) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "Дата не указана" : new Intl.DateTimeFormat(language === "uz" ? "uz-UZ" : language === "en" ? "en-US" : "ru-RU", { dateStyle: "medium" }).format(date);
    };
    const profileMenuItems: Array<{ key: typeof profileSection; label: string; Icon: typeof UserRound }> = [
      { key: "overview", label: "Обзор", Icon: UserRound },
      { key: "orders", label: "Мои заказы", Icon: Package },
      { key: "wishlist", label: "Избранное", Icon: Heart },
      { key: "stores", label: "Любимые магазины", Icon: Store },
      { key: "reviews", label: "Мои отзывы", Icon: Star },
      { key: "questions", label: "Вопросы и ответы", Icon: HelpCircle },
      { key: "coupons", label: "Купоны", Icon: Ticket },
      { key: "addresses", label: "Адреса доставки", Icon: MapPin },
      { key: "payments", label: "Способы оплаты", Icon: CreditCard },
      { key: "settings", label: "Настройки", Icon: ShieldCheck },
      { key: "support", label: "Служба поддержки", Icon: MessageCircle },
    ];
    return (
    <section className="screen-panel">
      {!profile ? (
        <div className="auth-panel">
          <div className="profile-header">
            <div className="profile-avatar"><LogoMark /></div>
            <div><small>Личный кабинет</small><h2>{verificationPending ? "Подтвердите email" : authMode === "login" ? "Войти в URIONA" : authMode === "register" ? "Создать аккаунт" : "Сбросить пароль"}</h2></div>
          </div>
          {verificationPending ? (
            <>
              <p className="profile-intro">Для защиты аккаунта подтвердите адрес электронной почты по ссылке в письме. До подтверждения доступ к профилю и заказам не выдаётся.</p>
              <div className="profile-actions">
                <button type="button" className="primary-btn" disabled={profileBusy} onClick={() => void checkEmailVerification()}>Я подтвердил email</button>
                <button type="button" className="secondary-btn" disabled={profileBusy} onClick={() => void resendVerificationEmail()}>Отправить письмо ещё раз</button>
                <button type="button" className="secondary-btn" disabled={profileBusy} onClick={() => void returnToLogin()}>Вернуться ко входу</button>
              </div>
            </>
          ) : (
            <>
              <p className="profile-intro">{authMode === "login" ? "Войдите, чтобы управлять заказами, адресами и избранным." : authMode === "register" ? "Создайте аккаунт. Для завершения регистрации нужно подтвердить email." : "Укажите email — отправим ссылку для создания нового пароля."}</p>
              <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void (authMode === "reset" ? submitPasswordReset() : submitAuth()); }}>
                <label>Email<input type="email" autoComplete="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="name@example.com" /></label>
                {authMode !== "reset" && <label>Пароль<input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={8} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Минимум 8 символов" /></label>}
                <div className="profile-actions">
                  <button type="submit" className="primary-btn" disabled={profileBusy || !firebaseConfigReady || !authEmail || (authMode !== "reset" && authPassword.length < 8)}>{profileBusy ? "Подождите…" : authMode === "login" ? "Войти" : authMode === "register" ? "Зарегистрироваться" : "Отправить ссылку"}</button>
                  {authMode === "login" && <button type="button" className="secondary-btn" onClick={() => { setAuthMode("register"); setAuthNotice(""); }}>Создать аккаунт</button>}
                  {authMode === "register" && <button type="button" className="secondary-btn" onClick={() => { setAuthMode("login"); setAuthNotice(""); }}>Уже есть аккаунт</button>}
                  {authMode === "reset" && <button type="button" className="secondary-btn" onClick={() => { setAuthMode("login"); setAuthNotice(""); }}>Вернуться ко входу</button>}
                </div>
              </form>
              {authMode === "login" && <button type="button" className="auth-link" onClick={() => { setAuthMode("reset"); setAuthNotice(""); }}>Забыли пароль?</button>}
              {!firebaseConfigReady && <p className="auth-message error" role="alert">Firebase не настроен для этого сайта: кнопки входа временно отключены. Нужны настройки Web App из Firebase Console и включённый метод Email/Password.</p>}
            </>
          )}
          {authNotice && <p className="auth-message" role="status">{authNotice}</p>}
        </div>
      ) : (
        <>
          <div className="profile-header">
            <div className="profile-avatar"><LogoMark /></div>
            <div><small>Личный кабинет</small><h2>{profileForm.name || profileForm.email}</h2><span className="profile-email">{profileForm.email}</span></div>
          </div>
          <div className="profile-layout">
            <nav className="profile-menu" aria-label="Разделы профиля">
              {profileMenuItems.map(({ key, label, Icon: MenuIcon }) => {
                return <button key={key} type="button" className={profileSection === key ? "active" : ""} onClick={() => setProfileSection(key)}><MenuIcon size={17} />{label}</button>;
              })}
              <button type="button" className="profile-logout" onClick={() => void logout()}><X size={17} />Выйти</button>
            </nav>
            <div className="profile-content">
              {profileSection === "overview" && <>
                <div className="mini-grid">
                  <button type="button" className="mini-tile" onClick={() => setProfileSection("orders")}><Package size={18} /><span>Активные заказы</span><b>{activeOrderCount}</b></button>
                  <button type="button" className="mini-tile" onClick={() => setProfileSection("payments")}><CreditCard size={18} /><span>Оплата</span><b>Настроить</b></button>
                  <button type="button" className="mini-tile" onClick={() => setProfileSection("wishlist")}><Heart size={18} /><span>Избранное</span><b>{liked.length}</b></button>
                </div>
                <div className="profile-section-heading"><div><small>Ваш аккаунт</small><h3>Личные данные</h3></div><ShieldCheck size={22} /></div>
                <div className="profile-form">
                  <label>Имя<input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} placeholder="Ваше имя" /></label>
                  <label>Email<input type="email" value={profileForm.email} readOnly /></label>
                  <label>Телефон<input type="tel" value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} placeholder="Добавить номер позже" /></label>
                  <label>Город<input value={profileForm.city} onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })} placeholder="Ташкент" /></label>
                  <label>Адрес доставки<textarea value={profileForm.address} onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })} placeholder="Улица, дом, квартира" rows={3} /></label>
                </div>
                <div className="profile-actions"><button type="button" className="primary-btn" disabled={profileBusy} onClick={() => void saveProfile()}>Сохранить профиль</button></div>
              </>}
              {profileSection === "orders" && <>
                <div className="profile-section-heading"><div><small>История покупок</small><h3>Мои заказы</h3></div><button type="button" className="text-action" onClick={() => setOrdersAttempt((attempt) => attempt + 1)} disabled={ordersLoading}>Обновить</button></div>
                <div className="profile-filter-row" role="group" aria-label="Фильтр заказов">
                  {(["all", "active", "archive"] as const).map((filter) => <button type="button" key={filter} className={orderFilter === filter ? "active" : ""} aria-pressed={orderFilter === filter} onClick={() => setOrderFilter(filter)}>{filter === "all" ? "Все" : filter === "active" ? "Активные" : "Архив"}</button>)}
                </div>
                {ordersLoading ? <div className="profile-empty"><Package size={30} /><p>Загружаем заказы…</p></div>
                  : ordersError ? <div className="profile-empty" role="alert"><Package size={30} /><h3>Не удалось загрузить заказы</h3><p>{ordersError}</p><button type="button" className="secondary-btn" onClick={() => setOrdersAttempt((attempt) => attempt + 1)}>Повторить</button></div>
                  : visibleOrders.length === 0 ? <div className="profile-empty"><Package size={30} /><h3>{orders.length ? "В этом разделе пока нет заказов" : "Заказов пока нет"}</h3><p>Оформленные покупки и их статусы появятся здесь.</p><button type="button" className="secondary-btn" onClick={() => goTo("Каталог")}>Перейти в каталог</button></div>
                  : <div className="profile-order-list">{visibleOrders.map((order) => (
                    <article className="profile-order-card" key={order.id}>
                      <div className="profile-order-top"><div><small>Заказ {order.id.slice(0, 8)}</small><time>{orderDate(order.createdAt)}</time></div><span className={`order-status status-${order.status.toLowerCase()}`}>{orderStatusLabels[order.status] ?? order.status}</span></div>
                      <div className="profile-order-items">{order.items.map((item) => <div className="profile-order-item" key={item.id}>
                        {item.product?.imageUrl ? <img src={item.product.imageUrl} alt="" loading="lazy" /> : <span className="order-item-placeholder"><ShoppingBag size={16} /></span>}
                        <span>{item.product ? productTitle(item.product) : localizeText(`Товар ${item.productId.slice(0, 8)}`, language)}</span><b>× {item.quantity}</b>
                      </div>)}</div>
                      <div className="profile-order-bottom"><span>{order.deliveryAddress}</span><b>{formatUzs(order.totalMinor)}</b></div>
                    </article>
                  ))}</div>}
              </>}
              {profileSection === "wishlist" && <>
                <div className="profile-section-heading"><div><small>Сохранённые товары</small><h3>Избранное · {liked.length}</h3></div></div>
                {savedProducts.length ? <div className="product-grid compact-grid">{savedProducts.map((product, index) => (
                  <article className="product-card compact-card" key={product.id}>
                    <div className={`product-media media-${index % 5}`}>{product.imageUrl && <img src={product.imageUrl} alt={productTitle(product) || ""} loading="lazy" />}</div>
                    <div className="product-body"><span className="product-category">{categoryLabel(product.category) || "Товар"}</span><h3>{productTitle(product)}</h3>
                      <div className="price-row"><strong>{formatUzs(product.priceMinor)}</strong><button type="button" className="mini-cart" onClick={() => handleAddToCart(product.id)}><ShoppingBag size={14} />В корзину</button></div>
                      <div className="profile-card-actions">{/^\d+$/.test(product.id) && <button type="button" onClick={() => openProductDetails(product)}>Подробнее</button>}<button type="button" onClick={() => toggleFavorite(product.id)}>Убрать</button></div>
                    </div>
                  </article>
                ))}</div> : <div className="profile-empty"><Heart size={30} /><h3>Избранное пока пусто</h3><p>Нажимайте на сердечко в карточке товара — товары сохранятся на этом устройстве.</p><button type="button" className="secondary-btn" onClick={() => goTo("Каталог")}>Найти товары</button></div>}
                {unavailableFavorites > 0 && <p className="profile-hint">{unavailableFavorites} сохранённых товаров сейчас отсутствуют в локальном каталоге. Когда каталог загрузится, они появятся здесь.</p>}
              </>}
              {profileSection === "stores" && <div className="profile-empty"><Store size={30} /><h3>Любимые магазины</h3><p>В текущем каталоге Uriona AliExpress не передаёт данные продавцов, необходимые для подписки на магазин. Раздел заработает после подтверждения доступа к данным магазинов.</p><button type="button" className="secondary-btn" onClick={() => goTo("Каталог")}>Вернуться в каталог</button></div>}
              {profileSection === "reviews" && <div className="profile-empty"><Star size={30} /><h3>Мои отзывы</h3><p>Отзывы можно оставить после доставки заказа. Публикация и хранение отзывов пока не подключены.</p><button type="button" className="secondary-btn" onClick={() => setProfileSection("orders")}>Мои заказы</button></div>}
              {profileSection === "questions" && <div className="profile-empty"><HelpCircle size={30} /><h3>Вопросы и ответы</h3><p>Вопросы продавцам и история ответов пока не подключены: для этого нужен разрешённый API продавцов и отдельный раздел товара.</p><button type="button" className="secondary-btn" onClick={() => goTo("Поддержка")}>Открыть справку</button></div>}
              {profileSection === "coupons" && <div className="profile-coupon">
                <div className="coupon-icon"><Ticket size={22} /></div><div><small>Купон Uriona</small><h3>SAVE10 · скидка 10%</h3><p>Действует на товары при сумме от 500 000 сум. Применение будет доступно в корзине.</p><button type="button" className="secondary-btn" onClick={() => { setPromo("SAVE10"); goTo("Корзина", "Промокод добавлен в корзину"); }}>Перейти в корзину</button></div>
              </div>}
              {profileSection === "addresses" && <>
                <div className="profile-section-heading"><div><small>Для оформления заказа</small><h3>Основной адрес доставки</h3></div><MapPin size={22} /></div>
                <div className="profile-form">
                  <label>Получатель<input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} placeholder="Имя получателя" /></label>
                  <label>Телефон<input type="tel" value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} placeholder="+998" /></label>
                  <label>Город<input value={profileForm.city} onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })} placeholder="Ташкент" /></label>
                  <label>Улица, дом, квартира<textarea value={profileForm.address} onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })} placeholder="Улица, дом, квартира" rows={3} /></label>
                </div>
                <div className="profile-actions"><button type="button" className="primary-btn" disabled={profileBusy} onClick={() => void saveProfile()}>Сохранить адрес</button></div>
                <p className="profile-hint">Сейчас профиль поддерживает один основной адрес. Несколько адресов добавим вместе с оформлением заказа.</p>
              </>}
              {profileSection === "payments" && <div className="profile-empty"><CreditCard size={30} /><h3>Оплата картой пока не подключена</h3><p>Не вводите и не отправляйте данные банковской карты в профиль. Подключение UZCARD/HUMO появится после настройки платёжного провайдера.</p></div>}
              {profileSection === "settings" && <>
                <div className="profile-section-heading"><div><small>Персональные настройки</small><h3>Настройки аккаунта</h3></div><ShieldCheck size={22} /></div>
                <div className="profile-form">
                  <label>Email<input type="email" value={profileForm.email} readOnly /></label>
                  <label>Язык интерфейса<select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="ru">Русский</option><option value="uz">O‘zbekcha</option><option value="en">English</option></select></label>
                </div>
                <div className="profile-setting-row"><span>Тема оформления</span><button type="button" className="secondary-btn" onClick={() => setLightMode((mode) => !mode)}>{lightMode ? "Включить тёмную тему" : "Включить светлую тему"}</button></div>
                <p className="profile-hint">Язык и тема сохраняются на этом устройстве. Email используется для входа; смена пароля пока не подключена.</p>
              </>}
              {profileSection === "support" && <div className="profile-help">
                <div className="profile-section-heading"><div><small>Помощь по Uriona</small><h3>Частые вопросы</h3></div><MessageCircle size={22} /></div>
                <details><summary>Как найти товар?</summary><p>Откройте каталог и воспользуйтесь строкой поиска. Доступность реального каталога зависит от ответа AliExpress API.</p></details>
                <details><summary>Где проверить заказ?</summary><p>После оформления заказа его статус появится в разделе «Мои заказы» профиля.</p></details>
                <details><summary>Как сохранить товар?</summary><p>Нажмите на значок сердца на карточке товара. Избранное сохраняется в браузере на этом устройстве.</p></details>
                <details><summary>Как связаться с поддержкой?</summary><p>Контактный канал поддержки Uriona ещё не настроен. Мы не показываем фиктивный телефон или неработающий чат.</p></details>
                <button type="button" className="secondary-btn" onClick={() => goTo("Поддержка")}>Раздел помощи</button>
              </div>}
            </div>
          </div>
        </>
      )}
    </section>
    );
  };

  const renderMain = () => {
    if (view === "Главная") return renderHome();
    if (view === "Категории") return renderCatalog();
    if (view === "Каталог") return renderCatalog();
    if (view === "Международный каталог") return renderChinaGoods();
    if (view === "Скидки") return renderSales();
    if (view === "Как заказать") return renderHowToOrder();
    if (view === "Доставка") return renderDelivery();
    if (view === "Поддержка") return renderSupport();
    if (view === "Корзина") return renderCart();
    return renderProfile();
  };

  return localizeNode(
    <div className={`app-shell ${lightMode ? "light-mode" : ""}`}>
      <header className="topbar">
        <div className="top-row">
          <div className="brand" aria-label="URIONA logo">
            <LogoMark className="brand-mark" />
            <span>URIONA</span>
          </div>

          <div className="location">
            <MapPin size={17} />
            <div>
              <small>Доставка в</small>
              <b>Ташкент</b>
            </div>
          </div>

          <div className="search-box">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search} />
            <button type="button" onClick={() => setNotice(search.trim() ? search.trim() : text.search)}>⌕</button>
          </div>

          <div className="utility-controls">
            <Languages size={16} />
            <select aria-label={text.lang} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              <option value="ru">RU</option><option value="en">EN</option><option value="uz">UZ</option>
            </select>
            <button type="button" className="theme-toggle" aria-label={lightMode ? text.dark : text.light} onClick={() => setLightMode((mode) => !mode)}>
              {lightMode ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>

          <button className="icon-btn" type="button" onClick={() => goTo("Профиль", "Профиль открыт")}>
            <UserRound size={20} />
            <span>{text.profile}</span>
          </button>

          <button className="icon-btn cart" type="button" onClick={() => goTo("Корзина", "Корзина открыта")}>
            <ShoppingBag size={20} />
            <span>{text.cart}</span>
            {cartCount > 0 && <i>{cartCount}</i>}
          </button>
        </div>

        <nav className="nav-menu" aria-label="Основное меню">
          {topMenuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={item.view === view ? "active" : ""}
              onClick={() => {
                setSelectedCat("all");
                goTo(item.view, item.message);
              }}
            >
              {item.view === "Каталог" ? text.catalog : item.view === "Международный каталог" ? text.global : item.view === "Скидки" ? text.sales : item.view === "Как заказать" ? text.how : item.view === "Доставка" ? text.delivery : text.support}
            </button>
          ))}
        </nav>
      </header>

      <main className="page">{renderMain()}</main>

      {detailProduct && (
        <div className="product-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailProduct(null); }}>
          <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
            <button type="button" className="product-dialog-close" onClick={() => setDetailProduct(null)} aria-label="Закрыть"><X size={20} /></button>
            {(productDetails?.images[0] || detailProduct.imageUrl) && <img className="product-dialog-image" src={productDetails?.images[0] || detailProduct.imageUrl || undefined} alt={productDetails?.subject || productTitle(detailProduct) || ""} />}
            <small>{productDetails?.categoryId ? localizeText("Товар AliExpress", language) : categoryLabel(detailProduct.category) || localizeText("Товар AliExpress", language)}</small>
            <h2 id="product-dialog-title">{productDetails?.subject || productTitle(detailProduct)}</h2>
            <p>{productDetails?.description || productDescription(detailProduct) || (detailLoading ? "Загружаем описание товара…" : "Описание не предоставлено API.")}</p>
            <strong>{formatUzs(detailProduct.priceMinor)}</strong>
            <code>product_id: {detailProduct.id}</code>
            {detailLoading && <p className="product-detail-state" role="status">Загружаем данные AliExpress…</p>}
            {detailError && <div className="product-detail-state" role="alert"><span>{detailError}</span><button type="button" onClick={() => setDetailAttempt((attempt) => attempt + 1)}>Повторить</button></div>}
            {productDetails && <>
              <dl className="product-detail-meta">
                {productDetails.status && <div><dt>Статус</dt><dd>{productDetails.status}</dd></div>}
                {productDetails.categoryId && <div><dt>ID категории</dt><dd>{productDetails.categoryId}</dd></div>}
                {productDetails.storeName && <div><dt>Магазин</dt><dd>{productDetails.storeName}</dd></div>}
                {productDetails.grossWeight && <div><dt>Вес брутто</dt><dd>{productDetails.grossWeight}</dd></div>}
                {productDetails.dimensions && <div><dt>Размер упаковки</dt><dd>{productDetails.dimensions}</dd></div>}
                {productDetails.deliveryTime && <div><dt>Срок отправки</dt><dd>{productDetails.deliveryTime}</dd></div>}
              </dl>
              {productDetails.images.length > 1 && <div className="product-detail-images" aria-label="Фотографии товара">
                {productDetails.images.slice(1, 7).map((image) => <img key={image} src={image} alt="" loading="lazy" />)}
              </div>}
              {productDetails.videos.length > 0 && <div className="product-detail-videos">
                {productDetails.videos.map((video) => <video key={video} src={video} controls preload="none" aria-label="Видео товара" />)}
              </div>}
              {productDetails.skus.length > 0 && <div className="product-detail-skus">
                <h3>Варианты товара</h3>
                {productDetails.skus.slice(0, 24).map((sku, index) => {
                  const properties = readRecords(sku.ae_sku_property_dtos)
                    .map((property) => `${readString(property, "property_name", "sku_property_name", "prop_name")}: ${readString(property, "property_value", "sku_property_value", "prop_value")}`)
                    .filter((value) => value !== ": ");
                  const price = readString(sku, "offer_sale_price", "sku_price");
                  const stock = readString(sku, "sku_available_stock");
                  return <div className="product-detail-sku" key={readString(sku, "sku_id") || index}>
                    <span>{properties.join(" · ") || `Вариант ${index + 1}`}</span>
                    <b>{price ? `${price} USD` : "Цена не указана"}{stock ? ` · Остаток: ${stock}` : ""}</b>
                  </div>;
                })}
              </div>}
            </>}
          </section>
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}

      <nav className="bottom-nav" aria-label="Нижняя навигация">
        {navItems.map((item) => (
          <button
            key={item}
            type="button"
            className={view === item ? "active" : ""}
            onClick={() => goTo(item, `${item} открыт`)}
          >
            <span>{item === "Главная" ? text.home : item === "Категории" ? text.categories : item === "Корзина" ? text.cart : text.profile}</span>
          </button>
        ))}
      </nav>
    </div>,
    language,
  );
}
