(() => {
  const BID_PATTERN = /GEM\s*\/\s*\d{4}\s*\/\s*[A-Z]+\s*\/\s*\d+/i;
  let syncing = false;
  let stopRequested = false;

  const text = (node) => String(node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizeBidNo = (value) => String(value || "").replace(/\s+/g, "").toUpperCase();

  function stopIfRequested() {
    if (!stopRequested) return;
    const error = new Error("GeM bid sync stopped by user.");
    error.code = "GEM_SYNC_STOPPED";
    throw error;
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
    const match = String(value || "").match(/\d{4}[-/]\d{2}[-/]\d{2}(?:\s+\d{2}:\d{2}:\d{2})?|\d{2}[-/]\d{2}[-/]\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?/);
    if (!match) return "";
    const parsed = new Date(match[0].replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
    return Number.isNaN(parsed.getTime()) ? match[0] : parsed.toISOString();
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
        await progress("running", "Waiting for bid cards from the complete GeM list...", { page, saved });
        const cards = await waitForBidCards(180000, async (seconds) => {
          await progress(
            "running",
            `Waiting for GeM bid cards to load (${seconds}s)...`,
            { page, saved },
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
          checked += 1;
          // Never discard a disqualified record in the scanner. The analyser
          // table applies its 2026 filter from the actual disqualified_at date.
          const wanted = result.is_disqualified;
          if (!wanted) {
            await progress(
              "running",
              `Checked ${result.bid_no} (${recordNumber}/${totalRecords} on page ${page}).`,
              { page, saved },
            );
            return;
          }
          await progress(
            "running",
            `Saving disqualified bid ${result.bid_no}.`,
            { page, saved },
          );
          const response = await runtimeMessage({
            type: "SAVE_GEM_BID_RESULTS",
            results: [result],
          });
          saved += response.saved || 0;
          await progress(
            "running",
            `Completed ${result.bid_no} (${recordNumber}/${totalRecords} on page ${page}).`,
            { page, saved },
          );
        });
        await progress("running", `Synced page ${page}.`, { page, saved });
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
        `Full GeM scan complete. Checked ${checked} bids; saved ${saved} disqualified bids.`,
        { page, saved },
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
      sendResponse({ ok: true, stopping: syncing });
      return true;
    }
    if (message.type !== "START_GEM_BID_SYNC") return undefined;
    if (syncing) {
      sendResponse({ ok: false, error: "A GeM bid sync is already running in this tab." });
      return true;
    }
    const cardCount = currentCards().length;
    sendResponse({ ok: true, started: true, cardCount });
    window.setTimeout(() => {
      scanAllPages().catch(async (error) => {
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
