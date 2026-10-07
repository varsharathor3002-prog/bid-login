const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Fake GeM tab: two search pages; clicking Next shows page 2.
function setup(category) {
  const pages = [
    { showing: 'Showing 1 - 2 products of 3 products', total: 3, page: 1, category, links: [['/c/a/p-1-1-cat.html', 'acxxel'], ['/c/b/p-1-2-cat.html', ''], ['/c/d/p-1-4-cat.html', 'HP']], hasNext: true },
    { showing: 'Showing 3 - 3 products of 3 products', total: 3, page: 2, category, links: [['/c/c/p-1-3-cat.html', 'acxxel']], hasNext: false },
  ];
  let current = 0;
  const store = {};
  const saves = [];
  let connect;
  globalThis.chrome = {
    storage: { local: {
      get: async (key) => ({ [key]: store[key] }),
      set: async (values) => Object.assign(store, values),
    } },
    scripting: { executeScript: async ({ func }) => {
      if (func.name === 'clickNext') { current += 1; return [{ result: true }]; }
      return [{ result: pages[current] }];
    } },
    tabs: {
      query: async () => [{ id: 7, url: 'https://mkp.gem.gov.in/computers-all-in-one-pc-v2-/search#/?1' }],
      get: async () => ({ status: 'complete' }),
    },
    runtime: { id: 'ext', onConnect: { addListener: (fn) => { connect = fn; } } },
  };
  const opened = [];
  globalThis.fetch = async (url) => {
    const n = url.match(/p-1-(\d)/)[1];
    opened.push(n);
    const brand = n === '2' ? 'acer' : 'acxxel';
    return { ok: true, text: async () => `<span class="brand-name">${brand}</span><span itemprop="model">M-${n}</span>
      <td class="feature_name">Processor Number</td><td>i${n}</td>` };
  };
  globalThis.api = async (path, options) => { saves.push({ path, body: JSON.parse(options.body) }); return { file: 'gem_products/x.xlsx' }; };
  // Fresh copy per test, like the service worker's importScripts.
  for (const file of ['gem-product-parse.js', 'gem-product-scan.js']) {
    vm.runInThisContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), { filename: file });
  }
  const send = (type) => new Promise((resolve) => {
    const port = {
      name: 'gem-product-scan', sender: { id: 'ext' },
      postMessage: resolve,
      onMessage: { addListener: (fn) => setTimeout(() => fn({ type })) },
    };
    connect(port);
  });
  const finished = async () => {
    for (let i = 0; i < 200 && !['complete', 'failed'].includes(store.gemProductScan?.status); i += 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return store.gemProductScan;
  };
  return { send, finished, saves, opened };
}

test('reads every page of the open search and saves only acxxel products to the category Excel', { timeout: 20000 }, async () => {
  const { send, finished, saves, opened } = setup('All in One PC (V2)');
  assert.equal((await send('PRODUCT_SCAN_START')).ok, true);
  const state = await finished();
  assert.equal(state.status, 'complete', state.message);
  assert.deepEqual(opened, ['1', '2', '3'], 'the HP card is skipped without opening its page');
  assert.deepEqual(saves.map((s) => s.path), ['/catalogue/gem-category-excel/', '/catalogue/gem-category-excel/']);
  assert.deepEqual(saves[0].body.products.map((p) => p.model_no), ['M-1']);
  assert.equal(saves[0].body.category, 'All in One PC (V2)');
  assert.deepEqual(saves[1].body.products.map((p) => p.model_no), ['M-3']);
  assert.match(state.message, /2 saved/);
  assert.match(state.message, /2 other-brand product\(s\) skipped/);
});

test('Desktop searches update the directory with acxxel products only', { timeout: 20000 }, async () => {
  const { send, finished, saves } = setup('High End Desktop Computer');
  await send('PRODUCT_SCAN_START');
  const state = await finished();
  assert.equal(state.status, 'complete', state.message);
  assert.ok(saves.every((s) => s.path === '/catalogue/replace-from-gem-market/' && s.body.mode === 'update'));
  assert.deepEqual(saves.flatMap((s) => s.body.products.map((p) => p.model_no)), ['M-1', 'M-3']);
  assert.match(state.message, /2 other-brand product\(s\) skipped/);
});
