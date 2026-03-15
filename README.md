# Campus Safety Hub

Full-stack campus safety platform with three components:

1. **Security Dashboard** (this directory) — React/Vite web app for security officers (Firebase-backed)
2. **Backend API** (`backend/`) — Python FastAPI server with MongoDB and Firebase Admin bridge
3. **Student Mobile App** (`frontend/`) — React Native/Expo app for students

## Stack

### Security Dashboard
- React + Vite + TypeScript
- Firebase Web SDK (Auth, Firestore, Functions, Messaging)
- Firebase Cloud Functions (Node.js + TypeScript)

### Backend API
- Python + FastAPI + Motor (async MongoDB)
- Firebase Admin SDK (Firestore bridge)
- JWT authentication restricted to `@acadiau.ca` emails

### Student Mobile App
- React Native + Expo Router
- Firebase Auth (`@acadiau.ca` email restriction)
- Connects to the backend REST API

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

## 5) Backend API setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in `backend/` with:

- `MONGO_URL` — MongoDB connection string
- `DB_NAME` — database name (default: `campus_safety_db`)
- `JWT_SECRET_KEY` — secret for JWT token signing
- `FIREBASE_SERVICE_ACCOUNT_JSON` — (optional) Firebase service account JSON for the Firestore bridge

Run the server:

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Run backend tests:

```bash
python backend_test.py
```

## 6) Student Mobile App setup

```bash
cd frontend
npm install
```

Configure `frontend/src/firebase/config.ts` with your Firebase project values. Then:

```bash
npx expo start
```

See `frontend/README.md` for full Expo setup details.

## 7) Production readiness - Week 1 baseline

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
