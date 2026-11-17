import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// Use only a disposable local/CI database: the server initializes and seeds it.
assert.ok(process.env.DATABASE_URL, 'Set DATABASE_URL to a disposable test database');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const email = `${randomUUID()}@example.invalid`;
const password = randomUUID();
const base = 'http://127.0.0.1:5000';
let userId;
try {
  for (const mode of ['development', 'production']) {
    let output = '';
    const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
      env: { ...process.env, NODE_ENV: mode, SESSION_SECRET: randomUUID() },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', data => { output += data; });
    server.stderr.on('data', data => { output += data; });
    try {
      for (let attempt = 0; !output.includes('Server running on'); attempt++) {
        assert.ok(attempt < 200 && server.exitCode === null, `Server failed: ${output}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!userId) {
        const result = await pool.query(
          'INSERT INTO users (name,email,role,password_hash) VALUES ($1,$2,$3,$4) RETURNING id',
          ['Smoke Test', email, 'student', await bcrypt.hash(password, 10)],
        );
        userId = result.rows[0].id;
      }
      const page = await fetch(`${base}/login`);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /<div id="root"><\/div>/);
      assert.equal((await fetch(`${base}/api/me`)).status, 401);
      assert.equal((await fetch(`${base}/api/login`, {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'})).status, 400);
      const login = await fetch(`${base}/api/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'student' }),
        ...(mode === 'production' ? { headers: { 'Content-Type':'application/json', 'X-Forwarded-Proto':'https' } } : {}),
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.get('set-cookie');
      assert.ok(cookie, 'Login must issue a session cookie');
      assert.equal(/; Secure/i.test(cookie), mode === 'production');
      assert.match(cookie, mode === 'production' ? /SameSite=None/i : /SameSite=Lax/i);
      const headers = { Cookie: cookie.split(';')[0] };
      const me = await fetch(`${base}/api/me`, { headers });
      assert.equal(me.status, 200);
      assert.equal((await me.json()).id, userId);
      const summary = await (await fetch(`${base}/api/dashboard/stats`, { headers })).json();
      assert.equal(typeof summary.starrez_configured, 'boolean');
      assert.equal(summary.starrez_connected, undefined);
      for (const key of ['active_alerts', 'pending_escorts', 'active_patrols']) {
        assert.ok(Number.isSafeInteger(summary[key]) && summary[key] >= 0);
      }
      if (process.env.FASTAPI_URL) {
        const endpoint = `${base}/api/campus-locations`;
        assert.equal((await fetch(endpoint)).status, 401);
        assert.equal((await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Forbidden', type: 'building', lat: 45, lng: -64 }) })).status, 403);
        await pool.query("UPDATE users SET role='admin' WHERE id=$1", [userId]);
        const data = { name: `Integration ${randomUUID()}`, type: 'building', lat: 45.087, lng: -64.366, description: 'Disposable integration fixture' };
        const created = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        assert.equal(created.status, 201);
        const location = await created.json();
        try {
          const stored = await pool.query('SELECT name FROM campus_locations WHERE id=$1', [location.id]);
          assert.equal(stored.rows[0].name, data.name, 'FastAPI must use the existing database');
          const patch = await fetch(`${endpoint}/${location.id}`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ description: null }) });
          assert.equal(patch.status, 200);
          assert.equal((await patch.json()).description, null);
          assert.ok((await (await fetch(endpoint, { headers })).json()).some(row => row.id === location.id));
          assert.equal((await fetch(`${endpoint}/${location.id}`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: 91 }) })).status, 422);
          assert.equal((await fetch(`${endpoint}/${location.id}`, { method: 'DELETE', headers })).status, 200);
        } finally {
          await pool.query('DELETE FROM campus_locations WHERE id=$1', [location.id]);
          await pool.query("UPDATE users SET role='student' WHERE id=$1", [userId]);
        }
        const sosEndpoint = `${base}/api/sos-alerts`;
        const sosBody = { student_name: 'Untrusted supplied name', location: `Smoke ${randomUUID()}`, lat: 45.087, lng: -64.366 };
        const submitted = await fetch(sosEndpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(sosBody) });
        assert.equal(submitted.status, 201);
        const alert = await submitted.json();
        let legacyAlertId;
        let patrolId;
        try {
          assert.equal(alert.student_name, 'Smoke Test', 'Non-staff identity comes from the authenticated database user');
          assert.equal(alert.created_by, userId);
          const legacy = await pool.query("INSERT INTO sos_alerts(student_name,location,lat,lng) VALUES ('Smoke legacy fixture','Fixture',45,-64) RETURNING id");
          legacyAlertId = legacy.rows[0].id;
          const patrol = await pool.query("INSERT INTO patrol_sessions(created_by,assigned_student_id,status,started_at) VALUES ($1,$1,'active',NOW()-INTERVAL '1 minute') RETURNING id", [userId]);
          patrolId = patrol.rows[0].id;
          await pool.query("INSERT INTO patrol_checkins(session_id,residence_name) VALUES ($1,'Smoke residence fixture')", [patrolId]);
          const ownMap = await (await fetch(`${base}/api/map/live-data`, { headers })).json();
          assert.ok(ownMap.active_alerts.some(row => row.id === alert.id));
          assert.ok(!ownMap.active_alerts.some(row => row.id === legacyAlertId));
          assert.equal(ownMap.active_patrols.find(row => row.id === patrolId).current_residence, 'Smoke residence fixture');
          await pool.query("UPDATE patrol_sessions SET started_at=NOW()-INTERVAL '6 hours' WHERE id=$1", [patrolId]);
          const expiredMap = await (await fetch(`${base}/api/map/live-data`, { headers })).json();
          assert.ok(!expiredMap.active_patrols.some(row => row.id === patrolId));
          assert.equal((await pool.query('SELECT status FROM patrol_sessions WHERE id=$1', [patrolId])).rows[0].status, 'active');

          assert.equal((await (await fetch(`${base}/api/dashboard/stats`, { headers })).json()).active_alerts, 1);
          assert.equal((await fetch(`${sosEndpoint}/${alert.id}/status`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) })).status, 403);
          await pool.query("UPDATE users SET role='admin' WHERE id=$1", [userId]);
          assert.ok((await (await fetch(sosEndpoint, { headers })).json()).some(row => row.id === alert.id));
          assert.ok((await (await fetch(`${base}/api/map/live-data`, { headers })).json()).active_alerts.some(row => row.id === legacyAlertId));
          for (const status of ['assigned', 'en_route', 'resolved']) {
            const changed = await fetch(`${sosEndpoint}/${alert.id}/status`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...(status === 'assigned' ? { assigned_officer: 'Smoke Test' } : {}) }) });
            assert.equal(changed.status, 200);
          }
          assert.equal((await pool.query('SELECT status FROM sos_alerts WHERE id=$1', [alert.id])).rows[0].status, 'resolved');
          const staffStats = await (await fetch(`${base}/api/dashboard/stats`, { headers })).json();
          const active = await pool.query("SELECT count(*)::int AS count FROM sos_alerts WHERE status <> 'resolved'");
          assert.equal(staffStats.active_alerts, active.rows[0].count);
          assert.equal((await pool.query("SELECT count(*)::int AS count FROM notifications WHERE reference_type='sos_alert' AND reference_id=$1", [alert.id])).rows[0].count, 4);
          const map = await (await fetch(`${base}/api/map/live-data`, { headers })).json();
          assert.ok(!map.active_alerts.some(row => row.id === alert.id));
        } finally {
          await pool.query("DELETE FROM notifications WHERE reference_type='sos_alert' AND reference_id=$1", [alert.id]);
          if (patrolId) await pool.query('DELETE FROM patrol_sessions WHERE id=$1', [patrolId]);
          if (legacyAlertId) await pool.query('DELETE FROM sos_alerts WHERE id=$1', [legacyAlertId]);
          await pool.query('DELETE FROM sos_alerts WHERE id=$1', [alert.id]);
          await pool.query("UPDATE users SET role='student' WHERE id=$1", [userId]);
        }
        const escortEndpoint = `${base}/api/escort-requests`;
        const requested = await fetch(escortEndpoint, { method:'POST', headers:{...headers,'Content-Type':'application/json'},
          body:JSON.stringify({student_name:'Untrusted supplied name',pickup:'Smoke pickup fixture',destination:'Smoke destination fixture'}) });
        assert.equal(requested.status,201);
        const escort = await requested.json();
        try {
          assert.equal(escort.student_name,'Smoke Test');
          assert.equal(escort.created_by,userId);
          assert.equal(escort.eta,null);
          assert.equal((await (await fetch(`${base}/api/dashboard/stats`,{headers})).json()).pending_escorts,1);
          assert.equal((await fetch(`${escortEndpoint}/${escort.id}/status`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({status:'cancelled'})})).status,403);
          await pool.query("UPDATE users SET role='admin' WHERE id=$1",[userId]);
          assert.ok((await (await fetch(escortEndpoint,{headers})).json()).some(row=>row.id===escort.id));
          for (const status of ['assigned','in_progress','completed']) {
            const updated = await fetch(`${escortEndpoint}/${escort.id}/status`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},
              body:JSON.stringify({status,...(status==='assigned'?{assigned_officer:'Smoke Test'}:{})})});
            assert.equal(updated.status,200);
            assert.equal((await updated.json()).eta,null,'No invented arrival estimate');
          }
          assert.equal((await pool.query('SELECT status FROM escort_requests WHERE id=$1',[escort.id])).rows[0].status,'completed');
          assert.equal((await pool.query("SELECT count(*)::int AS count FROM notifications WHERE reference_type='escort_request' AND reference_id=$1",[escort.id])).rows[0].count,4);
        } finally {
          await pool.query("DELETE FROM notifications WHERE reference_type='escort_request' AND reference_id=$1",[escort.id]);
          await pool.query('DELETE FROM escort_requests WHERE id=$1',[escort.id]);
          await pool.query("UPDATE users SET role='student' WHERE id=$1",[userId]);
        }
        console.log(`${mode}: escort ownership, staff workflow, notifications and no invented ETA passed`);
        console.log(`${mode}: SOS submission, identity, staff workflow, notifications and live-map consistency passed`);
        console.log(`${mode}: FastAPI gateway CRUD, shared persistence, authorization and validation passed`);
      }
      assert.equal((await fetch(`${base}/api/logout`, { method:'POST', headers })).status, 200);
      assert.equal((await fetch(`${base}/api/me`, { headers })).status, 401);
      console.log(`${mode}: SPA, auth validation, cookie, session persistence and logout passed`);
    } finally {
      server.kill('SIGTERM');
      await new Promise(resolve => server.once('exit', resolve));
    }
  }
} finally {
  if (userId) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  await pool.end();
}
