# Campus safety backend — map, SOS, escorts and read models

This service handles campus-location CRUD, SOS and escort list/create/status operations, dashboard summary counts and live-map reads through the existing Express session gateway. It uses the same PostgreSQL tables as Express; location-table initialization is supported, while Express owns user/session and remaining schema initialization. It does not seed users or replace all Express routes. Login, sessions, patrol workflow writes, broadcasts, notification reads and StarRez integration remain in Express. No Expo app or files from held PR #1 are included.

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

In a second terminal, supply the same `DATABASE_URL` and `SECRET_KEY`, set `FASTAPI_URL=http://127.0.0.1:8101`, set the existing Express `SESSION_SECRET` privately, then run `npm run dev` (or `npm run build && npm start`). Open http://localhost:5000 and sign in using an account in that database. The existing Campus Map, SOS Alerts, Escorts and Dashboard pages call their existing API URLs through Express, which forwards the migrated slices to FastAPI. No browser API key is needed.

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

## Dashboard summary slice

`GET /api/dashboard/stats` also uses FastAPI when `FASTAPI_URL` is enabled. It reads the existing Express-initialized tables in one SQL statement, giving all summary values a consistent PostgreSQL snapshot. No tables, dependencies, external services or production settings are added.

The JSON contract is `active_alerts`, `pending_escorts`, `active_patrols` (integer counts), and `starrez_configured` (boolean). Staff see total unresolved SOS alerts, pending escorts and currently active patrols; students/faculty see SOS/escorts they created and patrols assigned to them. Null-owned legacy rows are staff-only in the summary. The signed actor is checked against the current database account/role using the same helper as SOS. Missing tables/database errors return 503, not a success containing zero counts.

A patrol counts only when it is active, started, not ended, has a positive duration and has not reached its deadline. This read does not change patrol statuses. Existing Express patrol workflow/expiry writes remain outside this slice; the optional Express-only summary retains that legacy expiry behavior.

StarRez `Configured` means the first stored configuration has a nonblank URL; it does **not** mean a live connection was verified. The misleading old `starrez_connected` summary key is replaced by `starrez_configured` in both FastAPI and the Express fallback, and the dashboard labels this accurately. Other StarRez integration endpoints are unchanged.

The UI validates the summary contract and shows an error/Retry control on failed, unauthorized or malformed data, instead of displaying zero metrics. Existing endpoint-list privacy limitations outside this summary/SOS slice remain; this is not a complete application authorization migration.

## Live-map overlay slice

`GET /api/map/live-data` is also forwarded to FastAPI when `FASTAPI_URL` is enabled. It reads the existing Express-owned `users`, `sos_alerts`, `patrol_sessions` and `patrol_checkins` tables in one PostgreSQL statement/snapshot and returns `active_alerts` / `active_patrols` arrays. No schema or dependency is added.

Staff see all eligible overlays; students/faculty see only alerts they created and patrols assigned to them, after checking the signed actor against the current database account/role. Query-string user/role values cannot override that scope. The response projects only fields needed by the map; phone, email, notes and creator IDs are omitted.

Unresolved alerts appear only when both coordinates are present, finite and within valid latitude/longitude ranges. Legacy null, out-of-range, NaN and infinite coordinates are excluded. Such an alert still counts in the dashboard summary and remains in the SOS list: absence from the map does not mean it no longer needs attention. Resolved alerts disappear after commit.

Patrol eligibility matches the summary: active, started, not ended, positive duration and before its deadline. This GET never expires or otherwise updates a patrol. `current_residence` is the latest open check-in within the shift and not in the future, ordered by arrival time then ID; it is null if no valid open check-in exists. This is a stored check-in record, not live GPS tracking. Alert/patrol ordering is deterministic.

The Campus Map validates the overlay response before rendering it. Initial counts say Loading; failed/unauthorized/malformed reads say Unavailable and offer Retry. Cached overlays may remain visible with an explicit stale warning after a refresh failure. The overlay query cache is keyed by account and role to prevent reuse across sign-ins; SOS status changes invalidate overlay queries. Focused UI tests stub map rendering and supply a test auth/layout context; Selenium exercises the real UI/gateway/backend and verifies an active SOS overlay appears and disappears after resolution.

These ownership/eligibility rules apply to the FastAPI path. The optional Express-only fallback retains its legacy map query; the broader Express migration and production security review remain incomplete. Missing tables/database errors return a generic 503, not a false empty success. No external dispatch, geolocation or map-tile service is configured or verified by this slice.

## Escort queue slice

With `FASTAPI_URL` enabled, `GET/POST /api/escort-requests` and `PATCH /api/escort-requests/{id}/status` also use FastAPI over the existing Express-initialized `users`, `escort_requests` and `notifications` tables. No schema, new account store or external dispatch service is added. The existing Escorts page and dashboard preview use this API; a new student request form is not included in this slice.

Students/faculty list only their own requests, and non-staff submission names/creator IDs come from the authenticated database account. Staff may submit on behalf of someone and see the full queue. Unknown fields, initial status/creator injection, blank names/routes and oversized text are rejected. Every request checks the signed actor against the current database identity/role.

Only admins/safety officials update statuses: pending → assigned/cancelled; assigned → in_progress/cancelled; in_progress → completed/cancelled. Assignment requires an officer name; completed/cancelled requests cannot reopen. Row locks serialize competing updates. Repeating the current status without conflicting assignment details is retry-safe and does not duplicate a notification. ETA is optional caller-supplied text, never computed or invented; terminal states clear it (including on retries). Staff cancellation is supported by the API; the existing UI provides Assign, Start Escort and Mark Completed.

Creation and each status change commit their notification in the same transaction; notification failure rolls back the request/status write. Global notification messages omit names, phone numbers, pickup/destination and notes. Existing dashboard counts immediately reflect committed pending-status changes.

The UI assigns the signed-in staff member's real account name and no longer invents `Officer on duty` or `5 min`. It hides staff actions from non-staff, disables pending mutations and surfaces errors. Queue and preview data are validated and cached by account/role, with load/error/Retry states rather than false empty results. This does not migrate other legacy endpoints or certify real-world escort availability. The Express-only fallback remains its legacy implementation and is not a complete authorization/security boundary.

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

Not live yet. This delivers campus-map and SOS persistence/validation/authorization, transactional SOS notifications, the escort queue workflow, a role-scoped dashboard summary/live overlay read model and existing frontend wiring. No new identity system, mobile app, external service integration, all-route API migration, production deployment or operational safety certification is claimed. Future backend expansion should use separate reviewed slices. Needed to deploy: privately provisioned `SECRET_KEY`, `DATABASE_URL`, existing `SESSION_SECRET`, approved HTTPS/internal service topology, removal of demo credentials, and production security review. No third-party API key is required for this slice.
