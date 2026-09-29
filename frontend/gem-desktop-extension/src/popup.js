const state = document.getElementById("state");
const message = document.getElementById("message");
const syncButton = document.getElementById("sync-bids");
const pauseSyncButton = document.getElementById("pause-sync");
const retrySyncButton = document.getElementById("retry-sync");
const syncState = document.getElementById("sync-state");
const copySyncStatus = document.getElementById("copy-sync-status");
const opportunityButton = document.getElementById("sync-opportunities");
const pauseOpportunityButton = document.getElementById("pause-opportunities");
const copyOpportunityStatus = document.getElementById("copy-opportunity-status");
const opportunityState = document.getElementById("opportunity-state");
const TERMINAL_STATUS_TTL_MS = 15_000;
const TERMINAL_STATUSES = new Set(["failed", "stopped", "authentication_required"]);
const ACTIVE_SCAN_STATUSES = new Set(["running", "starting", "paused", "recovering"]);
const clearingStateKeys = new Set();
let acxxelConnected = false;
let lastSyncState = null;
document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;

function visibleSyncState(sync, storageKey) {
  const updatedAt = Number(sync?.updatedAt || 0);
  // Keep incomplete disqualified scans and their bid-level reasons visible.
  if (storageKey === "gemBidSync") return sync;
  const expired = TERMINAL_STATUSES.has(sync?.status)
    && updatedAt > 0
    && Date.now() - updatedAt >= TERMINAL_STATUS_TTL_MS;
  if (!expired) return sync;
  if (!clearingStateKeys.has(storageKey)) {
    clearingStateKeys.add(storageKey);
    chrome.storage.local.remove(storageKey, () => clearingStateKeys.delete(storageKey));
  }
  return null;
}

function showSyncState(sync) {
  sync = visibleSyncState(sync, "gemBidSync");
  lastSyncState = sync;
  syncState.className = `sync-state ${sync?.status || ""}`;
  if (!acxxelConnected) {
    syncState.className = "sync-state authentication_required";
    syncState.textContent = "Acxxel session is not connected. Open any logged-in Acxxel page and refresh it once.";
  } else if (!sync) {
    syncState.textContent = "Ready to scan. Refresh the GeM page if required.";
  } else {
    const details = [];
    if (sync.page) details.push(`Page ${sync.page}`);
    if (sync.pending?.length) details.push(`${sync.pending.length} pending retry`);
    if (sync.status !== "idle" && Number.isFinite(sync.checked)) details.push(`${sync.checked} checked`);
    if (sync.status !== "idle" && Number.isFinite(sync.saved)) details.push(`${sync.saved} saved`);
    if (sync.status !== "idle" && Number.isFinite(sync.rejected) && sync.rejected > 0) details.push(`${sync.rejected} not saved`);
    const updated = sync.updatedAt ? new Date(sync.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    syncState.textContent = `${sync.message || sync.status}${details.length ? ` (${details.join(" · ")})` : ""}${updated ? ` · Updated ${updated}` : ""}`;
  }
  const active = ACTIVE_SCAN_STATUSES.has(sync?.status);
  const paused = sync?.status === "paused";
  const retryable = ["failed", "stopped"].includes(sync?.status);

  syncButton.disabled = !acxxelConnected || active;
  syncButton.textContent = paused
    ? "Sync paused..."
    : sync?.status === "recovering" ? "Recovering scan..."
      : active ? "Scan running..." : "Scan Disqualified Bid";

  pauseSyncButton.hidden = false;
  pauseSyncButton.disabled = !active || ["starting", "recovering"].includes(sync?.status);
  pauseSyncButton.textContent = paused ? "Resume Sync" : "Pause Sync";

  retrySyncButton.hidden = !retryable;
  retrySyncButton.disabled = false;
}

function showOpportunityState(sync) {
  sync = visibleSyncState(sync, "gemOpportunitySync");
  opportunityState.className = `sync-state ${sync?.status || ""}`;
  if (!acxxelConnected) {
    opportunityState.className = "sync-state authentication_required";
    opportunityState.textContent = "Acxxel session is not connected. Open any logged-in Acxxel page and refresh it once.";
  } else if (!sync) {
    opportunityState.textContent = "Ready to scan. Refresh the GeM page if required.";
  } else {
    const details = [];
    if (sync.page) details.push(`Page ${sync.page}`);
    if (sync.status !== "idle" && Number.isFinite(sync.checked)) details.push(`${sync.checked} checked`);
    if (sync.status !== "idle" && Number.isFinite(sync.saved)) details.push(`${sync.saved} saved`);
    const updated = sync.updatedAt ? new Date(sync.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    opportunityState.textContent = `${sync.message || sync.status}${details.length ? ` (${details.join(" · ")})` : ""}${updated ? ` · Updated ${updated}` : ""}`;
  }
  const active = ACTIVE_SCAN_STATUSES.has(sync?.status);
  const paused = sync?.status === "paused";
  opportunityButton.disabled = !acxxelConnected || active;
  opportunityButton.textContent = paused
    ? "Scan paused..."
    : sync?.status === "recovering" ? "Recovering scan..."
      : active ? "Scan running..." : "Scan Bid To Be Participated";
  pauseOpportunityButton.hidden = false;
  pauseOpportunityButton.disabled = !active || ["starting", "recovering"].includes(sync?.status);
  pauseOpportunityButton.textContent = paused ? "Resume Scan" : "Pause Scan";
}

function preventConcurrentScans(bidSync, opportunitySync) {
  const bidActive = ACTIVE_SCAN_STATUSES.has(bidSync?.status);
  const opportunityActive = ACTIVE_SCAN_STATUSES.has(opportunitySync?.status);
  if (bidActive) opportunityButton.disabled = true;
  if (opportunityActive) {
    syncButton.disabled = true;
    retrySyncButton.disabled = true;
  }
}

function refreshSyncState() {
  chrome.runtime.sendMessage({ type: "GET_GEM_BID_SYNC_STATE" }, (response) => {
    if (!chrome.runtime.lastError && response?.ok) {
      acxxelConnected = Boolean(response.connected);
      state.textContent = acxxelConnected ? "Connected" : "Disconnected";
      message.textContent = acxxelConnected ? "" : "Open any logged-in Acxxel page and refresh it once.";
      showSyncState(response.gemBidSync);
      showOpportunityState(response.gemOpportunitySync);
      preventConcurrentScans(response.gemBidSync, response.gemOpportunitySync);
    }
  });
}

syncButton.addEventListener("click", () => {
  syncButton.disabled = true;
  syncState.textContent = "Starting GeM bid sync...";
  chrome.runtime.sendMessage({ type: "START_GEM_BID_SYNC" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      syncState.className = "sync-state failed";
      syncState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to start sync.";
      syncButton.disabled = false;
      return;
    }
    syncState.className = "sync-state";
    syncState.textContent = "Sync started. You may close this popup.";
    window.setTimeout(refreshSyncState, 300);
  });
});

opportunityButton.addEventListener("click", () => {
  opportunityButton.disabled = true;
  opportunityState.textContent = "Starting Bid To Be Participated scan...";
  chrome.runtime.sendMessage({ type: "START_GEM_OPPORTUNITY_SYNC" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      opportunityState.className = "sync-state failed";
      opportunityState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to start Bid To Be Participated scan.";
      opportunityButton.disabled = false;
      return;
    }
    window.setTimeout(refreshSyncState, 300);
  });
});

