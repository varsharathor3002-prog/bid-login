(() => {
  const BID_PATTERN = /GEM\s*\/\s*\d{4}\s*\/\s*[A-Z]+\s*\/\s*\d+/i;
  let syncing = false;
  let stopRequested = false;
  let pauseRequested = false;

  const text = (node) => String(node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizeBidNo = (value) => String(value || "").replace(/\s+/g, "").toUpperCase();

  function stopIfRequested() {
    if (!stopRequested) return;
    const error = new Error("GeM bid sync stopped by user.");
    error.code = "GEM_SYNC_STOPPED";
    throw error;
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
    await runtimeMessage({ type: "GEM_BID_SYNC_PROGRESS", status, message, ...extra });
  }

  function visible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function bidCardFor(element) {
    let current = element;
    let best = null;
    while (current?.parentElement) {
      const value = text(current);
      const matches = value.match(new RegExp(BID_PATTERN.source, "gi")) || [];
      if (matches.length === 1) {
        let score = 0;
        if (current.matches("tr, article, [role=row], [class*=card], [class*=result], [class*=list-item]")) score += 25;
        if (/technical\s+status|view\s+bid\s+result|disqualified|qualified/i.test(value)) score += 80;
        if (/department|quantity|start\s+date|end\s+date|items?/i.test(value)) score += 30;
        if (current.querySelector("button, [role=button], [ng-click], [data-ng-click]")) score += 15;
        score += Math.min(value.length, 1500) / 100;
        if (!best || score > best.score) best = { node: current, score };
      }
      if (matches.length > 1) break;
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
          const card = bidCardFor(node.parentElement);
          if (card && visible(card) && !cards.has(bidNo)) cards.set(bidNo, card);
        }
        node = walker.nextNode();
      }

      if (!cards.size && BID_PATTERN.test(text(container))) {
        for (const element of root.querySelectorAll("a, p, span, strong, td, th, li, section, article, div")) {
          const matches = text(element).match(new RegExp(BID_PATTERN.source, "gi")) || [];
          if (matches.length !== 1) continue;
          const bidNo = normalizeBidNo(matches[0]);
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
      for (const node of parent.querySelectorAll("a, button, [role=button], [ng-click]")) {
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
    control.setAttribute("data-acxxel-click-id", clickId);
    document.dispatchEvent(new CustomEvent("acxxel-gem-click-control", {
      detail: { clickId },
    }));
    control.removeAttribute("data-acxxel-click-id");
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
      const title = [...document.querySelectorAll("h1,h2,h3,h4,div,span")]
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
      let cellNodes = [...row.querySelectorAll(":scope > td, :scope > [role=cell], :scope > [class*=col-], :scope > .column")];
      if (cellNodes.length < 3) {
        cellNodes = [...row.querySelectorAll("td, [role=cell], [class*=col-], .column")]
          .filter((node) => visible(node));
      }
      const cells = cellNodes.map(text).filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index);
      if (cells.length < 3) continue;
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
      const rows = historyRows(modal);
      if (rows.length) return rows;
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
    const controls = disqualifiedControls(card);
    if (!controls.length) return { rows: [], error: "history control not found" };
    let modalOpened = false;
    let modalSample = "";
    for (const control of controls) {
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
    return [...card.querySelectorAll("button, a, [role=button], [ng-click]")]
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
    const labelled = raw.match(/technical\s+status\s*:?\s*(disqualified|qualified)/i);
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
    if (!control) return { card, status: "", read: false };
    activateControl(control);

    const end = Date.now() + timeout;
    while (Date.now() < end) {
      stopIfRequested();
      await sleep(250);
      const liveCard = currentCards().find((item) => item.bidNo === bidNo)?.card || card;
      const status = visibleTechnicalStatus(liveCard);
      if (status) return { card: liveCard, status, read: true };
    }
    return { card, status: "", read: false };
  }

  async function extractPage(onRecord) {
    const cards = currentCards();
    const results = [];
    for (const { bidNo, card } of cards) {
      stopIfRequested();
      // Opening and closing evaluation history can make Angular replace every row.
      // Always reacquire the current card instead of using a detached snapshot.
      const currentCard = currentCards().find((item) => item.bidNo === bidNo)?.card || card;
      const evaluation = await revealBidResult(bidNo, currentCard);
      const liveCard = evaluation.card;
      const raw = text(liveCard);
      const isDisqualified = evaluation.read && /disqualified/i.test(evaluation.status);
      const historyResult = isDisqualified ? await historyFor(liveCard) : { rows: [], error: "" };
      const history = historyResult.rows;
      const disqualifiedEvent = history.find((row) => /disqualified/i.test(row.status));
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
        is_disqualified: isDisqualified,
        disqualified_at: disqualifiedEvent?.date_time || "",
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
    const controls = [...document.querySelectorAll("button, a, [role=button], li")]
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

    const activePage = [...document.querySelectorAll(".active, [aria-current=page]")]
      .find((node) => visible(node) && /^\d+$/.test(text(node)));
    const page = Number(text(activePage));
    if (!page) return null;
    return [...document.querySelectorAll("button, a, [role=button], li")]
      .find((node) => visible(node) && enabled(node) && text(node) === String(page + 1)) || null;
  }

  function paginationNext() {
    const controls = [...document.querySelectorAll("button, a, [role=button], li")]
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

    const activePage = [...document.querySelectorAll(".active, [aria-current=page]")]
      .find((node) => visible(node) && /^\d+$/.test(text(node)));
    const page = Number(text(activePage));
    if (!page) return null;
    const numericNext = [...document.querySelectorAll("button, a, [role=button], li")]
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
    const candidates = [...document.querySelectorAll(selector)]
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

    const activePage = [...document.querySelectorAll(".active, [aria-current=page], [class*=current-page]")]
      .find((node) => visible(node) && /^\d+$/.test(text(node)));
    const page = Number(text(activePage));
    if (!page) return null;
    const numericNext = [...document.querySelectorAll(selector)]
      .find((node) => visible(node) && enabled(node) && text(node) === String(page + 1));
    return numericNext?.matches("li")
      ? numericNext.querySelector("a, button, [role=button]") || numericNext
      : numericNext || null;
  }

  function mainPaginationNextState() {
    const candidates = [...document.querySelectorAll("button, a, [role=button], li")]
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
    if (!candidates.length) return { found: false, disabled: false, node: null };
    const node = candidates[0].node;
    const disabled = !enabled(node) || Boolean(node.closest(".disabled, [aria-disabled=true]"));
    return { found: true, disabled, node };
  }

  function paginationTotalPages() {
    const paginationNodes = [...document.querySelectorAll(
      "[class*=pagination] a, [class*=pagination] button, [class*=pagination] li, "
      + "[class*=pager] a, [class*=pager] button, [class*=pager] li, [aria-label*=page i]"
    )].filter((node) => !node.closest(
      "[role=dialog], .modal, .modal-dialog, .modal-content, .ngdialog-content"
    ));
    const pages = paginationNodes
      .map((node) => Number(text(node)))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= 500);
    if (!pages.length) {
      const next = [...document.querySelectorAll("a, button, li, [role=button]")]
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

  async function waitForPageChange(signature, timeout = 12000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      stopIfRequested();
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
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const state = mainPaginationNextState();
      if (!state.found) return { advanced: false, reason: "missing" };
      if (state.disabled) return { advanced: false, reason: "end" };
      const next = state.node;
      next.scrollIntoView({ block: "center", inline: "center" });
      await sleep(250);
      activateControl(next);
      if (await waitForPageChange(signature, 30000)) return { advanced: true };
    }
    return { advanced: false, reason: "stuck" };
  }

  async function scanAllPages() {
    if (syncing) throw new Error("A GeM bid sync is already running in this tab.");
    syncing = true;
    stopRequested = false;
    pauseRequested = false;
    let page = 1;
    let saved = 0;
    let checked = 0;
    let totalPages = 0;
    const visited = new Set();
    try {
      await progress("running", "Preparing the complete GeM bid list...", { page, saved });
      // Always start from the complete evaluated-bid listing and page 1. Leaving
      // this to the user's current UI state silently syncs only a filtered subset.
      await applyCompleteBidListFilter();
      await sleep(1500);
      while (true) {
        stopIfRequested();
        await waitWhilePaused({ page, saved });
        await progress("running", `Waiting for bid cards from the complete GeM list... Checked ${checked}; saved ${saved} disqualified bids from 2026.`, { page, saved, checked });
        const cards = await waitForBidCards(180000, async (seconds) => {
          await progress(
            "running",
            `Waiting for GeM bid cards to load (${seconds}s)...`,
            { page, saved, checked },
          );
        });
        if (!cards.length) {
          throw new Error(
            `GeM Bid List opened, but its bid cards did not load within 180 seconds. ${bidPageDiagnostics()}`,
          );
        }
        const signature = cards.map((item) => item.bidNo).join("|");
        totalPages = Math.max(totalPages, paginationTotalPages());
        if (visited.has(signature)) {
          throw new Error(`GeM returned an already-scanned bid page at page ${page}; refusing to mark a partial scan complete.`);
        }
        visited.add(signature);
        await extractPage(async (result, recordNumber, totalRecords) => {
          stopIfRequested();
          await waitWhilePaused({ page, saved });
          checked += 1;
          // This screen is specifically the 2026 disqualification register.
          // Use the evaluation-history timestamp, never the bid number/year.
          const disqualifiedYear = result.disqualified_at
            ? new Date(result.disqualified_at).getFullYear()
            : 0;
          const wanted = result.is_disqualified && disqualifiedYear === 2026;
          if (!wanted) {
            await progress(
              "running",
              `Checked ${result.bid_no} (${recordNumber}/${totalRecords} on page ${page}).`,
              { page, saved, checked },
            );
            return;
          }
          await progress(
            "running",
            `Saving disqualified bid ${result.bid_no}.`,
            { page, saved, checked },
          );
          const response = await runtimeMessage({
            type: "SAVE_GEM_BID_RESULTS",
            results: [result],
          });
          saved += response.saved || 0;
          await progress(
            "running",
            `Completed ${result.bid_no} (${recordNumber}/${totalRecords} on page ${page}).`,
            { page, saved, checked },
          );
        });
        await progress("running", `Synced page ${page}. Checked ${checked}; saved ${saved} disqualified bids from 2026.`, { page, saved, checked });
        const advance = await advancePage(signature, page);
        if (!advance.advanced) {
          if (advance.reason !== "end") {
            throw new Error(`GeM pagination did not move after page ${page}. Keep the tab active and retry sync from this page.`);
          }
          break;
        }
        page += 1;
      }
      await progress(
        "complete",
        `Full GeM scan complete. Checked ${checked} bids; saved ${saved} disqualified bids from 2026.`,
        { page, saved, checked },
      );
    } catch (error) {
      if (error.code === "GEM_SYNC_STOPPED") {
        await progress("stopped", "GeM bid sync stopped by user.", { page, saved });
        return;
      }
      await progress("failed", error.message || "GeM bid sync failed.", { page, saved });
      throw error;
    } finally {
      syncing = false;
    }
  }

  const OPPORTUNITY_PRODUCTS = [
    ["desktop", /\b(?:entry|mid(?:dle)?|high)[ -]*(?:level)?[ -]*desktop|desktop computer/i],
    ["workstation", /\bworkstation\b/i],
    ["toner", /\btoner(?: cartridge)?\b/i],
    ["printer", /\b(?:multi\s*function\s*)?printer\b/i],
    ["aio", /\b(?:all[ -]*in[ -]*one|aio)\b/i],
    ["bunch_bid", /\bb(?:ou)?nch\s*bid\b/i],
  ];
  const OPPORTUNITY_CATEGORIES = [
    ["Entry/Mid Desktop", "Entry and Mid Level Desktop", /entry\s+and\s+mid.*desktop/i],
    ["High-End Desktop", "High End Desktop", /high\s+end.*desktop/i],
    ["Workstation", "Workstation", /workstation/i],
    ["Printer", "Printer", /\bprinter\b/i],
    ["Toner", "Toner Cartridge", /toner/i],
    ["AIO", "All in One", /all\s+in\s+one|\baio\b/i],
    ["Bunch Bid", "Bunch Bid", /bunch\s+bid/i],
  ];

  function opportunityFromText(bidNo, raw) {
    const flat = String(raw || "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
    const bounded = (start, end) => flat.match(new RegExp(`${start}\\s*:?\\s*(.+?)(?=${end})`, "i"))?.[1]?.trim() || "";
    const itemName = bounded(
      "Item\\s+Category",
      "(?:Minimum\\s+Average|Years?\\s+of\\s+Past|MSE\\s+Relaxation|Startup\\s+Relaxation|Bidder\\s+Turnover|$)"
    ) || bounded("Items?", "(?:Quantity|Department|Start\\s+Date|End\\s+Date|$)");
    const englishItemName = itemName.split(/[\u0900-\u097f]/, 1)[0];
    const qMarkers = [...englishItemName.matchAll(/\(Q\d+\)/gi)];
    const cleanItemName = (qMarkers.length ? englishItemName.slice(0, qMarkers.at(-1).index + qMarkers.at(-1)[0].length) : englishItemName)
      .replace(/\s*\(Q\d+\)\s*/gi, "")
      .replace(/\s*,\s*/g, ", ")
      .trim();
    const productText = `${cleanItemName} ${raw}`;
    const matchedProducts = OPPORTUNITY_PRODUCTS
      .filter(([type, pattern]) => type !== "bunch_bid" && pattern.test(productText));
    const looksLikeBunch = /\b(?:bunch|boq)\s*(?:bid)?\b/i.test(productText)
      || matchedProducts.length > 1
      || (itemName.match(/\(Q\d+\)/gi) || []).length > 1
      || /\s,\s/.test(itemName);
    const product = looksLikeBunch && matchedProducts.length
      ? ["bunch_bid", /./]
      : matchedProducts[0] || OPPORTUNITY_PRODUCTS.find(([type, pattern]) => (
        type === "bunch_bid" && pattern.test(productText)
      ));
    if (!product) return { reject: "product" };
    const pacField = bounded("(?:Is\\s+PAC|PAC\\s+Only|PAC\\s+Bid)", "(?:Bid|Ministry|Department|Item|$)");
    if (/\bPAC\b/i.test(cleanItemName) || /^(?:yes|true)\b/i.test(pacField)) return { reject: "pac" };
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
    if (validityDays > 120 || (endTime && endTime - Date.now() > 120 * 86400000)) return { reject: "over120" };
    return {
      eligible: true,
      bid_no: bidNo,
      bid_date: dateFrom(flat.match(new RegExp(`(?:Dated|Bid\\s+Start\\s+Date(?:/Time)?)\\s*:?\\s*${indianDateTime}`, "i"))?.[1]),
      end_date: endDate,
      product_name: cleanItemName.slice(0, 500),
      product_type: product[0],
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
    let response;
    try {
      response = await runtimeMessage({ type: "READ_GEM_BID_DETAIL", url, bidNo });
    } catch (error) {
      if (/no tab with id|tab.*(?:closed|not found)|invalid tab id/i.test(String(error?.message || error))) {
        return { reject: "detail" };
      }
      throw error;
    }
    if (!response.detailText) return { reject: "detail" };
    const opportunity = opportunityFromText(bidNo, response.detailText);
    if (opportunity?.eligible) opportunity.pdf_url = url;
    return opportunity;
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
    if (ongoing && !ongoing.checked) { ongoing.click(); await sleep(2500); }
    const ongoingRa = inputFor(/^ongoing\s+ras?\s+available\s+for\s+participation$/i);
    if (ongoingRa?.checked && ongoingRa.type === "checkbox") { ongoingRa.click(); await sleep(2000); }
    const submitted = inputFor(/already\s+submitted|participated/i);
    if (submitted?.checked && submitted.type === "checkbox") { submitted.click(); await sleep(2000); }
    const evaluated = inputFor(/^technical\s+evaluated$/i);
    if (evaluated?.checked && evaluated.type === "checkbox") { evaluated.click(); await sleep(2000); }
    const all = inputFor(/^all\s+bids?\/ras?$/i);
    if (all && !all.checked) { all.click(); await sleep(2500); }
    const sortedAutomatically = await selectLatestBidSort();
    if (!sortedAutomatically) {
      await progress(
        "running",
        "Using the current GeM sort. Keep Bid Start Date: Latest First selected manually.",
        { page: 1, saved: 0 },
      );
    }
    location.hash = "page-1";
    await sleep(2500);
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
      activateControl(clickable);
      await sleep(3000);
      const selectedText = text(container);
      if (!pattern.test(selectedText)) {
        const checked = choice.querySelector('input[type="checkbox"]')?.checked;
        if (!checked) throw new Error(`GeM category "${query}" did not become selected.`);
      }
      location.hash = "page-1";
      await sleep(2500);
      return;
    }
    throw new Error(`GeM category matching "${query}" was not found.`);
  }

  async function scanOpportunityPages() {
    if (syncing) throw new Error("A GeM bid sync is already running in this tab.");
    syncing = true;
    stopRequested = false;
    let page = 1, saved = 0, checked = 0;
    const rejected = { product: 0, pac: 0, location: 0, date: 0, expired: 0, over120: 0, detail: 0 };
    try {
      await progress("running", "Preparing the manually selected GeM category...", { page, saved });
      await applyOpportunityFilters();
      const visited = new Set();
      while (true) {
        const cards = await waitForBidCards(180000);
        const signature = cards.map((item) => item.bidNo).join("|");
        if (!signature || visited.has(signature)) throw new Error(`Selected category scan repeated/stalled at page ${page}.`);
        visited.add(signature);
        const eligible = [];
        for (const { bidNo, card } of cards) {
          stopIfRequested();
          await waitWhilePaused({ page, saved });
          checked += 1;
          await progress("running", `Opening ${bidNo} to verify full bid details...`, { page, saved });
          const row = await opportunityFromBidDetail(bidNo, card);
          if (row?.eligible) eligible.push(row);
          else if (row?.reject) rejected[row.reject] += 1;
        }
        if (eligible.length) {
          const response = await runtimeMessage({ type: "SAVE_GEM_BID_OPPORTUNITIES", results: eligible });
          saved += response.saved || 0;
        }
        await progress("running", `Selected category page ${page}: checked ${checked}, saved ${saved}; rejected detail ${rejected.detail}, product ${rejected.product}, PAC ${rejected.pac}, location ${rejected.location}, date ${rejected.date}, expired ${rejected.expired}, >120d ${rejected.over120}.`, { page, saved });
        const advance = await advancePage(signature, page);
        if (!advance.advanced) {
          if (advance.reason !== "end") throw new Error(`Selected category pagination did not move after page ${page}.`);
          break;
        }
        page += 1;
      }
      await progress("complete", `Selected category scan complete. Checked ${checked} bids; saved ${saved} eligible bids. Select the next category manually and scan again.`, { page, saved });
    } catch (error) {
      if (error.code === "GEM_SYNC_STOPPED") {
        await progress(
          "stopped",
          `Opportunity scan stopped after ${checked} bids; saved ${saved}. Rejected: detail ${rejected.detail}, product ${rejected.product}, PAC ${rejected.pac}, location ${rejected.location}, date ${rejected.date}, expired ${rejected.expired}, >120d ${rejected.over120}.`,
          { page, saved },
        );
        return;
      }
      await progress("failed", error.message || "GeM opportunity scan failed.", { page, saved });
      throw error;
    } finally {
      syncing = false;
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

    // Do not combine All/Submitted filters automatically: that combination was
    // shrinking GeM's result set. Only Technical Evaluated is required to expose
    // the status/history used by this sync.
    const technicalEvaluated = labelledInput(/^technical\s+evaluated$/i);
    if (technicalEvaluated && !technicalEvaluated.checked) {
      technicalEvaluated.click();
      await sleep(3000);
    }

    const firstPageControl = [...document.querySelectorAll(
      "[class*=pagination] a, [class*=pagination] button, [class*=pager] a, [class*=pager] button, [aria-label]"
    )].find((node) => visible(node) && enabled(node) && (
      text(node) === "1" || /^(?:first|page\s*1)$/i.test(node.getAttribute("aria-label") || "")
    ));
    if (firstPageControl) {
      firstPageControl.click();
      await sleep(1500);
    } else if (/^#page-\d+$/i.test(location.hash) && location.hash.toLowerCase() !== "#page-1") {
      location.hash = "page-1";
      await sleep(2000);
    }
    return Boolean(technicalEvaluated);
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
        url: location.href,
      });
      return true;
    }
    if (message.type === "STOP_GEM_BID_SYNC") {
      stopRequested = true;
      pauseRequested = false;
      sendResponse({ ok: true, stopping: syncing });
      return true;
    }
    if (message.type === "PAUSE_GEM_BID_SYNC") {
      if (!syncing) {
        sendResponse({ ok: false, error: "No GeM bid sync is currently running in this tab." });
        return true;
      }
      pauseRequested = true;
      sendResponse({ ok: true, pausing: true });
      return true;
    }
    if (message.type === "RESUME_GEM_BID_SYNC") {
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
      runner().catch(async (error) => {
        if (error.code === "GEM_SYNC_STOPPED") return;
        console.error("Acxxel GeM bid sync failed:", error);
        try {
          await progress("failed", error.message || "GeM bid scanner stopped before processing the page.", { page: 0, saved: 0 });
        } catch {
          // The extension was reloaded while this page was still running.
        }
      });
    }, 0);
    return true;
  });

})();
