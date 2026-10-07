const DEFAULT_API = "http://127.0.0.1:8000/api";
const GEM_BID_LIST_URL = "https://bidplus.gem.gov.in/seller-bids";
const AUTO_SYNC_ALARM = "acxxel-gem-bid-sync";
const ACXXEL_APP_URLS = [
  "http://localhost:5173/*",
  "http://127.0.0.1:5173/*",
  "https://acxxelbidding.com/*",
  "https://www.acxxelbidding.com/*",
];
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
    gemOpportunitySync: {
      status: "idle",
      message: "Ready to scan Bid To Be Participated.",
      page: 0,
      checked: 0,
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

const ACTIVE_SYNC_STATUSES = new Set(["starting", "running", "paused", "recovering"]);

function interruptedSyncState(state, scanType, hasLiveRunner, now = Date.now()) {
  if (!state || !ACTIVE_SYNC_STATUSES.has(state.status) || hasLiveRunner) return state;
  const updatedAt = Number(state.updatedAt || 0);
  const graceMs = state.status === "recovering" ? 60_000 : state.status === "starting" ? 15_000 : 8_000;
  if (!updatedAt || now - updatedAt < graceMs) return state;
  const label = scanType === "opportunity" ? "Bid To Be Participated scan" : "GeM bid sync";
  return {
    ...state,
    status: "failed",
    message: `${label} was interrupted when the GeM page refreshed or closed. `
      + "Already saved bids are retained; click Retry Sync to continue from the saved page.",
    updatedAt: now,
    extensionVersion: chrome.runtime.getManifest().version,
  };
}

async function reconcileInterruptedSyncStates() {
  const stored = await chrome.storage.local.get(["gemBidSync", "gemOpportunitySync"]);
  const needsProbe = [stored.gemBidSync, stored.gemOpportunitySync]
    .some((state) => state && ACTIVE_SYNC_STATUSES.has(state.status));
  if (!needsProbe) return stored;

  const tabs = await chrome.tabs.query({ url: "https://bidplus.gem.gov.in/seller-bids*" });
  const probes = await Promise.all(tabs.map((tab) => (
    chrome.tabs.sendMessage(tab.id, { type: "PROBE_GEM_BID_SYNC" }).catch(() => null)
  )));
  const hasDisqualifiedRunner = probes.some((probe) => probe?.syncing && probe.scanType === "disqualified");
  const hasOpportunityRunner = probes.some((probe) => probe?.syncing && probe.scanType === "opportunity");
  const now = Date.now();
  const gemBidSync = interruptedSyncState(stored.gemBidSync, "disqualified", hasDisqualifiedRunner, now);
  const gemOpportunitySync = interruptedSyncState(stored.gemOpportunitySync, "opportunity", hasOpportunityRunner, now);
  const changes = {};
  if (gemBidSync !== stored.gemBidSync) changes.gemBidSync = gemBidSync;
  if (gemOpportunitySync !== stored.gemOpportunitySync) changes.gemOpportunitySync = gemOpportunitySync;
  if (Object.keys(changes).length) await chrome.storage.local.set(changes);
  return { gemBidSync, gemOpportunitySync };
}

async function recoverAcxxelSession() {
  const saved = await settings();
  if (saved.token) return true;
  const appTabs = await chrome.tabs.query({ url: ACXXEL_APP_URLS });
  for (const tab of appTabs) {
    if (!tab.id) continue;
    try {
      const injection = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: () => ({
          token: sessionStorage.getItem("token") || localStorage.getItem("token") || "",
        }),
      });
      const token = String(injection?.[0]?.result?.token || "").trim();
      if (!token) continue;
      const origin = new URL(tab.url || "").origin;
      const localApp = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|$)/i.test(origin);
      await chrome.storage.local.set({
        token,
        apiBase: localApp ? DEFAULT_API : `${origin}/api`,
      });
      return true;
    } catch {
      // Another Acxxel tab may still contain the active session.
    }
  }
  return false;
}

