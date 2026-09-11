const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./financial-ranking-list.js');

function fixture(status, bid, ra) {
  const card = { innerText: `Bid No: ${bid} RA NO: ${ra} Technical Status: ${status} View Bid Results View RA Results`, parentElement: null };
  const makeControl = (label, href) => {
    const attributes = {};
    return { innerText: label, parentElement: card,
      getAttribute: (name) => name === 'href' ? href : attributes[name] || null,
      setAttribute: (name, value) => { attributes[name] = value; },
      click() { this.clicked = true; },
    };
  };
  const bidControl = makeControl('View Bid Results', '/bid/result');
  const control = makeControl('View RA Results', '/ra/result');
  return { control, bidControl, card };
}
test('collects original bid, RA and exact technical status independently', () => {
  const disqualified = fixture('Disqualified', 'GEM/2026/B/7524883', 'GEM/2026/R/716205');
  const qualified = fixture('Qualified', 'GEM/2026/B/7333927', 'GEM/2026/R/717123');
  const doc = { location: { href: 'https://bidplus.gem.gov.in/seller-bids#page-2' }, querySelectorAll: () => [disqualified.bidControl, disqualified.control, qualified.bidControl, qualified.control] };
  const rows = globalThis.AcxxelFinancialList.collect(doc);
  assert.equal(rows[0].technical_status, 'disqualified');
  assert.equal(rows[1].bid_no, 'GEM/2026/B/7333927');
  assert.equal(rows[1].ra_no, 'GEM/2026/R/717123');
  assert.equal(rows[1].ra_result_url, 'https://bidplus.gem.gov.in/ra/result');
  assert.equal(rows[1].bid_result_url, 'https://bidplus.gem.gov.in/bid/result');
  assert.equal(rows[1].has_ra_result, true);
  assert.equal(rows[1].has_bid_result, true);
  assert.equal(globalThis.AcxxelFinancialList.open(doc, rows[0].bid_no, 'bid'), true);
  assert.equal(globalThis.AcxxelFinancialList.open(doc, rows[1].bid_no), true);
  assert.equal(disqualified.bidControl.clicked, true);
  assert.equal(qualified.control.clicked, true);
});

test('does not attach a result button to a container containing multiple bids', () => {
  const { card, control } = fixture('Qualified', 'GEM/2026/B/1', 'GEM/2026/R/2');
  card.innerText += ' Bid No: GEM/2026/B/3';
  const doc = { querySelectorAll: () => [control] };
  assert.deepEqual(globalThis.AcxxelFinancialList.collect(doc), []);
});

test('scripted result controls are clicked rather than bypassed using placeholder href', () => {
  const { control } = fixture('Qualified', 'GEM/2026/B/1', 'GEM/2026/R/2');
  control.hasAttribute = (name) => name === 'ng-click';
  const doc = { location: { href: 'https://bidplus.gem.gov.in/seller-bids' }, querySelectorAll: () => [control] };
  assert.equal(globalThis.AcxxelFinancialList.collect(doc)[0].ra_result_url, null);
});

test('opens the exact bid result while Technical Status text is temporarily detached', () => {
  const { card, control } = fixture('Qualified', 'GEM/2026/B/7430505', 'GEM/2026/R/718714');
  card.innerText = 'Bid No: GEM/2026/B/7430505 RA NO: GEM/2026/R/718714 View RA Results';
  const doc = { body: {}, querySelectorAll: () => [control] };
  assert.deepEqual(globalThis.AcxxelFinancialList.collect(doc), []);
  assert.equal(globalThis.AcxxelFinancialList.open(doc, 'GEM/2026/B/7430505', 'ra'), true);
  assert.equal(control.clicked, true);
});

test('opens the tokenized snapshot control without recalculating its Angular card', () => {
  const { card, control } = fixture('Qualified', 'GEM/2026/B/7333927', 'GEM/2026/R/717123');
  const doc = {
    location: { href: 'https://bidplus.gem.gov.in/seller-bids#page-2' },
    querySelectorAll: () => [control],
    querySelector: (selector) => control.getAttribute('data-acxxel-financial-result') && selector.includes(control.getAttribute('data-acxxel-financial-result')) ? control : null,
  };
  const [snapshot] = globalThis.AcxxelFinancialList.collect(doc);
  assert.ok(snapshot.ra_result_token);
  card.innerText = 'GeM is re-rendering this card';
  assert.equal(globalThis.AcxxelFinancialList.open(doc, snapshot.bid_no, 'ra', snapshot.ra_result_token), true);
  assert.equal(control.clicked, true);
});

test('financial section without aria-expanded is expanded only once', () => {
  let clicks = 0;
  const control = { innerText: '3. FINANCIAL EVALUATION', getAttribute: () => null, click: () => clicks++ };
  const doc = { querySelectorAll: () => [control] };
  globalThis.AcxxelFinancialList.expand(doc);
  globalThis.AcxxelFinancialList.expand(doc);
  assert.equal(clicks, 1);
});

