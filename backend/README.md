# Campus safety backend — map and SOS slices

This service implements the existing campus-map location API: authenticated listing and role-restricted create, patch and delete, backed by the same PostgreSQL `campus_locations` table as Express. It creates the table if absent, but does not seed data or create users. The next slice adds the existing SOS alert list/create/status endpoints and transactional notification writes. It is not a replacement for all Express routes. Login, sessions, dashboard aggregates/live-map reads, patrols and other features stay in Express. No Expo app or files from held PR #1 are included.

## Run locally

Python 3.12 and PostgreSQL are required. From the repository root:

```sh
python -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m pip check
# Supply DATABASE_URL for the same database used by Express.
# Privately generate SECRET_KEY with at least 32 random characters and supply it
# to both processes; do not use a public example, commit it or expose it as VITE_*.
backend/.venv/bin/python -m uvicorn backend.app:create_app --factory --host 127.0.0.1 --port 8101
```

In a second terminal, supply the same `DATABASE_URL` and `SECRET_KEY`, set `FASTAPI_URL=http://127.0.0.1:8101`, set the existing Express `SESSION_SECRET` privately, then run `npm run dev` (or `npm run build && npm start`). Open http://localhost:5000 and sign in using an account in that database. The existing Campus Map and SOS Alerts pages call their same `/api/campus-locations` and `/api/sos-alerts` URLs through Express. No browser API key is needed.

FastAPI refuses startup if `SECRET_KEY` is missing, blank, short, a known fallback, or trivially repeated. Generate it using a cryptographically secure random generator; length checks cannot prove randomness. `DATABASE_URL` is mandatory. Express also refuses startup if FastAPI integration is configured without an acceptable key. Without `FASTAPI_URL`, Express retains its existing PostgreSQL implementation. When configured, backend connection failures return 502; requests never silently fall back to another writer.

## API and trust boundary

- `GET /api/health`: database health check, no credentials or database details returned.
- `GET /api/campus-locations`: any authenticated dashboard role.
- `POST /api/campus-locations`, `PATCH /api/campus-locations/{id}`, `DELETE /api/campus-locations/{id}`: admin or safety official only.
- Payload: `name`, `type` (`blue_phone`, `safe_zone`, `aed`, `building`, `parking`), latitude `lat` (-90..90), longitude `lng` (-180..180), nullable `description`. Names are trimmed, field lengths bounded, and unknown fields rejected. PATCH accepts supplied fields only; only description may be explicitly cleared. Errors retain the frontend's `{message}` shape.

Express loads the actor from its server-side session/database and issues a 30-second HS256 assertion with subject, role, audience and issuer. It never forwards browser Authorization headers or cookies to FastAPI, nor sends the assertion to the browser. FastAPI requires/verifies the signature, expiry, issue time, issuer, audience and recognized role independently. Direct unauthenticated calls are refused. There is no standalone login endpoint in this slice. Bind FastAPI to loopback or a private network; use HTTPS for remote `FASTAPI_URL` (the gateway rejects remote HTTP origins). Protect both processes and the shared signing key as trusted infrastructure. Existing Express session/demo-account/StarRez production blockers still apply.

## SOS alert slice

With `FASTAPI_URL` enabled, Express also forwards `GET/POST /api/sos-alerts` and `PATCH /api/sos-alerts/{id}/status`. These routes use the existing Express-created `users`, `sos_alerts` and `notifications` tables; Express must have initialized this database before SOS requests. FastAPI does not create an alternative user store or new database. It can still start for map/health checks before Express; missing/unavailable SOS tables return a generic 503 rather than leaking SQL details.

- Every SOS request checks the signed subject and role against the current database user. Students/faculty list only their own submitted alerts; admins/safety officials list all alerts. Non-staff submissions derive name/email from the authenticated account and cannot set `created_by` or an initial status.
- Creation validates bounded text, finite/ranged paired coordinates (or neither), and unknown fields. It creates a `new` alert and its notification in one PostgreSQL transaction.
- Only staff can update status. Supported transitions: new → assigned/resolved; assigned → en_route/resolved; en_route → on_scene/resolved; on_scene → resolved. Assignment requires an officer name. Resolved alerts cannot reopen. Row locking serializes competing updates; a retry of the current state returns it without a duplicate notification.
- Global notification messages omit student names/contact/location. Alert data and notification commit together; notification-write failures roll back the alert creation/status update. Existing dashboard counters and live-map SQL reads see the same rows immediately after commit.
- The SOS page uses the signed-in staff member's name for its Assign action, hides staff actions for non-staff, disables pending actions, and displays load/update failures. This slice does not add an external dispatch service, promise emergency response, migrate other Express endpoints, or claim a full app privacy/security review. Other legacy Express data endpoints remain outside this slice.
- No delete endpoint is added for SOS history. Use only disposable data for automated tests. The local E2E runner deletes its own unique SOS fixtures through the test database, not a production API.

## Verification

Use a disposable database, never production. Tests isolate their tables in random schemas and drop them afterward:

```sh
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres \
  backend/.venv/bin/python -m pytest backend/tests -q
# Runs real Express + FastAPI, login/session/SPA checks and campus-location CRUD.
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres \
  PYTHON=backend/.venv/bin/python node scripts/backend-smoke.mjs
```

The integration smoke creates temporary random accounts/locations and removes them. Existing Express startup seeds demonstration accounts in an empty database; use disposable local/CI data. CI runs pytest plus the gateway smoke with real PostgreSQL. No external preview URL is called.

## Dependency audit

Runtime requirements pin the full resolved dependency set for Python 3.12. A fresh virtual environment installed `backend/requirements.txt` successfully and `pip check` passed. Current version-specific PyPI JSON metadata was checked for every runtime pin, including transitive packages; all returned empty `vulnerabilities` lists at audit time (Nov 12, 2026, Halifax). This is a point-in-time advisory check, not a guarantee against unknown or later vulnerabilities.

Key pins: FastAPI 0.162.5, Starlette 1.10.0, PyJWT 2.15.1, psycopg/psycopg-binary 3.3.8, uvicorn 0.54.0. FastAPI's published `starlette>=0.46.0` bound accepts this Starlette version and the installed resolver/check confirmed compatibility. Metadata sources follow `https://pypi.org/pypi/<package>/<version>/json`, for example [FastAPI](https://pypi.org/pypi/fastapi/0.162.5/json), [Starlette](https://pypi.org/pypi/starlette/1.10.0/json) and [PyJWT](https://pypi.org/pypi/PyJWT/2.15.1/json). Black and emergentintegrations are not runtime dependencies and are not included.

## Slice boundary / live status

Not live yet. This delivers campus-map and SOS persistence/validation/authorization, transactional SOS notifications, and existing frontend wiring. No new identity system, mobile app, external service integration, all-route API migration, production deployment or operational safety certification is claimed. Future backend expansion should use separate reviewed slices. Needed to deploy: privately provisioned `SECRET_KEY`, `DATABASE_URL`, existing `SESSION_SECRET`, approved HTTPS/internal service topology, removal of demo credentials, and production security review. No third-party API key is required for this slice.