// Desktop, Workstation and Printer jobs share one queue; AIO and Toner jobs
// have their own (with their own job ids), so a job is always id + kind.
const JOB_APIS = {
  desktop: "/gem/extension/jobs",
  aio: "/gem/extension/aio-jobs",
  toner: "/gem/extension/toner-jobs",
};

function jobKind(product) {
  return JOB_APIS[product] ? product : "desktop";
}

async function clearActiveJobEverywhere() {
  await chrome.storage.local.remove(["activeJobId", "activeJobKind"]);
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
    throw new Error("This Acxxel action is not available. Refresh the logged-in Acxxel page and try again.");
  }
  if (!response.ok) throw new Error(data.error || `Acxxel API error ${response.status}`);
  return data;
}

const SELLER_BID_LIST_URL = "https://bidplus.gem.gov.in/seller-bids";
const SELLER_BID_LIST_PATTERN = /^https:\/\/bidplus\.gem\.gov\.in\/seller-bids(?:[/?#]|$)/i;

const GEM_LOGIN_URL_PATTERN = /\/(?:login|signin|sign-in)(?:[/?#]|$)|sso\.gem\.gov\.in/i;

// Runs in the logged-in GeM page: finds the Bids-menu link that leads to
// bidplus (the portal hands the session over only through its own link) and
// clicks it. Returns the chosen link, or null when none is on the page.
function clickGemBidListLink() {
  const label = (node) => String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
  const score = (node) => {
    const href = node.href || node.getAttribute("href") || "";
    const text = label(node);
    if (/logout|log-out|signout/i.test(`${href} ${text}`)) return 0;
    if (/bidplus\.gem\.gov\.in\/(?:seller-bids|auth\/autologin\/sbl)/i.test(href)) return 100;
    if (/bidplus\.gem\.gov\.in/i.test(href)) {
      return 50 + (/seller|participat|my\s+bids|bid\s+list|list\s+of\s+bids/i.test(text) ? 30 : 0)
        + (/\bbids?\b/i.test(text) ? 10 : 0);
    }
    if (/seller\s+bids?|participated\s+bids?|bid\s+list|list\s+of\s+bids/i.test(text) && text.length < 60) return 40;
    return 0;
  };
  const best = [...document.querySelectorAll("a, [role=menuitem]")]
    .map((node) => ({ node, value: score(node) }))
    .filter((item) => item.value > 0)
    .sort((x, y) => y.value - x.value)[0];
  if (!best) return null;
  const { node } = best;
  const href = node.getAttribute("href") || "";
  // GeM opens bidplus via window.open / a _blank form. Without a real user
  // click Chrome's popup blocker drops that, so keep it in this tab instead.
  const nativeOpen = window.open;
  window.open = (url, ...rest) => {
    if (url) { window.location.assign(url); return window; }
    return nativeOpen.call(window, url, ...rest);
  };
  const nativeSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function submitInSameTab() {
    this.target = "_self";
    return nativeSubmit.call(this);
  };
  document.querySelectorAll("form[target]").forEach((form) => { form.target = "_self"; });
  // "List of Bids" is javascript:ct.gem.launchBidsPage('<bidplus url>');
  // call GeM's own launcher so its session hand-off runs.
  const launch = href.match(/launchBidsPage\(\s*['"]([^'"]+)['"]\s*\)/);
  if (launch && typeof window.ct?.gem?.launchBidsPage === "function") {
    window.ct.gem.launchBidsPage(launch[1]);
  } else {
    if (node.matches("a[target]")) node.removeAttribute("target");
    node.click();
  }
  return { href: node.href || href, text: label(node).slice(0, 80) };
}

async function probeScanner(tabId) {
  const probe = await chrome.tabs.sendMessage(tabId, { type: "PROBE_GEM_BID_SYNC" }).catch(() => null);
  return Boolean(probe?.ok);
}

// Opens the Seller Bid List the same way the user does: through the logged-in
// GeM portal's own Bids link. Typing the bidplus URL directly lands on the
// login page because GeM keeps the session scoped to the portal until then.
async function openSellerBidList(activeTab, onWait = null) {
  const gemTabs = await chrome.tabs.query({ url: "https://*.gem.gov.in/*" });
  const loggedIn = (tab) => tab?.id && /^https:\/\/[^/]*gem\.gov\.in\//i.test(tab.url || "")
    && !GEM_LOGIN_URL_PATTERN.test(tab.url || "");
  // A bidplus tab that is already logged in can switch to seller-bids directly.
  const bidplusTab = [activeTab, ...gemTabs].find((tab) => loggedIn(tab)
    && /^https:\/\/bidplus\.gem\.gov\.in\//i.test(tab.url || ""));
  let watchIds;
  if (bidplusTab) {
    await chrome.tabs.update(bidplusTab.id, { url: SELLER_BID_LIST_URL, active: true });
    watchIds = new Set([bidplusTab.id]);
  } else {
    const portalTabs = [activeTab, ...gemTabs.filter((tab) => tab.id !== activeTab?.id)].filter(loggedIn);
    if (!portalTabs.length) {
      throw new Error("No logged-in GeM tab found. Log in to GeM, keep the GeM dashboard open, then click Scan Disqualified Bid.");
    }
    const before = new Set((await chrome.tabs.query({})).map((tab) => tab.id));
    let clicked = null;
    let clickedTab = null;
    for (const tab of portalTabs) {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        // MAIN world: GeM's javascript: links and ct.gem helpers only run in
        // the page's own context, not in the extension's isolated world.
        world: "MAIN",
        func: clickGemBidListLink,
      }).catch(() => []);
      if (injection?.result) {
        clicked = injection.result;
        clickedTab = tab;
        break;
      }
    }
    if (!clicked) {
      throw new Error("The Bids / Seller Bid List link was not found on the open GeM page. "
        + "Open the GeM seller dashboard (the page after login), then click Scan Disqualified Bid again.");
    }
    await chrome.tabs.update(clickedTab.id, { active: true }).catch(() => {});
    watchIds = new Set([clickedTab.id]);
    const trackNewTab = (tab) => { if (!before.has(tab.id)) watchIds.add(tab.id); };
    chrome.tabs.onCreated.addListener(trackNewTab);
    try {
      return await waitForSellerBidList(watchIds, onWait, true, `clicked "${clicked.text}" (${clicked.href || "no href"}) on ${clickedTab.url}`);
    } finally {
      chrome.tabs.onCreated.removeListener(trackNewTab);
    }
  }
  return waitForSellerBidList(watchIds, onWait, false);
}

async function waitForSellerBidList(watchIds, onWait, allowBidplusRedirect, clickedInfo = "") {
  const deadline = Date.now() + 90_000;
  const redirected = new Set();
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await onWait?.();
    for (const tabId of [...watchIds]) {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) { watchIds.delete(tabId); continue; }
      if (tab.status !== "complete") continue;
      const url = tab.url || "";
      if (SELLER_BID_LIST_PATTERN.test(url)) {
        if (await probeScanner(tab.id)) return tab;
        continue;
      }
      if (/^https:\/\/bidplus\.gem\.gov\.in\//i.test(url) && GEM_LOGIN_URL_PATTERN.test(url)) {
        throw new Error("GeM asked for login again on bidplus. Open Bids > Seller Bid List once from the GeM dashboard, then click Scan Disqualified Bid.");
      }
      // The portal link may land on another bidplus page; the session now
      // exists there, so moving to seller-bids is safe.
      // Leave GeM's /auth/autologin hand-off alone until it finishes redirecting.
      if (allowBidplusRedirect && /^https:\/\/bidplus\.gem\.gov\.in\//i.test(url)
        && !/^https:\/\/bidplus\.gem\.gov\.in\/auth\//i.test(url) && !redirected.has(tab.id)) {
        redirected.add(tab.id);
        await chrome.tabs.update(tab.id, { url: SELLER_BID_LIST_URL, active: true });
      }
    }
    if (!watchIds.size) throw new Error("The GeM Seller Bid List tab was closed before the scan started.");
  }
  const endedAt = await Promise.all([...watchIds].map((id) => chrome.tabs.get(id).then((tab) => tab.url).catch(() => "closed")));
  throw new Error("GeM Seller Bid List did not open within 90 seconds. "
    + `Diagnostics: ${clickedInfo || "direct bidplus tab"}; tab(s) ended at ${endedAt.join(", ") || "none"}. `
    + "Open Bids > Seller Bid List from the GeM dashboard once, then click Scan Disqualified Bid.");
}

async function startJob(jobId, product) {
  const kind = jobKind(product);
  const job = await api(`${JOB_APIS[kind]}/${jobId}/claim/`, {
    method: "POST",
    body: "{}",
  });
  job.kind = kind;
  await chrome.storage.local.set({ activeJobId: job.id, activeJobKind: kind });
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
  await api(`${JOB_APIS[kind]}/${jobId}/report/`, {
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
    if (message.type === "GEM_SYNC_WAKE") {
      // Chrome throttles chained timers in hidden tabs to about one wake-up per
      // minute. Service-worker timers are not throttled, so the scanner tab
      // sleeps here and is woken by the message response instead.
      const ms = Math.min(Math.max(Number(message.ms) || 0, 0), 30000);
      await new Promise((resolve) => setTimeout(resolve, ms));
      return { ok: true };
    }
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
      const sync = await chrome.storage.local.get("gemOpportunitySync");
      if (!sync.gemOpportunitySync || ["failed", "authentication_required", "stopped"].includes(sync.gemOpportunitySync.status)) {
        await chrome.storage.local.set({
          gemOpportunitySync: {
            status: "idle",
            message: "Acxxel reconnected. Ready to scan Bid To Be Participated.",
            page: 0,
            checked: 0,
            saved: 0,
            updatedAt: Date.now(),
            extensionVersion: chrome.runtime.getManifest().version,
          },
        });
      }
      return { ok: true };
    }
    if (message.type === "GET_STATE") {
      await recoverAcxxelSession();
      const saved = await settings();
      const sync = await reconcileInterruptedSyncStates();
      return { ok: true, connected: Boolean(saved.token), gemBidSync: sync.gemBidSync || null, gemOpportunitySync: sync.gemOpportunitySync || null };
    }
    if (message.type === "GET_GEM_BID_SYNC_STATE") {
      await recoverAcxxelSession();
      const saved = await settings();
      const sync = await reconcileInterruptedSyncStates();
      return { ok: true, connected: Boolean(saved.token), gemBidSync: sync.gemBidSync || null, gemOpportunitySync: sync.gemOpportunitySync || null };
    }
    if (message.type === "GET_ACTIVE_JOB") {
      const saved = await chrome.storage.local.get(["activeJobId", "activeJobKind"]);
      if (!saved.activeJobId) return { ok: true, job: null };
      const kind = jobKind(saved.activeJobKind);
      const jobs = await api(`${JOB_APIS[kind]}/`);
      const job = jobs.find((item) => item.id === saved.activeJobId) || null;
      if (job) job.kind = kind;
      if (!job || !["queued", "ready_for_fill", "filled"].includes(job.status)) {
        await chrome.storage.local.remove(["activeJobId", "activeJobKind"]);
      }
      return { ok: true, job };
    }
    if (message.type === "CLEAR_ACTIVE_JOB") {
      await chrome.storage.local.remove(["activeJobId", "activeJobKind"]);
      return { ok: true };
    }
    if (message.type === "START_JOB") return { ok: true, result: await startJob(message.jobId, message.product) };
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
            message: "GeM login is active. Click Scan Disqualified Bid to open the Seller Bid List and start automatically.",
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
      return { ok: true, job: await api(`${JOB_APIS[jobKind(message.kind)]}/${message.jobId}/report/`, {
        method: "POST",
        body: JSON.stringify(message.report),
      }) };
    }
    if (["START_GEM_BID_SYNC", "START_GEM_OPPORTUNITY_SYNC"].includes(message.type)) {
      const opportunityScan = message.type === "START_GEM_OPPORTUNITY_SYNC";
      const stateKey = opportunityScan ? "gemOpportunitySync" : "gemBidSync";
      await recoverAcxxelSession();
      const saved = await settings();
      if (!saved.token) throw new Error("Open Acxxel and log in before syncing GeM bids.");
      const syncStates = await reconcileInterruptedSyncStates();
      const retryState = !opportunityScan && message.resume && Number(syncStates.gemBidSync?.page || 0) > 1
        ? syncStates.gemBidSync
        : null;
      const pendingPages = (retryState?.pending || [])
        .map((item) => Number(item?.page || 0))
        .filter((page) => page > 0);
      const retryPage = retryState
        ? Math.min(Number(retryState.page), ...(pendingPages.length ? pendingPages : [Number(retryState.page)]))
        : 0;
      const resume = retryState ? {
        page: retryPage, saved: Number(retryState.saved || 0),
        rejected: Number(retryState.rejected || 0), checked: Number(retryState.checked || 0),
        pending: Array.isArray(retryState.pending) ? retryState.pending : [],
      } : null;
      const alreadyRunning = [syncStates.gemBidSync, syncStates.gemOpportunitySync]
        .some((state) => state && ACTIVE_SYNC_STATUSES.has(state.status));
      if (alreadyRunning) {
        throw new Error("Another GeM scan is already running or paused. Finish or stop it before starting a second scan.");
      }
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      let sellerTabs = await chrome.tabs.query({ url: "https://bidplus.gem.gov.in/seller-bids*" });
      if (!opportunityScan && !sellerTabs.length) {
        // One-click start: after GeM login, open the Seller Bid List ourselves.
        // The scanner then applies the required filters and starts reading.
        // Keep updatedAt fresh so the interrupted-scan check does not flag
        // this "starting" state as failed while GeM is still loading.
        const markOpening = () => chrome.storage.local.set({ [stateKey]: {
          status: "starting",
          message: "Opening GeM Seller Bid List...",
          page: resume?.page || 0,
          saved: resume?.saved || 0,
          checked: resume?.checked || 0,
          pending: resume?.pending || [],
          updatedAt: Date.now(),
        } });
        await markOpening();
        try {
          sellerTabs = [await openSellerBidList(activeTabs[0], markOpening)];
        } catch (error) {
          await chrome.storage.local.set({ [stateKey]: {
            status: "authentication_required",
            message: error.message,
            page: resume?.page || 0,
            saved: resume?.saved || 0,
            checked: resume?.checked || 0,
            pending: resume?.pending || [],
            updatedAt: Date.now(),
            extensionVersion: chrome.runtime.getManifest().version,
          } });
          throw error;
        }
      }
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
      await chrome.storage.local.set({ [stateKey]: {
        status: "starting",
        message: opportunityScan ? "Starting Bid To Be Participated scan..."
          : resume ? `Resuming disqualified bid sync from page ${resume.page}...` : "Starting disqualified bid sync...",
        page: resume?.page || 0,
        saved: resume?.saved || 0,
        checked: resume?.checked || 0,
        pending: resume?.pending || [],
        updatedAt: Date.now(),
      } });
      let response;
      try {
        const sendStart = () => Promise.race([
          chrome.tabs.sendMessage(tab.id, { type: message.type, resume }),
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
            files: ["src/blocked-pins.js", "src/gem-bid-sync.js"],
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
          response = await sendStart();
        }
        if (!response?.ok) throw new Error(response?.error || "GeM bid scanner did not start.");
      } catch (error) {
        const failureMessage = error.message || "GeM bid scanner did not start.";
        await chrome.storage.local.set({
          [stateKey]: {
            status: "failed",
            message: failureMessage,
            page: resume?.page || 0,
            saved: resume?.saved || 0,
            checked: resume?.checked || 0,
            pending: resume?.pending || [],
            updatedAt: Date.now(),
            extensionVersion: chrome.runtime.getManifest().version,
          },
        });
        throw error;
      }
      await chrome.storage.local.set({
        [stateKey]: {
          status: "running",
          message: resume
            ? `Scanner is restoring saved page ${resume.page}.`
            : `Scanner started. ${response.cardCount || 0} bid card(s) found on the current GeM page.`,
          page: resume?.page || 0,
          saved: resume?.saved || 0,
          checked: resume?.checked || 0,
          pending: resume?.pending || [],
          updatedAt: Date.now(),
          extensionVersion: chrome.runtime.getManifest().version,
        },
      });
      return { ok: true, started: true };
    }
    if (["PAUSE_GEM_BID_SYNC", "PAUSE_GEM_OPPORTUNITY_SYNC"].includes(message.type)) {
      const opportunityScan = message.type === "PAUSE_GEM_OPPORTUNITY_SYNC";
      const stateKey = opportunityScan ? "gemOpportunitySync" : "gemBidSync";
      const contentMessage = opportunityScan ? "PAUSE_GEM_OPPORTUNITY_SYNC" : "PAUSE_GEM_BID_SYNC";
      const tabs = await chrome.tabs.query({ url: "https://bidplus.gem.gov.in/seller-bids*" });
      const responses = await Promise.all(tabs.map((tab) => (
        chrome.tabs.sendMessage(tab.id, { type: contentMessage }).catch(() => null)
      )));
      if (!responses.some((response) => response?.ok)) {
        throw new Error("No running GeM bid sync was found to pause.");
      }
      const current = await chrome.storage.local.get(stateKey);
      await chrome.storage.local.set({
        [stateKey]: {
          ...(current[stateKey] || {}),
          status: "paused",
          message: "GeM bid sync paused by user.",
          updatedAt: Date.now(),
          extensionVersion: chrome.runtime.getManifest().version,
        },
      });
      return { ok: true, paused: true };
    }
    if (["RESUME_GEM_BID_SYNC", "RESUME_GEM_OPPORTUNITY_SYNC"].includes(message.type)) {
      const opportunityScan = message.type === "RESUME_GEM_OPPORTUNITY_SYNC";
      const stateKey = opportunityScan ? "gemOpportunitySync" : "gemBidSync";
      const contentMessage = opportunityScan ? "RESUME_GEM_OPPORTUNITY_SYNC" : "RESUME_GEM_BID_SYNC";
      const tabs = await chrome.tabs.query({ url: "https://bidplus.gem.gov.in/seller-bids*" });
      await Promise.all(tabs.map((tab) => (
        chrome.tabs.sendMessage(tab.id, { type: contentMessage }).catch(() => null)
      )));
      const current = await chrome.storage.local.get(stateKey);
      await chrome.storage.local.set({
        [stateKey]: {
          ...(current[stateKey] || {}),
          status: "running",
          message: "GeM bid sync resumed.",
          updatedAt: Date.now(),
          extensionVersion: chrome.runtime.getManifest().version,
        },
      });
      return { ok: true, resumed: true };
    }
    if (message.type === "SAVE_GEM_BID_RESULTS") {
      const result = await api("/gem/bid-results/", {
        method: "POST",
        body: JSON.stringify({ results: message.results || [] }),
      });
      return {
        ok: true,
        saved: result.saved || 0,
        created: result.created || 0,
        updated: result.updated || 0,
        rejected: result.rejected || 0,
        frontendVisible: result.frontend_visible === true,
        rejections: result.rejections || [],
      };
    }
    if (message.type === "SAVE_GEM_BID_OPPORTUNITIES") {
      const result = await api("/gem/bid-opportunities/", {
        method: "POST",
        body: JSON.stringify({ results: message.results || [] }),
      });
      return {
        ok: true,
        saved: result.saved || 0,
        created: result.created || 0,
        updated: result.updated || 0,
        rejected: result.rejected || 0,
        frontendVisible: result.frontend_visible === true,
        rejections: result.rejections || [],
      };
    }
    if (message.type === "GET_CORRIGENDUM_PENDING") {
      const result = await api("/gem/bid-opportunities/", {
        method: "POST",
        body: JSON.stringify({ action: "corrigendum_pending" }),
      });
      return { ok: true, bidNos: result.bid_nos || [] };
    }
    if (message.type === "MARK_GEM_CORRIGENDUM") {
      const result = await api("/gem/bid-opportunities/", {
        method: "POST",
        body: JSON.stringify({ action: "mark_corrigendum", bid_nos: message.bidNos || [], bids: message.bids || [] }),
      });
      return { ok: true, updated: result.updated || 0 };
    }
    if (message.type === "READ_GEM_BID_DETAIL") {
      const detailUrl = String(message.url || "");
      if (!/^https:\/\/[^/]*gem\.gov\.in\//i.test(detailUrl)) {
        throw new Error("Invalid GeM bid detail URL.");
      }
      let response = null;
      let bytes = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        response = await fetch(detailUrl, {
          credentials: "include",
          cache: "no-store",
        });
        const retryable = response.status === 429 || response.status >= 500;
        if (!response.ok) {
          if (!retryable || attempt === 2) break;
          await new Promise((resolve) => setTimeout(resolve, 15000));
          continue;
        }
        bytes = new Uint8Array(await response.arrayBuffer());
        // GeM sometimes answers a document request with an HTML error or
        // login page (HTTP 200) instead of the PDF.
        const isPdf = String.fromCharCode(...bytes.subarray(0, 1024)).includes("%PDF");
        if (isPdf) break;
        const head = new TextDecoder().decode(bytes.subarray(0, 20000));
        if (/type=["']?password|sign\s*in|log\s*in|captcha/i.test(head)) {
          throw new Error("GeM bid document returned HTTP 401: GeM session expired.");
        }
        bytes = null;
        if (attempt === 2) throw new Error("GeM bid document is not a PDF.");
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }
      if (!response.ok) throw new Error(`GeM bid document returned HTTP ${response.status}.`);
      if (bytes.length > 15 * 1024 * 1024) throw new Error("GeM bid document is larger than 15 MB.");
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 32768) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
      }
      const parsed = await api("/gem/bid-opportunities/parse-pdf/", {
        method: "POST",
        body: JSON.stringify({ pdf_base64: btoa(binary) }),
      });
      return { ok: true, detailText: parsed.detail_text || "" };
    }
    if (message.type === "GEM_BID_SYNC_PROGRESS") {
      const opportunityProgress = message.scanType === "opportunity" || (
        !message.scanType && /selected category|full bid details|opportunit|bid to be participated/i.test(String(message.message || ""))
      );
      const stateKey = opportunityProgress ? "gemOpportunitySync" : "gemBidSync";
      const syncState = {
        status: message.status || "running",
        message: message.message || "",
        page: message.page || 0,
        saved: message.saved || 0,
        rejected: message.rejected || 0,
        checked: message.checked || 0,
        pending: Array.isArray(message.pending) ? message.pending : [],
        updatedAt: Date.now(),
        extensionVersion: chrome.runtime.getManifest().version,
      };
      await chrome.storage.local.set({ [stateKey]: syncState });
      if (sender.tab?.id && ACTIVE_SYNC_STATUSES.has(syncState.status) && sender.tab.autoDiscardable !== false) {
        // A discarded background tab silently kills a long scan mid-page.
        chrome.tabs.update(sender.tab.id, { autoDiscardable: false }).catch(() => {});
      }
      if (["complete", "failed"].includes(syncState.status) && sender.tab?.id) {
        setTimeout(() => closeBackgroundSyncTab(sender.tab.id), 1200);
      }
      return { ok: true };
    }
    return { ok: false, error: "Unknown extension message." };
  })().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
