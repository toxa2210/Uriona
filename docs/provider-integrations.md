# Provider integrations

This repository keeps provider secrets outside Git. Copy `backend/.env.example` to a local `.env`.

## AliExpress

The AliExpress Open Platform app credentials are configured on the backend only; never put the app secret or access token in frontend variables. Add `ALIEXPRESS_APP_KEY` and `ALIEXPRESS_APP_SECRET` (and, when issued, `ALIEXPRESS_ACCESS_TOKEN`) to the backend environment in Render or `backend/.env` locally. `ALIEXPRESS_API_URL` defaults to `https://api-sg.aliexpress.com/sync`.

The signed-in Open Platform reference is in [docs/aliexpress-open-api](aliexpress-open-api/README.md). The backend exposes an affiliate/catalog slice under `/api/v1/integrations/aliexpress`:

- `GET /affiliate/products?keywords=phone&category_ids=...&page_no=1&page_size=20&target_currency=CNY` -> `aliexpress.affiliate.hotproduct.query`
- `GET /affiliate/categories` -> `aliexpress.affiliate.category.get`
- `GET /affiliate/links` -> `aliexpress.affiliate.link.generate`
- `GET /affiliate/orders` -> `aliexpress.affiliate.order.list`
- `GET /affiliate/orders/detail` -> `aliexpress.affiliate.order.get`

The storefront uses the Dropshipping product and category APIs for live catalog data. An authenticated `POST /api/v1/orders/shipping-quotes` request verifies the selected SKU and retrieves delivery options for `UZ` in `UZS`. `POST /api/v1/orders` repeats both checks to reject stale prices or delivery fees, then creates only an `AWAITING_PAYMENT` URIONA order. It does not charge the customer or submit a purchase to the AliExpress seller.

Confirm the application has the required Dropshipping API permissions and is approved for live data. Seller order placement and fulfillment APIs are not called by checkout and must not be enabled until the provider permissions, payment flow, and operational process are approved.

## Cainiao

The repository currently defines internal shipment and tracking contracts and database records only. There is no Cainiao API client or live shipment/tracking workflow. Integration requires approved API permissions, the official endpoint/signing requirements, and a confirmed business/onboarding contact from Cainiao. Do not create shipment requests or claim Cainiao tracking is active until those requirements are met.

## Click

Implemented Shop API callback endpoint:

`POST /api/v1/payments/click/callback`

Supports Prepare (action 0) and Complete (action 1), verifies the official Click signature format and stores the payment in the existing Prisma `Payment` model.

Environment:
- `CLICK_SERVICE_ID`
- `CLICK_MERCHANT_ID`
- `CLICK_SECRET_KEY`

Click must whitelist/configure the production callback URL on the merchant side.

## Payme

Implemented Merchant API JSON-RPC endpoint:

`POST /api/v1/payments/payme`

Methods:
- `CheckPerformTransaction`
- `CreateTransaction`
- `CheckTransaction`
- `PerformTransaction`
- `CancelTransaction`
- `GetStatement`

Environment:
- `PAYME_MERCHANT_ID`
- `PAYME_MERCHANT_KEY`
- `PAYME_TEST_MODE`

## Paynet

Implemented Paynet UWS JSON-RPC endpoint:

`POST /api/v1/payments/paynet/uws`

Methods:
- `GetInformation`
- `PerformTransaction`
- `CheckTransaction`
- `CancelTransaction`
- `GetStatement`

Environment:
- `PAYNET_USERNAME`
- `PAYNET_PASSWORD`

For Paynet UWS production, configure HTTPS, Basic Auth and the provider IP allowlist. The official Paynet onboarding also requires the serviceId list and production URL.

## Production checklist

1. Verify production DNS and TLS for the storefront domain and API.
2. Provision PostgreSQL/Redis and verify automated backups.
3. Set Firebase and provider credentials as deployment secrets; keep secrets out of Git and frontend build variables.
4. Configure provider callback URLs and exact production frontend origins.
5. Complete payment and marketplace sandbox/UAT tests before accepting live orders.
6. Obtain production merchant credentials and confirm marketplace order/fulfillment permissions.
7. Run Prisma migrations and verify the backend health endpoint.
8. Enable live checkout only when payment, customer support, refund handling, and supplier fulfillment are ready.

No production secret belongs in GitHub.
