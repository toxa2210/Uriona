# Uriona CRM

Standalone staff-facing CRM application. It uses the store's existing backend and database; it does not create a second customer or order database.

## Local development

1. Install this app's dependencies from the repository root:

   ```powershell
   npm --prefix crm install
   ```

2. Copy `crm/.env.example` to `crm/.env.local` and set the Firebase web app values. For local development, `VITE_API_URL` selects the backend for the Vite proxy (for example `http://localhost:8000/api/v1` or the deployed API URL).
3. Start the backend and its PostgreSQL database.
4. Start the CRM from the repository root:

   ```powershell
   npm run dev:crm
   ```

5. Open `http://localhost:5174`. Sign in using a verified Firebase email belonging to a user with the backend `ADMIN` role.

The backend must allow the CRM origin in `FRONTEND_URL`. To grant CRM access, first authenticate the account so it exists in the database, then run the backend's `npm run crm:promote-admin -- admin@example.com` command.

## Build and hosting

Run `npm run build:crm` from the repository root. The static site is emitted into `crm/dist`; set the hosting base directory to `crm`, the build command to `npm run build`, and the publish directory to `dist`. Set `VITE_API_URL` and the four Firebase web configuration variables in the hosting environment. Add the deployed CRM origin to the backend `FRONTEND_URL`.

The CRM uses only the existing authenticated backend API. The backend must allow the CRM site's origin in `FRONTEND_URL`. Firebase browser configuration is public app configuration; private backend credentials must never be added to `VITE_*` variables.
