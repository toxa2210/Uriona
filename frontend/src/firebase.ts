import { getApp, getApps, initializeApp } from "@firebase/app";
import { getAuth, type Auth } from "@firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigReady = Object.values(config).every((value) => typeof value === "string" && value.length > 0);

// Synchronous singleton: App.tsx uses `firebaseAuth` directly. When Firebase
// env vars are absent, auth UI must show a "not configured" state instead of crashing.
export const firebaseAuth: Auth | null = firebaseConfigReady
  ? getAuth(getApps().length ? getApp() : initializeApp(config))
  : null;
