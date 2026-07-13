// Firebase Admin SDK — server-side only (pick2home-1 project).
// Used by /api/uploads to push images to Firebase Storage.
//
// Config: set these in `.env`:
//   FIREBASE_PROJECT_ID             "pick2home-1"
//   FIREBASE_STORAGE_BUCKET         "pick2home-1.firebasestorage.app"
//   FIREBASE_SERVICE_ACCOUNT_JSON   Full service-account JSON (single line, escaped)
//                                   Get it: Firebase Console → Project Settings →
//                                   Service Accounts → Generate new private key
//
// When env is missing, isFirebaseConfigured() returns false so the rest of
// the app still runs — image URL fields fall back to manual URL entry.

import { cert, getApps, initializeApp, App, ServiceAccount } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

let cachedApp: App | null = null;
let initError: string | null = null;

function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    return {
      projectId: json.project_id,
      clientEmail: json.client_email,
      // Newlines in PEM keys are often escaped — restore them.
      privateKey: String(json.private_key).replace(/\\n/g, "\n"),
    };
  } catch (e) {
    initError = "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON";
    return null;
  }
}

export function isFirebaseConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_STORAGE_BUCKET);
}

export function firebaseStatus() {
  return {
    configured: isFirebaseConfigured(),
    bucket: process.env.FIREBASE_STORAGE_BUCKET || null,
    error: initError,
  };
}

export function getFirebaseApp(): App | null {
  if (cachedApp) return cachedApp;
  if (!isFirebaseConfigured()) return null;
  const sa = parseServiceAccount();
  if (!sa) return null;
  const existing = getApps()[0];
  cachedApp =
    existing ??
    initializeApp({
      credential: cert(sa),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET!,
    });
  return cachedApp;
}

export function getBucket() {
  const app = getFirebaseApp();
  if (!app) return null;
  return getStorage(app).bucket();
}
