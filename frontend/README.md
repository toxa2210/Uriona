# Frontend

- `src/` is the active React/Vite storefront.
- `mobile/uriona/` is the Android customer app.

Customer clients consume the versioned backend API. Build the storefront with `npm run build` from this directory.

## Firebase authentication

Create a Firebase project and Web App, enable **Authentication → Sign-in method → Email/Password** and **Google**, and add the deployed storefront domain under **Authentication → Settings → Authorized domains**. Copy the Web App's `apiKey`, `authDomain`, `projectId`, and `appId` to the matching `VITE_FIREBASE_*` variables in the frontend environment. These values are client configuration, not Admin credentials.

Set `FIREBASE_PROJECT_ID` to the same Firebase project ID in the backend environment. The API verifies Firebase ID tokens and uses the stable Firebase UID to reopen the same Uriona profile. If Google and Email/Password belong to the same Firebase email account, the storefront asks the user to sign in with the existing password before linking providers. Email verification is not required. Production deployments apply the `firebaseUid` database migration before starting the new backend.
