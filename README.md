# Acadia Safe — Campus Safety Hub

The current `main` application is a React/Vite dashboard with an Express API and PostgreSQL session/data storage. Firebase integration files and Cloud Functions are also present, but dashboard sign-in uses `/api/login`, not Firebase Authentication.

**Live status:** not live yet — blocked by an unconfirmed deployment URL, production configuration and security review. No live deployment has been verified. Local development runs at http://localhost:5000.

The [runtime and CI fixes (PR #2)](https://github.com/Amartya2001-droid/campus-safety-hub/pull/2) and [agent instructions/status documentation (PR #3)](https://github.com/Amartya2001-droid/campus-safety-hub/pull/3) are merged. CI passed on current main (`7dde158`): [post-merge run](https://github.com/Amartya2001-droid/campus-safety-hub/actions/runs/42916033687).

## Run locally

Use Node.js 20 (`nvm use`) and a disposable local PostgreSQL database:

```bash
npm ci
export DATABASE_URL=postgresql://postgres@localhost:5432/postgres
# Set SESSION_SECRET through your local environment; never commit it.
npm run dev
```

`npm run dev` runs Express and Vite together. `npm run dev:web` runs only Vite for UI work; authenticated API flows require Express. The database schema, demo accounts and campus locations are initialized automatically. The existing demo seed uses shared passwords: use only disposable local data. Production use requires removing/replacing those accounts and configuring a strong session secret.

To test production serving locally:

```bash
npm run build
npm start
```

Production cookies require HTTPS (including correct trusted proxy configuration); development cookies support localhost HTTP. The server listens on port 5000.

## Verified and blocked

Day 1 checks used local PostgreSQL and local MongoDB only; no production data was touched.

- The web lint, TypeScript check, Vitest suite and production build pass. Functions compile with `cd functions && npm ci && npm run build`.
- The runtime smoke test checks development and production startup, SPA fallback, login validation, cookie flags, session persistence and logout against a disposable database.
- Chromium sign-in and all eight dashboard routes load without page errors. Empty queues render, the map shows seeded locations, and reports show the unconfigured StarRez state. External StarRez integration, Firebase delivery and a deployed URL are not verified.
- StarRez reports require an authorized instance URL and account. Current code stores the login password in the session for forwarding to StarRez; this and broad role access need a security review before production.
- Default/demo users and development signing-key fallbacks in existing code are production blockers. Do not expose this application as a real emergency service on this evidence.

## Checks and CI

```bash
npm run ci
# Requires a disposable PostgreSQL database; initializes/seeds tables and temporarily creates a test user.
DATABASE_URL=postgresql://postgres@localhost:5432/postgres npm run test:smoke
cd functions && npm ci && npm run build
```

GitHub Actions runs these checks on pushes and PRs using Node.js 20 and a disposable PostgreSQL service. Vitest currently includes only the original example test; the runtime smoke test supplies meaningful coverage for the Day 1 fixes. Functions have a build check, not a validated integration suite.

## Minimal FastAPI campus-map service

A clean [FastAPI service](backend/README.md) now implements campus-location CRUD against the existing PostgreSQL table, with validated coordinates/payloads and role authorization. Set `FASTAPI_URL` on Express and privately supply the same required `SECRET_KEY` to both processes to use it through the existing Campus Map UI. The service refuses startup without a suitable key. It does not replace login or the rest of Express. See the backend README for installation, trust boundaries, tests and exact configuration. No external API key is needed; no deployment is claimed.

## Held FastAPI / MongoDB / Expo proposal (PR #1)

The original MongoDB backend and student Expo app `frontend/` exist only in [PR #1](https://github.com/Amartya2001-droid/campus-safety-hub/pull/1), and are not part of this clean PostgreSQL slice. That PR adds 36 files and is substantially broader than its dependency-fix title. It has not been merged.

The proposed backend started locally with its runtime dependencies installed separately. Its existing `backend_test.py` script passed 28/28 checks when redirected to a disposable local MongoDB server. This does **not** establish a reproducible full install: `pip install -r backend/requirements.txt` fails because `emergentintegrations==0.1.0` is unavailable from the configured index. `pytest` in `backend/` collects no tests.

Backend configuration actually uses `MONGO_URL`, optional `DB_NAME` (default `acadia_safe`), and `SECRET_KEY` (not the `JWT_SECRET_KEY` named in PR #1's README). Never use its hardcoded fallback signing key. Firebase bridging additionally requires an authorized `FIREBASE_SERVICE_ACCOUNT_JSON`; that integration was not tested.

The backend API test script hardcodes an external preview URL. For Day 1 it was imported and `BASE_URL` overridden to localhost, avoiding writes to that external service. The script does not exit nonzero on failed checks, so it is not yet a reliable CI gate. See the PR review for dependency findings and merge blockers.

## Firebase files

Optional Firebase client values are listed as empty entries in `.env.example`, `.env.development.example` and `.env.production.example`. Supply authorized values privately; do not invent them. The Functions source is in `functions/src`. Firestore rules/indexes and emulator settings are included. Firebase Hosting deployment is not configured or verified by these files. Avoid running the existing seed script against a real project: it deletes users outside its seed list.

## Agent workflow and daily log

Follow [AGENTS.md](AGENTS.md). Issues are disabled, so [DAILY-LOG.md](DAILY-LOG.md) is the daily log, maintained through pull requests. No merge or deployment is implied by passing local checks.
