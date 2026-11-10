const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../static/js/visitor-analytics.js'), 'utf8');
const key = 'jinliu.analytics.exclude';
const cityEndpoint = 'https://city-report.example.test/pageview';

function browser({ excluded = false, preferences = false, configured = true,
  endpoint = cityEndpoint, storageError = false, fetchFailure = false } = {}) {
  const saved = new Map(excluded ? [[key, '1']] : []);
  const appended = [];
  const requests = [];
  const elements = {};
  for (const name of ['status', 'exclude', 'count']) {
    elements[name] = { textContent: '', disabled: false, addEventListener(event, action) { this[event] = action; } };
  }
  const settings = { querySelector: selector => elements[selector.match(/analytics-(.+)\]/)[1]] };
  const storage = {
    getItem: name => { if (storageError) throw Error('Storage unavailable'); return saved.get(name) ?? null; },
    setItem: (name, value) => { if (storageError) throw Error('Storage unavailable'); saved.set(name, value); },
    removeItem: name => { if (storageError) throw Error('Storage unavailable'); saved.delete(name); }
  };
  const attributes = {
    'data-cf-beacon': configured ? '{"token":"public-site-token"}' : null,
    'data-city-endpoint': endpoint
  };
  const document = {
    currentScript: { getAttribute: name => attributes[name] ?? null },
    querySelector: () => preferences ? settings : null,
    createElement: () => ({ attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }),
    body: { appendChild: script => appended.push(script) }
  };
  const fetch = (url, options) => {
    requests.push({ url, options: JSON.parse(JSON.stringify(options)) });
    if (fetchFailure === 'sync') throw Error('Fetch unavailable');
    return fetchFailure ? Promise.reject(Error('Network unavailable')) : Promise.resolve({ ok: true });
  };
  vm.runInNewContext(source, { document, localStorage: storage, fetch });
  return { saved, appended, elements, requests };
}

test('ordinary visitors load exactly one correctly configured module beacon', () => {
  const { appended } = browser();
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, 'https://static.cloudflareinsights.com/beacon.min.js');
  assert.equal(appended[0].type, 'module');
  assert.equal(JSON.parse(appended[0].attributes['data-cf-beacon']).token, 'public-site-token');
});

test('city collection sends one plain pageview without cookies, referrer or visitor data', () => {
  const { requests } = browser();
  assert.deepEqual(requests, [{
    url: cityEndpoint,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'pageview',
      credentials: 'omit',
      keepalive: true,
      referrerPolicy: 'no-referrer'
    }
  }]);
});

test('city collection works independently of the Cloudflare beacon configuration', () => {
  const { appended, requests } = browser({ configured: false });
  assert.equal(appended.length, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, cityEndpoint);
});

test('an absent or empty city endpoint leaves the Cloudflare beacon working', () => {
  for (const endpoint of [null, '']) {
    const { appended, requests } = browser({ endpoint });
    assert.equal(appended.length, 1);
    assert.equal(requests.length, 0);
  }
});

test('excluded browsers never load the beacon or send a city pageview', () => {
  const { appended, requests } = browser({ excluded: true });
  assert.equal(appended.length, 0);
  assert.equal(requests.length, 0);
});

test('development builds without production attributes do not collect visits', () => {
  const { appended, requests } = browser({ configured: false, endpoint: null });
  assert.equal(appended.length, 0);
  assert.equal(requests.length, 0);
});

test('preferences page is never measured and exclusion persists for that browser', () => {
  const { elements, saved, appended, requests } = browser({ preferences: true });
  assert.equal(appended.length, 0);
  assert.equal(requests.length, 0);
  elements.exclude.click();
  assert.equal(saved.get(key), '1');
  assert.match(elements.status.textContent, /visits are excluded/);
  assert.equal(elements.exclude.disabled, true);
  const excludedVisit = browser({ excluded: saved.get(key) === '1' });
  assert.equal(excludedVisit.appended.length, 0);
  assert.equal(excludedVisit.requests.length, 0);
  assert.equal(browser().appended.length, 1);
  assert.equal(requests.length, 0);
});

test('restoring inclusion never measures the preferences page', () => {
  const { elements, saved, appended, requests } = browser({ preferences: true, excluded: true });
  elements.count.click();
  assert.equal(saved.has(key), false);
  assert.match(elements.status.textContent, /visits are included/);
  assert.equal(elements.count.disabled, true);
  assert.equal(appended.length, 0);
  assert.equal(requests.length, 0);
});

test('unavailable storage suppresses both collectors and never reports a successful save', () => {
  const failedVisit = browser({ storageError: true });
  assert.equal(failedVisit.appended.length, 0);
  assert.equal(failedVisit.requests.length, 0);
  const { elements, saved, appended, requests } = browser({ preferences: true, storageError: true });
  assert.match(elements.status.textContent, /could not read/);
  elements.exclude.click();
  assert.match(elements.status.textContent, /could not save/);
  assert.equal(saved.has(key), false);
  assert.equal(appended.length, 0);
  assert.equal(requests.length, 0);
});

test('a city network rejection is swallowed without retries or blocking the beacon', async () => {
  const { appended, requests } = browser({ fetchFailure: 'async' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.equal(appended.length, 1);
});

test('a synchronous fetch failure is swallowed without retries or blocking the beacon', () => {
  const { appended, requests } = browser({ fetchFailure: 'sync' });
  assert.equal(requests.length, 1);
  assert.equal(appended.length, 1);
});
