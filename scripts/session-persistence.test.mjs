import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import bcrypt from 'bcryptjs';

test('production login commits its session before headers and fails closed on store errors', { timeout: 30000 }, async () => {
  assert.ok(process.env.DATABASE_URL, 'Use a disposable PostgreSQL DATABASE_URL');
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const schema = `session_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const db = new pg.Pool({ connectionString: url.href });
  let server;
  let output = '';
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await db.query('CREATE TABLE session (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL)');
    server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
      env: { ...process.env, DATABASE_URL: url.href, NODE_ENV: 'production',
        SESSION_SECRET: randomUUID(), FASTAPI_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', data => { output += data; });
    server.stderr.on('data', data => { output += data; });
    for (let i = 0; !output.includes('Server running on'); i++) {
      assert.ok(i < 150 && server.exitCode === null, `Server failed: ${output}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const email = `${randomUUID()}@example.invalid`;
    const password = randomUUID();
    const { rows } = await db.query('INSERT INTO users (name,email,role,password_hash) VALUES ($1,$2,$3,$4) RETURNING id',
      ['Session regression fixture', email, 'student', await bcrypt.hash(password, 10)]);
    // Real PostgreSQL latency: success headers must not escape while INSERT is uncommitted.
    await db.query(`CREATE FUNCTION delay_session() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(0.3); RETURN NEW; END $$;
      CREATE TRIGGER delay_session BEFORE INSERT OR UPDATE ON session FOR EACH ROW EXECUTE FUNCTION delay_session()`);
    const login = () => fetch('http://127.0.0.1:5000/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
      body: JSON.stringify({ email, password, role: 'student' }),
    });
    const response = await login();
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.ok(cookie);
    // Deliberately do not consume login's body before the independent session read.
    const committed = await db.query('SELECT count(*)::int AS count FROM session WHERE (sess->>\'userId\')::int=$1', [rows[0].id]);
    assert.equal(committed.rows[0].count, 1, 'Login headers arrived before the session commit');
    const headers = { Cookie: cookie.split(';')[0] };
    const me = await fetch('http://127.0.0.1:5000/api/me', { headers });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).id, rows[0].id);
    assert.equal((await response.json()).id, rows[0].id);
    assert.equal((await fetch('http://127.0.0.1:5000/api/logout', { method: 'POST', headers })).status, 200);
    assert.equal((await fetch('http://127.0.0.1:5000/api/me', { headers })).status, 401);

    await db.query(`DROP TRIGGER delay_session ON session;
      CREATE FUNCTION reject_session() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected session write failure'; END $$;
      CREATE TRIGGER reject_session BEFORE INSERT ON session FOR EACH ROW EXECUTE FUNCTION reject_session()`);
    const rejected = await login();
    assert.equal(rejected.status, 503, 'A failed session save must never report successful login');
    assert.deepEqual(await rejected.json(), { message: 'Unable to establish session' });
    assert.equal(rejected.headers.get('set-cookie'), null);
  } finally {
    if (server?.pid && server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      await new Promise(resolve => server.once('exit', resolve));
    }
    await db.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
