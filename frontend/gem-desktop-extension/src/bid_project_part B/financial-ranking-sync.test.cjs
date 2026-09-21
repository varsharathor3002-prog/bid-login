const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function harness({ statuses = ['qualified', 'disqualified', 'qualified'], startDates = [], badRa = false, missingNext = false, stuck = false, routedFirst = false, delayed = false, transientFrame = false, childResults = false, noRa = false, firstPageInitiallyUnknown = false, foregroundTabId = 99 } = {}) {
  let connect, page = statuses.length > 1 ? 2 : 1, taskPage = 1, taskKind = 'bid', now = 0, nextId = 20, pendingPage = null;
  let createdListener, focusListener;
  let queryCount = 0;
  let frameFailures = transientFrame ? 31 : 0;
  const writes = [], removed = [], requests = [], created = [], navigated = [], updated = [], moved = [], windowsCreated = [], windowsRemoved = [];
  let snapshotCount = 0;
  const state = () => ({ page: firstPageInitiallyUnknown && snapshotCount++ === 0 ? null : page, signature: `GEM/2026/B/${page}`, filters: [{ key: 'checkbox:bid/ra awarded', checked: true }, { key: 'checkbox:bids/ras already submitted/participated', checked: true }], next: missingNext ? 'missing' : page === statuses.length ? 'end' : 'available', cards: [{ bid_no: `GEM/2026/B/${page}`, ra_no: noRa ? null : `GEM/2026/R/${page}`, technical_status: statuses[page - 1], start_date: startDates[page - 1] || '2026-07-20', end_date: '2026-09-21', has_bid_result: true, has_ra_result: !noRa, bid_result_url: childResults ? null : `https://bidplus.gem.gov.in/bid-result/${page}`, ra_result_url: childResults ? null : `https://bidplus.gem.gov.in/ra-result/${page}` }] });
  const chrome = {
    runtime: { id: 'test', getManifest: () => ({ version: '3.50.6' }), onConnect: { addListener(fn) { connect = fn; } } },
    storage: { local: { get: async () => ({ token: 'test-token', apiBase: 'http://127.0.0.1:8000/api' }), set: async (value) => writes.push(value) } },
    tabs: {
      onCreated: { addListener(fn) { createdListener = fn; }, removeListener() { createdListener = null; } },
      query: async (options = {}) => {
        const source = { id: 10, index: 2, windowId: 1, url: 'https://bidplus.gem.gov.in/seller-bids#page-2' };
        const foreground = { id: foregroundTabId, index: 1, windowId: 1, url: 'http://localhost:5173/analyser' };
        if (options.windowId === 1) return [source, foreground];
        return queryCount++ === 0 ? [source] : [foreground];
      },
      create: async (options) => {
        created.push(options);
        if (options.url.includes('-result/')) {
          taskPage = Number(options.url.split('/').at(-1));
          taskKind = options.url.includes('ra-result') ? 'ra' : 'bid';
        }
        return { id: nextId++ };
      },
      get: async (id) => ({ url: id === 10 ? `https://bidplus.gem.gov.in/seller-bids#page-${page}` : 'https://bidplus.gem.gov.in/result', status: 'complete' }),
      reload: async () => {},
      remove: async (id) => removed.push(id),
      update: async (id, options) => { updated.push({ id, ...options }); },
      move: async (id, options) => { moved.push({ id, ...options }); },
    },
    windows: {
      onFocusChanged: { addListener(fn) { focusListener = fn; }, removeListener() { focusListener = null; } },
      create: async (options) => { windowsCreated.push(options); return { id: 50 }; },
      update: async () => {},
      remove: async (id) => { windowsRemoved.push(id); },
    },
    scripting: { executeScript: async (options) => {
      if (options.files) return [];
      const code = options.func.toString();
      if (code.includes('.snapshot(')) { if (pendingPage && now >= pendingPage.at) { page = pendingPage.page; pendingPage = null; } return [{ result: state() }]; }
      if (code.includes('.restoreFilters(')) { assert.equal(options.target.tabId, 10); return [{ result: { ready: true } }]; }
      if (code.includes('.navigate(')) {
        assert.equal(options.target.tabId, 10);
        navigated.push(options.args[0]);
        if (missingNext && options.args[0] === 'next') return [{ result: 'missing' }];
        if (!stuck) { const target = options.args[0] === 'first' ? 1 : page + 1; if (delayed) pendingPage = { at: now + 18000, page: target }; else page = target; }
        return [{ result: routedFirst && options.args[0] === 'first' ? 'routed' : 'clicked' }];
      }
      if (code.includes('.open(')) {
        assert.match(code, /\.collect\(document\)/, 'result control must be re-scanned in the same execution that clicks it');
        taskKind = options.args[1];
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
      const identity = taskKind === 'bid' || noRa ? `GEM/2026/B/${taskPage}` : `GEM/2026/R/${badRa ? 999 : taskPage}`;
      const sellerStatus = taskKind === 'bid' ? statuses[taskPage - 1] || 'unknown' : 'qualified';
      return [{ frameId: 0, result: { status: 'read', ids: [identity], companyMatch: 'matched', companyRank: 2,
        sellers: [{ sellerName: 'LAPS N TABS TECHNOLOGY PRIVATE LIMITED', offeredItem: 'Desktop', rank: 2, totalPrice: '123.00', status: sellerStatus }] } }];
    } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'financial-ranking-sync.js'), 'utf8'), {
    chrome, URL, AbortSignal, Date: { now: () => now },
    setTimeout: (fn, ms) => { now += ms; queueMicrotask(fn); },
    fetch: async (...args) => { requests.push(args); return { ok: true, json: async () => ({ saved: 1, created: 1, updated: 0, frontend_visible: true }) }; },
  });
  function command(type, options = {}) {
    return new Promise((resolve) => {
      let listener;
      connect({ name: 'financial-ranking', sender: { id: 'test' }, postMessage: resolve, onMessage: { addListener(fn) { listener = fn; } } });
      listener({ type, ...options });
    });
  }
  return { writes, removed, requests, created, navigated, updated, moved, windowsCreated, windowsRemoved, command };
}
const finish = () => new Promise(setImmediate);

