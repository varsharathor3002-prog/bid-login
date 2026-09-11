const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./financial-ranking-content.js');
const { parseTable, readDocument } = globalThis.AcxxelFinancialRanking;
const headers = ['S.No.', 'Seller Name', 'Offered Item', 'Total Price', 'Rank'];
// Transcribed from the supplied screenshot; not captured live-page HTML.
const rows = [
  ['1', 'SAMA SMART SOLUTIONS(MII)', 'Item Categories : High End Desktop Computer', '₹ 847203.00', 'L1'],
  ['2', 'LAPS N TABS TECHNOLOGY PRIVATE LIMITED (MSE)', 'Item Categories : High End Desktop Computer', '₹ 847203.00 (Bid Price)', 'L2'],
  ['3', 'SDEVLOOP INFO PRIVATE LIMITED (MSE,MII)', 'Item Categories : High End Desktop Computer', '₹ 923944.00 (Bid Price)', 'L3'],
  ['4', 'ARIHANT ENTERPRISE (MII)', 'Item Categories : High End Desktop Computer', '₹ 1014734.00 (Bid Price)', 'L4'],
];

test('preserves explicit different ranks for equal prices and company outside top three', () => {
  const result = parseTable(headers, rows, ['ARIHANT ENTERPRISE']);
  assert.equal(result.status, 'read');
  assert.equal(result.leaders.L1[0].totalPrice, result.leaders.L2[0].totalPrice);
  assert.equal(result.leaders.L2[0].rank, 2);
  assert.equal(result.companyRank, 4);
});
test('requires exact normalized company name and leaves missing match unknown', () => {
  assert.equal(parseTable(headers, rows, []).companyMatch, 'unconfigured');
  assert.equal(parseTable(headers, rows, ['SAMA']).companyRank, null);
  assert.equal(parseTable(headers, rows, ['sdevloop info private limited']).companyRank, 3);
});
test('matches the user-confirmed company by default despite its MSE badge', () => {
  const result = parseTable(headers, rows);
  assert.equal(result.companyMatch, 'matched');
  assert.equal(result.companyRank, 2);
  assert.equal(result.leaders.L2[0].totalPrice, '847203.00');
});
test('retains ties and reports ambiguous company matches', () => {
  const result = parseTable(headers, [rows[0], rows[0]], ['SAMA SMART SOLUTIONS']);
  assert.equal(result.leaders.L1.length, 2);
  assert.equal(result.companyMatch, 'ambiguous');
  assert.equal(result.companyRank, null);
});
test('fails closed on missing ranks, prices, headers, and empty results', () => {
  for (const value of ['', '-', 'Pending', '847203 garbage']) {
    assert.equal(parseTable(headers, [[...rows[0].slice(0, 3), value, 'L1']]).status, 'unreadable');
  }
  assert.equal(parseTable(headers, [[...rows[0].slice(0, 4), '']]).status, 'unreadable');
  assert.equal(parseTable(['Seller Name'], rows).status, 'unreadable');
  assert.equal(parseTable(headers, []).status, 'unreadable');
});
test('supports Indian grouped amounts and reordered columns', () => {
  const result = parseTable(['Rank', 'Total Price', 'Offered Item', 'Seller Name'], [['L2', '₹ 8,47,203.50 (Bid Price)', 'Desktop', 'Example']]);
  assert.equal(result.sellers[0].totalPrice, '847203.50');
  assert.equal(result.sellers[0].rank, 2);
});
test('recovers financial fields when GeM inserts a responsive body-only cell', () => {
  const shifted = rows.map((row) => ['', ...row]);
  const result = parseTable(headers, shifted);
  assert.equal(result.status, 'read');
  assert.equal(result.sellers.length, 4);
  assert.equal(result.companyRank, 2);
});
test('accepts GeM rupee, INR, Rs and slash suffix price formats', () => {
  for (const amount of ['₹ 5973000.00', 'INR 59,73,000.00', 'Rs. 5,973,000.00/-']) {
    const result = parseTable(headers, [[...rows[0].slice(0, 3), amount, 'L1']]);
    assert.equal(result.status, 'read', amount);
    assert.equal(result.sellers[0].totalPrice, '5973000.00');
  }
});
test('accepts the backtick GeM renders for its rupee icon font', () => {
  // Live GeM result pages: the Total Price cell's text/innerText content is a
  // literal backtick, not U+20B9, because the rupee glyph comes from a custom
  // icon font. Seen live as "` 549300.00" (bid GEM/2026/B/7481730).
  const result = parseTable(headers, [[...rows[0].slice(0, 3), '` 549300.00', 'L1']]);
  assert.equal(result.status, 'read');
  assert.equal(result.sellers[0].totalPrice, '549300.00');
});
test('accepts Awarded as the GeM rank header and ignores responsive footer rows', () => {
  const result = parseTable(
    ['Seller Name', 'Offered Item Details', 'Total Price (INR)', 'Awarded'],
    [rows[0].slice(1), ['Seller Name', 'Offered Item', 'Total Price', 'Awarded']],
  );
  assert.equal(result.status, 'read');
  assert.equal(result.sellers.length, 1);
  assert.equal(result.sellers[0].rank, 1);
});
test('DOM adapter reads a table and rejects multiple table ambiguity', () => {
  const table = { rows: [headers, ...rows].map((row) => ({ cells: row.map((textContent) => ({ textContent })) })) };
  assert.equal(readDocument({ querySelectorAll: () => [table] }).sellers.length, 4);
  assert.equal(readDocument({ querySelectorAll: () => [table, table] }).status, 'unreadable');
  assert.equal(readDocument({ querySelectorAll: () => [] }).status, 'unreadable');
});

test('reads semantic grid rows and colon-suffixed headers', () => {
  const grid = { querySelectorAll: () => [headers.map((value) => `${value}:`), ...rows].map((row) => ({ querySelectorAll: () => row.map((textContent) => ({ textContent })) })) };
  assert.equal(readDocument({ querySelectorAll: () => [grid] }).companyRank, 2);
});
