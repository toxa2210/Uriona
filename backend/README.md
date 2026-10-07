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

Configure `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_REDIRECT_URI`, a base64-encoded 32-byte `ALIEXPRESS_TOKEN_ENCRYPTION_KEY`, and a long random `ALIEXPRESS_OAUTH_SETUP_SECRET` in the backend environment. Set the exact same redirect URI in AliExpress Open Platform. Generate keys with `openssl rand -base64 32` and `openssl rand -hex 32`; keep them stable because changing the encryption key makes stored tokens unreadable. Apply the Prisma migration before enabling OAuth. To start authorization, send a POST to `/api/v1/integrations/aliexpress/oauth/start` with the `x-aliexpress-setup-secret` header; open the returned `authorizationUrl` in a browser. The public callback validates its one-time state, exchanges the authorization code, and saves encrypted access and refresh tokens in PostgreSQL. The backend refreshes access tokens as needed. A manually supplied `ALIEXPRESS_ACCESS_TOKEN` remains a fallback and must only be configured on the backend. Never place app secrets or tokens in the frontend or repository.
