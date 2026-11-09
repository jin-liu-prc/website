const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../static/js/visitor-analytics.js'), 'utf8');
const key = 'jinliu.analytics.exclude';

function browser({ excluded = false, preferences = false, configured = true, storageError = false } = {}) {
  const saved = new Map(excluded ? [[key, '1']] : []);
  const appended = [];
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
  const document = {
    currentScript: { getAttribute: () => configured ? '{"token":"public-site-token"}' : null },
    querySelector: () => preferences ? settings : null,
    createElement: () => ({ attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }),
    body: { appendChild: script => appended.push(script) }
  };
  vm.runInNewContext(source, { document, localStorage: storage });
  return { saved, appended, elements };
}

test('ordinary visitors load exactly one correctly configured module beacon', () => {
  const { appended } = browser();
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, 'https://static.cloudflareinsights.com/beacon.min.js');
  assert.equal(appended[0].type, 'module');
  assert.equal(JSON.parse(appended[0].attributes['data-cf-beacon']).token, 'public-site-token');
});

test('excluded browsers never load the beacon', () => {
  assert.equal(browser({ excluded: true }).appended.length, 0);
});

test('unconfigured development builds never load the beacon', () => {
  assert.equal(browser({ configured: false }).appended.length, 0);
});

test('preferences page is never measured and exclusion persists for that browser', () => {
  const { elements, saved, appended } = browser({ preferences: true });
  assert.equal(appended.length, 0);
  elements.exclude.click();
  assert.equal(saved.get(key), '1');
  assert.match(elements.status.textContent, /visits are excluded/);
  assert.equal(elements.exclude.disabled, true);
  assert.equal(browser({ excluded: saved.get(key) === '1' }).appended.length, 0);
  assert.equal(browser().appended.length, 1);
});

test('restoring inclusion removes the flag without tracking the preferences page', () => {
  const { elements, saved, appended } = browser({ preferences: true, excluded: true });
  elements.count.click();
  assert.equal(saved.has(key), false);
  assert.match(elements.status.textContent, /visits are included/);
  assert.equal(elements.count.disabled, true);
  assert.equal(appended.length, 0);
});

test('unavailable storage suppresses collection and never reports a successful save', () => {
  assert.equal(browser({ storageError: true }).appended.length, 0);
  const { elements, saved, appended } = browser({ preferences: true, storageError: true });
  assert.match(elements.status.textContent, /could not read/);
  elements.exclude.click();
  assert.match(elements.status.textContent, /could not save/);
  assert.equal(saved.has(key), false);
  assert.equal(appended.length, 0);
});
