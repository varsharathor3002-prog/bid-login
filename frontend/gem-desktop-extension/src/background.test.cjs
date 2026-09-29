const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "background.js"), "utf8");

function reconcileState(state, scanType, hasLiveRunner, now) {
  const start = source.indexOf("const ACTIVE_SYNC_STATUSES");
  const end = source.indexOf("async function reconcileInterruptedSyncStates", start);
  assert.ok(start >= 0 && end > start, "stale scanner helpers must remain discoverable");
  const context = {
    state,
    scanType,
    hasLiveRunner,
    now,
    chrome: { runtime: { getManifest: () => ({ version: "test" }) } },
  };
  vm.runInNewContext(
    `${source.slice(start, end)}; result = interruptedSyncState(state, scanType, hasLiveRunner, now);`,
    context,
  );
  return context.result;
}

test("a refreshed GeM page turns a stale running scan into Retry Sync state", () => {
  const state = { status: "running", page: 19, checked: 95, saved: 14, pending: [{ bidNo: "GEM/2026/B/1" }], updatedAt: 1_000 };
  const result = reconcileState(state, "disqualified", false, 10_000);
  assert.equal(result.status, "failed");
  assert.equal(result.page, 19);
  assert.equal(result.saved, 14);
  assert.equal(result.pending.length, 1);
  assert.match(result.message, /interrupted when the GeM page refreshed or closed/);
  assert.match(result.message, /click Retry Sync to continue from the saved page/);
});

test("a live scanner or startup grace period is never marked interrupted", () => {
  const running = { status: "running", updatedAt: 1_000 };
  assert.equal(reconcileState(running, "disqualified", true, 50_000), running);
  const starting = { status: "starting", updatedAt: 10_000 };
  assert.equal(reconcileState(starting, "disqualified", false, 20_000), starting);
  const recovering = { status: "recovering", page: 13, updatedAt: 10_000 };
  assert.equal(reconcileState(recovering, "disqualified", false, 65_000), recovering);
});

test("an abandoned recovery is eventually reported instead of staying active forever", () => {
  const recovering = { status: "recovering", page: 13, updatedAt: 10_000 };
  const result = reconcileState(recovering, "disqualified", false, 75_000);
  assert.equal(result.status, "failed");
  assert.equal(result.page, 13);
});

test("Retry Sync carries the saved failed page and counters into the content scanner", () => {
  assert.match(source, /const retryState = !opportunityScan && message\.resume/);
  assert.match(source, /page: Number\(retryState\.page\)/);
  assert.match(source, /chrome\.tabs\.sendMessage\(tab\.id, \{ type: message\.type, resume \}\)/);
  assert.match(source, /Scanner is restoring saved page/);
});
