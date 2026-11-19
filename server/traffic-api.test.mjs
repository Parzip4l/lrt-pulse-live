import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createTrafficServer } from './traffic-api.mjs';

const env = {
  LRT_API_BASE_URL: 'http://upstream.test/index.php',
  LRT_API_RQID: 'private-request-id',
  LRT_API_USERNAME: 'private-user',
  LRT_API_PASSWORD: 'private-password',
};
const query = '/api/traffic-data?start_date=2026-11-19&end_date=2026-11-19';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

async function setup(t, fetchImpl, config = env) {
  const server = createTrafficServer({ env: config, fetchImpl });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  return (path = query, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}

test('credentials/token stay upstream and only dashboard row fields reach browsers', async (t) => {
  const calls = [];
  const request = await setup(t, async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) });
    if (url.endsWith('/login/doLogin')) return json({ code: 0, data: { token: 'private-token' } });
    return json({ sts: 'S', data: { total: '1', token: 'private-token', rows: [{
      station_code_var: 'PEG', gate_out_on_dtm: '2026-11-19 10:00:00', card_type_var: 'BANK',
      card_number: 'private-card', password: env.LRT_API_PASSWORD,
    }] } });
  });
  for (let i = 0; i < 2; i++) {
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('authorization'), null);
    const body = await response.json();
    assert.deepEqual(body.data, { total: 1, rows: [{ station_code_var: 'PEG', gate_out_on_dtm: '2026-11-19 10:00:00', card_type_var: 'BANK' }] });
    for (const secret of [...Object.values(env), 'private-token', 'private-card']) {
      assert.ok(!JSON.stringify(body).includes(secret));
    }
  }
  assert.equal(calls.filter((c) => c.url.endsWith('/login/doLogin')).length, 1);
  assert.equal(calls[0].body.password, env.LRT_API_PASSWORD);
  assert.equal(calls[1].headers.Authorization, 'Bearer private-token');
  assert.equal(calls[1].body.status_trx, 'S');
});

test('concurrent requests share login and expired token is retried once', async (t) => {
  let logins = 0;
  const request = await setup(t, async (url, options) => {
    if (url.endsWith('/login/doLogin')) {
      logins++;
      return json({ sts: 'S', data: { token: `token-${logins}` } });
    }
    if (options.headers.Authorization === 'Bearer token-1') return json({ msg: 'Token expired' });
    return json({ code: 0, data: { rows: [], total: 0 } });
  });
  const responses = await Promise.all([request(), request(), request()]);
  assert.ok(responses.every((r) => r.status === 200));
  assert.equal(logins, 2);
});

test('upstream errors never echo credentials, tokens, or internal URLs', async (t) => {
  for (const failure of ['http', 'body', 'network', 'timeout']) {
    const request = await setup(t, async (url) => {
      if (url.endsWith('/login/doLogin')) return json({ code: 0, data: { token: 'secret-token' } });
      const secret = `${env.LRT_API_PASSWORD} secret-token ${env.LRT_API_BASE_URL}`;
      if (failure === 'http') return json({ message: secret }, 500);
      if (failure === 'body') return json({ code: 1, message: secret });
      if (failure === 'timeout') throw new DOMException(secret, 'TimeoutError');
      throw new Error(secret);
    });
    const response = await request();
    assert.equal(response.status, failure === 'timeout' ? 504 : 502);
    const body = await response.text();
    for (const secret of [env.LRT_API_PASSWORD, env.LRT_API_BASE_URL, 'secret-token']) assert.ok(!body.includes(secret));
  }
});

test('old login paths, invalid requests, and absent configuration never contact upstream', async (t) => {
  let calls = 0;
  const request = await setup(t, async () => { calls++; throw new Error('Must not fetch'); });
  assert.equal((await request('/api/index.php/login/doLogin', { method: 'POST' })).status, 404);
  assert.equal((await request(query, { method: 'POST' })).status, 405);
  for (const path of [
    '/api/traffic-data',
    '/api/traffic-data?start_date=2026-02-30&end_date=2026-03-01',
    '/api/traffic-data?start_date=2026-12-01&end_date=2026-11-01',
    '/api/traffic-data?start_date=2026-01-01&end_date=2026-11-19',
    `${query}&status_trx=unsafe`,
  ]) assert.equal((await request(path)).status, 400);
  const unconfigured = await setup(t, async () => { calls++; }, {});
  assert.equal((await unconfigured()).status, 503);
  assert.equal(calls, 0);
});

test('repeated upstream unauthorized responses stop after one retry', async (t) => {
  let calls = 0;
  const request = await setup(t, async (url) => {
    calls++;
    return url.endsWith('/login/doLogin') ? json({ code: 0, token: 'token' }) : json({}, 401);
  });
  assert.equal((await request()).status, 502);
  assert.equal(calls, 4);
});
