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
  const start = source.indexOf("function isValidDisqualificationDate");
  const end = source.indexOf("function opportunityCardStartDate", start);
  assert.ok(start >= 0 && end > start, "retention helpers must remain discoverable");
  const context = {};
  vm.runInNewContext(
    `${source.slice(start, end)}; reference = ${referenceExpression}; result = isValidDisqualificationDate(${valueExpression}, reference);`,
    context,
  );
  return context;
}

function opportunityResult(itemCategory, quantityText = "", cardQuantity = 0, validityDays = 90) {
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
    cardQuantity,
    raw: `Bid End Date/Time ${indian(end)} 17:00:00 Bid Offer Validity (From End Date) ${validityDays} (Days) `
      + `Department Name Test Department Item Category ${itemCategory} MSE Relaxation No `
      + `${quantityText === "" ? "Total Quantity 30" : quantityText} `
      + "Consignees/Reporting Officer Test Address 1 Special terms",
    ACXXEL_BLOCKED_DELIVERY_PINS: new Set(),
    ACXXEL_BLOCKED_DELIVERY_DISTRICTS: new Set(),
    ACXXEL_BLOCKED_DELIVERY_STATES: new Set(),
  };
  vm.runInNewContext(
    `${source.slice(dateStart, dateEnd)}; ${source.slice(parserStart, parserEnd)}; result = opportunityFromText(bidNo, raw, cardStartDate, cardQuantity);`,
    context,
  );
  return context.result;
}

