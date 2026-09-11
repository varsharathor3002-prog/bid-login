const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function harness({ statuses = ['qualified', 'disqualified', 'qualified'], badRa = false, missingNext = false, stuck = false, routedFirst = false, delayed = false, transientFrame = false, childResults = false, noRa = false } = {}) {
  let connect, page = statuses.length > 1 ? 2 : 1, taskPage = 1, now = 0, nextId = 20, pendingPage = null;
  let createdListener;
  let frameFailures = transientFrame ? 31 : 0;
  const writes = [], removed = [], requests = [], created = [], navigated = [], updated = [];
  const state = () => ({ page, signature: `GEM/2026/B/${page}`, filters: [{ key: 'checkbox:financial evaluated', checked: true }, { key: 'checkbox:bids/ras already submitted/participated', checked: true }], next: missingNext ? 'missing' : page === statuses.length ? 'end' : 'available', cards: [{ bid_no: `GEM/2026/B/${page}`, ra_no: noRa ? null : `GEM/2026/R/${page}`, technical_status: statuses[page - 1], has_bid_result: true, has_ra_result: !noRa, bid_result_url: childResults ? null : `https://bidplus.gem.gov.in/bid-result/${page}`, ra_result_url: childResults ? null : `https://bidplus.gem.gov.in/ra-result/${page}` }] });
  const chrome = {
    runtime: { id: 'test', getManifest: () => ({ version: '3.50.6' }), onConnect: { addListener(fn) { connect = fn; } } },
    storage: { local: { get: async () => ({ token: 'test-token', apiBase: 'http://127.0.0.1:8000/api' }), set: async (value) => writes.push(value) } },
    tabs: {
      onCreated: { addListener(fn) { createdListener = fn; }, removeListener() { createdListener = null; } },
      query: async () => [{ id: 10, url: 'https://bidplus.gem.gov.in/seller-bids#page-2' }],
      create: async (options) => { created.push(options); if (options.url.includes('-result/')) taskPage = Number(options.url.split('/').at(-1)); return { id: nextId++ }; },
      get: async (id) => ({ url: id === 20 ? `https://bidplus.gem.gov.in/seller-bids#page-${page}` : 'https://bidplus.gem.gov.in/result', status: 'complete' }),
      reload: async () => {},
      remove: async (id) => removed.push(id),
      update: async (id, options) => { updated.push({ id, ...options }); },
    },
    scripting: { executeScript: async (options) => {
      if (options.files) return [];
      const code = options.func.toString();
      if (code.includes('.snapshot(')) { if (pendingPage && now >= pendingPage.at) { page = pendingPage.page; pendingPage = null; } return [{ result: state() }]; }
      if (code.includes('.restoreFilters(')) { assert.equal(options.target.tabId, 20); return [{ result: { ready: true } }]; }
      if (code.includes('.navigate(')) {
        assert.equal(options.target.tabId, 20);
        navigated.push(options.args[0]);
        if (missingNext && options.args[0] === 'next') return [{ result: 'missing' }];
        if (!stuck) { const target = options.args[0] === 'first' ? 1 : page + 1; if (delayed) pendingPage = { at: now + 18000, page: target }; else page = target; }
        return [{ result: routedFirst && options.args[0] === 'first' ? 'routed' : 'clicked' }];
      }
      if (code.includes('.open(')) {
        assert.match(code, /\.collect\(document\)/, 'result control must be re-scanned in the same execution that clicks it');
        if (childResults) {
          taskPage = page;
          // Reproduce the GeM path that creates the result without openerTabId.
          const child = { id: nextId++ };
          created.push({ url: `https://bidplus.gem.gov.in/${options.args[1]}-result/${page}`, active: false, child: true });
          createdListener?.(child);
        }
        return [{ result: true }];
      }
      if (frameFailures && code.includes('readDocument')) { frameFailures--; throw new Error('Frame with ID 0 is showing error page'); }
      return [{ frameId: 0, result: { status: 'read', ids: [noRa ? `GEM/2026/B/${taskPage}` : `GEM/2026/R/${badRa ? 999 : taskPage}`], companyMatch: 'matched', companyRank: 2,
        sellers: [{ sellerName: 'LAPS N TABS TECHNOLOGY PRIVATE LIMITED', offeredItem: 'Desktop', rank: 2, totalPrice: '123.00' }] } }];
    } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'financial-ranking-sync.js'), 'utf8'), {
    chrome, URL, AbortSignal, Date: { now: () => now },
    setTimeout: (fn, ms) => { now += ms; queueMicrotask(fn); },
    fetch: async (...args) => { requests.push(args); return { ok: true, json: async () => ({}) }; },
  });
  function command(type) {
    return new Promise((resolve) => {
      let listener;
      connect({ name: 'financial-ranking', sender: { id: 'test' }, postMessage: resolve, onMessage: { addListener(fn) { listener = fn; } } });
      listener({ type });
    });
  }
  return { writes, removed, requests, created, navigated, updated, command };
}
const finish = () => new Promise(setImmediate);

