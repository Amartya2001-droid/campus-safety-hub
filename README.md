# Campus Safety Hub

Campus dashboard with Firebase Authentication, Firestore, Cloud Functions, and Cloud Messaging integration.

## Stack

- React + Vite + TypeScript
- Firebase Web SDK (Auth, Firestore, Functions, Messaging)
- Firebase Cloud Functions (Node.js + TypeScript)

## 1) Frontend setup

```bash
nvm use
npm install
cp .env.example .env
```

Fill `.env` with your Firebase web app values:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_PUBLIC_KEY`

Environment separation files:

- Development template: `.env.development.example`
- Production template: `.env.production.example`

Also update `public/firebase-messaging-sw.js` with the same Firebase config values.

Run app:

```bash
npm run dev
```

Use `/settings` to test:

- Sign up / Sign in / Sign out (Auth)
- Write and read incidents (Firestore)
- Call `assignEscort` and `sendBroadcastNotification` (Functions)
- Register browser push token (Messaging)

## 2) Functions setup

Install function dependencies:

```bash
cd functions
npm install
```

Build functions:

```bash
npm run build
```

Seed test users (admin + student) and remove all others in Firebase Auth:

```bash
cd functions
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json npm run seed:test-users
```

Seeded users:

- `amartyakarmakar@gmail.com` / `password` with role `admin`
- `162478k@acadiau.ca` / `password` with role `student`

## 3) Firebase project setup

Login and pick your project:

```bash
firebase login
firebase use dev
```

Deploy Firestore rules/indexes + Functions:

```bash
firebase deploy --only firestore,functions
```

Production deploy:

```bash
firebase use prod
firebase deploy --only firestore,functions
```

## 4) Local emulators (optional)

From repo root:

```bash
firebase emulators:start
```

## 5) Production readiness - Week 1 baseline

Security hardening shipped in this repository:

- Firestore schema validation and immutable field checks in `firestore.rules`.
- Callable functions require Authentication and App Check in `functions/src/index.ts`.
- Node runtime pinned to LTS with `.nvmrc` and `package.json` engine constraints.

Observability baseline:

- Structured client logs and global unhandled error capture in `src/lib/observability.ts`.
- Structured function logs in callable entrypoints.

CI baseline:

- GitHub Actions workflow at `.github/workflows/ci.yml`.
- Web checks: lint + test + build.
- Functions checks: lint + build.
