const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.join(__dirname, "gem-bid-sync.js");
const source = fs.readFileSync(sourcePath, "utf8");

function cardStartDate(cardText) {
  const start = source.indexOf("function dateFrom");
  const end = source.indexOf("function productType", start);
  assert.ok(start >= 0 && end > start, "date parser helpers must remain discoverable");
  const context = {
    cardText,
    text: (node) => String(node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim(),
  };
  vm.runInNewContext(
    `${source.slice(start, end)}; parsed = opportunityCardStartDate({ innerText: cardText });`,
    context,
  );
  return context.parsed;
}

function retentionResult(valueExpression, referenceExpression) {
  const start = source.indexOf("function disqualifiedRetentionCutoff");
  const end = source.indexOf("function opportunityCardStartDate", start);
  assert.ok(start >= 0 && end > start, "retention helpers must remain discoverable");
  const context = {};
  vm.runInNewContext(
    `${source.slice(start, end)}; reference = ${referenceExpression}; result = isRecentDisqualification(${valueExpression}, reference); cutoff = disqualifiedRetentionCutoff(reference);`,
    context,
  );
  return context;
}

function opportunityResult(itemCategory) {
  const dateStart = source.indexOf("function dateFrom");
  const dateEnd = source.indexOf("function productType", dateStart);
  const parserStart = source.indexOf("const OPPORTUNITY_PRODUCTS");
  const parserEnd = source.indexOf("function bidDetailUrl", parserStart);
  assert.ok(dateStart >= 0 && dateEnd > dateStart && parserStart >= 0 && parserEnd > parserStart);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10, 17, 0, 0);
  const indian = (value) => [
    String(value.getDate()).padStart(2, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    value.getFullYear(),
  ].join("-");
  const context = {
    bidNo: "GEM/2026/B/9999999",
    cardStartDate: start.toISOString(),
    raw: `Bid End Date/Time ${indian(end)} 17:00:00 Bid Offer Validity (From End Date) 90 (Days) `
      + `Department Name Test Department Item Category ${itemCategory} MSE Relaxation No `
      + "Consignees/Reporting Officer and Quantity 110001, Test Address 1 30 Special terms",
    ACXXEL_BLOCKED_DELIVERY_PINS: new Set(),
    ACXXEL_BLOCKED_DELIVERY_DISTRICTS: new Set(),
    ACXXEL_BLOCKED_DELIVERY_STATES: new Set(),
  };
  vm.runInNewContext(
    `${source.slice(dateStart, dateEnd)}; ${source.slice(parserStart, parserEnd)}; result = opportunityFromText(bidNo, raw, cardStartDate);`,
    context,
  );
  return context.result;
}

function opportunityCutoffResult(valueExpression, referenceExpression) {
  const start = source.indexOf("function opportunityStartCutoff");
  const end = source.indexOf("function opportunityCardStartDate", start);
  assert.ok(start >= 0 && end > start, "opportunity cutoff helpers must remain discoverable");
  const context = {};
  vm.runInNewContext(
    `${source.slice(start, end)}; reference = ${referenceExpression}; result = isOpportunityBeforeStartCutoff(${valueExpression}, reference); cutoff = opportunityStartCutoff(reference);`,
    context,
  );
  return context;
}

test("reads the current bid Start Date and time from a seller-list card", () => {
  const parsed = cardStartDate(
    "BID NO: GEM/2026/B/7867238 Participation Status: Not participated "
      + "Start Date: 15-09-2026 10:18 AM End Date: 25-09-2026 11:00 AM",
  );
  const local = new Date(parsed);
  assert.deepEqual(
    [local.getFullYear(), local.getMonth() + 1, local.getDate(), local.getHours(), local.getMinutes()],
    [2026, 9, 15, 10, 18],
  );
});

test("supports GeM's Bid/RA Start Date label", () => {
  const parsed = cardStartDate("Bid/RA Start Date: 14/09/2026 9:02 PM End Date: 17/09/2026 9:00 PM");
  const local = new Date(parsed);
  assert.deepEqual(
    [local.getFullYear(), local.getMonth() + 1, local.getDate(), local.getHours(), local.getMinutes()],
    [2026, 9, 14, 21, 2],
  );
});

test("uses the card Start Date before the PDF Dated fallback", () => {
  assert.match(source, /const bidDate = cardStartDate\s*\|\|\s*dateFrom/);
  assert.match(source, /opportunityFromText\(bidNo, response\.detailText, cardStartDate\)/);
});

test("accepts exactly the six approved opportunity categories", () => {
  const categories = [
    ["Entry and Mid Level Desktop Computer (Q2)", "desktop"],
    ["High End Desktop Computer (Q2)", "desktop"],
    ["All in One PC (V2) (Q2)", "aio"],
    ["Fixed Computer Workstation (Q2)", "workstation"],
    ["Toner Cartridges / Ink Cartridges (Q2)", "toner"],
    ["A4 and Legal Size Multifunction Printer (MFP) (Q2)", "printer"],
  ];
  for (const [category, productType] of categories) {
    const result = opportunityResult(category);
    assert.equal(result.eligible, true, category);
    assert.equal(result.product_type, productType, category);
  }
});

test("accepts a bunch only when every category is approved", () => {
  const result = opportunityResult(
    "All in One PC (V2) (Q2), Entry and Mid Level Desktop Computer (Q2), "
      + "A4 and Legal Size Multifunction Printer (MFP) (Q2)",
  );
  assert.equal(result.eligible, true);
  assert.equal(result.product_type, "bunch_bid");
});

test("rejects PAC Only even when it follows the final Q marker", () => {
  const result = opportunityResult("A4 and Legal Size Multifunction Printer (MFP) (Q2) ( PAC Only )");
  assert.equal(result.reject, "pac");
});

test("rejects the complete bunch when it contains A3, UPS, or another unsupported category", () => {
  const invalid = [
    "A3 Size Multifunction Printer (MFP) (Q2), A4 and Legal Size Multifunction Printer (MFP) (Q2)",
    "All in One PC (V2) (Q2), A4 and Legal Size Multifunction Printer (MFP) (Q2), Line Interactive UPS with AVR (V2) (Q2)",
    "All in One PC (V2) (Q2), Entry and Mid Level Desktop Computer (Q2), A4 and Legal Size Multifunction Printer (MFP) (Q2), A3 Printer (MFP) (Q2)",
  ];
  for (const category of invalid) assert.equal(opportunityResult(category).reject, "product", category);
});

test("three-day opportunity cutoff includes the cutoff day and stops on older dates", () => {
  const reference = "new Date(2026, 8, 16, 15, 0, 0)";
  const onCutoff = opportunityCutoffResult("new Date(2026, 8, 13, 0, 0, 0).toISOString()", reference);
  assert.equal(onCutoff.result, false);
  assert.equal(onCutoff.cutoff.getDate(), 13);
  assert.equal(opportunityCutoffResult("new Date(2026, 8, 12, 23, 59, 59).toISOString()", reference).result, true);
  assert.equal(opportunityCutoffResult("''", reference).result, false);
});

test("opportunity scan stops before opening details or navigating after the date cutoff", () => {
  const start = source.indexOf("async function scanOpportunityPages");
  const end = source.indexOf("async function waitForBidCards", start);
  const scan = source.slice(start, end);
  assert.match(scan, /const latestFirst = await applyOpportunityFilters\(\)/);
  assert.match(scan, /isOpportunityBeforeStartCutoff\(cardStartDate\)[\s\S]*stoppedAtStartCutoff = true[\s\S]*break/);
  assert.ok(scan.indexOf("isOpportunityBeforeStartCutoff(cardStartDate)") < scan.indexOf("opportunityFromBidDetail(bidNo, card)"));
  assert.match(scan, /if \(stoppedAtStartCutoff\) break;[\s\S]*advancePageWithRecovery/);
});

test("saves each eligible opportunity immediately and preserves checked progress", () => {
  const start = source.indexOf("async function scanOpportunityPages");
  const end = source.indexOf("async function waitForBidCards", start);
  const scan = source.slice(start, end);
  assert.match(scan, /SAVE_GEM_BID_OPPORTUNITIES[\s\S]*results:\s*\[row\]/);
  assert.doesNotMatch(scan, /const eligible\s*=\s*\[\]/);
  assert.match(scan, /Opening \$\{bidNo\}[\s\S]*\{ page, saved, checked \}/);
  assert.match(scan, /Selected category page \$\{page\}[\s\S]*\{ page, saved, checked \}/);
  assert.match(scan, /"complete"[\s\S]*\{ page, saved, checked \}/);
  assert.match(scan, /"stopped"[\s\S]*\{ page, saved, checked \}/);
});

test("only counts disqualifications inside the dashboard one-month window", () => {
  const reference = "new Date(2026, 8, 15, 13, 0, 0)";
  assert.equal(retentionResult("new Date(2026, 7, 15, 0, 0, 0).toISOString()", reference).result, true);
  assert.equal(retentionResult("new Date(2026, 7, 14, 23, 59, 59).toISOString()", reference).result, false);
  assert.equal(retentionResult("''", reference).result, false);
  assert.equal(retentionResult("new Date(2026, 8, 16, 0, 0, 0).toISOString()", reference).result, false);
});

test("one-month cutoff clamps to the previous month's last day", () => {
  const context = retentionResult("new Date(2026, 1, 28, 0, 0, 0).toISOString()", "new Date(2026, 2, 31, 13, 0, 0)");
  assert.equal(context.cutoff.getMonth(), 1);
  assert.equal(context.cutoff.getDate(), 28);
  assert.equal(context.result, true);
});

test("disqualified scan reports only dashboard-valid API saves", () => {
  const start = source.indexOf("async function scanAllPages");
  const end = source.indexOf("const OPPORTUNITY_PRODUCTS", start);
  const scan = source.slice(start, end);
  assert.match(scan, /if \(!isRecentDisqualification\(result\.disqualified_at\)\)/);
  assert.match(scan, /created \+= response\.created/);
  assert.match(scan, /updated \+= response\.updated/);
  assert.match(scan, /rejected \+= response\.rejected/);
  assert.doesNotMatch(scan, /saved.*disqualified bids from 2026/);
});

test("pagination uses the page route when Next is temporarily missing and recovery is bounded", () => {
  const start = source.indexOf("async function advancePage(signature, page)");
  const end = source.indexOf("async function scanAllPages", start);
  const pagination = source.slice(start, end);
  assert.ok(start >= 0 && end > start, "pagination helpers must remain discoverable");
  assert.doesNotMatch(pagination, /if \(!state\.found\) return/);
  assert.match(pagination, /if \(!state\.found\) \{[\s\S]*lastReason = "missing";[\s\S]*continue;/);
  assert.match(pagination, /const targetHash = `#page-\$\{page \+ 1\}`;[\s\S]*location\.hash = targetHash/);
  assert.match(pagination, /const MAX_PAGINATION_RECOVERY_ATTEMPTS = 4;/);
  assert.match(pagination, /while \(recoveryAttempt < MAX_PAGINATION_RECOVERY_ATTEMPTS\)/);
  assert.match(pagination, /scan is incomplete; already saved bids are retained/);
});
