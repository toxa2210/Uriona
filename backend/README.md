# Backend

NestJS + Prisma backend for Uriona. AliExpress is the external catalog provider.

## Local development

1. Start infrastructure from repository root:
   `docker compose up -d`
2. Copy `.env.example` to `.env`.
3. Install dependencies:
   `npm install`
4. Generate Prisma client:
   `npm run prisma:generate`
5. Create the local database schema:
   `npm run prisma:migrate -- --name init`
6. Start the API:
   `npm run dev`

API base URL: `http://localhost:8000/api/v1`.

The development OTP is returned by `POST /auth/request-otp`. This is intentionally disabled as a production delivery mechanism; production must use an approved OTP provider.

Email/password sign-in is provided by Firebase Authentication. Enable the Email/Password provider in Firebase Console, set `FIREBASE_PROJECT_ID` to that project's ID, and provide the Firebase Web App configuration to the frontend. The API accepts a Firebase ID token at `POST /api/v1/auth/firebase` and rejects sign-in until the Firebase token reports a verified email. Apply database migrations with `npm run prisma:migrate:deploy`; Render runs this command during the backend build.

AliExpress product detail requests use `GET /api/v1/integrations/aliexpress/product/:productId` and require an app with Dropshipping API access. The endpoint defaults to delivery country `UZ`, currency `USD`, and language `ru_RU`; these can be overridden with `ship_to_country`, `target_currency`, and `target_language` query parameters.

Image search uses SerpApi's Google Lens engine. Set `SERPAPI_API_KEY` in the backend environment; the key must never be placed in the frontend. `POST /api/v1/integrations/aliexpress/image-search` accepts a multipart `image` file up to 8 MB, forwards it to SerpApi for image matching, and returns matching AliExpress products. Users are informed in the UI that their selected image is sent to SerpApi and Google Lens.

AliExpress catalog responses and product details are cached in the PostgreSQL `MarketplaceApiCache` table. Fresh responses are served from the database; expired responses are returned immediately while the backend refreshes them in the background. Cache lifetimes are one hour for searches, 12 hours for product details, and 24 hours for categories. Old cache entries are pruned every six hours. The browser requests catalog pages in batches of 20, while the image proxy resizes marketplace images and serves WebP thumbnails (larger WebP images for product details).

Shipping estimates use `GET /api/v1/integrations/aliexpress/freight` with `productId`, `selectedSkuId`, and `quantity`. The backend calls `aliexpress.ds.freight.query` with destination `UZ` by default; currency defaults to USD and locale to Russian. Freight quotes are deliberately not cached. The buyer must select an available option before adding an AliExpress product through the detail view.

Authenticated customers submit checkout to `POST /api/v1/orders` with recipient/address details and cart item snapshots. Before saving an AliExpress item, the backend rechecks the current SKU price and stock and requests a fresh delivery quote for the selected SKU, quantity, and destination `UZ`. Shipping is converted to UZS using AliExpress's UZS quote where available; if the quote is in another currency, the backend uses the Central Bank of Uzbekistan's published rate (cached for six hours). The saved order includes the product subtotal, delivery amount, discount, and payable total, and starts in `AWAITING_PAYMENT`. The order confirmation and order history show that status; payment initiation is deliberately not exposed yet. Apply all pending Prisma migrations before deployment. The legacy `POST /api/v1/checkout` endpoint is retired and returns `410 Gone`. AliExpress order placement and payment collection remain out of scope.

### Cainiao delivery integration status

The Cainiao application is officially launched and currently subscribes to `CROSSBORDER_WAYBILL_GET` (cross-border waybill lookup) and `CROSSBORDER_LOGISTICS_DETAIL_QUERY` (cross-border logistics details). These subscriptions do not provide a delivery-price quote or, by themselves, create/dispatch a shipment. The current checkout therefore continues to calculate AliExpress freight; it does not create a Cainiao shipment or store Cainiao tracking data.

Before implementing live Cainiao calls, obtain the API-specific documentation for both subscribed APIs and confirm the request gateway, signing/authentication rules, required resource-code fields, request/response schemas, and sandbox/test credentials. The public Cainiao integration overview and the application console do not expose those call details. Also confirm which approved API creates/dispatches a cross-border shipment; do not substitute the older `cainiao.cntms.*` merchant-warehouse API because it is a different workflow.

Remaining delivery work, in order:

1. Implement a backend-only Cainiao client with the documented gateway, signature, strict request/response validation, timeouts, and sanitized errors; cover signing and parsing with unit tests before making live calls.
2. Add an idempotent shipment workflow for eligible paid orders only, after the shipment-creation API and its required customs/parcel data are confirmed. Persist the provider order reference, waybill number, and shipment state in PostgreSQL.
3. Add authenticated order tracking endpoints using `CROSSBORDER_LOGISTICS_DETAIL_QUERY`; persist normalized tracking events and expose carrier, waybill, status, and event history in the order API/UI.
4. Decide whether Cainiao returns a printable label or a label reference, then securely proxy or download it for order details; do not expose Cainiao credentials or temporary provider URLs to the browser.
5. Validate the entire flow in Cainiao's test environment, including duplicate requests, provider timeouts/retries, cancellation/refund behavior, and a real Uzbekistan delivery before enabling production fulfillment.

Cainiao credentials and resource codes belong only in backend environment variables. `backend/.env.local` is ignored by Git; use `.env.example` for variable names only and rotate any credential that has been exposed.

### Standalone CRM

The CRM is a separately deployed web application under `crm/`, with a separate staff login and UI. It uses the existing backend and PostgreSQL records as the source of truth; do not create a second customer/order database. Configure its `VITE_API_URL` to the backend's `/api/v1` endpoint and its Firebase web settings using the same project as the storefront. Configure backend `FRONTEND_URL` as a comma-separated list containing both the storefront and CRM origins.

Only users with the `ADMIN` role can use `/api/v1/crm/*`. To provision an administrator, first sign in once with a verified Firebase email so the user exists, then from `backend/` run `npm run crm:promote-admin -- admin@example.com`. Use an individual, controlled staff account; never promote customers through a public API. Deploy the Prisma migration before deploying the CRM or promoting the initial administrator.

The CRM MVP provides customer/order search, manual carrier and tracking updates, order status history, expenses, and a finance ledger. Confirmed payment callbacks create income ledger entries exactly once, and refunds create corresponding expense entries. The ledger is an operational cash view, not a substitute for an accountant-approved chart of accounts, bank reconciliation, tax accounting, or inventory cost accounting.

Configure `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_REDIRECT_URI`, a base64-encoded 32-byte `ALIEXPRESS_TOKEN_ENCRYPTION_KEY`, and a long random `ALIEXPRESS_OAUTH_SETUP_SECRET` in the backend environment. Set the exact same redirect URI in AliExpress Open Platform. Generate keys with `openssl rand -base64 32` and `openssl rand -hex 32`; keep them stable because changing the encryption key makes stored tokens unreadable. Apply the Prisma migration before enabling OAuth. To start authorization, send a POST to `/api/v1/integrations/aliexpress/oauth/start` with the `x-aliexpress-setup-secret` header; open the returned `authorizationUrl` in a browser. The public callback validates its one-time state, exchanges the authorization code, and saves encrypted access and refresh tokens in PostgreSQL. The backend refreshes access tokens as needed. A manually supplied `ALIEXPRESS_ACCESS_TOKEN` remains a fallback and must only be configured on the backend. Never place app secrets or tokens in the frontend or repository.
