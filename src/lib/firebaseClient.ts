/**
 * Firebase CLIENT SDK — browser-side initialization.
 * Used for: Auth, Firestore real-time reads (if needed in future), etc.
 *
 * Project : pick2home-1
 * Region  : asia-south1 (Mumbai) — lowest latency for India
 *
 * Config comes from NEXT_PUBLIC_* env vars (set in .env).
 * These are safe to expose in the browser.
 *
 * NOTE: Firebase Admin SDK (server-side) lives in src/lib/firebase.ts
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Prevent re-initializing on hot-reload in dev
function getFirebaseClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return initializeApp(firebaseConfig);
}

export const firebaseClientApp: FirebaseApp = getFirebaseClientApp();
export const firebaseClientStorage: FirebaseStorage = getStorage(firebaseClientApp);
export const firebaseClientDb: Firestore = getFirestore(firebaseClientApp);
export const firebaseClientAuth: Auth = getAuth(firebaseClientApp);
