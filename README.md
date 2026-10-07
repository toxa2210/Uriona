# Uriona (Pinduoduo Uzbekistan)

Кросс-бордер e-commerce платформа для Узбекистана: локальный каталог + маркетплейс-товары (AliExpress DS API), корзина, заказы, оплата Click/Payme/Paynet, CRM для операторов.

## Requirements

- Node.js 22+
- Docker + Docker Compose (PostgreSQL 17, Redis 7)
- npm 10+

## Installation

```bash
git clone https://github.com/toxa2210/Uriona.git
cd Uriona

docker compose up -d        # PostgreSQL + Redis

cd backend
cp .env.example .env        # заполнить значения
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed         # демо-категории и товары
npm run dev                 # http://localhost:8000/api/v1

cd ../frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

CRM (для сотрудников с ролью ADMIN):

```bash
cd crm && cp .env.example .env && npm install && npm run dev
```

## Environment

Ключевые переменные backend (`backend/.env`):

| Переменная | Обязательна | Назначение |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL |
| `JWT_SECRET` | ✅ | Подпись токенов |
| `APP_ENV` | ✅ | `development` / `production` (dev OTP `123456` только вне production) |
| `USD_TO_UZS_RATE` | для marketplace | Курс конвертации цен маркетплейса в UZS (тийины) |
| `FIREBASE_PROJECT_ID` | для email-входа | Firebase Auth |
| `ALIEXPRESS_*` | для marketplace | APP_KEY/APP_SECRET + OAuth + ключ шифрования токенов |
| `CLICK_*` / `PAYME_*` / `PAYNET_*` | для оплаты | Merchant credentials |

При отсутствии credentials провайдера приложение запускается, а провайдер отвечает статусом `NOT_CONFIGURED` — backend не падает.

## Database

```bash
npx prisma format && npx prisma validate
npx prisma generate
npx prisma migrate dev      # разработка
npx prisma migrate deploy   # production
```

## Payments

- Click: callback `/api/v1/integrations/payments/click` (MD5-подпись, проверка суммы и дубликатов, timing-safe сравнение).
- Payme: JSON-RPC (`CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`, `CheckTransaction`, `GetStatement`), Basic-авторизация merchant key.
- Paynet: каркас контроллера/сервиса; требует merchant-договора.

Никогда не доверять `amount`/`status`/`orderId` из frontend — статус PAID ставится только после проверенного callback провайдера.

## Marketplace

Актуальный провайдер — AliExpress Dropshipping API (`/api/v1/integrations/aliexpress/*`). OAuth-токены хранятся зашифрованными (AES-256-GCM). Цены и доставка перепроверяются при создании заказа; конвертация в UZS — только на backend.

Доступ Pinduoduo Open API на данный момент отсутствует — см. `docs/` дорожную карту.

## Testing

```bash
cd backend && npm test
```

E2E и unit-набор по ТЗ §46–47 — в разработке (см. `docs/02-ДО-ЗАВЕРШЕНИЯ-РАЗРАБОТКИ.md`).

## Docker

```bash
docker compose up -d   # PostgreSQL + Redis
```

Backend в compose и healthchecks — в дорожной карте (Этап 1).

## Architecture

```text
Frontend (Vite/React) ─┐
CRM (Vite/React) ──────┤ REST /api/v1
                       ▼
              Backend (NestJS)
               ├── PostgreSQL (Prisma)
               ├── Redis
               ├── Marketplace Adapter (AliExpress DS)
               ├── Payment Adapters (Click/Payme/Paynet)
               └── Delivery (контракт Cainiao, ручной трекинг через CRM)
```

Мобильное приложение Android (`frontend/mobile/uriona`) — прототип.

## Документация

- `техническая задача.txt` — полное ТЗ (57 разделов).
- `docs/01-ОТЧЁТ-АУДИТА.md` — аудит 08.10.2026: дыры, безопасность, статус PASS/FAIL.
- `docs/02-ДО-ЗАВЕРШЕНИЯ-РАЗРАБОТКИ.md` — дорожная карта по этапам ТЗ.
- `docs/03-ЧЕКЛИСТ-ДО-ЗАПУСКА.md` — pre-launch чек-лист.
- `docs/production-business-and-tech-plan.html` — бизнес- и техплан запуска.

## Security

См. `SECURITY.md`. Секреты не коммитить; репозиторий содержит коммерческую архитектуру — держать Private (ТЗ §52).
