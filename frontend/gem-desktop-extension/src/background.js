const DEFAULT_API = "http://127.0.0.1:8000/api";
const GEM_BID_LIST_URL = "https://bidplus.gem.gov.in/seller-bids";
const AUTO_SYNC_ALARM = "acxxel-gem-bid-sync";
const backgroundStarts = new Set();
const userInitiatedSyncTabs = new Set();

function missingTabError(error) {
  return /no tab with id|tab.*(?:closed|not found)|invalid tab id/i.test(String(error?.message || error || ""));
}

async function tabStillExists(tabId) {
  if (!tabId) return false;
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch (error) {
    if (missingTabError(error)) return false;
    throw error;
  }
}

async function autoSyncTabIds() {
  const stored = await chrome.storage.local.get("autoSyncTabIds");
  return Array.isArray(stored.autoSyncTabIds) ? stored.autoSyncTabIds : [];
}

async function launchBackgroundBidSync() {
  const saved = await settings();
  if (!saved.token) return false;
  const gemTabs = await chrome.tabs.query({ url: "https://bidplus.gem.gov.in/seller-bids*" });
  if (!gemTabs.length) return false;
  const trackedIds = await autoSyncTabIds();
  const liveTracked = trackedIds.filter((id) => gemTabs.some((tab) => tab.id === id));
  if (liveTracked.length) return true;
  // Never create a fresh bidplus tab automatically. GeM can keep authentication
  // scoped to another portal and redirect the new tab to login, causing a flash.
  // Existing user tabs are also never marked disposable or closed by this worker.
  return true;
}

async function closeBackgroundSyncTab(tabId) {
  if (!tabId) return;
  const trackedIds = await autoSyncTabIds();
  if (!trackedIds.includes(tabId)) return;
  await chrome.storage.local.set({
    autoSyncTabIds: trackedIds.filter((id) => id !== tabId),
  });
  backgroundStarts.delete(tabId);
  await chrome.tabs.remove(tabId).catch(() => {});
}