test('starts at first page, scans past disqualified-only page, preserves original tab and uses isolated state', async () => {
  const h = harness();
  const first = h.command('FINANCIAL_START');
  const duplicate = h.command('FINANCIAL_START');
  assert.equal((await first).ok, true);
  assert.equal((await duplicate).ok, false);
  await finish();
  assert.deepEqual(h.navigated, ['first', 'next', 'next']);
  assert.deepEqual(h.requests.map((args) => JSON.parse(args[1].body).bid_no), ['GEM/2026/B/1', 'GEM/2026/B/3']);
  assert.deepEqual(h.removed, [21, 22, 20]);
  assert.ok(h.created.every((options) => options.active === false));
  assert.ok(h.writes.every((entry) => Object.keys(entry).join() === 'financialEvalSyncState'));
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
  assert.match(h.writes.at(-1).financialEvalSyncState.message, /All 3 pages/);
});

test('disqualified-only list finishes without opening any result tabs', async () => {
  const h = harness({ statuses: ['disqualified'] });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.requests.length, 0);
  // Disqualified seller-list cards never open View RA Results.
  assert.equal(h.created.length, 1);
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
});

test('RA identity mismatch never saves under the original bid', async () => {
  const h = harness({ statuses: ['qualified'], badRa: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.requests.length, 0);
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'failed');
});

test('missing Next is an incomplete scan, not a successful finish', async () => {
  const h = harness({ statuses: ['qualified'], missingNext: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'failed');
  assert.match(h.writes.at(-1).financialEvalSyncState.message, /could not load verified page/);
});

test('stuck pagination performs bounded retries without skipping pages', async () => {
  const h = harness({ stuck: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.requests.length, 0);
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'failed');
  assert.deepEqual(h.navigated, ['first', 'first']);
});

test('stop request prevents navigation and persistence', async () => {
  const h = harness();
  await h.command('FINANCIAL_START');
  await h.command('FINANCIAL_STOP'); await finish();
  assert.equal(h.requests.length, 0);
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'stopped');
});


test('hash fallback reaches first page and continues through all pages', async () => {
  const h = harness({ routedFirst: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
  assert.deepEqual(h.requests.map((args) => JSON.parse(args[1].body).bid_no), ['GEM/2026/B/1', 'GEM/2026/B/3']);
});

test('hash fallback alone is not success when bid cards do not change', async () => {
  const h = harness({ routedFirst: true, stuck: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'failed');
  assert.equal(h.requests.length, 0);
});


test('delayed GeM response is accepted before a second click, preventing skipped pages', async () => {
  const h = harness({ delayed: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
  assert.deepEqual(h.navigated, ['first', 'next', 'next']);
  assert.equal(new URL(h.created[0].url).hash, '#page-1');
});

test('qualified bid without an RA reads and saves View Bid Results instead', async () => {
  const h = harness({ statuses: ['qualified'], noRa: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.requests.length, 1);
  assert.match(h.created[1].url, /\/bid-result\/1$/);
  assert.equal(JSON.parse(h.requests[0][1].body).ra_no, '');
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
});

test('temporary top-frame error reopens View RA Results from the seller list and continues', async () => {
  const h = harness({ statuses: ['qualified'], transientFrame: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.requests.length, 1);
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
  assert.ok(h.created.length >= 2); // list and failed direct RA result; retry uses the live list
});

test('adopts and closes GeM child result tabs even when openerTabId is missing', async () => {
  const h = harness({ statuses: ['qualified'], childResults: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.requests.length, 1);
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
  // dedicated list tab + GeM View RA Results child (no unfiltered copy)
  assert.equal(h.created.length, 2);
  assert.equal(new Set(h.removed).size, 2);
  // GeM's own window.open activates the child tab by default; the scan must
  // push it back to the background immediately so it never steals focus from
  // whatever tab the user is on (including the Acxxel site itself).
  assert.ok(h.updated.some((entry) => entry.active === false));
});
