(() => {
  const BID_PATTERN = /GEM\s*\/\s*\d{4}\s*\/\s*[A-Z]+\s*\/\s*\d+/i;
  let syncing = false;
  let stopRequested = false;
  let pauseRequested = false;
  let activeScanType = "";
  let disqualifiedPending = [];
  let lastGemRemoteActionAt = 0;
  let gemBackoffMs = 0;

  const text = (node) => String(node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  const sleep = (ms) => new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    setTimeout(finish, ms);
    // The scan runs in a background tab, where Chrome throttles chained timers
    // to roughly one wake-up per minute. Every Date.now()-based wait loop then
    // gets one or two polls before its deadline and falsely reports that GeM
    // stopped rendering. Let the (unthrottled) service worker wake us instead.
    if (document.visibilityState !== "hidden" || ms < 100) return;
    try {
      chrome.runtime.sendMessage({ type: "GEM_SYNC_WAKE", ms }, () => {
        void chrome.runtime.lastError;
        finish();
      });
    } catch {
      // Extension was reloaded; the plain timer above still resolves.
    }
  });
  const normalizeBidNo = (value) => String(value || "").replace(/\s+/g, "").toUpperCase();
  const isOriginalBidNo = (value) => /\/B\//.test(normalizeBidNo(value));
  const originalBidNumbers = (value) => [...new Set(
    (String(value || "").match(new RegExp(BID_PATTERN.source, "gi")) || [])
      .map(normalizeBidNo)
      .filter(isOriginalBidNo),
  )];
  const GEM_REMOTE_ACTION_INTERVAL_MS = 2500;
  const GEM_BACKOFF_START_MS = 4000;
  const GEM_BACKOFF_MAX_MS = 30000;
  const GEM_TRANSIENT_ERROR_PATTERN = /something\s+went\s+wrong\s*,?\s*please\s+try\s+again\s+after\s+some\s+time|internal\s+server\s+error|service\s+temporarily\s+unavailable/i;

  function stopIfRequested() {
    if (!stopRequested) return;
    const error = new Error("GeM bid sync stopped by user.");
    error.code = "GEM_SYNC_STOPPED";
    throw error;
  }

  function gemTransientErrorMessage() {
    const pageText = searchableDocuments()
      .map((root) => String(root.body?.innerText || root.body?.textContent || root.textContent || ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return pageText.match(GEM_TRANSIENT_ERROR_PATTERN)?.[0] || "";
  }

  function throwIfGemTransientError() {
    // A GeM result/history request can briefly render this banner while the
    // seller list remains recoverable. It is a page-level retry signal, not a
    // reason to terminate the complete scan.
    return gemTransientErrorMessage();
  }

  async function waitForGemRemoteActionSlot(minimumInterval = GEM_REMOTE_ACTION_INTERVAL_MS) {
    stopIfRequested();
    // GeM's "something went wrong" banner is a rate-limit signal, not just a
    // one-off glitch. Hitting it again at the same fixed cadence just keeps
    // drawing more rejections, so back off exponentially while it persists
    // and reset to the normal cadence the moment it clears.
    if (gemTransientErrorMessage()) {
      gemBackoffMs = Math.min(gemBackoffMs ? gemBackoffMs * 2 : GEM_BACKOFF_START_MS, GEM_BACKOFF_MAX_MS);
      await sleep(gemBackoffMs);
      stopIfRequested();
    } else {
      gemBackoffMs = 0;
    }
    const remaining = minimumInterval - (Date.now() - lastGemRemoteActionAt);
    if (remaining > 0) await sleep(remaining);
    stopIfRequested();
    lastGemRemoteActionAt = Date.now();
  }

  async function waitWhilePaused(context) {
    if (!pauseRequested) return;
    await progress("paused", "GeM bid sync paused by user.", context);
    while (pauseRequested) {
      stopIfRequested();
      await sleep(500);
    }
    stopIfRequested();
    await progress("running", "GeM bid sync resumed.", context);
  }

  function runtimeMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (!response?.ok) reject(new Error(response?.error || "Extension request failed."));
          else resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function progress(status, message, extra = {}) {
    if (activeScanType === "disqualified") {
      if (extra.pending) disqualifiedPending = extra.pending;
      extra = { ...extra, pending: disqualifiedPending };
    }
    await runtimeMessage({ type: "GEM_BID_SYNC_PROGRESS", scanType: activeScanType, status, message, ...extra });
  }

  function visible(element) {
    if (!element || element.nodeType !== 1) return false;
    const view = element.ownerDocument?.defaultView || window;
    const style = view.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function bidCardFor(element) {
    let current = element;
    let best = null;
    while (current?.parentElement) {
      const value = text(current);
      // A GeM result card commonly contains both its original Bid No. (/B/)
      // and its generated RA No. (/R/). They belong to the same card. Counting
      // the RA as another bid made us stop at the tiny Bid/RA label instead of
      // reaching the complete card that contains status and result controls.
      const bidNumbers = originalBidNumbers(value);
      if (bidNumbers.length === 1) {
        let score = 0;
        if (current.matches("tr, article, [role=row], [class*=card], [class*=result], [class*=list-item]")) score += 25;
        if (/technical\s+status|view\s+bid\s+result|disqualified|qualified/i.test(value)) score += 80;
        if (/department|quantity|start\s+date|end\s+date|items?/i.test(value)) score += 30;
        if (current.querySelector("button, [role=button], [ng-click], [data-ng-click]")) score += 15;
        score += Math.min(value.length, 1500) / 100;
        if (!best || score > best.score) best = { node: current, score };
      }
      if (bidNumbers.length > 1) break;
      current = current.parentElement;
    }
    return best?.node || null;
  }

  function searchableDocuments() {
    const roots = [];
    const seen = new Set();
    const addRoot = (root) => {
      if (!root || seen.has(root)) return;
      seen.add(root);
      roots.push(root);
      for (const element of root.querySelectorAll?.("*") || []) {
        if (element.shadowRoot) addRoot(element.shadowRoot);
      }
    };
    addRoot(document);
    for (const frame of document.querySelectorAll("iframe, frame")) {
      try {
        if (frame.contentDocument?.body) addRoot(frame.contentDocument);
      } catch {
        // Cross-origin frames are scanned by their own declared content script.
      }
    }
    return roots;
  }

  function queryAllSearchableRoots(selector) {
    return searchableDocuments().flatMap((root) => [...(root.querySelectorAll?.(selector) || [])]);
  }

  function currentCards() {
    const cards = new Map();
    for (const root of searchableDocuments()) {
      const container = root.body || root;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const match = String(node.nodeValue || "").match(BID_PATTERN);
        if (match) {
          const bidNo = normalizeBidNo(match[0]);
          if (!isOriginalBidNo(bidNo)) {
            node = walker.nextNode();
            continue;
          }
          const card = bidCardFor(node.parentElement);
          if (card && visible(card) && !cards.has(bidNo)) cards.set(bidNo, card);
        }
        node = walker.nextNode();
      }

      if (!cards.size && BID_PATTERN.test(text(container))) {
        for (const element of root.querySelectorAll("a, p, span, strong, td, th, li, section, article, div")) {
          const bidNumbers = originalBidNumbers(text(element));
          if (bidNumbers.length !== 1) continue;
          const bidNo = bidNumbers[0];
          if (cards.has(bidNo)) continue;
          const card = bidCardFor(element) || element.closest("tr, article, section, div") || element;
          if (visible(card)) cards.set(bidNo, card);
        }
      }
    }
    return [...cards.entries()].map(([bidNo, card]) => ({ bidNo, card }));
  }

  function bidPageDiagnostics() {
    const roots = searchableDocuments();
    const bodyText = roots.map((root) => text(root.body || root)).join(" ");
    const matches = bodyText.match(new RegExp(BID_PATTERN.source, "gi")) || [];
    return `URL: ${location.href}; rendered bid numbers: ${matches.length}; frames: ${document.querySelectorAll("iframe, frame").length}; DOM roots: ${roots.length}`;
  }

  function valueAfterLabel(raw, labels) {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = raw.match(new RegExp(`\\b${escaped}\\b\\s*:?\\s*(.+?)(?=\\s{2,}|Bid\/RA|Start Date|End Date|Quantity|Status|$)`, "i"));
      if (match?.[1]) return match[1].trim();
    }
    return "";
  }

  function dateFrom(value) {
    const match = String(value || "").match(/\d{4}[-/]\d{2}[-/]\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?|\d{2}[-/]\d{2}[-/]\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?/i);
    if (!match) return "";
    const parts = match[0].match(/^(\d{2,4})[-/](\d{2})[-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if (!parts) return "";
    const yearFirst = parts[1].length === 4;
    const year = Number(yearFirst ? parts[1] : parts[3]);
    const month = Number(parts[2]);
    const day = Number(yearFirst ? parts[3] : parts[1]);
    let hour = Number(parts[4] || 0);
    const minute = Number(parts[5] || 0);
    const second = Number(parts[6] || 0);
    const meridiem = String(parts[7] || "").toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    const parsed = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }

  function isValidDisqualificationDate(value, reference = new Date()) {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime())
      && parsed.getFullYear() === reference.getFullYear()
      && parsed <= reference;
  }

  function disqualifiedSaveSummary(saved, created, updated, rejected) {
    return `${saved} valid in dashboard (${created} new, ${updated} refreshed); ${rejected} invalid not saved`;
  }

  function opportunitySaveSummary(saved, created, updated, apiRejected) {
    return `${saved} frontend-valid (${created} new, ${updated} refreshed); ${apiRejected} rejected by API`;
  }

  // Bid numbers read by the last completed opportunity scan, including bids
  // that were rejected, so a later scan can tell where the new bids end.
  const OPPORTUNITY_KNOWN_BIDS_KEY = "gemOpportunityKnownBids";
  // Bids read by the scan in progress. They only become "known" once that
  // scan completes; an interrupted run must not hide the pages it never read.
  const OPPORTUNITY_RUN_BIDS_KEY = "gemOpportunityRunBids";
  const OPPORTUNITY_KNOWN_PAGES_TO_STOP = 2;
  const OPPORTUNITY_KNOWN_BID_TTL_MS = 150 * 86400000;

  async function storedBidMap(key) {
    try {
      const value = (await chrome.storage.local.get(key))[key];
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  async function storeBidMap(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch {
      // Losing this only means the next scan reads a few extra pages.
    }
  }

  function isKnownOpportunityPage(cards, knownBids) {
    return cards.length > 0 && cards.every(({ bidNo }) => knownBids[bidNo]);
  }

  function mergeKnownBids(knownBids, runBids, now = Date.now()) {
    const merged = {};
    for (const [bidNo, seenAt] of Object.entries({ ...knownBids, ...runBids })) {
      if (now - Number(seenAt || 0) < OPPORTUNITY_KNOWN_BID_TTL_MS) merged[bidNo] = seenAt;
    }
    return merged;
  }

  function opportunityCardQuantity(card) {
    return Number(text(card).match(/\bQuantity\s*:?\s*(\d+)\b/i)?.[1] || 0);
  }

  function opportunityCardStartDate(card) {
    const raw = text(card);
    const value = raw.match(
      /\b(?:Bid(?:\s*\/\s*RA)?\s+)?Start\s+Date(?:\/Time)?\s*:?\s*(\d{2,4}[-/]\d{2}[-/]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?)/i
    )?.[1];
    return dateFrom(value || "");
  }

  // Current End Date shown on the seller-list card. A corrigendum that extends
  // a bid changes this, while the bid PDF keeps the original date.
  function opportunityCardEndDate(card) {
    const raw = text(card);
    const value = raw.match(
      /\b(?:Bid(?:\s*\/\s*RA)?\s+)?End\s+Date(?:\/Time)?\s*:?\s*(\d{2,4}[-/]\d{2}[-/]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?)/i
    )?.[1];
    return dateFrom(value || "");
  }

  function productType(raw, itemName) {
    const value = `${itemName || ""} ${raw || ""}`.toLowerCase();
    if (/multifunction|printer|printing|laserjet|inkjet|mfp\b/.test(value)) return "printer";
    if (/workstation/.test(value)) return "workstation";
    if (/all[ -]?in[ -]?one|\baio\b/.test(value)) return "aio";
    if (/desktop|computer/.test(value)) return "desktop";
    return "other";
  }

  function disqualifiedControls(card) {
    const marker = [...card.querySelectorAll("a, button, [role=button], [ng-click], span, div")]
      .filter(visible)
      .find((node) => /^(technical status\s*:\s*)?disqualified$/i.test(text(node)));
    if (!marker) return [];
    const direct = marker.closest("a, button, [role=button], [ng-click]");
    const markerRect = marker.getBoundingClientRect();
    const candidates = [];
    for (const node of card.querySelectorAll(
      "a.view_reason, button.view_reason, [class~=view_reason], [ng-click*=reason i], [data-ng-click*=reason i]"
    )) {
      if (visible(node)) candidates.push({ node, score: 500 });
    }
    if (direct && !BID_PATTERN.test(text(direct))) candidates.push({ node: direct, score: 120 });

    for (const icon of card.querySelectorAll("i, svg, img, [class*=eye]")) {
      if (!visible(icon)) continue;
      const iconRect = icon.getBoundingClientRect();
      const distance = Math.abs(iconRect.left - markerRect.right) + Math.abs(iconRect.top - markerRect.top);
      if (distance > 180) continue;
      const action = icon.closest("a, button, [role=button], [ng-click]") || icon;
      const attrs = `${action.getAttribute("ng-click") || ""} ${action.getAttribute("title") || ""} ${action.getAttribute("aria-label") || ""} ${action.className || ""} ${icon.className?.baseVal || icon.className || ""}`;
      let score = 140 - distance;
      if (/eye|view|reason|technical|evaluat|history/i.test(attrs)) score += 100;
      candidates.push({ node: action, score });
    }
    let parent = marker.parentElement;
    for (let depth = 0; parent && depth < 4; depth += 1, parent = parent.parentElement) {
      for (const node of parent.querySelectorAll("a, button, [role=button], [ng-click], [data-ng-click]")) {
        if (!visible(node) || BID_PATTERN.test(text(node))) continue;
        const href = node.getAttribute("href") || "";
        if (href && href !== "#" && !/^javascript:/i.test(href) && !node.hasAttribute("ng-click")) continue;
        const attrs = `${node.getAttribute("ng-click") || ""} ${node.getAttribute("title") || ""} ${node.getAttribute("aria-label") || ""} ${node.className || ""}`;
        const nodeRect = node.getBoundingClientRect();
        const distance = Math.abs(nodeRect.left - markerRect.right) + Math.abs(nodeRect.top - markerRect.top);
        let score = Math.max(0, 20 - distance / 10) - depth;
        if (/reason|technical|evaluat|history|status/i.test(attrs)) score += 50;
        if (/eye/i.test(attrs) || node.querySelector("[class*=eye], .fa-eye, .glyphicon-eye-open")) score += 70;
        if (/disqualified/i.test(text(node))) score += 25;
        candidates.push({ node, score });
      }
      if (candidates.some((item) => item.score >= 60)) break;
    }
    candidates.push({ node: marker, score: 5 });
    candidates.sort((a, b) => b.score - a.score);
    return [...new Map(candidates.map((item) => [item.node, item])).values()]
      .slice(0, 8)
      .map((item) => item.node);
  }

  function disqualifiedControl(card) {
    return disqualifiedControls(card)[0] || null;
  }

  function activateControl(control) {
    control.scrollIntoView({ block: "center", inline: "center" });
    const clickId = `bid-history-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ownerDocument = control.ownerDocument || document;
    let clicked = false;
    const acknowledge = (event) => {
      if (event.detail?.clickId === clickId) clicked = Boolean(event.detail.clicked);
    };
    control.setAttribute("data-acxxel-click-id", clickId);
    ownerDocument.addEventListener("acxxel-gem-control-clicked", acknowledge);
    try {
      ownerDocument.dispatchEvent(new CustomEvent("acxxel-gem-click-control", {
        detail: { clickId },
      }));
    } finally {
      ownerDocument.removeEventListener("acxxel-gem-control-clicked", acknowledge);
      control.removeAttribute("data-acxxel-click-id");
    }
    // Reloading/reinstalling an unpacked extension does not retroactively run
    // its MAIN-world bridge in an already-open GeM document. In that case the
    // bridge emits no acknowledgement; a native click still reaches GeM's
    // Angular/jQuery handler and prevents every modal/pagination action from
    // silently becoming stuck. Never fire this after an acknowledged bridge
    // click, because that would submit the control twice.
    if (!clicked) control.click();
    return clicked;
  }

  function describeControl(control) {
    const attrs = [
      ["id", control.id],
      ["class", typeof control.className === "string" ? control.className : control.className?.baseVal],
      ["ng-click", control.getAttribute?.("ng-click") || control.getAttribute?.("data-ng-click")],
      ["href", control.getAttribute?.("href")],
      ["title", control.getAttribute?.("title")],
      ["aria-label", control.getAttribute?.("aria-label")],
      ["onclick", control.getAttribute?.("onclick")],
    ].filter(([, value]) => value).map(([key, value]) => `${key}=${String(value).slice(0, 100)}`);
    return `<${control.tagName?.toLowerCase() || "node"} ${attrs.join(" ")}> text=${text(control).slice(0, 80)}`;
  }

  async function waitForHistoryModal(timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      stopIfRequested();
      throwIfGemTransientError();
      const title = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,div,span")]
        .find((node) => visible(node) && /^reason for technical evaluation$/i.test(text(node)));
      if (title) {
        let modal = title.closest("[role=dialog], .modal, .modal-content, .ngdialog-content, .modal-dialog");
        if (!modal) modal = bidCardFor(title) || title.parentElement?.parentElement;
        if (modal) return modal;
      }
      const modal = [...document.querySelectorAll("[role=dialog], .modal.show, .modal.in, .ngdialog-content")]
        .find((node) => visible(node) && /reason for technical evaluation/i.test(text(node)));
      if (modal) return modal;
      await sleep(200);
    }
    return null;
  }

  function historyRows(modal) {
    const rows = [];
    const rowCandidates = modal.querySelectorAll(
      "table tr, [role=row], .table-row, .row, tbody > *, [class*=history] > *"
    );
    for (const row of rowCandidates) {
      let cellNodes = [...row.querySelectorAll(":scope > td, :scope > th, :scope > [role=cell], :scope > [class*=col-], :scope > .column")];
      if (cellNodes.length < 3) {
        cellNodes = [...row.querySelectorAll("td, th, [role=cell], [class*=col-], .column")]
          .filter((node) => visible(node));
      }
      // Preserve column positions: empty or repeated reason/comment values
      // must not shift the date and status columns.
      const cells = cellNodes.map(text);
      if (cells.length < 2) continue;
      if (!/\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}/.test(cells[0])) continue;
      rows.push({
        date_time: dateFrom(cells[0]) || cells[0],
        status: cells[1] || "",
        reason: cells[2] || "",
        comment: cells.slice(3).join(" ") || "",
      });
    }
    if (rows.length) return rows;

    const legacyValues = {};
    for (const block of modal.querySelectorAll(".well, .modal-body > div")) {
      const label = text(block.querySelector(".phead1, strong, b"));
      if (!/^(reason|comment)$/i.test(label)) continue;
      const valueNode = [...block.querySelectorAll("p, div, span")]
        .find((node) => node !== block.querySelector(".phead1") && text(node) && text(node) !== label);
      legacyValues[label.toLowerCase()] = text(valueNode);
    }
    if (legacyValues.reason || legacyValues.comment) {
      return [{
        date_time: "",
        status: "Disqualified",
        reason: legacyValues.reason || "",
        comment: legacyValues.comment || "",
      }];
    }

    const datedNodes = [...modal.querySelectorAll("td, div, span, p, li")]
      .filter((node) => visible(node))
      .filter((node) => {
        const value = text(node);
        return value.length < 1200
          && /\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}/.test(value)
          && /disqualified/i.test(value);
      })
      .sort((a, b) => text(a).length - text(b).length);
    for (const node of datedNodes) {
      const value = text(node);
      const dateMatch = value.match(/\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}(?::\d{2})?/);
      const statusMatch = value.match(/\b(disqualified|qualified|evaluated|pending)\b/i);
      if (!dateMatch || !statusMatch) continue;
      const afterStatus = value.slice((statusMatch.index || 0) + statusMatch[0].length).trim();
      rows.push({
        date_time: dateFrom(dateMatch[0]) || dateMatch[0],
        status: statusMatch[0],
        reason: afterStatus,
        comment: "",
      });
      break;
    }
    return rows;
  }

  async function waitForHistoryRows(modal, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      stopIfRequested();
      throwIfGemTransientError();
      const rows = historyRows(modal);
      if (rows.some((row) => row.date_time && /disqualified/i.test(row.status))) return rows;
      await sleep(250);
    }
    return [];
  }

  async function closeModal(modal) {
    const close = [...modal.querySelectorAll(
      "[data-dismiss=modal], [data-bs-dismiss=modal], .close, button, a, [role=button], [ng-click], [data-ng-click]"
    )].find((node) => {
      if (!visible(node)) return false;
      const label = [text(node), node.getAttribute("aria-label"), node.getAttribute("title"),
        node.getAttribute("ng-click"), node.getAttribute("data-ng-click")].filter(Boolean).join(" ");
      return /^(?:close|x|×)$/i.test(text(node)) || /\b(?:close|dismiss|cancel)\b/i.test(label);
    });
    if (close) activateControl(close);
    const end = Date.now() + 5000;
    while (Date.now() < end) {
      if (!document.contains(modal) || !visible(modal)) return true;
      await sleep(150);
    }
    return false;
  }

  async function historyFor(card) {
    // A previous close failure can leave an overlay intercepting all retries.
    // Never read a still-open popup as though it belonged to the next bid.
    const existingModal = [...document.querySelectorAll("[role=dialog], .modal, .ngdialog-content")]
      .find((node) => visible(node) && /reason for technical evaluation/i.test(text(node)));
    if (existingModal && !await closeModal(existingModal)) {
      return { rows: [], error: "previous technical evaluation popup is still open" };
    }
    const controls = disqualifiedControls(card);
    if (!controls.length) return { rows: [], error: "history control not found" };
    if (gemTransientErrorMessage()) {
      return { rows: [], error: "GeM temporarily rejected the evaluation-history request" };
    }
    let modalOpened = false;
    let modalSample = "";
    for (const control of controls) {
      if (gemTransientErrorMessage()) {
        return { rows: [], error: "GeM temporarily rejected the evaluation-history request" };
      }
      await waitForGemRemoteActionSlot();
      if (gemTransientErrorMessage()) {
        return { rows: [], error: "GeM temporarily rejected the evaluation-history request" };
      }
      activateControl(control);
      const modal = await waitForHistoryModal(3000);
      if (!modal) continue;
      modalOpened = true;
      modalSample = String(modal.innerHTML || modal.outerHTML || "")
        .replace(/\s+/g, " ")
        .slice(0, 1800);
      const rows = await waitForHistoryRows(modal);
      const closed = await closeModal(modal);
      if (!closed) return { rows: [], error: "technical evaluation popup could not be closed" };
      await sleep(350);
      if (rows.length) return { rows, error: "" };
    }
    return {
      rows: [],
      error: modalOpened
        ? `history popup opened but its table was empty; modal HTML: ${modalSample}`
        : `history popup did not open; controls tried: ${controls.slice(0, 4).map(describeControl).join(" | ")}`,
    };
  }

  function bidResultControl(card) {
    return [...card.querySelectorAll("button, a, [role=button], [ng-click], [data-ng-click]")]
      .filter(visible)
      .find((node) => {
        const label = [
          text(node), node.getAttribute("title"), node.getAttribute("aria-label"),
          node.getAttribute("ng-click"), node.getAttribute("data-ng-click"),
        ].filter(Boolean).join(" ");
        return /view.*bid.*results?|bid.*results?|technical.*results?|show.*results?/i.test(label);
      }) || null;
  }

  function visibleTechnicalStatus(card) {
    const raw = text(card);
    const labelled = raw.match(/technical\s+status\s*:?\s*(disqualified|qualified|not\s+evaluated|under\s+evaluation|evaluation\s+pending|pending|evaluated)\b/i);
    if (labelled) return labelled[1];

    // GeM's table layout renders the status and its heading in separate cells, so
    // the flattened card text does not always contain "Technical Status:".
    const marker = [...card.querySelectorAll("td, [role=cell], a, button, span, strong, b, div")]
      .filter(visible)
      .find((node) => /^(disqualified|qualified)$/i.test(text(node)));
    return marker ? text(marker).match(/^(disqualified|qualified)$/i)?.[1] || "" : "";
  }

  async function revealBidResult(bidNo, card, timeout = 15000) {
    const existingStatus = visibleTechnicalStatus(card);
    if (existingStatus) return { card, status: existingStatus, read: true };

    const control = bidResultControl(card);
    if (!control) {
      // GeM only renders View Bid Results once the technical result is
      // published. A bid still in Technical Evaluation cannot be disqualified
      // yet, so it is checked (not pending) and a later scan picks it up.
      if (/\bStatus\s*:?\s*Technical\s+Evaluation\b/i.test(text(card))) {
        return { card, status: "Under Evaluation", read: true };
      }
      return { card, status: "", read: false, error: `No View Bid Results control found. Card: ${text(card).slice(0, 900)}` };
    }
    if (gemTransientErrorMessage()) {
      return { card, status: "", read: false, error: "GeM temporarily rejected the Bid Result request" };
    }
    await waitForGemRemoteActionSlot();
    if (gemTransientErrorMessage()) {
      return { card, status: "", read: false, error: "GeM temporarily rejected the Bid Result request" };
    }
    activateControl(control);

    const end = Date.now() + timeout;
    while (Date.now() < end) {
      stopIfRequested();
      throwIfGemTransientError();
      await sleep(250);
      const liveCard = currentCards().find((item) => item.bidNo === bidNo)?.card || card;
      const status = visibleTechnicalStatus(liveCard);
      if (status) return { card: liveCard, status, read: true };
    }
    const latestCard = currentCards().find((item) => item.bidNo === bidNo)?.card || card;
    return { card: latestCard, status: "", read: false, error: `View Bid Results did not reveal a recognized technical status. Card: ${text(latestCard).slice(0, 900)}` };
  }

  async function extractPage(onRecord, processed = new Set()) {
    const cards = currentCards();
    const results = [];
    for (const { bidNo, card } of cards) {
      stopIfRequested();
      if (processed.has(bidNo)) continue;
      // Opening and closing evaluation history can make Angular replace every row.
      // Always reacquire the current card instead of using a detached snapshot.
      const currentCard = currentCards().find((item) => item.bidNo === bidNo)?.card || card;
      // Disqualified tracking follows the status printed on the seller-list
      // card. Do not open View Bid Results for Evaluated, Qualified, Pending,
      // or status-less cards: those requests add load to GeM and this scan is
      // only meant to persist explicitly disqualified bids.
      const listedStatus = visibleTechnicalStatus(currentCard);
      const evaluation = {
        card: currentCard,
        status: listedStatus,
        read: true,
        error: "",
      };
      const liveCard = evaluation.card;
      const raw = text(liveCard);
      const isDisqualified = evaluation.read && /disqualified/i.test(evaluation.status);
      const historyResult = isDisqualified ? await historyFor(liveCard) : { rows: [], error: "" };
      const history = historyResult.rows;
      const disqualifiedEvent = history.find((row) => /disqualified/i.test(row.status));
      const disqualifiedDate = disqualifiedEvent?.date_time
        || dateFrom(valueAfterLabel(raw, ["Disqualified Date", "Disqualification Date"]));
      const quantityText = valueAfterLabel(raw, ["Quantity"]);
      const itemName = valueAfterLabel(raw, ["Items", "Item", "Product Name", "Product"])
        .replace(/^s\s*:\s*/i, "");
      const result = {
        bid_no: bidNo,
        product_type: productType(raw, itemName),
        item_name: itemName,
        quantity: Number((quantityText.match(/\d+/) || [])[0]) || null,
        department: valueAfterLabel(raw, ["Department Name And Address", "Department Name & Address", "Department"]),
        start_date: dateFrom(valueAfterLabel(raw, ["Start Date", "Bid Start Date"])),
        end_date: dateFrom(valueAfterLabel(raw, ["End Date", "Bid End Date"])),
        status: valueAfterLabel(raw, ["Bid/RA Status", "Status"]),
        technical_status: evaluation.read ? evaluation.status : valueAfterLabel(raw, ["Technical Status"]),
        evaluation_read: evaluation.read,
        evaluation_error: evaluation.error || "",
        is_disqualified: isDisqualified,
        disqualified_at: disqualifiedDate || "",
        history,
        history_sync_error: historyResult.error || "",
      };
      results.push(result);
      if (onRecord) await onRecord(result, results.length, cards.length);
    }
    return results;
  }

  function enabled(node) {
    return Boolean(node)
      && !node.disabled
      && node.getAttribute("aria-disabled") !== "true"
      && !/(^|\s)disabled(\s|$)/i.test(node.className || "");
  }

  function paginationNextLegacy() {
    const controls = queryAllSearchableRoots("button, a, [role=button], li")
      .filter((node) => visible(node) && /^next\s*(›|»|>)?$/i.test(text(node)) && enabled(node));
    const scored = controls.map((node) => {
      let parent = node.parentElement;
      let score = 0;
      for (let depth = 0; parent && depth < 5; depth += 1, parent = parent.parentElement) {
        const parentText = text(parent);
        if (/\bprev\b/i.test(parentText)) score += 5;
        if (/\b\d+\b/.test(parentText)) score += 2;
        if (/pagination|pager/i.test(parent.className || "")) score += 8;
      }
      return { node, score };
    }).sort((a, b) => b.score - a.score);
    if (scored[0]?.node) return scored[0].node;

    const activePage = queryAllSearchableRoots(".active, [aria-current=page]")
      .find((node) => visible(node) && /^\d+$/.test(text(node)));
    const page = Number(text(activePage));
    if (!page) return null;
    return queryAllSearchableRoots("button, a, [role=button], li")
      .find((node) => visible(node) && enabled(node) && text(node) === String(page + 1)) || null;
  }

  function paginationNext() {
    const controls = queryAllSearchableRoots("button, a, [role=button], li")
      .filter((node) => {
        if (!visible(node) || !enabled(node)) return false;
        const disabledParent = node.closest(".disabled, [aria-disabled=true]");
        if (disabledParent && disabledParent !== node) return false;
        const label = [
          text(node),
          node.getAttribute("aria-label"),
          node.getAttribute("title"),
          node.getAttribute("rel"),
          node.getAttribute("data-original-title"),
          typeof node.className === "string" ? node.className : "",
        ].filter(Boolean).join(" ");
        return /\bnext\b/i.test(label) || /(?:^|\s)(?:›|»|>)(?:\s|$)/.test(label);
      });

    const scored = controls.map((node) => {
      let parent = node.parentElement;
      let score = /\bnext\b/i.test(node.getAttribute("rel") || "") ? 20 : 0;
      for (let depth = 0; parent && depth < 6; depth += 1, parent = parent.parentElement) {
        const parentLabel = `${parent.id || ""} ${typeof parent.className === "string" ? parent.className : ""}`;
        if (/pagination|pager|paging/i.test(parentLabel)) score += 12;
        if (/\bprev(?:ious)?\b/i.test(text(parent))) score += 4;
        if (/\b\d+\b/.test(text(parent))) score += 2;
      }
      return { node, score };
    }).sort((a, b) => b.score - a.score);

    if (scored[0]?.node) {
      const node = scored[0].node;
      return node.matches("li") ? node.querySelector("a, button, [role=button]") || node : node;
    }

    const activePage = queryAllSearchableRoots(".active, [aria-current=page]")
      .find((node) => visible(node) && /^\d+$/.test(text(node)));
    const page = Number(text(activePage));
    if (!page) return null;
    const numericNext = queryAllSearchableRoots("button, a, [role=button], li")
      .find((node) => visible(node) && enabled(node) && text(node) === String(page + 1));
    if (!numericNext) return null;
    return numericNext.matches("li")
      ? numericNext.querySelector("a, button, [role=button]") || numericNext
      : numericNext;
  }

  function paginationNextRobust() {
    const selector = [
      "button", "a", "[role=button]", "li",
      "[ng-click*=page]", "[data-ng-click*=page]",
      "[class*=pagination-next]", "[class~=next]",
      "i[class*=angle-right]", "i[class*=chevron-right]",
      "svg[class*=angle-right]", "svg[class*=chevron-right]",
    ].join(",");
    const candidates = queryAllSearchableRoots(selector)
      .filter((node) => {
        if (node.closest("[role=dialog], .modal, .modal-dialog, .modal-content, .ngdialog-content")) return false;
        if (!visible(node) || !enabled(node) || node.closest(".disabled, [aria-disabled=true]")) return false;
        const label = [
          text(node), node.getAttribute("aria-label"), node.getAttribute("title"),
          node.getAttribute("rel"), node.getAttribute("ng-click"),
          node.getAttribute("data-ng-click"),
          typeof node.className === "string" ? node.className : "",
          node.querySelector?.("i, svg")?.getAttribute?.("class"),
        ].filter(Boolean).join(" ");
        const paginationParent = node.closest("[class*=pagination], [class*=pager], [class*=paging], nav");
        return /\bnext(?:\s+page)?\b/i.test(label)
          || /(?:select|set|goTo|change)Page\s*\(\s*(?:page|currentPage)\s*\+\s*1/i.test(label)
          || (Boolean(paginationParent) && /(?:angle|chevron)-right/i.test(label))
          || /^(?:\u203a|\u00bb|>)$/.test(text(node));
      });

    if (candidates.length) {
      candidates.sort((a, b) => {
        const score = (node) => (/pagination|pager|paging/i.test(
          `${node.id || ""} ${typeof node.className === "string" ? node.className : ""} ${node.parentElement?.className || ""}`
        ) ? 20 : 0) + (/\bnext\b/i.test(node.getAttribute("rel") || "") ? 20 : 0);
        return score(b) - score(a);
      });
      const node = candidates[0];
      const clickable = node.closest("a, button, [role=button], li") || node;
      return clickable.matches("li")
        ? clickable.querySelector("a, button, [role=button]") || clickable
        : clickable;
    }

    const activePage = queryAllSearchableRoots(".active, [aria-current=page], [class*=current-page]")
      .find((node) => visible(node) && /^\d+$/.test(text(node)));
    const page = Number(text(activePage));
    if (!page) return null;
    const numericNext = queryAllSearchableRoots(selector)
      .find((node) => visible(node) && enabled(node) && text(node) === String(page + 1));
    return numericNext?.matches("li")
      ? numericNext.querySelector("a, button, [role=button]") || numericNext
      : numericNext || null;
  }

  function mainPaginationNextState() {
    const candidates = queryAllSearchableRoots("button, a, [role=button], li")
      .filter((node) => {
        if (!visible(node)) return false;
        if (node.closest("[role=dialog], .modal, .modal-dialog, .modal-content, .ngdialog-content")) return false;
        const label = [text(node), node.getAttribute("aria-label"), node.getAttribute("title"),
          node.getAttribute("rel")].filter(Boolean).join(" ");
        return /^next\s*(?:page)?\s*$/i.test(text(node)) || /\bnext\s+page\b/i.test(label);
      })
      .map((node) => {
        const clickable = node.matches("li")
          ? node.querySelector("a, button, [role=button]") || node
          : node.closest("a, button, [role=button], li") || node;
        const parent = clickable.closest("[class*=pagination], [class*=pager], [class*=paging], nav");
        const score = (parent ? 100 : 0) + Math.max(0, clickable.getBoundingClientRect().top);
        return { node: clickable, score };
      })
      .sort((a, b) => b.score - a.score);
    if (!candidates.length) {
      const fallback = paginationNextRobust() || paginationNext() || paginationNextLegacy();
      if (!fallback) return { found: false, disabled: false, node: null };
      return {
        found: true,
        disabled: !enabled(fallback) || Boolean(fallback.closest?.(".disabled, [aria-disabled=true]")),
        node: fallback,
      };
    }
    const node = candidates[0].node;
    const disabled = !enabled(node) || Boolean(node.closest(".disabled, [aria-disabled=true]"));
    return { found: true, disabled, node };
  }

  function paginationTotalPages() {
    const paginationNodes = queryAllSearchableRoots(
      "[class*=pagination] a, [class*=pagination] button, [class*=pagination] li, "
      + "[class*=pager] a, [class*=pager] button, [class*=pager] li, [aria-label*=page i]"
    ).filter((node) => !node.closest(
      "[role=dialog], .modal, .modal-dialog, .modal-content, .ngdialog-content"
    ));
    const pages = paginationNodes
      .map((node) => Number(text(node)))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= 500);
    if (!pages.length) {
      const next = queryAllSearchableRoots("a, button, li, [role=button]")
        .find((node) => visible(node) && /^next$/i.test(text(node)));
      let parent = next?.parentElement;
      for (let depth = 0; parent && depth < 4; depth += 1, parent = parent.parentElement) {
        const nearbyPages = [...parent.querySelectorAll("a, button, li, span")]
          .map((node) => /^\d+$/.test(text(node)) ? Number(text(node)) : 0)
          .filter((value) => value > 0 && value <= 500);
        if (nearbyPages.length) pages.push(...nearbyPages);
      }
    }
    return pages.length ? Math.max(...pages) : 0;
  }

  const PAGINATION_SCOPE = "[class*=pagination], [class*=pager], [class*=paging]";
  const MODAL_SCOPE = "[role=dialog], .modal, .modal-dialog, .modal-content, .ngdialog-content";

  function activePageNumber() {
    const node = queryAllSearchableRoots(
      "[class*=pagination] .active, [class*=pagination] .current, [class*=pagination] [aria-current=page], "
      + "[class*=pager] .active, [class*=pager] .current, [class*=pager] [aria-current=page]"
    ).find((item) => !item.closest(MODAL_SCOPE) && visible(item) && /^\d+$/.test(text(item)));
    return node ? Number(text(node)) : 0;
  }

  function paginationPageLinks() {
    return queryAllSearchableRoots("a, button, [role=button]")
      .filter((node) => (node.closest(PAGINATION_SCOPE) || /^#page-\d+$/i.test(node.getAttribute("href") || ""))
        && !node.closest(MODAL_SCOPE)
        && visible(node) && enabled(node)
        && !node.closest(".disabled, .active, [aria-current=page]"))
      .map((node) => ({ node, page: /^\d+$/.test(text(node)) ? Number(text(node)) : 0 }))
      .filter((item) => item.page > 0 && item.page <= 500);
  }

  // Ask GeM's own pager (in the page's MAIN world) to select a page directly.
  function requestBridgePageSelect(page) {
    const requestId = `page-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let selected = false;
    const acknowledge = (event) => {
      if (event.detail?.requestId === requestId) selected = Boolean(event.detail.selected);
    };
    document.addEventListener("acxxel-gem-page-selected", acknowledge);
    try {
      document.dispatchEvent(new CustomEvent("acxxel-gem-select-page", { detail: { requestId, page } }));
    } finally {
      document.removeEventListener("acxxel-gem-page-selected", acknowledge);
    }
    return selected;
  }

  // Jump from the current list page to a saved page without stepping through
  // every page with Next: first GeM's pager API, then the numbered page link
  // nearest to the target (1 -> 5 -> 6 instead of 1 -> 2 -> ... -> 6).
  async function jumpToSavedPage(page, startSignature, onStep = null) {
    let signature = startSignature;
    let current = activePageNumber() || 1;
    const settle = async (expectedPage) => {
      const cards = await waitForBidCards(60000);
      const nextSignature = cards.map((item) => item.bidNo).join("|");
      if (nextSignature) signature = nextSignature;
      current = activePageNumber() || expectedPage;
    };
    if (current === page) return { restored: true, signature, current };

    await onStep?.(current, page);
    await waitForGemRemoteActionSlot(5000);
    if (requestBridgePageSelect(page) && await waitForPageChange(signature, 20000)) {
      await settle(page);
      if (current === page) return { restored: true, signature, current, method: "pager" };
    }

    for (let hop = 0; hop < 80 && current !== page; hop += 1) {
      stopIfRequested();
      if (gemTransientErrorMessage()) break;
      const best = paginationPageLinks()
        .filter((item) => item.page !== current)
        .sort((a, b) => Math.abs(a.page - page) - Math.abs(b.page - page))[0];
      if (!best || Math.abs(best.page - page) >= Math.abs(current - page)) break;
      await onStep?.(current, best.page);
      await waitForGemRemoteActionSlot(5000);
      activateControl(best.node);
      if (!await waitForPageChange(signature, 20000)) break;
      await settle(best.page);
    }
    return { restored: current === page, signature, current, method: "page-links" };
  }

  async function waitForPageChange(signature, timeout = 12000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      stopIfRequested();
      if (gemTransientErrorMessage()) return false;
      await sleep(350);
      const nextSignature = currentCards().map((item) => item.bidNo).join("|");
      if (nextSignature && nextSignature !== signature) return true;
    }
    return false;
  }

  async function advancePage(signature, page) {
    // Only the real seller-list Next control decides when scanning ends. A
    // missing control or repeated page is an error, never a successful finish.
    // Never steal focus from the user's current tab. Chrome keeps the GeM DOM
    // available in a background tab, so pagination should remain unobtrusive.
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    await sleep(500);
    if (gemTransientErrorMessage()) return { advanced: false, reason: "gem-server-error" };
    let lastReason = "missing";
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      let state = mainPaginationNextState();
      if (!state.found) {
        lastReason = "missing";
        const renderDeadline = Date.now() + (attempt === 1 ? 10000 : 3000);
        while (!state.found && Date.now() < renderDeadline) {
          stopIfRequested();
          if (gemTransientErrorMessage()) return { advanced: false, reason: "gem-server-error" };
          await sleep(500);
          state = mainPaginationNextState();
        }
        if (!state.found) continue;
      }
      if (state.disabled) {
        await sleep(1500);
        const confirmed = mainPaginationNextState();
        if (confirmed.found && confirmed.disabled && paginationTotalPages() <= page) {
          return { advanced: false, reason: "end" };
        }
        lastReason = "temporarily disabled";
        continue;
      }
      lastReason = "stuck";
      const next = state.node;
      next.scrollIntoView({ block: "center", inline: "center" });
      await waitForGemRemoteActionSlot(5000);
      if (gemTransientErrorMessage()) return { advanced: false, reason: "gem-server-error" };
      activateControl(next);
      if (await waitForPageChange(signature, 15000)) return { advanced: true };
    }
    // GeM occasionally leaves the Next control visually enabled while its
    // Angular click handler stops responding. Its seller list also supports a
    // page hash, so use that as a final navigation fallback and still verify
    // that the bid-card signature actually changed.
    const currentHash = `#page-${page}`;
    const targetHash = `#page-${page + 1}`;
    for (let routeAttempt = 1; routeAttempt <= 1; routeAttempt += 1) {
      // A failed Angular request can leave the address at the target page while
      // the old cards remain rendered. Reset the URL without dispatching an
      // extra hashchange, then emit exactly one verified target-page request.
      if (location.hash.toLowerCase() === targetHash) {
        history.replaceState(history.state, "", `${location.pathname}${location.search}${currentHash}`);
        await sleep(250);
      }
      await waitForGemRemoteActionSlot(5000);
      location.hash = targetHash;
      if (await waitForPageChange(signature, 20000)) return { advanced: true };
    }
    return { advanced: false, reason: lastReason };
  }

  // GeM's "Something went wrong, please try again after some time" banner can
  // also appear while a page's bid cards are still rendering, not just while
  // clicking Next. Reload the tab and resume at the same page, mirroring the
  // pagination recovery below, instead of spinning until an unrecoverable
  // timeout ends the whole scan.
  async function reloadAndResumeDisqualifiedScan(state, message) {
    sessionStorage.setItem("acxxelDisqualifiedResume", JSON.stringify({ ...state, savedAt: Date.now() }));
    await progress("recovering", message, {
      page: state.page, saved: state.saved, rejected: state.rejected, checked: state.checked, pending: state.pending,
    });
    // Give GeM a short cooldown before rebuilding the same filtered page. An
    // immediate reload after its generic error tends to reproduce the error.
    await sleep(Math.min(8000 + Number(state.serverRecoveryAttempts || 0) * 5000, 30000));
    location.reload();
    await new Promise(() => {});
  }

  const MAX_PAGINATION_RECOVERY_ATTEMPTS = 4;
  const MAX_SERVER_RECOVERY_ATTEMPTS = 8;

  async function advancePageWithRecovery(signature, page, onRetry) {
    let recoveryAttempt = 0;
    while (recoveryAttempt < MAX_PAGINATION_RECOVERY_ATTEMPTS) {
      stopIfRequested();
      const advance = await advancePage(signature, page);
      if (advance.advanced || advance.reason === "end") return advance;
      // The banner prevents advancePage from issuing any request. Repeating
      // that guard cannot recover the tab; let the caller rebuild the list.
      if (advance.reason === "gem-server-error") {
        const error = new Error(`GeM server error blocked pagination on page ${page}.`);
        error.reason = advance.reason;
        throw error;
      }
      recoveryAttempt += 1;
      await onRetry?.(recoveryAttempt, advance.reason);

      // A GeM response may arrive after the click timeout. Check for that late
      // response before clicking Next again, otherwise a second click could
      // accidentally skip a page.
      if (await waitForPageChange(signature, 30000)) {
        return { advanced: true, recovered: true };
      }
      await sleep(Math.min(5000 + recoveryAttempt * 2000, 30000));
    }
    throw new Error(
      `GeM pagination could not recover after page ${page} after ${MAX_PAGINATION_RECOVERY_ATTEMPTS} attempts. `
        + "The scan is incomplete; already saved bids are retained. Refresh the GeM Bid List and start the scan again.",
    );
  }

  async function scanAllPages(resume = null) {
    if (syncing) throw new Error("A GeM bid sync is already running in this tab.");
    syncing = true;
    activeScanType = "disqualified";
    disqualifiedPending = [];
    stopRequested = false;
    pauseRequested = false;
    let page = Number(resume?.page || 1);
    let saved = Number(resume?.saved || 0);
    let created = Number(resume?.created || 0);
    let updated = Number(resume?.updated || 0);
    let rejected = Number(resume?.rejected || 0);
    let checked = Number(resume?.checked || 0);
    let totalPages = Number(resume?.totalPages || 0);
    let serverRecoveryAttempts = Number(resume?.serverRecoveryAttempts || 0);
    const pending = new Map((resume?.pending || []).map((item) => [item.bidNo, item]));
    const processed = new Set(resume?.processedBidNos || []);
    const seen = new Set(resume?.seenBidNos || []);
    const visited = new Set();
    try {
      await progress("running", resume
        ? `Restoring the disqualified-bid scan at page ${page} after GeM stopped rendering pagination...`
        : "Preparing the complete GeM bid list...", { page, saved, rejected, checked, pending: [...pending.values()] });
      // Always start from the complete evaluated-bid listing and page 1. Leaving
      // this to the user's current UI state silently syncs only a filtered subset.
      await applyCompleteBidListFilter();
      await sleep(1500);
      if (page > 1) {
        // A forced location.reload() cold-boots GeM's whole Angular app, which is
        // slower than a normal hash-based page change, so give it a longer window
        // than the routine per-page wait. Page 1 failing to render here is not
        // always accompanied by GeM's "something went wrong" banner text (it can
        // just be a slow/incomplete boot), so retry regardless of that match.
        const firstPageCards = await waitForBidCards(60000, async (seconds) => {
          await progress("running", `Restoring page ${page}: waiting for GeM page 1 to load (${seconds}s)...`, {
            page, saved, rejected, checked,
          });
        });
        const firstPageSignature = firstPageCards.map((item) => item.bidNo).join("|");
        if (!firstPageSignature) {
          if (serverRecoveryAttempts < MAX_SERVER_RECOVERY_ATTEMPTS) {
            const transientError = gemTransientErrorMessage();
            await reloadAndResumeDisqualifiedScan({
              page, saved, created, updated, rejected, checked, totalPages,
              serverRecoveryAttempts: serverRecoveryAttempts + 1,
              processedBidNos: [...processed], seenBidNos: [...seen], pending: [...pending.values()],
            }, transientError
              ? `GeM showed "${transientError}" while restoring page ${page}. Reapplying the required filters and retrying the same page automatically (${serverRecoveryAttempts + 1}/${MAX_SERVER_RECOVERY_ATTEMPTS})...`
              : `GeM's filtered bid list did not finish loading while restoring page ${page}. Reapplying the required filters and retrying the same page automatically (${serverRecoveryAttempts + 1}/${MAX_SERVER_RECOVERY_ATTEMPTS})...`);
          }
          throw new Error("GeM page 1 did not load while restoring the interrupted scan.");
        }
        // Jump straight to the saved page (pager API / numbered page links)
        // instead of walking 1 -> 2 -> ... -> N with Next.
        const jump = await jumpToSavedPage(page, firstPageSignature, async (fromPage, toPage) => {
          await progress("running", `Jumping directly to saved page ${page} (page ${fromPage} -> ${toPage})...`, {
            page, saved, rejected, checked, pending: [...pending.values()],
          });
        });
        let restored = jump.restored;
        let restoreFailure = "direct page jump did not render the saved page";
        let jumpPage = jump.current || 1;
        let jumpSignature = jump.signature || firstPageSignature;
        if (!restored && !gemTransientErrorMessage()) {
          const targetHash = `#page-${page}`;
          if (location.hash.toLowerCase() === targetHash) {
            history.replaceState(history.state, "", `${location.pathname}${location.search}#page-${jumpPage}`);
          }
          await waitForGemRemoteActionSlot(5000);
          location.hash = targetHash;
          restored = await waitForPageChange(jumpSignature, 20000);
          if (!restored) restoreFailure = "direct page route did not render new cards";
        }
        // Some GeM sessions update #page-N without asking Angular to replace
        // the cards. Fall back to the real Next control and fast-forward from
        // wherever the jump stopped, without processing intermediate pages.
        if (!restored && !gemTransientErrorMessage()) {
          history.replaceState(history.state, "", `${location.pathname}${location.search}#page-${jumpPage}`);
          let cursorPage = jumpPage;
          let cursorSignature = jumpSignature;
          try {
            while (cursorPage < page) {
              stopIfRequested();
              await progress(
                "running",
                `Restoring saved page ${page}: moving through GeM pagination (${cursorPage} of ${page}) without rescanning earlier pages...`,
                { page, saved, rejected, checked, pending: [...pending.values()] },
              );
              const advance = await advancePageWithRecovery(cursorSignature, cursorPage);
              if (!advance.advanced) {
                restoreFailure = `GeM pagination ended at page ${cursorPage} before saved page ${page}`;
                break;
              }
              cursorPage += 1;
              const restoredCards = await waitForBidCards(60000);
              const nextSignature = restoredCards.map((item) => item.bidNo).join("|");
              if (!nextSignature || nextSignature === cursorSignature) {
                restoreFailure = `GeM did not render cards for recovery page ${cursorPage}`;
                break;
              }
              cursorSignature = nextSignature;
            }
            restored = cursorPage === page && Boolean(cursorSignature);
          } catch (error) {
            restoreFailure = error.message || "pagination fast-forward failed";
          }
        }
        if (!restored) {
          if (serverRecoveryAttempts < MAX_SERVER_RECOVERY_ATTEMPTS) {
            await reloadAndResumeDisqualifiedScan({
              page, saved, created, updated, rejected, checked, totalPages,
              serverRecoveryAttempts: serverRecoveryAttempts + 1,
              processedBidNos: [...processed], seenBidNos: [...seen], pending: [...pending.values()],
            }, `GeM did not render saved page ${page} (${restoreFailure}). Reapplying the required filters and retrying page ${page} automatically (${serverRecoveryAttempts + 1}/${MAX_SERVER_RECOVERY_ATTEMPTS})...`);
          }
          throw new Error(`GeM did not restore seller-list page ${page} after an automatic reload.`);
        }
        await sleep(1500);
      }
      while (true) {
        stopIfRequested();
        await waitWhilePaused({ page, saved, rejected, checked });
        await progress("running", `Waiting for bid cards from the complete GeM list... ${disqualifiedSaveSummary(saved, created, updated, rejected)}.`, { page, saved, rejected, checked });
        const cards = await waitForBidCards(180000, async (seconds) => {
          await progress(
            "running",
            `Waiting for GeM bid cards to load (${seconds}s)...`,
            { page, saved, checked },
          );
        });
        if (!cards.length) {
          const transientError = gemTransientErrorMessage();
          if (serverRecoveryAttempts < MAX_SERVER_RECOVERY_ATTEMPTS) {
            await reloadAndResumeDisqualifiedScan({
              page, saved, created, updated, rejected, checked, totalPages,
              serverRecoveryAttempts: serverRecoveryAttempts + 1,
              processedBidNos: [...processed], seenBidNos: [...seen], pending: [...pending.values()],
            }, transientError
              ? `GeM showed "${transientError}" while loading page ${page}. Reapplying the required filters and retrying page ${page} automatically (${serverRecoveryAttempts + 1}/${MAX_SERVER_RECOVERY_ATTEMPTS})...`
              : `GeM stopped rendering filtered cards on page ${page}. Reapplying the required filters and retrying page ${page} automatically (${serverRecoveryAttempts + 1}/${MAX_SERVER_RECOVERY_ATTEMPTS})...`);
          }
          throw new Error(
            `GeM Bid List opened, but its bid cards did not load within 180 seconds. ${bidPageDiagnostics()}`,
          );
        }
        // Rendering old cards is not recovery: keep the budget until Next
        // actually succeeds, otherwise a persistent banner loops forever.
        const signature = cards.map((item) => item.bidNo).join("|");
        totalPages = Math.max(totalPages, paginationTotalPages());
        if (visited.has(signature)) {
          throw new Error(`GeM returned an already-scanned bid page at page ${page}; refusing to mark a partial scan complete.`);
        }
        visited.add(signature);
        // Resolve every card on this page before allowing pagination. Retries
        // reacquire live cards because GeM replaces them when modals close.
        // Read each GeM card only once per pass. Reopening the same result/history
        // three times in quick succession was throttling GeM and removing the
        // seller-list pagination. API confirmation still has its own retries.
        for (let attempt = 1; attempt <= 1; attempt += 1) {
          await extractPage(async (result, recordNumber, totalRecords) => {
            if (processed.has(result.bid_no)) return;
            if (!seen.has(result.bid_no)) { seen.add(result.bid_no); checked += 1; }
            pending.set(result.bid_no, { bidNo: result.bid_no, page, attempts: attempt, reason: "Awaiting save confirmation" });
            try {
              stopIfRequested();
              await waitWhilePaused({ page, saved, rejected, checked });
              if (!result.evaluation_read) {
                throw new Error(result.evaluation_error || "Technical status could not be read; bid has not been classified as qualified or skipped.");
              }
              if (!result.is_disqualified) {
                processed.add(result.bid_no);
                pending.delete(result.bid_no);
                await progress(
                  "running",
                  `Checked ${result.bid_no} (${recordNumber}/${totalRecords} on page ${page}).`,
                  { page, saved, rejected, checked },
                );
                return;
              }
              if (result.history_sync_error || !result.disqualified_at) {
                throw new Error(`Could not confirm evaluation history for ${result.bid_no}: ${result.history_sync_error || "disqualification date was not read"}. This bid has NOT been classified as old. Reopen the GeM tab and retry the scan.`);
              }
              // Only this calendar year is synced; there is no monthly cutoff.
              if (!isValidDisqualificationDate(result.disqualified_at)) {
                rejected += 1;
                processed.add(result.bid_no);
                pending.delete(result.bid_no);
                await progress(
                  "running",
                  `Not saving ${result.bid_no}: disqualification date is outside the current year, invalid, or in the future.`,
                  { page, saved, rejected, checked },
                );
                return;
              }
              await progress(
                "running",
                `Saving disqualified bid ${result.bid_no}.`,
                { page, saved, rejected, checked },
              );
              let response = null;
              for (let saveAttempt = 1; saveAttempt <= 3; saveAttempt += 1) {
                response = await runtimeMessage({
                  type: "SAVE_GEM_BID_RESULTS",
                  results: [result],
                });
                if (response.saved === 1 && response.frontendVisible) break;
                if (saveAttempt < 3) await sleep(saveAttempt * 2000);
              }
              if (response.saved !== 1 || !response.frontendVisible) {
                const reason = (response.rejections || []).map((item) => item.reason).join(", ");
                throw new Error(`${result.bid_no}: save not confirmed by dashboard API${reason ? ` (${reason})` : ""}.`);
              }
              processed.add(result.bid_no);
              pending.delete(result.bid_no);
              saved += response.saved || 0;
              created += response.created || 0;
              updated += response.updated || 0;
              rejected += response.rejected || 0;
              await progress(
                "running",
                `Completed ${result.bid_no} (${recordNumber}/${totalRecords} on page ${page}).`,
                { page, saved, rejected, checked },
              );
            } catch (error) {
              if (error.code === "GEM_SYNC_STOPPED") throw error;
              pending.set(result.bid_no, { bidNo: result.bid_no, page, attempts: attempt, reason: error.message });
              await progress("running", `Retry required for ${result.bid_no}: ${error.message}`, { page, saved, rejected, checked, pending: [...pending.values()] });
            }
          }, processed);
          // A card disappearing during a GeM refresh must not silently disappear
          // from the page's accounting either.
          for (const card of cards) {
            if (!processed.has(card.bidNo) && !pending.has(card.bidNo)) {
              pending.set(card.bidNo, { bidNo: card.bidNo, page, attempts: attempt, reason: "Card disappeared during page refresh" });
            }
          }
          const pagePending = [...pending.values()].filter((item) => item.page === page);
          if (!pagePending.length) break;
          if (attempt < 1) await sleep(1500 * attempt);
        }
        const pagePending = [...pending.values()].filter((item) => item.page === page);
        const firstPending = pagePending[0];
        const pendingDetail = firstPending
          ? ` First unresolved: ${firstPending.bidNo}: ${String(firstPending.reason || "unknown reason").slice(0, 240)}.`
          : "";
        await progress("running", `Scanned page ${page}. Checked ${checked}; ${disqualifiedSaveSummary(saved, created, updated, rejected)}. ${pending.size} unresolved bids retained for retry; continuing remaining pages.${pendingDetail}`, { page, saved, rejected, checked, pending: [...pending.values()] });
        let advance;
        // GeM rate-limits rapid page changes with its generic server-error
        // banner. Pause 3-5s (with jitter) before each Next click.
        await sleep(3000 + Math.floor(Math.random() * 2000));
        stopIfRequested();
        try {
          advance = await advancePageWithRecovery(signature, page, async (attempt, reason) => {
            await progress(
              "running",
              `GeM pagination on page ${page} is ${reason}; retrying in the same tab before any reload (${attempt}/${MAX_PAGINATION_RECOVERY_ATTEMPTS})...`,
              { page, saved, rejected, checked, pending: [...pending.values()] },
            );
          });
        } catch (paginationError) {
          if (paginationError.code === "GEM_SYNC_STOPPED") throw paginationError;
          const retryCurrentPage = paginationError.reason === "gem-server-error" && pagePending.length > 0;
          const resumePage = retryCurrentPage ? page : page + 1;
          const nextServerRecoveryAttempts = serverRecoveryAttempts + 1;
          if (nextServerRecoveryAttempts <= MAX_SERVER_RECOVERY_ATTEMPTS) {
            await reloadAndResumeDisqualifiedScan({
              page: resumePage,
              saved,
              created,
              updated,
              rejected,
              checked,
              totalPages,
              serverRecoveryAttempts: nextServerRecoveryAttempts,
              processedBidNos: [...processed],
              seenBidNos: [...seen],
              pending: [...pending.values()],
            }, `GeM pagination failed on page ${page}. Cooling down, reloading the list and resuming at page ${resumePage} (${nextServerRecoveryAttempts}/${MAX_SERVER_RECOVERY_ATTEMPTS})...`);
          }
          throw paginationError;
        }
        if (!advance.advanced) {
          if (totalPages > page) throw new Error(`Scan incomplete: stopped at page ${page}, but pagination showed at least ${totalPages} pages.`);
          break;
        }
        page += 1;
        serverRecoveryAttempts = 0;
      }
      if (pending.size) {
        throw new Error(`All available pages scanned, but ${pending.size} bids still need retry: ${[...pending.values()].map((item) => `${item.bidNo} (page ${item.page}): ${item.reason}`).join(" | ")}. Saved bids are retained; scan is not complete.`);
      }
      await progress(
        "complete",
        `Full GeM scan complete. Checked ${checked} bids; ${disqualifiedSaveSummary(saved, created, updated, rejected)}.`,
        { page, saved, rejected, checked },
      );
      sessionStorage.removeItem("acxxelDisqualifiedResume");
    } catch (error) {
      if (error.code === "GEM_SYNC_STOPPED") {
        await progress("stopped", `GeM bid sync stopped by user. ${disqualifiedSaveSummary(saved, created, updated, rejected)}.`, { page, saved, rejected, checked, pending: [...pending.values()] });
        sessionStorage.removeItem("acxxelDisqualifiedResume");
        return;
      }
      sessionStorage.removeItem("acxxelDisqualifiedResume");
      await progress("failed", error.message || "GeM bid sync failed.", { page, saved, rejected, checked, pending: [...pending.values()] });
      error.syncProgressReported = true;
      throw error;
    } finally {
      syncing = false;
      activeScanType = "";
    }
  }

  const OPPORTUNITY_PRODUCTS = [
    ["desktop", /^entry\s+and\s+mid\s+level\s+deskto(?:p(?:\s+com(?:p(?:uter)?)?)?)?$/i],
    ["desktop", /^high\s+end\s+deskto(?:p(?:\s+com(?:p(?:uter)?)?)?)?$/i],
    ["aio", /^all\s+in\s+one\s+pc(?:\s*\(v2\))?$/i],
    ["workstation", /^fixed\s+computer\s+workstation(?:\s*\(v\d+\))?$/i],
    ["toner", /^toner\s+cartridges?\s*(?:\/|and)\s*ink\s+cartridges?$/i],
    ["printer", /^a4\b(?=[\s\S]*(?:multifunction|\bmfp\b))(?=[\s\S]*(?:printer|\bp\b))[\s\S]*$/i],
  ];
  const OPPORTUNITY_CATEGORIES = [
    ["Entry/Mid Desktop", "Entry and Mid Level Desktop", /entry\s+and\s+mid.*desktop/i],
    ["High-End Desktop", "High End Desktop", /high\s+end.*desktop/i],
    ["Workstation", "Fixed Computer Workstation", /fixed\s+computer\s+workstation/i],
    ["Printer", "A4 and Legal Size Multifunction Printer", /a4\s+and\s+legal\s+size\s+multifunction\s+printer/i],
    ["Toner", "Toner Cartridges / Ink Cartridges", /toner\s+cartridges?\s*(?:\/|and)\s*ink\s+cartridges?/i],
    ["AIO", "All in One PC", /all\s+in\s+one\s+pc/i],
  ];

  // Printer bids are received at any quantity and however far off they end;
  // Workstation bids at any quantity. Every other rule still applies.
  const NO_MINIMUM_QUANTITY_PRODUCTS = new Set(["printer", "workstation"]);
  const NO_DAY_LIMIT_PRODUCTS = new Set(["printer"]);

  // A Printer bid whose Printer Technology is only Inkjet is not received;
  // one that also allows Electrophotography/Xerography (Laser/LED) is kept,
  // and so is one whose technology could not be read.
  function inkjetOnlyPrinter(flat) {
    const values = [...flat.matchAll(/Print(?:er|ing)?\s+Technology\s*:?\s*(.{0,120})/gi)].map((match) => match[1]);
    if (!values.length) return false;
    const text = values.join(" ");
    return /ink\s*-?\s*jet/i.test(text) && !/laser|\bled\b|electro\s*-?\s*photo|xerograph/i.test(text);
  }

  function opportunityFromText(bidNo, raw, cardStartDate = "", cardQuantity = 0) {
    const flat = String(raw || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
    const bounded = (start, end) => flat.match(new RegExp(`${start}\\s*:?\\s*(.+?)(?=${end})`, "i"))?.[1]?.trim() || "";
    const quantity = Number(flat.match(/\bTotal\s+Quantity\s*:?\s*(\d+)\b/i)?.[1]
      || cardQuantity
      || flat.match(/\bQuantity\s*:?\s*(\d+)\b/i)?.[1] || 0);
    // A bid whose quantity could not be read is rejected rather than risk
    // saving a small one; the minimum itself depends on the product (below).
    if (!quantity) return { reject: "quantity_unread" };
    const itemName = bounded(
      "Item\\s+Category",
      "(?:Minimum\\s+Average|Years?\\s+of\\s+Past|MSE\\s+Relaxation|Startup\\s+Relaxation|Bidder\\s+Turnover|$)"
    ) || bounded("Items?", "(?:Quantity|Department|Start\\s+Date|End\\s+Date|$)");
    const englishItemName = itemName.split(/[\u0900-\u097f]/, 1)[0];
    if (
      /(?:\(\s*PAC\s*Only\s*\)|\bPAC\s*Only\b)/i.test(englishItemName)
      || /\bIs\s+PAC\s*:?\s*(?:Yes|True)\b/i.test(flat)
    ) return { reject: "pac" };
    const qMarkers = [...englishItemName.matchAll(/\(Q\d+\)/gi)];
    const cleanItemName = (qMarkers.length ? englishItemName.slice(0, qMarkers.at(-1).index + qMarkers.at(-1)[0].length) : englishItemName)
      .replace(/\s*\(Q\d+\)\s*/gi, "")
      .replace(/\s*,\s*/g, ", ")
      .trim().replace(/^,|,$/g, "").trim();
    const categories = cleanItemName.split(/\s*,\s*/).map((value) => value.trim()).filter(Boolean);
    const matchedProducts = categories.map((category) => (
      OPPORTUNITY_PRODUCTS.find(([, pattern]) => pattern.test(category)) || null
    ));
    // Only single-product bids are received. A bunch bid (more than one item
    // category) is rejected even when every category is supported.
    if (!categories.length || matchedProducts.some((product) => !product)) return { reject: "product" };
    if (categories.length > 1) return { reject: "bunch" };
    const product = matchedProducts[0];
    // Bids below 5 units are not received, except Printer and Workstation.
    if (quantity < 5 && !NO_MINIMUM_QUANTITY_PRODUCTS.has(product[0])) return { reject: "quantity" };
    if (product[0] === "printer" && inkjetOnlyPrinter(flat)) return { reject: "inkjet" };
    const deliveryText = bounded(
      "Consignees?/Reporting\\s+Officer\\s+and\\s+Quantity",
      "(?:Special\\s+terms|Buyer\\s+Added|Technical\\s+Specifications|$)"
    ) || bounded("(?:Consignee|Delivery)\\s+Address", "(?:Quantity|Delivery\\s+Days|$)");
    const pins = deliveryText.match(/\b[1-9]\d{5}\b/g) || [];
    const normalizedDelivery = deliveryText.toLowerCase();
    if (pins.length) {
      if (pins.some((pin) => ACXXEL_BLOCKED_DELIVERY_PINS.has(pin))) return { reject: "location" };
    } else {
      const blockedDistrict = [...ACXXEL_BLOCKED_DELIVERY_DISTRICTS].some((district) => normalizedDelivery.includes(district));
      if (blockedDistrict) return { reject: "location" };
      const blockedState = [...ACXXEL_BLOCKED_DELIVERY_STATES].some((state) => normalizedDelivery.includes(state));
      if (blockedState) return { reject: "location" };
    }
    const indianDateTime = "(\\d{2}[-/]\\d{2}[-/]\\d{4}(?:\\s+\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:AM|PM)?)?)";
    let endDate = dateFrom(flat.match(new RegExp(`Bid\\s+End\\s+Date(?:/Time)?\\s*:?\\s*${indianDateTime}`, "i"))?.[1])
      || dateFrom(flat.match(new RegExp(`(?:Bid\\s+End|End\\s+Date)[^\\d]{0,60}${indianDateTime}`, "i"))?.[1]);
    const validityDays = Number(flat.match(/Bid\s+Offer\s+Validity\s*\(From\s+End\s+Date\)\s*:?\s*(\d+)\s*\(?Days?/i)?.[1] || 0);
    if (!endDate) {
      const futureDates = [...flat.matchAll(/\b\d{2}[-/]\d{2}[-/]\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?/g)]
        .map((match) => dateFrom(match[0]))
        .filter(Boolean)
        .sort((a, b) => Date.parse(a) - Date.parse(b));
      endDate = futureDates.find((value) => Date.parse(value) > Date.now()) || "";
    }
    const endTime = Date.parse(endDate || "");
    if (endTime && endTime <= Date.now()) return { reject: "expired" };
    if (!endTime && !validityDays) return { reject: "date" };
    if (
      !NO_DAY_LIMIT_PRODUCTS.has(product[0])
      && (validityDays > 120 || (endTime && endTime - Date.now() > 120 * 86400000))
    ) return { reject: "over120" };
    // The seller-list card is the authoritative current Start Date, including
    // corrigendum changes. Several valid GeM PDFs render their Dated value as
    // glyphs that PyMuPDF cannot extract, so use the PDF value only as a
    // fallback when the card itself did not expose a date.
    const bidDate = cardStartDate
      || dateFrom(flat.match(new RegExp(`(?:Dated|Bid\\s+Start\\s+Date(?:/Time)?)\\s*:?\\s*${indianDateTime}`, "i"))?.[1]);
    if (!bidDate) return { reject: "date" };
    const now = new Date();
    const lastAllowedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (Date.parse(bidDate) >= lastAllowedDate.getTime()) {
      return { reject: "date" };
    }
    return {
      eligible: true,
      bid_no: bidNo,
      bid_date: bidDate,
      end_date: endDate,
      product_name: cleanItemName.slice(0, 500),
      product_type: product[0],
      quantity,
      offer_validity_days: validityDays || null,
      department: bounded("Department\\s+Name", "(?:Organisation|Office|Contact|Buyer|Item\\s+Category|$)"),
      delivery_pincode: pins[0] || "",
    };
  }

  function bidDetailUrl(bidNo, card) {
    const link = [...card.querySelectorAll("a[href]")].find((node) => (
      normalizeBidNo(text(node)) === bidNo || text(node).includes(bidNo)
    ));
    if (!link) return "";
    try { return new URL(link.getAttribute("href"), location.href).href; } catch { return ""; }
  }

  async function opportunityFromBidDetail(bidNo, card) {
    const url = bidDetailUrl(bidNo, card);
    if (!url || !/^https:\/\/[^/]*gem\.gov\.in\//i.test(url)) return { reject: "detail" };
    const cardStartDate = opportunityCardStartDate(card);
    let response;
    try {
      await waitForGemRemoteActionSlot();
      response = await runtimeMessage({ type: "READ_GEM_BID_DETAIL", url, bidNo });
    } catch (error) {
      const message = String(error?.message || error);
      if (/HTTP\s+(?:401|403)\b/i.test(message)) {
        throw new Error("GeM session expired or access was denied. Please log in to GeM again.");
      }
      // One unreadable or non-PDF document skips only that bid; it is not
      // marked as read, so the next scan tries it again.
      if (/no tab with id|tab.*(?:closed|not found)|invalid tab id|GeM bid document (?:returned HTTP|could not be read|is not a PDF|is larger than)|failed to fetch|networkerror/i.test(message)) {
        return { reject: "detail" };
      }
      throw error;
    }
    if (!response.detailText) return { reject: "detail" };
    const opportunity = opportunityFromText(bidNo, response.detailText, cardStartDate, opportunityCardQuantity(card));
    if (opportunity?.eligible) {
      opportunity.pdf_url = url;
      // Prefer the card's End Date: after a corrigendum it is the current one.
      const cardEndDate = opportunityCardEndDate(card);
      if (cardEndDate) {
        if (Date.parse(cardEndDate) <= Date.now()) return { reject: "expired" };
        opportunity.end_date = cardEndDate;
      }
    }
    return opportunity;
  }

  function corrigendumControl(card) {
    return [...card.querySelectorAll("a, button, [role=button], [ng-click], [data-ng-click]")]
      .filter(visible)
      .find((node) => /^view\s+corrigendum$/i.test(text(node))) || null;
  }

  function openCorrigendumModal() {
    return [...document.querySelectorAll("[role=dialog], .modal.show, .modal.in, .bootbox, .ngdialog-content, .modal-dialog")]
      .filter(visible)
      .find((node) => text(node) && !/reason for technical evaluation/i.test(text(node))) || null;
  }

  async function closeCorrigendumModal(modal) {
    const close = [...modal.querySelectorAll("button, a, [role=button], .close, [data-dismiss], [data-bs-dismiss]")]
      .filter(visible)
      .find((node) => /^(?:ok|close|x|×)$/i.test(text(node))
        || node.hasAttribute("data-dismiss") || node.hasAttribute("data-bs-dismiss")
        || /\bclose\b/i.test(node.getAttribute("aria-label") || ""));
    if (close) activateControl(close);
    const end = Date.now() + 5000;
    while (Date.now() < end) {
      if (!openCorrigendumModal()) return true;
      await sleep(150);
    }
    return false;
  }

  // Clicks the card's View Corrigendum link. GeM answers either with "No
  // corrigendum found for this bid" or with the corrigendum details. Returns
  // has_corrigendum: null when the popup could not be read, so a flaky read
  // never changes what the dashboard already shows.
  async function corrigendumFor(bidNo, card) {
    const unknown = { has_corrigendum: null };
    const liveCard = currentCards().find((item) => item.bidNo === bidNo)?.card || card;
    const control = corrigendumControl(liveCard);
    if (!control) return unknown;
    const stale = openCorrigendumModal();
    if (stale && !await closeCorrigendumModal(stale)) return unknown;
    await waitForGemRemoteActionSlot();
    if (gemTransientErrorMessage()) return unknown;
    activateControl(control);
    let lastBody = "";
    let stableChecks = 0;
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      stopIfRequested();
      await sleep(250);
      if (gemTransientErrorMessage()) break;
      const modal = openCorrigendumModal();
      if (!modal) continue;
      const body = text(modal);
      if (/no\s+corrigendum\s+found/i.test(body)) {
        await closeCorrigendumModal(modal);
        return { has_corrigendum: false };
      }
      // The details are loaded after the popup opens; read them only once
      // the popup text has stopped changing.
      stableChecks = body === lastBody && !/loading|please\s+wait/i.test(body) ? stableChecks + 1 : 0;
      lastBody = body;
      if (stableChecks >= 3) {
        await closeCorrigendumModal(modal);
        return { has_corrigendum: true };
      }
    }
    const leftOpen = openCorrigendumModal();
    if (leftOpen) await closeCorrigendumModal(leftOpen);
    return unknown;
  }

  function bidSearchInput() {
    return queryAllSearchableRoots('input[type="text"], input[type="search"], input:not([type])')
      .filter((input) => visible(input) && !input.disabled && !input.readOnly)
      .filter((input) => !input.closest(
        "[role=dialog], .modal, .ui-select-container, .multiSelect, .dropdown-menu, [class*=multiselect]"
      ))
      .find((input) => /search|bid\s*(?:no|number)|keyword/i.test([
        input.placeholder, input.name, input.id,
        input.getAttribute("aria-label"), input.getAttribute("ng-model"),
      ].filter(Boolean).join(" "))) || null;
  }

  async function submitBidSearch(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await waitForGemRemoteActionSlot();
    const group = input.closest("form, .input-group, [class*=search]") || input.parentElement;
    const button = [...(group?.querySelectorAll("button, [role=button], a, i, span") || [])]
      .filter(visible)
      .find((node) => /search/i.test([
        text(node), node.getAttribute("title"), node.getAttribute("aria-label"),
        typeof node.className === "string" ? node.className : node.className?.baseVal,
      ].filter(Boolean).join(" ")));
    if (button) {
      activateControl(button.closest("button, [role=button], a") || button);
      return;
    }
    for (const type of ["keydown", "keypress", "keyup"]) {
      input.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    }
  }

  async function findBidBySearch(bidNo, input) {
    await submitBidSearch(input, bidNo);
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      stopIfRequested();
      await sleep(500);
      if (gemTransientErrorMessage()) return null;
      const match = currentCards().find((item) => item.bidNo === bidNo);
      if (match) return match.card;
    }
    return null;
  }

  // A corrigendum can be issued days after a bid was received, and later scans
  // skip already-read bids. Search each active dashboard bid that has no
  // corrigendum yet and click only its View Corrigendum link (no PDF download).
  async function recheckSavedCorrigenda(skipBids, context) {
    const summary = { checked: 0, found: 0, notFound: 0, error: "" };
    const pending = (await runtimeMessage({ type: "GET_CORRIGENDUM_PENDING" })).bidNos || [];
    const bids = pending.filter((bidNo) => !skipBids[bidNo]);
    if (!bids.length) return summary;
    const input = bidSearchInput();
    if (!input) {
      summary.notFound = bids.length;
      summary.error = "GeM bid search box was not found";
      return summary;
    }
    try {
      for (const [index, bidNo] of bids.entries()) {
        stopIfRequested();
        await waitWhilePaused(context);
        await progress("running", `Checking saved bid ${bidNo} for a new corrigendum (${index + 1}/${bids.length})...`, context);
        const card = await findBidBySearch(bidNo, bidSearchInput() || input);
        // A bid outside the selected category is checked when its category is scanned.
        if (!card) { summary.notFound += 1; continue; }
        const result = await corrigendumFor(bidNo, card);
        summary.checked += 1;
        if (result.has_corrigendum) {
          // Send the card's current dates too: a corrigendum usually moves
          // the End Date, and the dashboard must show the new one.
          const liveCard = currentCards().find((item) => item.bidNo === bidNo)?.card || card;
          await runtimeMessage({
            type: "MARK_GEM_CORRIGENDUM",
            bidNos: [bidNo],
            bids: [{
              bid_no: bidNo,
              bid_date: opportunityCardStartDate(liveCard),
              end_date: opportunityCardEndDate(liveCard),
            }],
          });
          summary.found += 1;
        }
      }
    } finally {
      // Leaving a bid number in the search box would filter the next scan.
      const current = bidSearchInput();
      if (current?.value) await submitBidSearch(current, "").catch(() => {});
    }
    return summary;
  }

  async function selectLatestBidSort() {
    const selects = [...document.querySelectorAll("select")].filter(visible);
    for (const select of selects) {
      const options = [...select.options];
      const latest = options.find((option) => /bid\s+start\s+date\s*:\s*latest\s+first/i.test(text(option)))
        || options.find((option) => /bid.*latest\s+first/i.test(text(option)));
      if (!latest) continue;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      if (setter) setter.call(select, latest.value); else select.value = latest.value;
      await waitForGemRemoteActionSlot();
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(3000);
      if (!/latest\s+first/i.test(text(select.selectedOptions?.[0]))) {
        throw new Error("GeM Sort by could not be changed to Latest First.");
      }
      return true;
    }
    // GeM renders Sort by as an Angular/Bootstrap custom dropdown rather than
    // a native select (button label + menu items).
    const exact = (pattern) => searchableDocuments().flatMap((root) => [...root.querySelectorAll(
      "button, a, [role=button], li, span, div, [class*=dropdown]"
    )]).filter(visible).filter((node) => pattern.test(text(node)))
      .sort((a, b) => text(a).length - text(b).length);
    let current = exact(/Bid\s+(?:Start|End)\s+Date\s*:\s*(?:Latest|Oldest)\s+First/i)[0];
    if (!current) {
      const sortLabel = exact(/Sort\s+by\s*:/i)[0];
      current = sortLabel?.parentElement?.querySelector("button, [role=button], a") || null;
    }
    if (!current) return false;
    activateControl(current);
    await sleep(500);
    const latestOption = exact(/Bid\s+Start\s+Date\s*:\s*Latest\s+First/i)
      .find((node) => node !== current);
    if (!latestOption) return false;
    await waitForGemRemoteActionSlot();
    activateControl(latestOption);
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      await sleep(250);
      const selected = exact(/Bid\s+Start\s+Date\s*:\s*Latest\s+First/i)
        .find((node) => !node.closest(".dropdown-menu, [role=menu]"));
      if (selected) return true;
    }
    return false;
  }

  async function applyOpportunityFilters() {
    const inputFor = (pattern) => [...document.querySelectorAll('input[type="checkbox"], input[type="radio"]')]
      .find((input) => {
        const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : input.closest("label");
        return pattern.test(text(label || input.parentElement));
      });
    const ongoing = inputFor(/^ongoing\s+bids?\s+available\s+for\s+participation$/i);
    if (ongoing && !ongoing.checked) { await waitForGemRemoteActionSlot(); ongoing.click(); await sleep(2500); }
    const ongoingRa = inputFor(/^ongoing\s+ras?\s+available\s+for\s+participation$/i);
    if (ongoingRa?.checked && ongoingRa.type === "checkbox") { await waitForGemRemoteActionSlot(); ongoingRa.click(); await sleep(2000); }
    const submitted = inputFor(/already\s+submitted|participated/i);
    if (submitted?.checked && submitted.type === "checkbox") { await waitForGemRemoteActionSlot(); submitted.click(); await sleep(2000); }
    const evaluated = inputFor(/^technical\s+evaluated$/i);
    if (evaluated?.checked && evaluated.type === "checkbox") { await waitForGemRemoteActionSlot(); evaluated.click(); await sleep(2000); }
    const all = inputFor(/^all\s+bids?\/ras?$/i);
    if (all && !all.checked) { await waitForGemRemoteActionSlot(); all.click(); await sleep(2500); }
    const sortedAutomatically = await selectLatestBidSort();
    if (!sortedAutomatically) {
      await progress(
        "running",
        "Using the current GeM sort. Keep Bid Start Date: Latest First selected manually.",
        { page: 1, saved: 0 },
      );
    }
    await waitForGemRemoteActionSlot(5000);
    location.hash = "page-1";
    await sleep(2500);
    return sortedAutomatically;
  }

  function categorySelectContainer() {
    const heading = [...document.querySelectorAll("div, span, label, p")]
      .filter(visible).find((node) => /^by\s+category\s*:?$/i.test(text(node)));
    if (!heading) return null;
    const candidates = [...document.querySelectorAll(
      ".ui-select-container, .multiSelect, .dropdown-multiselect, [class*=multiselect]"
    )].filter(visible);
    const noneSelected = [...document.querySelectorAll("button, [role=button], a")]
      .filter(visible).find((node) => /^none\s+selected$/i.test(text(node)));
    if (noneSelected) {
      return noneSelected.closest(
        ".ui-select-container, .multiSelect, .dropdown-multiselect, [class*=multiselect]"
      ) || noneSelected.parentElement;
    }
    const below = candidates.filter((node) => node.getBoundingClientRect().top >= heading.getBoundingClientRect().bottom - 4);
    return (below.length ? below : candidates).sort((a, b) => (
      Math.abs(a.getBoundingClientRect().top - heading.getBoundingClientRect().bottom)
      - Math.abs(b.getBoundingClientRect().top - heading.getBoundingClientRect().bottom)
    ))[0] || null;
  }

  async function clearOpportunityCategory() {
    const container = categorySelectContainer();
    if (!container) throw new Error("GeM By Category search control was not found.");
    for (const close of [...container.querySelectorAll(
      ".ui-select-match-close, .close, [aria-label*=remove i], [title*=remove i]"
    )].filter(visible)) activateControl(close);
    const toggle = [...container.querySelectorAll(
      ".ui-select-toggle, .ui-select-match, [role=combobox], button, a"
    )].find(visible);
    const hasVisibleMenu = Boolean([...container.querySelectorAll(
      ".ui-select-choices, .checkBoxContainer, .dropdown-menu"
    )].find(visible));
    if (toggle && !hasVisibleMenu) { activateControl(toggle); await sleep(500); }
    for (const checked of container.querySelectorAll('input[type="checkbox"]:checked')) {
      const option = checked.closest(".multiSelectItem, li, label, [role=option]");
      if (option && visible(option)) activateControl(option);
    }
    await sleep(1200);
    return container;
  }

  async function selectOpportunityCategory(query, pattern) {
    const container = await clearOpportunityCategory();
    const toggle = [...container.querySelectorAll(
      ".ui-select-toggle, .ui-select-match, [role=combobox], button, a"
    )].find(visible);
    if (!toggle) throw new Error("GeM By Category dropdown could not be opened.");
    let input = [...container.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])')].find(visible)
      || [...document.querySelectorAll(
        '.ui-select-container.open input:not([type="hidden"]), .multiSelect input[type=text], .dropdown-menu input[type=text]'
      )].find(visible);
    if (!input) {
      activateControl(toggle);
      await sleep(400);
      input = [...container.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])')].find(visible)
        || [...document.querySelectorAll('.multiSelect input[type=text], .dropdown-menu input[type=text]')].find(visible);
    }
    if (!input) throw new Error("GeM By Category search box did not open.");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, query); else input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const end = Date.now() + 12000;
    while (Date.now() < end) {
      await sleep(300);
      const choice = [...document.querySelectorAll(
        ".ui-select-choices-row, .ui-select-choices li, [role=option], .multiSelectItem, .dropdown-menu li, .dropdown-menu a"
      )].filter(visible).find((node) => pattern.test(text(node)));
      if (!choice) continue;
      const clickable = choice.querySelector("button, a, [role=option], label") || choice;
      await waitForGemRemoteActionSlot();
      activateControl(clickable);
      await sleep(3000);
      const selectedText = text(container);
      if (!pattern.test(selectedText)) {
        const checked = choice.querySelector('input[type="checkbox"]')?.checked;
        if (!checked) throw new Error(`GeM category "${query}" did not become selected.`);
      }
      await waitForGemRemoteActionSlot(5000);
      location.hash = "page-1";
      await sleep(2500);
      return;
    }
    throw new Error(`GeM category matching "${query}" was not found.`);
  }

  async function scanOpportunityPages(resume = null) {
    if (syncing) throw new Error("A GeM bid sync is already running in this tab.");
    syncing = true;
    activeScanType = "opportunity";
    stopRequested = false;
    pauseRequested = false;
    let page = Number(resume?.page || 1);
    let saved = Number(resume?.saved || 0);
    let created = Number(resume?.created || 0);
    let updated = Number(resume?.updated || 0);
    let checked = Number(resume?.checked || 0);
    let stoppedAtKnownBids = false;
    let knownPages = Number(resume?.knownPages || 0);
    let corrigendaFound = 0;
    const rejected = {
      product: 0, bunch: 0, quantity: 0, quantity_unread: 0, pac: 0, location: 0, date: 0, expired: 0, over120: 0, inkjet: 0, detail: 0, api: 0,
      ...(resume?.rejected || {}),
    };
    try {
      await progress("running", resume
        ? `Restoring the selected category scan at page ${page} after GeM stopped loading...`
        : "Preparing the manually selected GeM category...", { page, saved, checked });
      const knownBids = await storedBidMap(OPPORTUNITY_KNOWN_BIDS_KEY);
      const runBids = resume ? await storedBidMap(OPPORTUNITY_RUN_BIDS_KEY) : {};
      if (!resume) await storeBidMap(OPPORTUNITY_RUN_BIDS_KEY, {});
      const latestFirst = await applyOpportunityFilters();
      if (resume?.categoryQuery) {
        const category = OPPORTUNITY_CATEGORIES.find((entry) => entry[1] === resume.categoryQuery);
        if (!category) throw new Error("Saved GeM category could not be restored.");
        await selectOpportunityCategory(category[1], category[2]);
      }
      if (page > 1) {
        await waitForGemRemoteActionSlot(5000);
        location.hash = `page-${page}`;
        await sleep(3000);
      }
      const visited = new Set();
      while (true) {
        const cards = await waitForBidCards(180000);
        const signature = cards.map((item) => item.bidNo).join("|");
        if (!signature || visited.has(signature)) throw new Error(`Selected category scan repeated/stalled at page ${page}.`);
        visited.add(signature);
        // With Latest First sorting, new bids come first. Once whole pages
        // contain only bids the previous completed scan already read, every
        // later page is older still, so stop instead of re-reading them.
        if (latestFirst && isKnownOpportunityPage(cards, knownBids)) {
          knownPages += 1;
          if (knownPages >= OPPORTUNITY_KNOWN_PAGES_TO_STOP) {
            stoppedAtKnownBids = true;
            break;
          }
        } else {
          knownPages = 0;
        }
        for (const { bidNo, card } of cards) {
          stopIfRequested();
          await waitWhilePaused({ page, saved, checked });
          if (knownBids[bidNo] || runBids[bidNo]) continue;
          checked += 1;
          await progress("running", `Opening ${bidNo} to verify full bid details...`, { page, saved, checked });
          const row = await opportunityFromBidDetail(bidNo, card);
          if (row?.eligible) {
            const corrigendum = await corrigendumFor(bidNo, card);
            if (corrigendum.has_corrigendum !== null) Object.assign(row, corrigendum);
            if (corrigendum.has_corrigendum) {
              corrigendaFound += 1;
              await progress("running", `Corrigendum found for ${bidNo}.`, { page, saved, checked });
            }
            // Save immediately instead of holding a whole page in memory. A
            // Pause/Stop after this point cannot discard already-read bids.
            const response = await runtimeMessage({ type: "SAVE_GEM_BID_OPPORTUNITIES", results: [row] });
            if (response.saved > 0 && !response.frontendVisible) {
              throw new Error(`${bidNo} was saved but the API did not confirm frontend visibility.`);
            }
            saved += response.saved || 0;
            created += response.created || 0;
            updated += response.updated || 0;
            rejected.api += response.rejected || 0;
          } else if (row?.reject) rejected[row.reject] += 1;
          // A failed detail download is retried by the next scan.
          if (row?.reject !== "detail") runBids[bidNo] = Date.now();
        }
        await storeBidMap(OPPORTUNITY_RUN_BIDS_KEY, runBids);
        await progress("running", `Selected category page ${page}: checked ${checked}; ${opportunitySaveSummary(saved, created, updated, rejected.api)}. Rejected before API: detail ${rejected.detail}, product ${rejected.product}, bunch ${rejected.bunch || 0}, qty<5 ${rejected.quantity}, qty unread ${rejected.quantity_unread}, PAC ${rejected.pac}, location ${rejected.location}, date ${rejected.date}, expired ${rejected.expired}, >120d ${rejected.over120}, inkjet-only ${rejected.inkjet}.`, { page, saved, checked });
        const advance = await advancePageWithRecovery(signature, page, async (attempt, reason) => {
          await progress(
            "running",
            `GeM did not load page ${page + 1} (${reason}). Reloading the tab and resuming automatically...`,
            { page, saved, checked },
          );
          const selectedText = text(categorySelectContainer());
          const category = OPPORTUNITY_CATEGORIES.find((entry) => entry[2].test(selectedText));
          sessionStorage.setItem("acxxelOpportunityResume", JSON.stringify({
            page: page + 1,
            saved,
            created,
            updated,
            checked,
            rejected,
            knownPages,
            categoryQuery: category?.[1] || "",
            savedAt: Date.now(),
          }));
          window.setTimeout(() => location.reload(), 250);
          // Keep this execution parked until the reload replaces the document.
          await new Promise(() => {});
        });
        if (!advance.advanced) {
          break;
        }
        page += 1;
      }
      await storeBidMap(OPPORTUNITY_KNOWN_BIDS_KEY, mergeKnownBids(knownBids, runBids));
      await storeBidMap(OPPORTUNITY_RUN_BIDS_KEY, {});
      let recheck;
      try {
        recheck = await recheckSavedCorrigenda(runBids, { page, saved, checked });
      } catch (error) {
        if (error.code === "GEM_SYNC_STOPPED") throw error;
        recheck = { checked: 0, found: 0, notFound: 0, error: error.message || "failed" };
      }
      const recheckSummary = ` Corrigendum re-check of saved bids: ${recheck.checked} checked, ${recheck.found} new corrigendum, ${recheck.notFound} not in this category/list${recheck.error ? ` (${recheck.error})` : ""}.`;
      await progress(
        "complete",
        `${stoppedAtKnownBids ? `Reached already-read bids on page ${page}; older pages were skipped` : "Selected category scan complete"}. Checked ${checked} bids; ${opportunitySaveSummary(saved, created, updated, rejected.api)}; ${corrigendaFound} with a corrigendum.${recheckSummary} Select the next category manually and scan again.`,
        { page, saved, checked },
      );
      sessionStorage.removeItem("acxxelOpportunityResume");
    } catch (error) {
      if (error.code === "GEM_SYNC_STOPPED") {
        await progress(
          "stopped",
          `Opportunity scan stopped after ${checked} bids; ${opportunitySaveSummary(saved, created, updated, rejected.api)}. Rejected before API: detail ${rejected.detail}, product ${rejected.product}, bunch ${rejected.bunch || 0}, qty<5 ${rejected.quantity}, qty unread ${rejected.quantity_unread}, PAC ${rejected.pac}, location ${rejected.location}, date ${rejected.date}, expired ${rejected.expired}, >120d ${rejected.over120}, inkjet-only ${rejected.inkjet}.`,
          { page, saved, checked },
        );
        return;
      }
      await progress("failed", error.message || "GeM opportunity scan failed.", { page, saved, checked });
      error.syncProgressReported = true;
      throw error;
    } finally {
      syncing = false;
      activeScanType = "";
    }
  }

  async function waitForBidCards(timeout = 60000, onWait = null) {
    const end = Date.now() + timeout;
    const startedAt = Date.now();
    let lastNotice = 0;
    let lastSignature = "";
    let stableChecks = 0;
    while (Date.now() < end) {
      stopIfRequested();
      // Don't wait out the full timeout behind GeM's transient error banner;
      // let the caller reload and resume right away.
      if (gemTransientErrorMessage()) return [];
      const cards = currentCards();
      const signature = cards.map((item) => item.bidNo).join("|");
      if (signature && signature === lastSignature) stableChecks += 1;
      else stableChecks = 0;
      if (cards.length && stableChecks >= 3) return cards;
      lastSignature = signature;
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      if (onWait && elapsedSeconds >= lastNotice + 5) {
        lastNotice = elapsedSeconds;
        await onWait(elapsedSeconds);
      }
      await sleep(500);
    }
    return [];
  }

  async function applyTechnicalEvaluatedFilter() {
    const ensureChecked = (pattern) => {
      const checkbox = [...document.querySelectorAll('input[type="checkbox"], input[type="radio"]')]
        .find((input) => {
        const label = input.id
          ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)
          : input.closest("label");
        const nearbyText = text(label || input.parentElement);
          return pattern.test(nearbyText);
        });
      if (!checkbox) return false;
      if (!checkbox.checked) checkbox.click();
      return true;
    };

    const allBidsReady = ensureChecked(/^all\s+bids?\s*\/\s*ras?$/i);
    if (allBidsReady) await sleep(1200);
    const technicalCheckboxReady = ensureChecked(/^technical\s+evaluated$/i);
    if (technicalCheckboxReady) {
      await sleep(1200);
      return true;
    }

    const nativeSelect = [...document.querySelectorAll("select")].find((select) => (
      visible(select) && [...select.options].some((option) => /technical\s+evaluated/i.test(text(option)))
    ));
    if (nativeSelect) {
      const option = [...nativeSelect.options].find((item) => /technical\s+evaluated/i.test(text(item)));
      if (nativeSelect.value === option.value) return true;
      nativeSelect.value = option.value;
      nativeSelect.dispatchEvent(new Event("input", { bubbles: true }));
      nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(1200);
      return true;
    }

    const exactControl = [...document.querySelectorAll("button, a, [role=button], label, li")]
      .filter(visible)
      .find((node) => /^technical\s+evaluated$/i.test(text(node)));
    if (exactControl) {
      if (exactControl.getAttribute("aria-checked") === "true" || exactControl.getAttribute("aria-pressed") === "true") {
        return true;
      }
      exactControl.click();
      await sleep(1200);
      return true;
    }
    return false;
  }

  async function applyCompleteBidListFilter() {
    const labelledInput = (pattern) => [...document.querySelectorAll('input[type="checkbox"], input[type="radio"]')]
      .find((input) => {
        const label = input.id
          ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)
          : input.closest("label");
        return pattern.test(text(label || input.parentElement));
      });

    const waitForInput = async (pattern, timeout = 30000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        stopIfRequested();
        const input = labelledInput(pattern);
        if (input) return input;
        await sleep(500);
      }
      return null;
    };

    const desiredFilters = [
      ["Bids/RAs Already Submitted/Participated", /^bids?\s*\/\s*ras?\s+already\s+submitted\s*\/\s*participated$/i, true, true],
      ["All Bid/RAs", /^all\s+bids?\s*\/\s*ras?$/i, true, true],
      ["Technical Evaluated", /^technical\s+evaluated$/i, true, true],
      ["Ongoing Bids Available For Participation", /^ongoing\s+bids?\s+available\s+for\s+participation$/i, false, false],
      ["Ongoing RAs Available For Participation", /^ongoing\s+ras?\s+available\s+for\s+participation$/i, false, false],
      ["Product Bid/RAs", /^product\s+bids?\s*\/\s*ras?$/i, false, false],
      ["Service Bid/RAs", /^service\s+bids?\s*\/\s*ras?$/i, false, false],
      ["Bid To RAs", /^bid\s+to\s+ras?$/i, false, false],
      ["Product Custom Bid/RAs", /^product\s+custom\s+bids?\s*\/\s*ras?$/i, false, false],
      ["BOQ Bids", /^boq\s+bids?$/i, false, false],
      ["Rate Contract Bids", /^rate\s+contract\s+bids?$/i, false, false],
      ["Global Tender", /^global\s+tender$/i, false, false],
      ["Financial Evaluated", /^financial\s+evaluated$/i, false, false],
      ["Bid/RA Awarded", /^bid\s*\/\s*ra\s+awarded$/i, false, false],
    ].map(([label, pattern, checked, required]) => ({ label, pattern, checked, required }));

    // Apply the three positive filters first; GeM normally clears conflicting
    // choices in each group automatically.
    for (const filter of desiredFilters.filter((item) => item.checked)) {
      let input = await waitForInput(filter.pattern);
      if (!input) throw new Error(`Required GeM filter was not found: ${filter.label}.`);
      if (!input.checked) {
        await waitForGemRemoteActionSlot(4000);
        input.click();
        await sleep(2500);
        input = await waitForInput(filter.pattern, 10000);
      }
      if (!input?.checked) throw new Error(`GeM did not enable required filter: ${filter.label}.`);
    }

    // Angular replaces this panel after a filter request, so reacquire every
    // conflicting checkbox immediately before reading or clearing it.
    for (const filter of desiredFilters.filter((item) => !item.checked)) {
      let input = labelledInput(filter.pattern);
      if (!input?.checked) continue;
      await waitForGemRemoteActionSlot(4000);
      input.click();
      await sleep(2500);
      input = await waitForInput(filter.pattern, 10000);
      if (input?.checked) throw new Error(`GeM did not clear conflicting filter: ${filter.label}.`);
    }

    for (const filter of desiredFilters.filter((item) => item.required)) {
      if (!labelledInput(filter.pattern)?.checked) {
        throw new Error(`Required GeM filter changed while loading results: ${filter.label}.`);
      }
    }

    const firstPageControl = [...document.querySelectorAll(
      "[class*=pagination] a, [class*=pagination] button, [class*=pager] a, [class*=pager] button, [aria-label]"
    )].find((node) => visible(node) && enabled(node) && (
      text(node) === "1" || /^(?:first|page\s*1)$/i.test(node.getAttribute("aria-label") || "")
    ));
    if (firstPageControl) {
      await waitForGemRemoteActionSlot(5000);
      firstPageControl.click();
      await sleep(1500);
    } else if (/^#page-\d+$/i.test(location.hash) && location.hash.toLowerCase() !== "#page-1") {
      await waitForGemRemoteActionSlot(5000);
      location.hash = "page-1";
      await sleep(2000);
    }
    return true;
  }

  async function autoStartAfterLogin() {
    if (document.visibilityState !== "visible") return;
    if (document.querySelector("input[type=password], input[name*=captcha i], input[id*=captcha i]")) return;
    if (/admin-mkp|catalog|offering|product/i.test(location.href)) return;
    const onSellerBidList = /^https:\/\/bidplus\.gem\.gov\.in\/seller-bids(?:[/?#]|$)/i.test(location.href);
    if (!onSellerBidList) {
      await runtimeMessage({ type: "GEM_LOGIN_READY" });
      return;
    }
    const syncMarker = `started:${chrome.runtime.getManifest().version}`;
    if (sessionStorage.getItem("acxxelAutoBidSync") === syncMarker) return;
    sessionStorage.setItem("acxxelAutoBidSync", syncMarker);
    await progress("starting", "Starting automatic full GeM bid-list sync...", { page: 0, saved: 0 });
    await sleep(3000);
    // The background worker may already have started this tab after navigation.
    if (syncing) return;
    try {
      await scanAllPages();
    } catch (error) {
      sessionStorage.removeItem("acxxelAutoBidSync");
      throw error;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PROBE_GEM_BID_SYNC") {
      sendResponse({
        ok: true,
        cardCount: currentCards().length,
        visible: document.visibilityState === "visible",
        syncing,
        scanType: activeScanType,
        url: location.href,
      });
      return true;
    }
    if (["STOP_GEM_BID_SYNC", "STOP_GEM_OPPORTUNITY_SYNC"].includes(message.type)) {
      const requestedType = message.type === "STOP_GEM_OPPORTUNITY_SYNC" ? "opportunity" : "disqualified";
      if (!syncing || activeScanType !== requestedType) {
        sendResponse({ ok: false, error: `No running ${requestedType} scan was found in this tab.` });
        return true;
      }
      stopRequested = true;
      pauseRequested = false;
      if (requestedType === "disqualified") sessionStorage.removeItem("acxxelDisqualifiedResume");
      sendResponse({ ok: true, stopping: syncing });
      return true;
    }
    if (["PAUSE_GEM_BID_SYNC", "PAUSE_GEM_OPPORTUNITY_SYNC"].includes(message.type)) {
      const requestedType = message.type === "PAUSE_GEM_OPPORTUNITY_SYNC" ? "opportunity" : "disqualified";
      if (!syncing || activeScanType !== requestedType) {
        sendResponse({ ok: false, error: "No GeM bid sync is currently running in this tab." });
        return true;
      }
      pauseRequested = true;
      sendResponse({ ok: true, pausing: true });
      return true;
    }
    if (["RESUME_GEM_BID_SYNC", "RESUME_GEM_OPPORTUNITY_SYNC"].includes(message.type)) {
      const requestedType = message.type === "RESUME_GEM_OPPORTUNITY_SYNC" ? "opportunity" : "disqualified";
      if (!syncing || activeScanType !== requestedType) {
        sendResponse({ ok: false, error: `No paused ${requestedType} scan was found in this tab.` });
        return true;
      }
      pauseRequested = false;
      sendResponse({ ok: true, resuming: syncing });
      return true;
    }
    if (!["START_GEM_BID_SYNC", "START_GEM_OPPORTUNITY_SYNC"].includes(message.type)) return undefined;
    if (syncing) {
      sendResponse({ ok: false, error: "A GeM bid sync is already running in this tab." });
      return true;
    }
    const cardCount = currentCards().length;
    sendResponse({ ok: true, started: true, cardCount });
    window.setTimeout(() => {
      const runner = message.type === "START_GEM_OPPORTUNITY_SYNC" ? scanOpportunityPages : scanAllPages;
      runner(message.type === "START_GEM_BID_SYNC" ? message.resume || null : null).catch(async (error) => {
        if (error.code === "GEM_SYNC_STOPPED") return;
        console.error("Acxxel GeM bid sync failed:", error);
        if (error.syncProgressReported) return;
        try {
          await progress("failed", error.message || "GeM bid scanner stopped before processing the page.", { page: 0, saved: 0 });
        } catch {
          // The extension was reloaded while this page was still running.
        }
      });
    }, 0);
    return true;
  });

  try {
    const disqualifiedResume = JSON.parse(sessionStorage.getItem("acxxelDisqualifiedResume") || "null");
    if (disqualifiedResume && Date.now() - Number(disqualifiedResume.savedAt || 0) < 30 * 60 * 1000) {
      sessionStorage.removeItem("acxxelDisqualifiedResume");
      window.setTimeout(() => {
        scanAllPages(disqualifiedResume).catch(async (error) => {
          console.error("Acxxel GeM disqualified scan resume failed:", error);
          if (error.syncProgressReported) return;
          await progress("failed", error.message || "GeM disqualified scan could not resume.", {
            page: disqualifiedResume.page,
            saved: disqualifiedResume.saved,
            checked: disqualifiedResume.checked,
            pending: disqualifiedResume.pending || [],
          }).catch(() => {});
        });
      }, 3000);
    }
  } catch {
    sessionStorage.removeItem("acxxelDisqualifiedResume");
  }

  try {
    const resume = JSON.parse(sessionStorage.getItem("acxxelOpportunityResume") || "null");
    if (resume && Date.now() - Number(resume.savedAt || 0) < 30 * 60 * 1000) {
      sessionStorage.removeItem("acxxelOpportunityResume");
      window.setTimeout(() => {
        scanOpportunityPages(resume).catch(async (error) => {
          console.error("Acxxel GeM opportunity resume failed:", error);
          if (error.syncProgressReported) return;
          await progress("failed", error.message || "GeM opportunity scan could not resume.", {
            page: resume.page,
            saved: resume.saved,
            checked: resume.checked,
          }).catch(() => {});
        });
      }, 3000);
    }
  } catch {
    sessionStorage.removeItem("acxxelOpportunityResume");
  }

})();