pauseOpportunityButton.addEventListener("click", () => {
  const resuming = pauseOpportunityButton.textContent === "Resume Scan";
  pauseOpportunityButton.disabled = true;
  chrome.runtime.sendMessage({ type: resuming ? "RESUME_GEM_OPPORTUNITY_SYNC" : "PAUSE_GEM_OPPORTUNITY_SYNC" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      pauseOpportunityButton.disabled = false;
      opportunityState.className = "sync-state failed";
      opportunityState.textContent = chrome.runtime.lastError?.message || response?.error || `Unable to ${resuming ? "resume" : "pause"} scan.`;
      return;
    }
    window.setTimeout(refreshSyncState, 200);
  });
});

pauseSyncButton.addEventListener("click", () => {
  const resuming = pauseSyncButton.textContent === "Resume Sync";
  pauseSyncButton.disabled = true;
  pauseSyncButton.textContent = resuming ? "Resuming..." : "Pausing...";
  chrome.runtime.sendMessage({ type: resuming ? "RESUME_GEM_BID_SYNC" : "PAUSE_GEM_BID_SYNC" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      pauseSyncButton.disabled = false;
      pauseSyncButton.textContent = resuming ? "Resume Sync" : "Pause Sync";
      syncState.className = "sync-state failed";
      syncState.textContent = chrome.runtime.lastError?.message || response?.error
        || `Unable to ${resuming ? "resume" : "pause"} sync.`;
      return;
    }
    window.setTimeout(refreshSyncState, 200);
  });
});

retrySyncButton.addEventListener("click", () => {
  retrySyncButton.disabled = true;
  retrySyncButton.textContent = "Retrying...";
  syncState.textContent = "Retrying GeM bid sync...";
  chrome.runtime.sendMessage({ type: "START_GEM_BID_SYNC", resume: true }, (response) => {
    retrySyncButton.textContent = "Retry Sync";
    if (chrome.runtime.lastError || !response?.ok) {
      retrySyncButton.disabled = false;
      syncState.className = "sync-state failed";
      syncState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to retry sync.";
      return;
    }
    window.setTimeout(refreshSyncState, 300);
  });
});

window.setInterval(refreshSyncState, 1000);

copySyncStatus.addEventListener("click", async () => {
  const lines = [syncState.textContent || ""];
  const pending = lastSyncState?.pending;
  if (Array.isArray(pending) && pending.length) {
    lines.push("", `Pending bids (${pending.length}${pending.length > 25 ? ", first 25 shown" : ""}):`);
    for (const item of pending.slice(0, 25)) {
      lines.push(`- ${item.bidNo} (page ${item.page}): ${item.reason || "unknown reason"}`);
    }
  }
  await navigator.clipboard.writeText(lines.join("\n"));
  copySyncStatus.textContent = "Copied";
  window.setTimeout(() => { copySyncStatus.textContent = "Copy status"; }, 1200);
});

copyOpportunityStatus.addEventListener("click", async () => {
  await navigator.clipboard.writeText(opportunityState.textContent || "");
  copyOpportunityStatus.textContent = "Copied";
  window.setTimeout(() => { copyOpportunityStatus.textContent = "Copy status"; }, 1200);
});

chrome.runtime.sendMessage({ type: "GET_STATE" }, (result) => {
  if (!result?.ok) {
    acxxelConnected = false;
    state.textContent = "Disconnected";
    message.textContent = result?.error || "Open Acxxel and log in again.";
    showSyncState(null);
    showOpportunityState(null);
    return;
  }
  acxxelConnected = Boolean(result.connected);
  state.textContent = acxxelConnected ? "Connected" : "Disconnected";
  showSyncState(result.gemBidSync);
  showOpportunityState(result.gemOpportunitySync);
  preventConcurrentScans(result.gemBidSync, result.gemOpportunitySync);
  if (!acxxelConnected) {
    message.textContent = "Open any logged-in Acxxel page and refresh it once.";
    return;
  }
});