function knownBidHelpers() {
  const start = source.indexOf("const OPPORTUNITY_KNOWN_BIDS_KEY");
  const end = source.indexOf("function opportunityCardStartDate", start);
  assert.ok(start >= 0 && end > start, "known-bid helpers must remain discoverable");
  const context = {};
  vm.runInNewContext(
    `${source.slice(start, end)}; helpers = { isKnownOpportunityPage, mergeKnownBids, OPPORTUNITY_KNOWN_BID_TTL_MS };`,
    context,
  );
  return context.helpers;
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
  assert.match(source, /opportunityFromText\(bidNo, response\.detailText, cardStartDate, opportunityCardQuantity\(card\)\)/);
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

test("receives Printer bids at any quantity and validity, Workstation at any quantity", () => {
  const printer = "A4 and Legal Size Multifunction Printer (MFP) (Q2)";
  const workstation = "Fixed Computer Workstation (V2) (Q2)";
  const desktop = "High End Desktop Computer (Q2)";
  assert.equal(opportunityResult(printer, "Total Quantity 1").eligible, true);
  assert.equal(opportunityResult(printer, "Total Quantity 2", 0, 180).eligible, true);
  assert.equal(opportunityResult(workstation, "Total Quantity 2").eligible, true);
  assert.equal(opportunityResult(workstation, "Total Quantity 30", 0, 180).reject, "over120");
  assert.equal(opportunityResult(desktop, "Total Quantity 30", 0, 180).reject, "over120");
  assert.equal(opportunityResult(printer, "No units listed").reject, "quantity_unread");
});

test("removes a Printer bid only when its Printer Technology is just Inkjet", () => {
  const printer = "A4 and Legal Size Multifunction Printer (MFP) (Q2)";
  const desktop = "High End Desktop Computer (Q2)";
  assert.equal(opportunityResult(printer, "Total Quantity 3 Printer Technology Inkjet Print Speed 20").reject, "inkjet");
  assert.equal(opportunityResult(printer, "Total Quantity 3 Printer Technology Ink Jet").reject, "inkjet");
  assert.equal(opportunityResult(printer, "Total Quantity 3 Printer Technology Electrophotography/Xerography (Laser/LED)").eligible, true);
  assert.equal(opportunityResult(printer, "Total Quantity 3 Printer Technology Inkjet, Electrophotography/Xerography (Laser/LED)").eligible, true);
  assert.equal(opportunityResult(printer, "Total Quantity 3").eligible, true);
  assert.equal(opportunityResult(desktop, "Total Quantity 30 Printer Technology Inkjet").eligible, true);
});

test("rejects a bunch bid even when every category is approved", () => {
  const result = opportunityResult(
    "All in One PC (V2) (Q2), Entry and Mid Level Desktop Computer (Q2), "
      + "A4 and Legal Size Multifunction Printer (MFP) (Q2)",
  );
  assert.equal(result.reject, "bunch");
});

test("never receives a bid below five units or with an unreadable quantity", () => {
  const category = "High End Desktop Computer (Q2)";
  assert.equal(opportunityResult(category, "Total Quantity 4").reject, "quantity");
  assert.equal(opportunityResult(category, "Total Quantity 5").eligible, true);
  assert.equal(opportunityResult(category, "No units listed").reject, "quantity_unread");
  assert.equal(opportunityResult(category, "No units listed", 3).reject, "quantity");
  assert.equal(opportunityResult(category, "No units listed", 12).quantity, 12);
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

test("a page is old only when every bid on it was already read", () => {
  const { isKnownOpportunityPage } = knownBidHelpers();
  const known = { "GEM/2026/B/1": 1, "GEM/2026/B/2": 1 };
  assert.equal(isKnownOpportunityPage([{ bidNo: "GEM/2026/B/1" }, { bidNo: "GEM/2026/B/2" }], known), true);
  assert.equal(isKnownOpportunityPage([{ bidNo: "GEM/2026/B/1" }, { bidNo: "GEM/2026/B/3" }], known), false);
  assert.equal(isKnownOpportunityPage([], known), false);
});

test("completed runs add their bids to the known list and very old entries expire", () => {
  const { mergeKnownBids, OPPORTUNITY_KNOWN_BID_TTL_MS } = knownBidHelpers();
  const now = 10 * OPPORTUNITY_KNOWN_BID_TTL_MS;
  const merged = mergeKnownBids({ old: now - OPPORTUNITY_KNOWN_BID_TTL_MS - 1, kept: now - 1000 }, { fresh: now }, now);
  assert.deepEqual(Object.keys(merged).sort(), ["fresh", "kept"]);
});

test("accepts ongoing bids that started more than three days ago", () => {
  const dateStart = source.indexOf("function dateFrom");
  const parserStart = source.indexOf("const OPPORTUNITY_PRODUCTS");
  const parser = source.slice(parserStart, source.indexOf("function bidDetailUrl", parserStart));
  assert.ok(dateStart >= 0 && parserStart >= 0);
  assert.doesNotMatch(parser, /getDate\(\) - 3/);
});

test("opportunity scan stops after two pages of already-read bids and skips read bids", () => {
  const start = source.indexOf("async function scanOpportunityPages");
  const end = source.indexOf("async function waitForBidCards", start);
  const scan = source.slice(start, end);
  assert.match(scan, /const latestFirst = await applyOpportunityFilters\(\)/);
  assert.match(scan, /latestFirst && isKnownOpportunityPage\(cards, knownBids\)[\s\S]*knownPages >= OPPORTUNITY_KNOWN_PAGES_TO_STOP[\s\S]*break/);
  assert.ok(scan.indexOf("isKnownOpportunityPage(cards, knownBids)") < scan.indexOf("opportunityFromBidDetail(bidNo, card)"));
  assert.match(scan, /if \(knownBids\[bidNo\] \|\| runBids\[bidNo\]\) continue;/);
  // Only a completed scan may mark its bids as known.
  assert.ok(scan.indexOf("mergeKnownBids(knownBids, runBids)") < scan.indexOf('"complete"'));
  assert.ok(scan.indexOf("mergeKnownBids(knownBids, runBids)") < scan.indexOf("catch (error)"));
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

test("accepts current-year disqualifications without a monthly cutoff", () => {
  const reference = "new Date(2026, 8, 15, 13, 0, 0)";
  assert.equal(retentionResult("new Date(2026, 7, 15, 0, 0, 0).toISOString()", reference).result, true);
  assert.equal(retentionResult("new Date(2026, 7, 14, 23, 59, 59).toISOString()", reference).result, true);
  assert.equal(retentionResult("''", reference).result, false);
  assert.equal(retentionResult("new Date(2026, 8, 16, 0, 0, 0).toISOString()", reference).result, false);
});

test("excludes previous-year disqualifications", () => {
  assert.equal(retentionResult("new Date(2020, 0, 1).toISOString()", "new Date(2026, 8, 19)").result, false);
});

test("disqualified scan reports only dashboard-valid API saves", () => {
  const start = source.indexOf("async function scanAllPages");
  const end = source.indexOf("const OPPORTUNITY_PRODUCTS", start);
  const scan = source.slice(start, end);
  assert.match(scan, /if \(!isValidDisqualificationDate\(result\.disqualified_at\)\)/);
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

test("actual pagination uses robust and cross-root Next fallbacks", () => {
  const start = source.indexOf("function mainPaginationNextState");
  const end = source.indexOf("function paginationTotalPages", start);
  const pagination = source.slice(start, end);
  assert.match(pagination, /queryAllSearchableRoots/);
  assert.match(pagination, /paginationNextRobust\(\) \|\| paginationNext\(\) \|\| paginationNextLegacy\(\)/);
  const advanceStart = source.indexOf("async function advancePage(signature, page)");
  const advanceEnd = source.indexOf("const MAX_PAGINATION_RECOVERY_ATTEMPTS", advanceStart);
  assert.match(source.slice(advanceStart, advanceEnd), /renderDeadline[\s\S]*mainPaginationNextState\(\)/);
});

test("GeM generic server errors become recoverable page signals", () => {
  const start = source.indexOf("let lastGemRemoteActionAt");
  const end = source.indexOf("async function waitWhilePaused", start);
  assert.ok(start >= 0 && end > start, "GeM request guard helpers must remain discoverable");
  const context = {
    document: { body: { innerText: "Something went wrong, please try again after some time" } },
    searchableDocuments: () => [{ body: { innerText: "Something went wrong, please try again after some time" } }],
    stopRequested: false,
    Date,
  };
  vm.runInNewContext(
    `${source.slice(start, end)}; result = throwIfGemTransientError();`,
    context,
  );
  assert.match(context.result, /Something went wrong/i);
});

test("GeM generic error detection searches every accessible document root", () => {
  const start = source.indexOf("function gemTransientErrorMessage");
  const end = source.indexOf("function throwIfGemTransientError", start);
  assert.match(source.slice(start, end), /searchableDocuments\(\)/);
});

test("server-triggering GeM actions are rate limited before activation", () => {
  const historyStart = source.indexOf("async function historyFor");
  const historyEnd = source.indexOf("function bidResultControl", historyStart);
  const revealStart = source.indexOf("async function revealBidResult");
  const revealEnd = source.indexOf("async function extractPage", revealStart);
  const pageStart = source.indexOf("async function advancePage(signature, page)");
  const pageEnd = source.indexOf("const MAX_PAGINATION_RECOVERY_ATTEMPTS", pageStart);
  const historyCode = source.slice(historyStart, historyEnd);
  const revealCode = source.slice(revealStart, revealEnd);
  const pageCode = source.slice(pageStart, pageEnd);
  assert.ok(historyCode.indexOf("await waitForGemRemoteActionSlot()") < historyCode.indexOf("activateControl(control)"));
  assert.ok(revealCode.indexOf("await waitForGemRemoteActionSlot()") < revealCode.indexOf("activateControl(control)"));
  assert.ok(pageCode.indexOf("await waitForGemRemoteActionSlot(5000)") < pageCode.indexOf("activateControl(next)"));
  assert.match(pageCode, /replaceState[\s\S]*waitForGemRemoteActionSlot\(5000\)[\s\S]*location\.hash = targetHash/);
});

test("the shared GeM action gate backs off exponentially while GeM keeps rejecting and resets once it clears", () => {
  const start = source.indexOf("async function waitForGemRemoteActionSlot");
  const end = source.indexOf("async function waitWhilePaused", start);
  const fn = source.slice(start, end);
  assert.match(fn, /if \(gemTransientErrorMessage\(\)\) \{/);
  assert.match(fn, /gemBackoffMs \* 2/);
  assert.match(fn, /GEM_BACKOFF_MAX_MS/);
  assert.match(fn, /\} else \{\s*gemBackoffMs = 0;/);
});

test("control activation falls back to one native click when the MAIN-world bridge is absent", () => {
  const start = source.indexOf("function activateControl(control)");
  const end = source.indexOf("function describeControl", start);
  assert.ok(start >= 0 && end > start, "control activation helper must remain discoverable");
  const listeners = new Map();
  let nativeClicks = 0;
  const ownerDocument = {
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent: () => true,
  };
  const control = {
    ownerDocument,
    scrollIntoView: () => {},
    setAttribute: () => {},
    removeAttribute: () => {},
    click: () => { nativeClicks += 1; },
  };
  const context = { control, document: ownerDocument, CustomEvent: class { constructor(name, init) { this.type = name; this.detail = init.detail; } }, Date, Math };
  vm.runInNewContext(`${source.slice(start, end)}; activateControl(control);`, context);
  assert.equal(nativeClicks, 1);
});

test("acknowledged MAIN-world control activation never double-clicks natively", () => {
  const start = source.indexOf("function activateControl(control)");
  const end = source.indexOf("function describeControl", start);
  const listeners = new Map();
  let nativeClicks = 0;
  const ownerDocument = {
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent: (event) => {
      listeners.get("acxxel-gem-control-clicked")?.({ detail: { clickId: event.detail.clickId, clicked: true } });
      return true;
    },
  };
  const control = {
    ownerDocument,
    scrollIntoView: () => {},
    setAttribute: () => {},
    removeAttribute: () => {},
    click: () => { nativeClicks += 1; },
  };
  const context = { control, document: ownerDocument, CustomEvent: class { constructor(name, init) { this.type = name; this.detail = init.detail; } }, Date, Math };
  vm.runInNewContext(`${source.slice(start, end)}; activateControl(control);`, context);
  assert.equal(nativeClicks, 0);
});


test("closes GeM's multiplication-sign popup button without losing history", async () => {
  const start = source.indexOf("async function closeModal");
  const end = source.indexOf("async function historyFor", start);
  const button = { innerText: "\u00d7", getAttribute: () => null };
  let clicked = false;
  const modal = { querySelectorAll: () => [button] };
  const context = {
    modal, text: (node) => node.innerText, visible: () => true,
    activateControl: (node) => { assert.equal(node, button); clicked = true; },
    document: { contains: () => false }, sleep: async () => {},
  };
  vm.runInNewContext(`${source.slice(start, end)}; result = closeModal(modal);`, context);
  assert.equal(await context.result, true);
  assert.equal(clicked, true);
});

test("reads September 10 evaluation history with wrapped time and empty reason", () => {
  const dateStart = source.indexOf("function dateFrom");
  const dateEnd = source.indexOf("function isValidDisqualificationDate", dateStart);
  const start = source.indexOf("function historyRows");
  const end = source.indexOf("async function waitForHistoryRows", start);
  const cells = ["2026-09-10\n10:46:47", "Disqualified", "", "Documents not appropriate"]
    .map((innerText) => ({ innerText }));
  const modal = { querySelectorAll: () => [{ querySelectorAll: () => cells }] };
  const context = {
    modal, text: (node) => node.innerText.replace(/\s+/g, " ").trim(), visible: () => true,
  };
  vm.runInNewContext(`${source.slice(dateStart, dateEnd)}; ${source.slice(start, end)}; rows = historyRows(modal);`, context);
  assert.equal(context.rows.length, 1);
  assert.equal(context.rows[0].status, "Disqualified");
  assert.equal(context.rows[0].reason, "");
  assert.equal(context.rows[0].comment, "Documents not appropriate");
  const date = new Date(context.rows[0].date_time);
  assert.deepEqual([date.getFullYear(), date.getMonth()+1, date.getDate(), date.getHours(), date.getMinutes()], [2026,9,10,10,46]);
  assert.equal(retentionResult('new Date(2026,8,10,10,46,47)', 'new Date(2026,8,19,11)').result, true);
});


async function runDisqualifiedScenario({ unread = 0, saveFails = 0, pages = 1, continuePages = false } = {}) {
  const start = source.indexOf('async function scanAllPages(resume = null)');
  const end = source.indexOf('\n  const OPPORTUNITY_PRODUCTS', start);
  assert.ok(end > start);
  let reads = 0, saves = 0, advances = 0;
  let currentPage = 1;
  const events = [];
  const card = { bidNo: 'GEM/2026/B/7782662' };
  const nextCard = { bidNo: 'GEM/2026/B/9999999' };
  const context = {
    syncing: false, activeScanType: '', stopRequested: false, pauseRequested: false,
    progress: async (status, message, extra) => events.push({ status, message, ...extra }),
    applyCompleteBidListFilter: async () => {}, sleep: async () => {},
    sessionStorage: { setItem: () => {}, removeItem: () => {}, getItem: () => null },
    stopIfRequested: () => {}, waitWhilePaused: async () => {},
    waitForBidCards: async () => [currentPage === 1 ? card : nextCard], paginationTotalPages: () => pages,
    disqualifiedSaveSummary: () => 'summary', isValidDisqualificationDate: () => true,
    extractPage: async (callback, processed) => {
      const activeCard = currentPage === 1 ? card : nextCard;
      if (processed.has(activeCard.bidNo)) return;
      reads++;
      await callback({ bid_no: activeCard.bidNo, evaluation_read: currentPage > 1 || reads > unread,
        is_disqualified: true, disqualified_at: '2026-09-10T10:46:47Z' }, 1, 1);
    },
    runtimeMessage: async () => {
      saves++;
      return saves <= saveFails ? { saved: 0, rejections: [{ reason: 'temporary failure' }] }
        : { saved: 1, created: 0, updated: 1, frontendVisible: true };
    },
    advancePageWithRecovery: async () => {
      advances++;
      if (continuePages && currentPage < pages) { currentPage++; return { advanced: true }; }
      return { advanced: false, reason: 'end' };
    },
  };
  vm.runInNewContext(`${source.slice(start, end)}; task = scanAllPages();`, context);
  let error;
  try { await context.task; } catch (caught) { error = caught; }
  return { events, reads, saves, advances, error };
}

test('retains unread technical status for a later pass without hammering GeM', async () => {
  const run = await runDisqualifiedScenario({ unread: 1 });
  assert.ok(run.error);
  assert.equal(run.reads, 1);
  assert.equal(run.saves, 0);
  assert.equal(run.events.at(-1).checked, 1);
  assert.equal(run.events.at(-1).saved, 0);
  assert.equal(run.events.at(-1).status, 'failed');
  assert.equal(run.events.at(-1).pending.length, 1);
});

test('retries unconfirmed API saves and only counts the confirmed save', async () => {
  const run = await runDisqualifiedScenario({ saveFails: 2 });
  assert.equal(run.saves, 3);
  assert.equal(run.events.at(-1).saved, 1);
  assert.equal(run.events.at(-1).checked, 1);
});

test('persistent unread status stays pending while remaining pages are scanned', async () => {
  const run = await runDisqualifiedScenario({ unread: 99 });
  assert.equal(run.reads, 1);
  assert.equal(run.advances, 1);
  assert.ok(run.error);
  assert.equal(run.events.at(-1).status, 'failed');
  assert.equal(run.events.at(-1).pending[0].bidNo, 'GEM/2026/B/7782662');
  assert.equal(run.events.some((event) => event.status === 'complete'), false);
});

test('missing pagination reloads the same tab with resumable disqualified progress', () => {
  const start = source.indexOf('async function scanAllPages(resume = null)');
  const end = source.indexOf('\n  const OPPORTUNITY_PRODUCTS', start);
  const scan = source.slice(start, end);
  assert.match(scan, /acxxelDisqualifiedResume/);
  assert.match(scan, /page:\s*resumePage/);
  assert.match(scan, /pending:\s*\[\.\.\.pending\.values\(\)\]/);
  assert.match(scan, /reloadAndResumeDisqualifiedScan/);
  assert.match(source, /sessionStorage\.setItem\("acxxelDisqualifiedResume"[\s\S]*location\.reload\(\)/);
  assert.match(source, /scanAllPages\(disqualifiedResume\)/);
});

test('temporary GeM server banners retry the current page without ending the full scan', () => {
  const start = source.indexOf('async function scanAllPages(resume = null)');
  const end = source.indexOf('\n  const OPPORTUNITY_PRODUCTS', start);
  const scan = source.slice(start, end);
  assert.match(scan, /reason === "gem-server-error"/);
  assert.match(scan, /resumePage = retryCurrentPage \? page : page \+ 1/);
  assert.match(scan, /serverRecoveryAttempts < MAX_SERVER_RECOVERY_ATTEMPTS/);
  assert.match(scan, /seenBidNos: \[\.\.\.seen\]/);
});

test('disqualified recovery reapplies the three exact GeM filters from the supplied screenshot', () => {
  const start = source.indexOf('async function applyCompleteBidListFilter');
  const end = source.indexOf('async function autoStartAfterLogin', start);
  const filter = source.slice(start, end);
  assert.match(filter, /Bids\/RAs Already Submitted\/Participated/);
  assert.match(filter, /All Bid\/RAs/);
  assert.match(filter, /Technical Evaluated/);
  assert.match(filter, /Ongoing Bids Available For Participation[\s\S]*false/);
  assert.match(filter, /Financial Evaluated[\s\S]*false/);
  assert.match(filter, /Required GeM filter changed while loading results/);
});

test('a successful restored page resets the automatic GeM recovery budget', () => {
  const start = source.indexOf('async function scanAllPages(resume = null)');
  const end = source.indexOf('\n  const OPPORTUNITY_PRODUCTS', start);
  const scan = source.slice(start, end);
  assert.match(source, /const MAX_SERVER_RECOVERY_ATTEMPTS = 8/);
  assert.match(scan, /serverRecoveryAttempts = 0/);
  assert.match(scan, /did not render saved page[\s\S]*reloadAndResumeDisqualifiedScan/);
});

test('saved-page recovery fast-forwards with real pagination when GeM ignores the direct hash route', () => {
  const start = source.indexOf('async function scanAllPages(resume = null)');
  const end = source.indexOf('\n  const OPPORTUNITY_PRODUCTS', start);
  const scan = source.slice(start, end);
  assert.match(scan, /const jump = await jumpToSavedPage\(page, firstPageSignature/);
  assert.match(scan, /restored = await waitForPageChange\(jumpSignature, 20000\)/);
  assert.match(scan, /let cursorPage = jumpPage;/);
  assert.match(scan, /while \(cursorPage < page\)/);
  assert.match(scan, /advancePageWithRecovery\(cursorSignature, cursorPage\)/);
  assert.match(scan, /without rescanning earlier pages/);
});

test('intentional reload recovery has a distinct progress state', () => {
  const start = source.indexOf('async function reloadAndResumeDisqualifiedScan');
  const end = source.indexOf('const MAX_PAGINATION_RECOVERY_ATTEMPTS', start);
  assert.match(source.slice(start, end), /progress\("recovering"/);
});

test('manual Retry Sync passes its saved-page payload into scanAllPages', () => {
  assert.match(source, /runner\(message\.type === "START_GEM_BID_SYNC" \? message\.resume \|\| null : null\)/);
});

test('a transient GeM error while bid cards are still loading reloads and resumes instead of hard-failing', () => {
  const start = source.indexOf('async function scanAllPages(resume = null)');
  const end = source.indexOf('\n  const OPPORTUNITY_PRODUCTS', start);
  const scan = source.slice(start, end);
  // The empty-cards branch (both the initial page restore and the main scan
  // loop) must check gemTransientErrorMessage() and reload before falling
  // back to the unrecoverable "did not load" error.
  const emptyCardsBranches = [...scan.matchAll(/if \(!(?:firstPageSignature|cards\.length)\) \{[\s\S]*?\n( {8}| {10})\}/g)];
  assert.equal(emptyCardsBranches.length, 2);
  for (const [branch] of emptyCardsBranches) {
    assert.match(branch, /gemTransientErrorMessage\(\)/);
    assert.match(branch, /reloadAndResumeDisqualifiedScan/);
    assert.match(branch, /serverRecoveryAttempts \+ 1/);
  }
});

test('waitForBidCards gives up immediately on a transient GeM error instead of spinning to timeout', () => {
  const start = source.indexOf('async function waitForBidCards');
  const end = source.indexOf('\n  async function applyTechnicalEvaluatedFilter', start);
  const fn = source.slice(start, end);
  assert.match(fn, /if \(gemTransientErrorMessage\(\)\) return \[\];/);
});

test('a disabled Next button cannot complete a scan before known pages finish', async () => {
  const run = await runDisqualifiedScenario({ pages: 9 });
  assert.ok(run.error);
  assert.equal(run.events.at(-1).status, 'failed');
  assert.match(run.error.message, /at least 9 pages/);
});


test('recognizes explicit pending technical statuses without treating bid-level Evaluation as a result', () => {
  const start = source.indexOf('function visibleTechnicalStatus');
  const end = source.indexOf('async function revealBidResult', start);
  for (const [raw, expected] of [
    ['Technical Status: Not Evaluated', 'Not Evaluated'],
    ['Technical Status: Under Evaluation', 'Under Evaluation'],
    ['Technical Status: Pending', 'Pending'],
    ['Technical Status: Evaluated', 'Evaluated'],
    ['Status: Evaluation Bid/RA Status: Active', ''],
    ['Technical Status: Disqualified', 'Disqualified'],
  ]) {
    const context = { card: { querySelectorAll: () => [] }, text: () => raw, visible: () => true };
    vm.runInNewContext(`${source.slice(start, end)}; result = visibleTechnicalStatus(card);`, context);
    assert.equal(context.result, expected);
  }
});

test('treats an RA number as part of its original bid card instead of a separate bid', () => {
  const start = source.indexOf('const normalizeBidNo');
  const end = source.indexOf('const GEM_REMOTE_ACTION_INTERVAL_MS', start);
  assert.ok(start >= 0 && end > start, 'bid-number helpers must remain discoverable');
  const context = { BID_PATTERN: /GEM\s*\/\s*\d{4}\s*\/\s*[A-Z]+\s*\/\s*\d+/i };
  vm.runInNewContext(
    `${source.slice(start, end)}; result = originalBidNumbers(`
      + `'Bid No.: GEM/2026/B/7587381 RA NO: GEM/2026/R/742461');`,
    context,
  );
  assert.deepEqual([...context.result], ['GEM/2026/B/7587381']);
});

test('current card discovery ignores standalone RA numbers', () => {
  const start = source.indexOf('function currentCards');
  const end = source.indexOf('function bidPageDiagnostics', start);
  const currentCards = source.slice(start, end);
  assert.match(currentCards, /if \(!isOriginalBidNo\(bidNo\)\)/);
  assert.match(currentCards, /originalBidNumbers\(text\(element\)\)/);
});

test('disqualified tracking only trusts the technical status printed on each list card', () => {
  const start = source.indexOf('async function extractPage');
  const end = source.indexOf('function enabled', start);
  const extract = source.slice(start, end);
  assert.match(extract, /const listedStatus = visibleTechnicalStatus\(currentCard\)/);
  assert.doesNotMatch(extract, /await revealBidResult/);
  assert.match(extract, /const isDisqualified = evaluation\.read && \/disqualified\/i\.test\(evaluation\.status\)/);
});


test('unread first-page bid does not prevent later-page saves and remains in final pending list', async () => {
  const run = await runDisqualifiedScenario({ unread: 99, pages: 2, continuePages: true });
  assert.equal(run.saves, 1);
  assert.equal(run.events.at(-1).saved, 1);
  assert.equal(run.events.at(-1).checked, 2);
  assert.equal(run.events.at(-1).status, 'failed');
  assert.equal(run.events.at(-1).pending.length, 1);
  assert.equal(run.events.at(-1).pending[0].bidNo, 'GEM/2026/B/7782662');
  assert.equal(run.events.at(-1).pending[0].page, 1);
});

test("completed opportunity scans re-check saved bids for a later corrigendum", () => {
  const start = source.indexOf("async function recheckSavedCorrigenda");
  const end = source.indexOf("async function selectLatestBidSort", start);
  const recheck = source.slice(start, end);
  assert.match(recheck, /GET_CORRIGENDUM_PENDING/);
  assert.match(recheck, /filter\(\(bidNo\) => !skipBids\[bidNo\]\)/);
  assert.match(recheck, /if \(result\.has_corrigendum\) \{[\s\S]*MARK_GEM_CORRIGENDUM/);
  // The search box must be emptied even when the re-check stops midway.
  assert.match(recheck, /finally \{[\s\S]*submitBidSearch\(current, ""\)/);

  const scanStart = source.indexOf("async function scanOpportunityPages");
  const scan = source.slice(scanStart, source.indexOf("async function waitForBidCards", scanStart));
  assert.ok(scan.indexOf("mergeKnownBids(knownBids, runBids)") < scan.indexOf("recheckSavedCorrigenda(runBids"));
  assert.ok(scan.indexOf("recheckSavedCorrigenda(runBids") < scan.indexOf('"complete"'));
});

test("an unreadable GeM bid PDF skips only that bid instead of failing the scan", () => {
  const start = source.indexOf("async function opportunityFromBidDetail");
  const detail = source.slice(start, source.indexOf("async function selectLatestBidSort", start));
  const skip = detail.match(/if \((\/.*\/i)\.test\(message\)\) \{\s*return \{ reject: "detail" \}/);
  assert.ok(skip, "detail skip rule must remain discoverable");
  const pattern = eval(skip[1]);
  for (const message of [
    "GeM bid document could not be read.",
    "GeM bid document is not a PDF.",
    "GeM bid document returned HTTP 502.",
    "GeM bid document is larger than 15 MB.",
  ]) assert.ok(pattern.test(message), message);
  // An expired session must still stop the scan with a clear message.
  assert.ok(detail.indexOf("HTTP\s+(?:401|403)") < detail.indexOf("could not be read"));
});


test('server banner exits local retries immediately so the caller can reload', async () => {
  const start = source.indexOf('async function advancePageWithRecovery');
  const end = source.indexOf('async function scanAllPages', start);
  let requests = 0, waits = 0, retries = 0;
  const context = {
    MAX_PAGINATION_RECOVERY_ATTEMPTS: 4, stopIfRequested() {},
    advancePage: async () => { requests++; return { advanced: false, reason: 'gem-server-error' }; },
    waitForPageChange: async () => { waits++; return false; },
    sleep: async () => {}, onRetry: async () => { retries++; },
  };
  vm.runInNewContext(`${source.slice(start, end)}; task = advancePageWithRecovery('old', 6, onRetry);`, context);
  await assert.rejects(context.task, (error) => error.reason === 'gem-server-error');
  assert.equal(requests, 1);
  assert.equal(waits, 0);
  assert.equal(retries, 0);
});

test('a late pagination response succeeds without clicking Next again', async () => {
  const start = source.indexOf('async function advancePageWithRecovery');
  const end = source.indexOf('async function scanAllPages', start);
  let requests = 0;
  const context = {
    MAX_PAGINATION_RECOVERY_ATTEMPTS: 4, stopIfRequested() {},
    advancePage: async () => { requests++; return { advanced: false, reason: 'stuck' }; },
    waitForPageChange: async () => true, sleep: async () => {},
  };
  vm.runInNewContext(`${source.slice(start, end)}; task = advancePageWithRecovery('old', 6);`, context);
  assert.equal((await context.task).advanced, true);
  assert.equal(requests, 1);
});

test('saved-page recovery jumps via numbered page links instead of Next-by-Next', async () => {
  const start = source.indexOf('async function jumpToSavedPage');
  const end = source.indexOf('async function waitForPageChange', start);
  assert.ok(start >= 0 && end > start);
  // Simulated GeM pager: 40 pages, shows current +/-2 plus the edge pages.
  let current = 1;
  const clicks = [];
  const context = {
    activePageNumber: () => current,
    requestBridgePageSelect: () => false,
    paginationPageLinks: () => {
      const pages = new Set([1, 2, 39, 40]);
      for (let p = current - 2; p <= current + 2; p += 1) if (p >= 1 && p <= 40) pages.add(p);
      pages.delete(current);
      return [...pages].map((page) => ({ page, node: { page } }));
    },
    waitForGemRemoteActionSlot: async () => {},
    activateControl: (node) => { clicks.push(node.page); current = node.page; },
    waitForPageChange: async () => true,
    waitForBidCards: async () => [{ bidNo: `p${current}` }],
    stopIfRequested: () => {},
    gemTransientErrorMessage: () => '',
  };
  vm.runInNewContext(`${source.slice(start, end)}; run = (page) => jumpToSavedPage(page, 'p1', null);`, context);
  const result = await context.run(6);
  assert.equal(result.restored, true);
  assert.equal(result.current, 6);
  assert.deepEqual(clicks, [3, 5, 6]);
  current = 1; clicks.length = 0;
  const far = await context.run(38);
  assert.equal(far.restored, true);
  assert.deepEqual(clicks, [39, 38]);
});
