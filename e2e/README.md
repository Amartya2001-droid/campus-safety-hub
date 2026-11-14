# Java / Maven / Selenium end-to-end suite

This is a separate Maven project using Selenium 4.52.0 and JUnit 6.1.3 on Java 21. It drives a real headless Chrome/Chromium browser against the React application, Express sessions, PostgreSQL, and the enabled FastAPI campus-map service. It does not intercept network responses or mock authentication.

Coverage:

- Valid login through the UI creates an HTTP-only server-session cookie and opens the dashboard.
- Invalid credentials display the real error and leave the session unauthenticated.
- Login persists through refresh and direct navigation.
- Logout invalidates the server session; protected route reload shows login.
- All eight SPA routes render on direct navigation and refresh, including production fallback.
- An SOS fixture is submitted through the authenticated API, then assigned, moved en route, resolved and refreshed through the real dashboard UI.
- A campus-map location is created through the UI, read through the authenticated API, and deleted afterward. This exercises the rebuilt backend, not the held PR #1 proposal.

## Run the complete local stack

Prerequisites: Node 20, Python 3.12, a **JDK** 21, Maven 3.9+, Chrome/Chromium plus a compatible ChromeDriver, OpenSSL, and a disposable local PostgreSQL database. From the repository root:

```sh
npm ci
npm run build
python -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres \
  PYTHON=backend/.venv/bin/python node e2e/run-local.mjs
```

The runner starts FastAPI on 8101 and production Express on 5000, then serves a loopback HTTPS test proxy on 5443. This lets Chrome exercise real production `Secure` cookies and SPA fallback. Ports must be free. The runner generates a one-day self-signed certificate and private key in an OS temporary directory, supplies temporary random signing/session keys in memory, and removes the TLS files afterward. Only this local browser run opts into accepting that certificate; Maven/network TLS verification stays enabled. It provisions a randomly named disposable admin user and removes that account and this run's location/SOS/notification fixtures in cleanup. Existing Express initialization seeds demo accounts in an empty database: never run this against production or shared operational data.

Useful optional environment variables:

| Variable | Purpose |
| --- | --- |
| `CHROME_BINARY` | Explicit Chrome/Chromium executable path |
| `CHROME_PROFILE_ROOT` | Writable directory for per-test temporary browser profiles (defaults to the JVM temp directory) |
| `CHROMEDRIVER_PATH` | Explicit matching driver path; otherwise Selenium Manager resolves the driver |
| `MVN` | Maven executable path |
| `MAVEN_REPO_LOCAL` | Maven artifact cache directory |
| `MAVEN_SETTINGS` | Maven settings XML path, for an authorized proxy/mirror |
| `JAVA_HOME` | Complete Java 21 JDK, including compiler/platform files |
| `CHROME_NO_SANDBOX=true` | Explicit opt-in only for an isolated container that cannot support Chrome's sandbox |

The runner always targets its own local stack. A nonzero Maven/test exit makes the runner and CI fail. Surefire reports appear in `e2e/target/surefire-reports/`; generated build output is ignored.

## Test an already running app

The Java suite reads **`APP_BASE_URL`**, default **`http://localhost:5000`**. Supply an authorized admin test account through environment variables; neither the suite nor the repository supplies a credential default:

```sh
# Privately set E2E_EMAIL and E2E_PASSWORD for an authorized disposable admin account.
# The app must have FASTAPI_URL configured; see backend/README.md.
APP_BASE_URL=http://localhost:5000 mvn -f e2e/pom.xml test
```

`E2E_ACCEPT_INSECURE_CERTS=true` is an optional browser-only setting for a local self-signed HTTPS test origin. Leave it unset for deployed environments. Running against an existing app creates a uniquely named SOS fixture and resolves it through the UI; that history remains in the database because there is no SOS delete API. It also creates and deletes a uniquely named `Selenium fixture ...` campus-map row, so use only authorized test data and accounts. The standalone suite does not provision or delete accounts.

## CI / status

`.github/workflows/e2e.yml` installs the web/backend dependencies, uses Java 21 with Maven and the hosted runner's Chrome/ChromeDriver, starts disposable PostgreSQL, builds the frontend, then runs the local production HTTPS stack and headless suite. It uploads Surefire results on success or failure. No production service or API credential is required. The suite is proposed independently of the backend PR and depends on that backend slice; neither PR is merged by the agent. There is no verified live demo URL yet.

Local verification: all 13 collected cases passed with zero failures/errors/skips against the integrated production stack using JDK 21.0.13, Maven 3.9.11 and matching Chromium/ChromeDriver 156.0.8078.79. This isolated container required writable browser profile/cache paths and explicit `CHROME_NO_SANDBOX=true`; hosted CI keeps Chrome sandboxing enabled.
