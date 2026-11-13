// Starts only local processes against a disposable PostgreSQL database.
// Fixture passwords/signing keys are generated in memory, never stored in the repo.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import https from 'node:https';
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must point to a disposable local PostgreSQL database');
const internalBase = 'http://127.0.0.1:5000';
const base = 'https://127.0.0.1:5443';
const email = `${randomUUID()}@example.invalid`;
const runId = randomUUID();
const env = { ...process.env, E2E_RUN_ID: runId, NODE_ENV: 'production', APP_BASE_URL: base, E2E_ACCEPT_INSECURE_CERTS: 'true',
  FASTAPI_URL: 'http://127.0.0.1:8101', SECRET_KEY: randomBytes(48).toString('base64url'),
  SESSION_SECRET: randomBytes(48).toString('base64url'), E2E_EMAIL: email,
  E2E_PASSWORD: randomBytes(32).toString('base64url') };
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const children = [];
let userId;
let tlsProxy;
let certificateDirectory;
function start(command, args, inherit = false) {
  const child = spawn(command, args, { cwd: root, env, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
  let output = '';
  if (!inherit) {
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
  }
  child.on('error', error => { output += error.message; });
  children.push(child);
  return { child, output: () => output };
}
async function ready(process, url) {
  for (let count = 0; count < 150; count++) {
    assert.equal(process.child.exitCode, null, `Local service exited: ${process.output()}`);
    try { if ((await fetch(url)).ok) return; } catch { /* Poll bounded local readiness. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Local service did not become ready: ${process.output()}`);
}
try {
  // Refuse to test an unrelated process already occupying the expected ports.
  for (const url of [internalBase, env.FASTAPI_URL]) {
    let occupied = false;
    try { await fetch(url, { signal: AbortSignal.timeout(1000) }); occupied = true; } catch { /* free */ }
    assert.equal(occupied, false, 'Stop existing app processes on ports 5000/8101 first');
  }
  const backend = start(env.PYTHON || 'python', ['-m', 'uvicorn', 'backend.app:create_app', '--factory', '--host', '127.0.0.1', '--port', '8101']);
  await ready(backend, `${env.FASTAPI_URL}/api/health`);
  const frontend = start(process.execPath, ['--import', 'tsx', 'server/index.ts']);
  await ready(frontend, `${internalBase}/`);
  // Production cookies require a real HTTPS browser origin, not spoofed browser headers.
  certificateDirectory = mkdtempSync(path.join(tmpdir(), 'acadia-e2e-tls-'));
  const keyPath = path.join(certificateDirectory, 'key.pem');
  const certPath = path.join(certificateDirectory, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', keyPath, '-out', certPath, '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
  tlsProxy = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath) }, (req, res) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: 5000, path: req.url,
      method: req.method,
      headers: { ...req.headers, 'x-forwarded-proto': 'https' },
    }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => { res.writeHead(502); res.end('Local test proxy unavailable'); });
    req.pipe(upstream);
  });
  await new Promise((resolve, reject) => {
    tlsProxy.once('error', reject);
    tlsProxy.listen(5443, '127.0.0.1', resolve);
  });
  const { rows } = await pool.query('INSERT INTO users (name,email,role,password_hash) VALUES ($1,$2,$3,$4) RETURNING id',
    ['Selenium Test User', email, 'admin', await bcrypt.hash(env.E2E_PASSWORD, 10)]);
  userId = rows[0].id;
  const maven = start(env.MVN || 'mvn', ['--batch-mode', '--no-transfer-progress', '-f', 'e2e/pom.xml',
    ...(env.MAVEN_SETTINGS ? ['--settings', env.MAVEN_SETTINGS] : []),
    ...(env.MAVEN_REPO_LOCAL ? [`-Dmaven.repo.local=${env.MAVEN_REPO_LOCAL}`] : []), 'test'], true);
  const code = await new Promise((resolve, reject) => {
    maven.child.once('error', reject);
    maven.child.once('exit', resolve);
  });
  assert.equal(code, 0, 'Selenium suite failed');
} finally {
  try {
    if (userId) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    // Remove only this run's leftover location fixture, including on assertion failure.
    await pool.query('DELETE FROM campus_locations WHERE name LIKE $1', [`Selenium fixture ${runId} %`]);
  } finally {
    await pool.end();
    if (tlsProxy?.listening) {
      tlsProxy.closeAllConnections();
      await new Promise(resolve => tlsProxy.close(resolve));
    }
    if (certificateDirectory) rmSync(certificateDirectory, { recursive: true, force: true });
    for (const child of children.reverse()) {
      if (child.pid && child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        await new Promise(resolve => child.once('exit', resolve));
      }
    }
  }
}
