import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { campusBackend } from '../server/campus-backend.ts';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.FASTAPI_URL;
const originalKey = process.env.SECRET_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.FASTAPI_URL;
  else process.env.FASTAPI_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SECRET_KEY;
  else process.env.SECRET_KEY = originalKey;
});
function configured() {
  process.env.FASTAPI_URL = 'http://127.0.0.1:8101';
  process.env.SECRET_KEY = randomBytes(48).toString('base64url');
  return campusBackend(async () => ({ id: 12, role: 'student' }));
}
function response() {
  return { code: null, body: null, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}

test('integration startup requires a private key and a safe configured origin', () => {
  delete process.env.FASTAPI_URL;
  assert.equal(campusBackend(async () => null), null);
  configured();
  delete process.env.SECRET_KEY;
  assert.throws(() => campusBackend(async () => null), /SECRET_KEY/);
  process.env.SECRET_KEY = randomBytes(48).toString('base64url');
  for (const url of ['http://example.invalid', 'https://example.invalid/path', 'https://user:pass@example.invalid']) {
    process.env.FASTAPI_URL = url;
    assert.throws(() => campusBackend(async () => null), /FASTAPI_URL/);
  }
});

test('gateway authenticates the session and ignores browser-supplied credentials', async () => {
  const handler = configured();
  const req = { session: { userId: 12 }, path: '/api/campus-locations', method: 'POST',
    headers: { authorization: 'Bearer untrusted', cookie: 'untrusted' }, body: { name: 'Test' } };
  globalThis.fetch = async (url, options) => {
    assert.equal(url.href, 'http://127.0.0.1:8101/api/campus-locations');
    assert.equal(options.headers.cookie, undefined);
    assert.notEqual(options.headers.Authorization, req.headers.authorization);
    const claims = JSON.parse(Buffer.from(options.headers.Authorization.split('.')[1], 'base64url'));
    assert.equal(claims.sub, '12');
    assert.equal(claims.role, 'student');
    assert.equal(claims.exp - claims.iat, 30);
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({ message: 'Denied' }), { status: 403, headers: { 'content-type': 'application/json' } });
  };
  const res = response();
  await handler(req, res);
  assert.equal(res.code, 403);
  assert.deepEqual(res.body, { message: 'Denied' });
  const unauthenticated = response();
  await handler({ ...req, session: {} }, unauthenticated);
  assert.equal(unauthenticated.code, 401);
});

test('backend outage or invalid upstream response fails closed without leaking details', async () => {
  const handler = configured();
  for (const fetch of [async () => { throw new Error('private connection details'); },
    async () => new Response('<html>proxy error</html>', { headers: { 'content-type': 'text/html' } })]) {
    globalThis.fetch = fetch;
    const res = response();
    await handler({ session: { userId: 12 }, path: '/api/campus-locations', method: 'GET' }, res);
    assert.equal(res.code, 502);
    assert.deepEqual(res.body, { message: 'Campus map service unavailable' });
  }
});