test('pagination clicks first and next, and respects a disabled last-page control', () => {
  let clicks = 0;
  const button = (value) => ({ innerText: value, disabled: false, closest: () => null, matches: () => false, getAttribute: () => null, click: () => clicks++ });
  const first = button('1');
  const next = button('Next');
  const doc = { location: { hash: '#page-2' }, querySelector: () => null, querySelectorAll: () => [first, next] };
  assert.equal(globalThis.AcxxelFinancialList.navigate(doc, 'first'), 'clicked');
  assert.equal(globalThis.AcxxelFinancialList.navigate(doc, 'next'), 'clicked');
  next.disabled = true;
  assert.equal(globalThis.AcxxelFinancialList.navigate(doc, 'next'), 'end');
  assert.equal(clicks, 2);
});

function filterFixture(prefix, selected = true) {
  const controls = [];
  const sidebar = { innerText: 'By Bid Type: Financial Evaluated', contains: (node) => controls.includes(node) };
  function add(label, type, checked) {
    const node = { id: `${prefix}-${controls.length}`, type, checked, disabled: false, parentElement: sidebar,
      labels: [{ innerText: label }], getAttribute: () => null,
      click() {
        this.clicks = (this.clicks || 0) + 1;
        if (type === 'radio') controls.filter((other) => other.type === 'radio').forEach((other) => { other.checked = false; });
        this.checked = type === 'radio' ? true : !this.checked;
      },
    };
    controls.push(node);
    return node;
  }
  add('Financial Evaluated', 'checkbox', selected);
  add('All Bid/RAs', 'radio', selected);
  add('Product Bid/RAs', 'radio', !selected);
  const outside = { labels: [{ innerText: 'Select bid row' }], type: 'checkbox', checked: true };
  const doc = { body: {}, querySelectorAll: () => [...controls, outside] };
  return { doc, controls };
}

test('missing first-page button uses the GeM hash route without altering query filters', () => {
  const doc = { location: { pathname: '/seller-bids', hash: '#page-12', search: '?status=financial' }, querySelector: () => null, querySelectorAll: () => [] };
  assert.equal(globalThis.AcxxelFinancialList.navigate(doc, 'first'), 'routed');
  assert.equal(doc.location.hash, '#page-1');
  assert.equal(doc.location.search, '?status=financial');
});

test('first-page fallback never routes a result document', () => {
  const doc = { location: { pathname: '/ra-result', hash: '#page-2' }, querySelector: () => null, querySelectorAll: () => [] };
  assert.equal(globalThis.AcxxelFinancialList.navigate(doc, 'first'), 'missing');
  assert.equal(doc.location.hash, '#page-2');
});

test('restores by visible filter labels despite changed IDs and ignores row selection', () => {
  const source = filterFixture('old');
  const target = filterFixture('new', false);
  const expected = globalThis.AcxxelFinancialList.filters(source.doc);
  assert.equal(expected.length, 3);
  assert.equal(globalThis.AcxxelFinancialList.restoreFilters(target.doc, expected).ready, false);
  assert.equal(globalThis.AcxxelFinancialList.restoreFilters(target.doc, expected).ready, false);
  assert.equal(globalThis.AcxxelFinancialList.restoreFilters(target.doc, expected).ready, true);
  assert.equal(target.controls[2].clicks, undefined);
  assert.deepEqual(globalThis.AcxxelFinancialList.filters(target.doc), expected);
});

test('reports the missing selected label rather than toggling unrelated filters', () => {
  const target = filterFixture('new');
  const result = globalThis.AcxxelFinancialList.restoreFilters(target.doc, [{ key: 'checkbox:desktop category', checked: true }]);
  assert.equal(result.ready, false);
  assert.match(result.reason, /desktop category/);
  assert.ok(target.controls.every((node) => !node.clicks));
});

test('pagination uses the existing Angular click bridge without a duplicate native click', () => {
  let native = 0, bridged = 0;
  const attributes = {};
  const listeners = new Map();
  const button = { innerText: 'Next', closest: () => null, matches: () => false,
    getAttribute: (key) => attributes[key] || null, setAttribute: (key, value) => { attributes[key] = value; }, removeAttribute: (key) => { delete attributes[key]; },
    scrollIntoView() {}, click: () => native++,
  };
  const doc = { location: { hash: '#page-1' }, querySelector: () => null, querySelectorAll: () => [button],
    addEventListener: (name, listener) => listeners.set(name, listener), removeEventListener: (name) => listeners.delete(name),
    dispatchEvent(event) {
      assert.equal(event.type, 'acxxel-gem-click-control');
      bridged++;
      listeners.get('acxxel-gem-control-clicked')({ detail: { clickId: event.detail.clickId, clicked: true } });
    },
  };
  button.ownerDocument = doc;
  assert.equal(globalThis.AcxxelFinancialList.navigate(doc, 'next'), 'clicked');
  assert.equal(bridged, 1);
  assert.equal(native, 0);
  assert.equal(attributes['data-acxxel-click-id'], undefined);
});
