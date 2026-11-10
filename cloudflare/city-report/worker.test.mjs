import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { CLEANUP_SQL, UPSERT_SQL, melbourneDay, retentionCutoff } from './worker.mjs';

const original = 'https://www.jinliu.org';
const translated = 'https://www-jinliu-org.translate.goog';

function fakeDB({ fail = false, success = true } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return { bind(...values) { return { async run() {
        if (fail) throw new Error('private database details');
        calls.push({ sql, values });
        return { success };
      } }; } };
    },
  };
}

function request({ origin = original, method = 'POST', body = 'pageview', path = '/collect',
  cf = { country: 'AU', region: 'Victoria', city: 'Melbourne' }, headers = {} } = {}) {
  const req = new Request(`https://city.example.workers.dev${path}`, {
    method,
    headers: { ...(origin === null ? {} : { Origin: origin }), ...headers },
    ...(['POST', 'PUT'].includes(method) ? { body } : {}),
  });
  Object.defineProperty(req, 'cf', { value: cf });
  return req;
}

test('allowed original and translated origins produce one atomic increment with only aggregate fields', async () => {
  for (const origin of [original, translated]) {
    const DB = fakeDB();
    const res = await worker.fetch(request({ origin, headers: {
      'CF-Connecting-IP': '192.0.2.1', 'User-Agent': 'private-agent', Referer: `${original}/private`,
    } }), { DB });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(DB.calls, [{ sql: UPSERT_SQL, values: [
      melbourneDay(), 'AU', 'Victoria', 'Melbourne', new URL(origin).hostname,
    ] }]);
    assert.equal(JSON.stringify(DB.calls).includes('192.0.2.1'), false);
    assert.equal(JSON.stringify(DB.calls).includes('private-agent'), false);
  }
});

test('unapproved and missing origins are refused before writing, including lookalike sites', async () => {
  for (const origin of [null, 'null', 'http://www.jinliu.org', 'https://www.jinliu.org.evil.test',
    'https://jinliu.org', 'https://www.jinliu.org:444', 'https://other.translate.goog']) {
    const DB = fakeDB();
    const res = await worker.fetch(request({ origin }), { DB });
    assert.equal(res.status, 403);
    assert.equal(res.headers.has('Access-Control-Allow-Origin'), false);
    assert.equal(DB.calls.length, 0);
  }
});

test('only exact pageview bytes are accepted, without query/body fields being saved', async () => {
  for (const body of [null, '', 'pageview\n', ' pageview', 'PAGEVIEW', '{"event":"pageview"}',
    'pageview'.repeat(200_000), 'pagevieé']) {
    const DB = fakeDB();
    assert.equal((await worker.fetch(request({ body }), { DB })).status, 400);
    assert.equal(DB.calls.length, 0);
  }
});

test('missing location fields become Unknown; metadata is bounded', async () => {
  const DB = fakeDB();
  await worker.fetch(request({ cf: { city: '   ', region: null, country: null } }), { DB });
  assert.deepEqual(DB.calls[0].values.slice(1, 4), ['Unknown', 'Unknown', 'Unknown']);
  await worker.fetch(request({ cf: { country: 'invalid', region: ' x ', city: 'a'.repeat(300) } }), { DB });
  assert.deepEqual(DB.calls[1].values.slice(1, 4), ['Unknown', 'x', 'a'.repeat(128)]);
});

test('CORS preflight is supported without a database call', async () => {
  const DB = fakeDB();
  const res = await worker.fetch(request({ method: 'OPTIONS', headers: {
    'Access-Control-Request-Method': 'POST',
  } }), { DB });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Methods'), 'POST');
  assert.equal(res.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  assert.equal(DB.calls.length, 0);
  const denied = await worker.fetch(request({ method: 'OPTIONS', headers: {
    'Access-Control-Request-Method': 'GET',
  } }), { DB });
  assert.equal(denied.status, 405);
});

test('no public read/report route or GET collector exists', async () => {
  const DB = fakeDB();
  for (const path of ['/', '/city_report', '/report', '/collect/']) {
    assert.equal((await worker.fetch(request({ method: 'GET', path }), { DB })).status, 404);
  }
  assert.equal((await worker.fetch(request({ method: 'GET' }), { DB })).status, 405);
  assert.equal((await worker.fetch(request({ method: 'GET', origin: null }), { DB })).status, 405);
  assert.equal(DB.calls.length, 0);
});

test('database failures return no private error text', async () => {
  for (const options of [{ fail: true }, { success: false }]) {
    const res = await worker.fetch(request(), { DB: fakeDB(options) });
    assert.equal(res.status, 503);
    assert.equal(await res.text(), '');
  }
});

test('Melbourne days and 180-day cutoffs follow civil dates across DST and midnight', () => {
  assert.equal(melbourneDay(Date.parse('2026-11-09T12:59:59Z')), '2026-11-09');
  assert.equal(melbourneDay(Date.parse('2026-11-09T13:00:00Z')), '2026-11-10');
  assert.equal(melbourneDay(Date.parse('2026-07-01T13:59:59Z')), '2026-07-01');
  assert.equal(melbourneDay(Date.parse('2026-07-01T14:00:00Z')), '2026-07-02');
  assert.equal(retentionCutoff(Date.parse('2026-11-09T13:00:00Z')), '2026-05-15');
  assert.equal(retentionCutoff(Date.parse('2026-04-05T01:00:00Z')), '2025-10-08');
});

test('daily scheduled cleanup uses the event time and only deletes expired aggregate days', async () => {
  const DB = fakeDB();
  await worker.scheduled({ scheduledTime: Date.parse('2026-11-10T14:30:00Z') }, { DB });
  assert.deepEqual(DB.calls, [{ sql: CLEANUP_SQL, values: ['2026-05-16'] }]);
});