test('uses the selected filtered tab and saves every awarded status without closing it', async () => {
  const h = harness();
  const first = h.command('FINANCIAL_START');
  const duplicate = h.command('FINANCIAL_START');
  assert.equal((await first).ok, true);
  assert.equal((await duplicate).ok, false);
  await finish();
  assert.deepEqual(h.navigated, ['first', 'next', 'next']);
  assert.deepEqual(h.requests.map((args) => JSON.parse(args[1].body).bid_no), ['GEM/2026/B/1', 'GEM/2026/B/2', 'GEM/2026/B/3']);
  assert.deepEqual(h.requests.map((args) => JSON.parse(args[1].body).technical_status), ['qualified', 'disqualified', 'qualified']);
  assert.ok(h.requests.every((args) => JSON.parse(args[1].body).source_type === 'bid_ra_awarded'));
  assert.ok(h.requests.every((args) => JSON.parse(args[1].body).start_date === '2026-07-20' && JSON.parse(args[1].body).end_date === '2026-09-21'));
  assert.ok(h.removed.length > 0);
  assert.ok(!h.removed.includes(10), 'the user-selected GeM list tab must never be closed');
  const resultTabs = h.created.filter((options) => options.url.includes('-result/'));
  assert.ok(resultTabs.every((options) => options.active === false));
  assert.ok(resultTabs.every((options) => options.windowId === 50));
  assert.equal(h.windowsCreated.length, 1);
  assert.equal(h.windowsCreated[0].tabId, undefined);
  assert.equal(h.windowsCreated[0].url, 'about:blank');
  assert.equal(h.windowsCreated[0].type, 'popup');
  assert.equal(h.windowsCreated[0].state, 'minimized');
  assert.equal(h.windowsCreated[0].focused, false);
  assert.ok(!h.moved.some((entry) => entry.id === 10), 'the selected GeM list must remain in its original window');
  assert.deepEqual(h.windowsRemoved, [50]);
  assert.ok(h.writes.every((entry) => Object.keys(entry).join() === 'financialEvalSyncState'));
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
  assert.match(h.writes.at(-1).financialEvalSyncState.message, /Last available awarded page reached/);
});

