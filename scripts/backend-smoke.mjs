import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

assert.ok(process.env.DATABASE_URL, 'Use a disposable PostgreSQL DATABASE_URL');
const env = { ...process.env, SECRET_KEY: randomBytes(48).toString('base64url'), FASTAPI_URL: 'http://127.0.0.1:8101' };
const backend = spawn(process.env.PYTHON || 'python', ['-m', 'uvicorn', 'backend.app:create_app', '--factory', '--host', '127.0.0.1', '--port', '8101'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
backend.stdout.on('data', data => { output += data; });
backend.stderr.on('data', data => { output += data; });
try {
  for (let attempt = 0; ; attempt++) {
    assert.ok(attempt < 100 && backend.exitCode === null, `Backend startup failed: ${output}`);
    try {
      const response = await fetch(`${env.FASTAPI_URL}/api/health`);
      if (response.ok) break;
    } catch { /* Wait for the real local service to start. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal((await fetch(`${env.FASTAPI_URL}/api/campus-locations`)).status, 401);
  const smoke = spawn(process.execPath, ['scripts/smoke.mjs'], { env, stdio: 'inherit' });
  const code = await new Promise(resolve => smoke.once('exit', resolve));
  assert.equal(code, 0, 'Integrated frontend gateway smoke failed');
} finally {
  backend.kill('SIGTERM');
  if (backend.exitCode === null) await new Promise(resolve => backend.once('exit', resolve));
}
