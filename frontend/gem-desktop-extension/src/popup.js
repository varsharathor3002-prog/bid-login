const state = document.getElementById("state");
const message = document.getElementById("message");
const syncButton = document.getElementById("sync-bids");
const pauseSyncButton = document.getElementById("pause-sync");
const stopSyncButton = document.getElementById("stop-sync");
const retrySyncButton = document.getElementById("retry-sync");
const syncState = document.getElementById("sync-state");
const copySyncStatus = document.getElementById("copy-sync-status");
const opportunityButton = document.getElementById("sync-opportunities");
const pauseOpportunityButton = document.getElementById("pause-opportunities");
const stopOpportunityButton = document.getElementById("stop-opportunities");
const copyOpportunityStatus = document.getElementById("copy-opportunity-status");
const opportunityState = document.getElementById("opportunity-state");
document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;

function showSyncState(sync) {
  syncState.className = `sync-state ${sync?.status || ""}`;
  if (!sync) {
    syncState.textContent = "Not synced yet.";
  } else {
    const details = [];
    if (sync.page) details.push(`Page ${sync.page}`);
    if (sync.status !== "idle" && Number.isFinite(sync.checked)) details.push(`${sync.checked} checked`);
    if (sync.status !== "idle" && Number.isFinite(sync.saved)) details.push(`${sync.saved} saved`);
    const updated = sync.updatedAt ? new Date(sync.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    syncState.textContent = `${sync.message || sync.status}${details.length ? ` (${details.join(" · ")})` : ""}${updated ? ` · Updated ${updated}` : ""}`;
  }
  const active = ["running", "starting", "paused"].includes(sync?.status);
  const paused = sync?.status === "paused";
  const retryable = ["failed", "stopped"].includes(sync?.status);

  syncButton.disabled = active;
  syncButton.textContent = paused
    ? "Sync paused..."
    : syncButton.disabled ? "Scan running..." : "Scan Disqualified Bid";

  pauseSyncButton.hidden = false;
  pauseSyncButton.disabled = !active || sync?.status === "starting";
  pauseSyncButton.textContent = paused ? "Resume Sync" : "Pause Sync";

  stopSyncButton.hidden = false;
  stopSyncButton.disabled = !active;

  retrySyncButton.hidden = !retryable;
  retrySyncButton.disabled = false;
}

function showOpportunityState(sync) {
  opportunityState.className = `sync-state ${sync?.status || ""}`;
  if (!sync) {
    opportunityState.textContent = "Not scanned yet.";
  } else {
    const details = [];
    if (sync.page) details.push(`Page ${sync.page}`);
    if (sync.status !== "idle" && Number.isFinite(sync.checked)) details.push(`${sync.checked} checked`);
    if (sync.status !== "idle" && Number.isFinite(sync.saved)) details.push(`${sync.saved} saved`);
    const updated = sync.updatedAt ? new Date(sync.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    opportunityState.textContent = `${sync.message || sync.status}${details.length ? ` (${details.join(" · ")})` : ""}${updated ? ` · Updated ${updated}` : ""}`;
  }
  const active = ["running", "starting", "paused"].includes(sync?.status);
  const paused = sync?.status === "paused";
  opportunityButton.disabled = active;
  opportunityButton.textContent = paused
    ? "Scan paused..."
    : active ? "Scan running..." : "Scan Bid To Be Participated";
  pauseOpportunityButton.hidden = false;
  pauseOpportunityButton.disabled = false;
  pauseOpportunityButton.disabled = !active || sync?.status === "starting";
  pauseOpportunityButton.textContent = paused ? "Resume Scan" : "Pause Scan";
  stopOpportunityButton.hidden = false;
  stopOpportunityButton.disabled = !active;
}

function refreshSyncState() {
  chrome.runtime.sendMessage({ type: "GET_GEM_BID_SYNC_STATE" }, (response) => {
    if (!chrome.runtime.lastError && response?.ok) {
      showSyncState(response.gemBidSync);
      showOpportunityState(response.gemOpportunitySync);
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

stopOpportunityButton.addEventListener("click", () => {
  stopOpportunityButton.disabled = true;
  stopOpportunityButton.textContent = "Stopping...";
  chrome.runtime.sendMessage({ type: "STOP_GEM_OPPORTUNITY_SYNC" }, (response) => {
    stopOpportunityButton.textContent = "Stop Scan";
    if (chrome.runtime.lastError || !response?.ok) {
      stopOpportunityButton.disabled = false;
      opportunityState.className = "sync-state failed";
      opportunityState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to stop scan.";
      return;
    }
    window.setTimeout(refreshSyncState, 200);
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

stopSyncButton.addEventListener("click", () => {
  stopSyncButton.disabled = true;
  stopSyncButton.textContent = "Stopping...";
  chrome.runtime.sendMessage({ type: "STOP_GEM_BID_SYNC" }, (response) => {
    stopSyncButton.textContent = "Stop Sync";
    if (chrome.runtime.lastError || !response?.ok) {
      stopSyncButton.disabled = false;
      syncState.className = "sync-state failed";
      syncState.textContent = chrome.runtime.lastError?.message || response?.error || "Unable to stop sync.";
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
  chrome.runtime.sendMessage({ type: "START_GEM_BID_SYNC" }, (response) => {
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
  await navigator.clipboard.writeText(syncState.textContent || "");
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
    state.textContent = "Disconnected";
    message.textContent = result?.error || "Open Acxxel and log in again.";
    return;
  }
  state.textContent = result.connected ? "Connected" : "Disconnected";
  showSyncState(result.gemBidSync);
  showOpportunityState(result.gemOpportunitySync);
  if (!result.connected) {
    message.textContent = "Open the Acxxel app and connect the extension.";
    return;
  }
});