test('stops after the configured page limit without traversing the remaining pages', async () => {
  const h = harness({ statuses: ['qualified', 'qualified', 'qualified'] });
  await h.command('FINANCIAL_START', { startDateFrom: '2026-01-01', lastPage: 2 }); await finish();
  assert.deepEqual(h.requests.map((args) => JSON.parse(args[1].body).bid_no), ['GEM/2026/B/1', 'GEM/2026/B/2']);
  assert.deepEqual(h.navigated, ['first', 'next']);
  assert.match(h.writes.at(-1).financialEvalSyncState.message, /Page limit 2 reached/);
});

test('skips cards older than Start Date From while retaining cutoff-day bids', async () => {
  const h = harness({ statuses: ['qualified', 'qualified'], startDates: ['2025-12-31', '2026-01-01'] });
  await h.command('FINANCIAL_START', { startDateFrom: '2026-01-01', lastPage: 65 }); await finish();
  assert.deepEqual(h.requests.map((args) => JSON.parse(args[1].body).bid_no), ['GEM/2026/B/2']);
  assert.match(h.writes.at(-1).financialEvalSyncState.message, /1 older/);
});

test('accepts page 1 when the first pagination snapshot temporarily lacks its number', async () => {
  const h = harness({ statuses: ['qualified'], firstPageInitiallyUnknown: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.requests.length, 1);
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
  assert.ok(!h.removed.includes(10));
});

test('disqualified awarded bid is read and saved instead of skipped', async () => {
  const h = harness({ statuses: ['disqualified'] });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.requests.length, 1);
  assert.equal(JSON.parse(h.requests[0][1].body).technical_status, 'disqualified');
  assert.equal(h.created.filter((entry) => entry.url.includes('-result/')).length, 1);
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

test('pause request halts navigation and persistence until resumed', async () => {
  const h = harness();
  await h.command('FINANCIAL_START');
  await h.command('FINANCIAL_PAUSE'); await finish();
  assert.equal(h.requests.length, 0);
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'paused');
  await h.command('FINANCIAL_RESUME'); await finish();
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
});


test('hash fallback reaches first page and continues through all pages', async () => {
  const h = harness({ routedFirst: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
  assert.deepEqual(h.requests.map((args) => JSON.parse(args[1].body).bid_no), ['GEM/2026/B/1', 'GEM/2026/B/2', 'GEM/2026/B/3']);
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
  assert.deepEqual(h.navigated, ['first', 'next', 'next']);
});

test('awarded bid without an RA reads status and ranking from View Bid Results', async () => {
  const h = harness({ statuses: ['qualified'], noRa: true });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.requests.length, 1);
  assert.match(h.created[0].url, /\/bid-result\/1$/);
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

test('adopts child result tabs and immediately restores the foreground software tab', async () => {
  const h = harness({ statuses: ['qualified'], childResults: true, foregroundTabId: 99 });
  await h.command('FINANCIAL_START'); await finish();
  assert.equal(h.requests.length, 1);
  assert.equal(h.writes.at(-1).financialEvalSyncState.status, 'complete');
  // Only View RA Results is needed because card Technical Status is present.
  assert.equal(h.created.filter((entry) => entry.child).length, 1);
  assert.equal(new Set(h.removed).size, 1);
  assert.ok(!h.removed.includes(10));
  // GeM's own window.open activates the child tab by default; the scan must
  // push it back to the background immediately so it never steals focus from
  // whatever tab the user is on (including the Acxxel site itself).
  assert.ok(h.updated.some((entry) => entry.id !== 99 && entry.active === false));
  assert.ok(h.updated.some((entry) => entry.id === 99 && entry.active === true));
  assert.ok(h.moved.some((entry) => entry.windowId === 50));
});
