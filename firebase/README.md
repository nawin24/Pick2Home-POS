# Firebase Configuration — pick2home-pos

This folder contains all Firebase-related deployment config **scoped only to the POS app**.
It is intentionally kept separate from the root `C:\pick2home\firebase.json` which manages the Flutter apps.

## Project
- **Firebase Project ID:** `pick2home-1`
- **Storage Bucket:** `pick2home-1.firebasestorage.app`

## Files
| File | Purpose |
|---|---|
| `firebase.json` | Hosting/deployment config for the POS Next.js app |
| `.firebaserc` | Maps this folder to the `pick2home-1` Firebase project |

## Firebase in the POS App

Firebase is used in **two modes**:

### 1. Admin SDK (Server-side) — `src/lib/firebase.ts`
- Used in Next.js API routes only
- Handles **image uploads to Firebase Storage**
- Needs a service account JSON key → set in `.env` as `FIREBASE_SERVICE_ACCOUNT_JSON`

### 2. Client SDK (Browser-side) — `src/lib/firebaseClient.ts`
- Used in React components/pages
- Exports: `firebaseClientStorage`, `firebaseClientDb`, `firebaseClientAuth`
- Configured via `NEXT_PUBLIC_*` env vars in `.env`

## How to get the Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project **pick2home-1**
3. Project Settings (⚙) → **Service Accounts** tab
4. Click **"Generate new private key"**
5. Download the JSON file
6. Open it, copy all contents, and paste as a **single line** into `.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"pick2home-1",...}'
   ```

## Deploying the POS App to Firebase Hosting

```bash
# From inside C:\pick2home\pick2home-pos
npm run build
firebase deploy --only hosting:pos --config firebase/firebase.json
```
