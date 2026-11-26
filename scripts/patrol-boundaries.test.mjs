import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import bcrypt from 'bcryptjs';

test('patrol account boundaries through real production sessions', { timeout: 60000 }, async t => {
  assert.ok(process.env.DATABASE_URL, 'Use a disposable PostgreSQL DATABASE_URL with CREATE SCHEMA permission');
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const schema = `boundary_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const db = new pg.Pool({ connectionString: url.href });
  let server;
  let output = '';
  const call = async (cookie, path, method = 'GET', body) => {
    const response = await fetch(`http://127.0.0.1:5000/api${path}`, {
      method, headers: { 'Content-Type':'application/json', 'X-Forwarded-Proto':'https', ...(cookie ? { Cookie:cookie } : {}) },
      ...(body ? { body:JSON.stringify(body) } : {}),
    });
    return { status:response.status, body:await response.json(), cookie:response.headers.get('set-cookie')?.split(';')[0] };
  };
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    server = spawn(process.execPath, ['--import','tsx','server/index.ts'], {
      env:{...process.env,DATABASE_URL:url.href,NODE_ENV:'production',SESSION_SECRET:randomUUID(),FASTAPI_URL:''},
      stdio:['ignore','pipe','pipe'],
    });
    server.stdout.on('data', data => { output += data; });
    server.stderr.on('data', data => { output += data; });
    for (let i=0; !output.includes('Server running on'); i++) {
      assert.ok(i<150 && server.exitCode===null, `Server startup failed: ${output}`);
      await new Promise(resolve => setTimeout(resolve,100));
    }
    const accounts = {};
    for (const [label,role] of [['owner','student'],['other','student'],['faculty','faculty'],['staff','safety_official'],['admin','admin']]) {
      const email = `${randomUUID()}@example.invalid`;
      const password = randomUUID();
      const {rows} = await db.query('INSERT INTO users (name,email,role,password_hash) VALUES ($1,$2,$3,$4) RETURNING id',
        [`Boundary ${label}`,email,role,await bcrypt.hash(password,4)]);
      const login = await call(null,'/login','POST',{email,password,role});
      assert.equal(login.status,200);
      assert.equal(login.body.role,role);
      accounts[label] = { id:rows[0].id,cookie:login.cookie,email,password,role };
    }
    const {owner,staff} = accounts;
    await t.test('login role selection cannot elevate a real account', async () => {
      for (const label of ['owner','faculty','staff']) {
        const {email,password} = accounts[label];
        assert.equal((await call(null,'/login','POST',{email,password,role:'admin'})).status,401);
        const me = await call(accounts[label].cookie,'/me');
        assert.equal(me.body.id,accounts[label].id);
        assert.equal(me.body.role,accounts[label].role);
      }
    });
    const assigned = await call(staff.cookie,'/patrol-sessions','POST',{assigned_student_id:owner.id,notes:'Private boundary fixture'});
    assert.equal(assigned.status,201);
    const sessionId = assigned.body.id;
    assert.equal((await call(owner.cookie,`/patrol-sessions/${sessionId}/accept`,'PATCH')).status,200);
    const created = await call(owner.cookie,`/patrol-sessions/${sessionId}/checkins`,'POST',{residence_name:'Private residence',notes:'Owner only fixture'});
    assert.equal(created.status,201);
    const checkinId = created.body.id;
    for (const [label,account] of Object.entries(accounts)) {
      await t.test(`${label} patrol visibility and assignment permissions`, async () => {
        const allowed = ['owner','staff','admin'].includes(label);
        const sessions = await call(account.cookie,'/patrol-sessions');
        assert.equal(sessions.status,200);
        assert.equal(sessions.body.some(row => row.id===sessionId),allowed);
        const result = await call(account.cookie,`/patrol-sessions/${sessionId}/checkins`);
        assert.equal(result.status,allowed ? 200 : 404);
        if (allowed) assert.equal(result.body[0].id,checkinId);
        else assert.ok(!JSON.stringify(result.body).includes('Private residence'));
        if (['other','faculty'].includes(label)) {
          assert.equal((await call(account.cookie,'/patrol-sessions','POST',{assigned_student_id:owner.id})).status,403);
          assert.equal((await call(account.cookie,`/patrol-sessions/${sessionId}/checkins`,'POST',{residence_name:'Intruder'})).status,404);
        }
      });
    }
    await t.test('another student and staff cannot record the owner departure', async () => {
      for (const label of ['other','faculty','staff','admin']) {
        const denied = await call(accounts[label].cookie,`/patrol-checkins/${checkinId}/depart`,'PATCH');
        assert.equal(denied.status,404, `${label} must not mutate another account's check-in`);
        const {rows} = await db.query('SELECT departure_at FROM patrol_checkins WHERE id=$1',[checkinId]);
        assert.equal(rows[0].departure_at,null,'Rejected mutation must leave the database unchanged');
      }
    });
    await t.test('anonymous and nonexistent IDs are denied', async () => {
      assert.equal((await call(null,`/patrol-sessions/${sessionId}/checkins`)).status,401);
      assert.equal((await call(null,`/patrol-checkins/${checkinId}/depart`,'PATCH')).status,401);
      assert.equal((await call(owner.cookie,'/patrol-sessions/2147483647/checkins')).status,404);
      assert.equal((await call(owner.cookie,'/patrol-checkins/2147483647/depart','PATCH')).status,404);
    });
    await t.test('assigned student can depart once, but not after the shift ends', async () => {
      // Restore the fixture even when the pre-fix negative regression already changed it.
      await db.query('UPDATE patrol_checkins SET departure_at=NULL WHERE id=$1',[checkinId]);
      assert.equal((await call(owner.cookie,`/patrol-checkins/${checkinId}/depart`,'PATCH')).status,200);
      assert.equal((await call(owner.cookie,`/patrol-checkins/${checkinId}/depart`,'PATCH')).status,404);
      const next = await call(owner.cookie,`/patrol-sessions/${sessionId}/checkins`,'POST',{residence_name:'Second residence'});
      assert.equal(next.status,201);
      await db.query("UPDATE patrol_sessions SET status='completed' WHERE id=$1",[sessionId]);
      assert.equal((await call(owner.cookie,`/patrol-checkins/${next.body.id}/depart`,'PATCH')).status,404);
      assert.equal((await db.query('SELECT departure_at FROM patrol_checkins WHERE id=$1',[next.body.id])).rows[0].departure_at,null);
      await db.query("UPDATE patrol_sessions SET status='active', started_at=NOW()-INTERVAL '6 hours' WHERE id=$1",[sessionId]);
      assert.equal((await call(owner.cookie,`/patrol-checkins/${next.body.id}/depart`,'PATCH')).status,404);
      assert.equal((await db.query('SELECT departure_at FROM patrol_checkins WHERE id=$1',[next.body.id])).rows[0].departure_at,null);
    });
  } finally {
    if (server?.pid && server.exitCode===null && server.signalCode===null) {
      server.kill('SIGTERM');
      await new Promise(resolve => server.once('exit',resolve));
    }
    await db.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