async function startBackgroundScanner(tabId) {
  if (!tabId || backgroundStarts.has(tabId)) return;
  backgroundStarts.add(tabId);
  try {
    if (!(await tabStillExists(tabId))) {
      await closeBackgroundSyncTab(tabId);
      await launchBackgroundBidSync();
      return;
    }
    await chrome.storage.local.set({
      gemBidSync: {
        status: "starting",
        message: "Opening GeM Bid List and applying Technical Evaluated filters in background...",
        page: 0,
        saved: 0,
        updatedAt: Date.now(),
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
    const sendStart = () => chrome.tabs.sendMessage(tabId, { type: "START_GEM_BID_SYNC" });
    let response;
    try {
      response = await sendStart();
    } catch (error) {
      if (!/receiving end does not exist|could not establish connection/i.test(error.message || "")) throw error;
      await chrome.scripting.executeScript({ target: { tabId }, files: ["src/gem-bid-sync.js"] });
      await new Promise((resolve) => setTimeout(resolve, 500));
      response = await sendStart();
    }
    if (!response?.ok) throw new Error(response?.error || "Background GeM scanner did not start.");
  } catch (error) {
    if (missingTabError(error)) {
      await closeBackgroundSyncTab(tabId);
      await chrome.storage.local.set({
        gemBidSync: {
          status: "starting",
          message: "The previous GeM sync tab closed. Opening a fresh tab to continue...",
          page: 0,
          saved: 0,
          updatedAt: Date.now(),
          extensionVersion: chrome.runtime.getManifest().version,
        },
      });
      await launchBackgroundBidSync();
      return;
    }
    await chrome.storage.local.set({
      gemBidSync: {
        status: "failed",
        message: error.message || "Background GeM scanner did not start.",
        page: 0,
        saved: 0,
        updatedAt: Date.now(),
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
    await closeBackgroundSyncTab(tabId);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  const version = chrome.runtime.getManifest().version;
  chrome.alarms.create(AUTO_SYNC_ALARM, { periodInMinutes: 30 });
  autoSyncTabIds().then(async () => {
    // Stored IDs may belong to normal user tabs after an older extension build.
    // Never close them during install/update; just forget the stale tracking data.
    await chrome.storage.local.remove("autoSyncTabIds");
    await launchBackgroundBidSync();
  }).catch(() => {});
  chrome.storage.local.set({
    gemBidSync: {
      status: "idle",
      message: `Extension v${version} loaded. Open the logged-in Seller Bid List to start sync.`,
      page: 0,
      saved: 0,
      updatedAt: Date.now(),
      extensionVersion: version,
    },
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(AUTO_SYNC_ALARM, { periodInMinutes: 30 });
  launchBackgroundBidSync().catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_SYNC_ALARM) launchBackgroundBidSync().catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // A GeM filter can perform a full navigation. The content scanner from the
  // previous document is then gone, so allow the completed document to start it again.
  if (changeInfo.status === "loading") backgroundStarts.delete(tabId);
  if (changeInfo.status !== "complete") return;
  if (userInitiatedSyncTabs.has(tabId)) {
    if (/^https:\/\/bidplus\.gem\.gov\.in\/seller-bids(?:[/?#]|$)/i.test(tab.url || "")) {
      userInitiatedSyncTabs.delete(tabId);
      setTimeout(() => startBackgroundScanner(tabId), 3000);
    }
    return;
  }
  autoSyncTabIds().then((trackedIds) => {
    if (!trackedIds.includes(tabId)) return;
    if (!/^https:\/\/bidplus\.gem\.gov\.in\/seller-bids(?:[/?#]|$)/i.test(tab.url || "")) {
      chrome.storage.local.set({
        gemBidSync: {
          status: "authentication_required",
          message: "GeM login is required before automatic bid sync can continue.",
          page: 0,
          saved: 0,
          updatedAt: Date.now(),
          extensionVersion: chrome.runtime.getManifest().version,
        },
      });
      closeBackgroundSyncTab(tabId);
      return;
    }
    setTimeout(() => startBackgroundScanner(tabId), 3000);
  }).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  backgroundStarts.delete(tabId);
  userInitiatedSyncTabs.delete(tabId);
  autoSyncTabIds().then((trackedIds) => {
    if (!trackedIds.includes(tabId)) return;
    return chrome.storage.local.set({
      autoSyncTabIds: trackedIds.filter((id) => id !== tabId),
    });
  }).catch(() => {});
});

async function settings() {
  return chrome.storage.local.get(["token", "apiBase"]);
}

async function clearActiveJobEverywhere() {
  await chrome.storage.local.remove("activeJobId");
  const gemTabs = await chrome.tabs.query({ url: "https://*.gem.gov.in/*" });
  await Promise.all(gemTabs.map((tab) => (
    chrome.tabs.sendMessage(tab.id, { type: "DEACTIVATE_JOB" }).catch(() => {})
  )));
}

async function api(path, options = {}) {
  const saved = await settings();
  if (!saved.token) throw new Error("Acxxel session expired. Log in to the Acxxel app again.");
  const response = await fetch(`${saved.apiBase || DEFAULT_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${saved.token}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    await chrome.storage.local.remove("token");
    await clearActiveJobEverywhere();
    throw new Error("Acxxel session expired. Log in to the Acxxel app again.");
  }
  if (
    response.status === 403
    && /assigned to another employee/i.test(String(data.error || ""))
  ) {
    await clearActiveJobEverywhere();
    throw new Error("Old employee job was cleared. Start this job again from the current analyser login.");
  }
  if (
    response.status === 403
    && /not authorized for this action/i.test(String(data.error || ""))
  ) {
    await chrome.storage.local.remove(["token", "activeJobId"]);
    throw new Error("Log in to Acxxel as Bid Analyser, then start GeM Upload again.");
  }
  if (!response.ok) throw new Error(data.error || `Acxxel API error ${response.status}`);
  return data;
}

async function startJob(jobId) {
  const job = await api(`/gem/extension/jobs/${jobId}/claim/`, {
    method: "POST",
    body: "{}",
  });
  await chrome.storage.local.set({ activeJobId: job.id });
  const existingGemTabs = await chrome.tabs.query({ url: "https://*.gem.gov.in/*" });
  const trackedIds = await autoSyncTabIds();
  const userGemTabs = existingGemTabs.filter((tab) => !trackedIds.includes(tab.id));
  const preferredTab = userGemTabs.find((tab) => tab.active) || userGemTabs[0];
  const gemTab = preferredTab
    ? await chrome.tabs.update(preferredTab.id, { active: true })
    : await chrome.tabs.create({
        url: "https://mkp.gem.gov.in/login",
        active: true,
      });
  chrome.tabs.sendMessage(gemTab.id, { type: "ACTIVATE_JOB", job }).catch(() => {});
  await api(`/gem/extension/jobs/${jobId}/report/`, {
    method: "POST",
    body: JSON.stringify({
      status: "ready_for_fill",
      progress: "GeM job activated. Log in and navigate to Add New Offering; approved fields will fill automatically.",
    }),
  });
  return { waitingForForm: true, tabId: gemTab.id };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "CONNECT_ACXXEL") {
      if (!message.token) throw new Error("Log in to Acxxel before connecting the extension.");
      const previous = await settings();
      if (previous.token && previous.token !== message.token) {
        await clearActiveJobEverywhere();
      }
      await chrome.storage.local.set({
        token: message.token,
        apiBase: message.apiBase || DEFAULT_API,
      });
      try {
        await api("/gem/extension/jobs/");
      } catch (error) {
        await chrome.storage.local.remove(["token", "activeJobId"]);
        throw error;
      }
      return { ok: true };
    }
    if (message.type === "GET_STATE") {
      const saved = await settings();
      const jobs = saved.token ? await api("/gem/extension/jobs/") : [];
      const sync = await chrome.storage.local.get("gemBidSync");
      return { ok: true, connected: Boolean(saved.token), jobs, gemBidSync: sync.gemBidSync || null };
    }
    if (message.type === "GET_GEM_BID_SYNC_STATE") {
      const sync = await chrome.storage.local.get("gemBidSync");
      return { ok: true, gemBidSync: sync.gemBidSync || null };
    }
    if (message.type === "GET_ACTIVE_JOB") {
      const saved = await chrome.storage.local.get("activeJobId");
      if (!saved.activeJobId) return { ok: true, job: null };
      const jobs = await api("/gem/extension/jobs/");
      const job = jobs.find((item) => item.id === saved.activeJobId) || null;
      if (!job || !["queued", "ready_for_fill", "filled"].includes(job.status)) {
        await chrome.storage.local.remove("activeJobId");
      }
      return { ok: true, job };
    }
    if (message.type === "CLEAR_ACTIVE_JOB") {
      await chrome.storage.local.remove("activeJobId");
      return { ok: true };
    }
    if (message.type === "START_JOB") return { ok: true, result: await startJob(message.jobId) };
    if (message.type === "GET_MRP_DOCUMENT") {
      return {
        ok: true,
        document: await api(`/gem/extension/jobs/${message.jobId}/mrp-document/`),
      };
    }
    if (message.type === "GET_BIS_DOCUMENT") {
      return {
        ok: true,
        document: await api(`/gem/extension/jobs/${message.jobId}/bis-document/`),
      };
    }
    if (message.type === "GET_PRODUCT_IMAGES") {
      return {
        ok: true,
        result: await api(`/gem/extension/jobs/${message.jobId}/product-images/`),
      };
    }
    if (message.type === "GEM_LOGIN_READY") {
      const saved = await settings();
      if (!saved.token) return { ok: false, error: "Acxxel is not connected." };
      const currentUrl = sender.tab?.url || "";
      if (!/^https:\/\/bidplus\.gem\.gov\.in\/seller-bids(?:[/?#]|$)/i.test(currentUrl)) {
        await chrome.storage.local.set({
          gemBidSync: {
            status: "authentication_required",
            message: "GeM login is active, but Seller Bid List must be opened from the GeM Bids menu.",
            page: 0,
            saved: 0,
            updatedAt: Date.now(),
            extensionVersion: chrome.runtime.getManifest().version,
          },
        });
        return { ok: true, sellerBidListRequired: true };
      }
      return { ok: true };
    }
    if (message.type === "REPORT_JOB") {
      return { ok: true, job: await api(`/gem/extension/jobs/${message.jobId}/report/`, {
        method: "POST",
        body: JSON.stringify(message.report),
      }) };
    }
    if (message.type === "START_GEM_BID_SYNC") {
      const saved = await settings();
      if (!saved.token) throw new Error("Open Acxxel and log in before syncing GeM bids.");
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const sellerTabs = await chrome.tabs.query({ url: "https://bidplus.gem.gov.in/seller-bids*" });
      const activeSellerTab = activeTabs.find((item) => (
        /^https:\/\/bidplus\.gem\.gov\.in\/seller-bids(?:[/?#]|$)/i.test(item.url || "")
      ));
      const probes = await Promise.all(sellerTabs.map(async (candidate) => {
        try {
          const result = await chrome.tabs.sendMessage(candidate.id, { type: "PROBE_GEM_BID_SYNC" });
          return { tab: candidate, cardCount: Number(result?.cardCount || 0), visible: Boolean(result?.visible) };
        } catch {
          return { tab: candidate, cardCount: -1, visible: false };
        }
      }));
      probes.sort((a, b) => (b.cardCount - a.cardCount) || (Number(b.visible) - Number(a.visible)));
      const activeProbe = probes.find((item) => item.tab.id === activeSellerTab?.id);
      const tab = activeProbe?.cardCount > 0 ? activeSellerTab : probes[0]?.tab || activeSellerTab || sellerTabs[0];
      if (!tab?.id) {
        throw new Error("Open Seller Bid List from the logged-in GeM Bids menu, then click Sync. Your current tab was not redirected.");
      }
      await chrome.storage.local.set({ gemBidSync: { status: "starting", message: "Starting GeM bid sync...", page: 0, saved: 0, updatedAt: Date.now() } });
      let response;
      try {
        const sendStart = () => Promise.race([
          chrome.tabs.sendMessage(tab.id, { type: "START_GEM_BID_SYNC" }),
          new Promise((_, reject) => setTimeout(
            () => reject(new Error("GeM bid scanner did not respond within 5 seconds.")),
            5000,
          )),
        ]);
        try {
          response = await sendStart();
        } catch (connectionError) {
          if (!/receiving end does not exist|could not establish connection/i.test(connectionError.message || "")) {
            throw connectionError;
          }
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["src/gem-bid-sync.js"],
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
          response = await sendStart();
        }
        if (!response?.ok) throw new Error(response?.error || "GeM bid scanner did not start.");
      } catch (error) {
        const failureMessage = error.message || "GeM bid scanner did not start.";
        await chrome.storage.local.set({
          gemBidSync: {
            status: "failed",
            message: failureMessage,
            page: 0,
            saved: 0,
            updatedAt: Date.now(),
            extensionVersion: chrome.runtime.getManifest().version,
          },
        });
        throw error;
      }
      await chrome.storage.local.set({
        gemBidSync: {
          status: "running",
          message: `Scanner started. ${response.cardCount || 0} bid card(s) found on the current GeM page.`,
          page: 0,
          saved: 0,
          updatedAt: Date.now(),
          extensionVersion: chrome.runtime.getManifest().version,
        },
      });
      return { ok: true, started: true };
    }
    if (message.type === "STOP_GEM_BID_SYNC") {
      const tabs = await chrome.tabs.query({ url: "https://bidplus.gem.gov.in/seller-bids*" });
      await Promise.all(tabs.map((tab) => (
        chrome.tabs.sendMessage(tab.id, { type: "STOP_GEM_BID_SYNC" }).catch(() => null)
      )));
      await chrome.storage.local.set({
        gemBidSync: {
          status: "stopped",
          message: "GeM bid sync stopped by user.",
          page: 0,
          saved: 0,
          updatedAt: Date.now(),
          extensionVersion: chrome.runtime.getManifest().version,
        },
      });
      return { ok: true, stopped: true };
    }
    if (message.type === "SAVE_GEM_BID_RESULTS") {
      const result = await api("/gem/bid-results/", {
        method: "POST",
        body: JSON.stringify({ results: message.results || [] }),
      });
      return { ok: true, saved: result.saved || 0 };
    }
    if (message.type === "GEM_BID_SYNC_PROGRESS") {
      const gemBidSync = {
        status: message.status || "running",
        message: message.message || "",
        page: message.page || 0,
        saved: message.saved || 0,
        updatedAt: Date.now(),
        extensionVersion: chrome.runtime.getManifest().version,
      };
      await chrome.storage.local.set({ gemBidSync });
      if (["complete", "failed"].includes(gemBidSync.status) && sender.tab?.id) {
        setTimeout(() => closeBackgroundSyncTab(sender.tab.id), 1200);
      }
      return { ok: true };
    }
    return { ok: false, error: "Unknown extension message." };
  })().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
