(() => {
  const KEY = 'financialEvalSyncState';
  let active = null;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const gemUrl = (value) => {
    try { const url = new URL(value); return url.protocol === 'https:' && url.hostname.endsWith('.gem.gov.in'); }
    catch { return false; }
  };
  const COMPANY_KEYS = new Set(['LAPS N TABS TECHNOLOGY PRIVATE LIMITED', 'LAPS N TABS TECHNOLOGY PVT LTD']);
  const sellerKey = (value) => String(value || '').replace(/\s+/g, ' ').trim().toUpperCase()
    .replace(/(?:\s*\([^)]*\))+\s*(?:UNDER\s+PMA)?\s*$/i, '')
    .replace(/\s+UNDER\s+PMA\s*$/i, '').trim();
  const isCompany = (seller) => COMPANY_KEYS.has(sellerKey(seller?.sellerName));
  const validSellerStatus = (value) => ['qualified', 'not_evaluated', 'non_qualified', 'disqualified'].includes(value) ? value : 'unknown';
  const validIsoDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const [year, month, day] = value.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
  };
  function combineRankingAndEvaluation(ranking, evaluation, cardStatus = 'unknown') {
    const evaluatedRows = evaluation?.evaluations?.length ? evaluation.evaluations : evaluation?.sellers || [];
    const evaluatedBySeller = new Map(evaluatedRows.map((seller) => [sellerKey(seller.sellerName), validSellerStatus(seller.status)]));
    const sellers = (ranking?.sellers || []).map((seller) => {
      const evaluated = evaluatedBySeller.get(sellerKey(seller.sellerName));
      return { ...seller, status: evaluated && evaluated !== 'unknown' ? evaluated : validSellerStatus(seller.status) };
    });
    const evaluatedCompany = evaluatedRows.find(isCompany);
    const rankedCompany = sellers.find(isCompany);
    // The seller-bids card is the logged-in company's authoritative Technical
    // Status. Bid Result is only a fallback when that card label is absent.
    let companyStatus = validSellerStatus(cardStatus);
    if (companyStatus === 'unknown') companyStatus = validSellerStatus(evaluatedCompany?.status);
    if (companyStatus === 'unknown') companyStatus = validSellerStatus(rankedCompany?.status);
    if (companyStatus === 'unknown' && rankedCompany) companyStatus = 'qualified';
    return { sellers: sellers.map((seller) => isCompany(seller) ? { ...seller, status: companyStatus } : seller), companyStatus };
  }
  async function update(run, status, message) {
    run.status = status;
    run.message = message;
    await chrome.storage.local.set({ [KEY]: { status, message, tabId: run.tabId || null, listTabId: run.listTabId || null, page: run.page || 0, saved: run.saved || 0, updatedAt: Date.now() } });
  }
  function resumeSignal(run) {
    return new Promise((resolve) => { (run.resumeWaiters || (run.resumeWaiters = [])).push(resolve); });
  }
  async function check(run) {
    if (run.cancelled) throw new Error('Awarded Bid/RA scan stopped.');
    if (run.paused) {
      await update(run, 'paused', 'Awarded Bid/RA scan paused by user.');
      await resumeSignal(run);
      if (run.cancelled) throw new Error('Awarded Bid/RA scan stopped.');
      await update(run, 'running', 'Awarded Bid/RA scan resumed.');
    }
  }

  async function inject(tabId, allFrames = false) {
    await chrome.scripting.executeScript({ target: { tabId, allFrames }, files: [
      'src/bid_project_part B/financial-ranking-content.js',
      'src/bid_project_part B/financial-ranking-list.js',
    ] });
  }
  async function readResult(run, task) {
    const deadline = Date.now() + 30000;
    let result;
    let lastResultUrl = '';
    while (Date.now() < deadline) {
      await check(run);
      const current = await chrome.tabs.get(run.tabId);
      if (current.status === 'complete') {
        if (!gemUrl(current.url)) throw new Error('Result tab left GeM. Log in and retry.');
        if (!/^\/seller-bids\/?$/.test(new URL(current.url).pathname)) lastResultUrl = current.url;
        let extracted;
        try {
          await inject(run.tabId, true);
          extracted = await chrome.scripting.executeScript({
            target: { tabId: run.tabId, allFrames: true },
            func: () => {
              if (!globalThis.AcxxelFinancialRanking) return null;
              const result = globalThis.AcxxelFinancialRanking.readDocument(document);
              // Do not toggle an already readable/open section closed.
              if (result.status !== 'read') globalThis.AcxxelFinancialList.expand(document);
              const ids = [...new Set(((document.body?.innerText || '').match(/GEM\s*\/\s*\d{4}\s*\/\s*[BR]\s*\/\s*\d+/gi) || []).map((id) => id.replace(/\s+/g, '').toUpperCase()))];
              return { ...result, ids, diagnostic: {
                page: location.origin + location.pathname,
                tables: document.querySelectorAll('table, [role=table], [role=grid]').length,
                frames: document.querySelectorAll('iframe, frame').length,
                financialHeading: /financial\s+evaluation/i.test(document.body?.innerText || ''),
                headers: Array.from(document.querySelectorAll('th, [role=columnheader]')).slice(0, 20).map((cell) => cell.innerText.slice(0, 60)),
              } };
            },
          });
        } catch (error) {
          // Navigation after View RA Results can briefly destroy the frame.
          result = { reason: `Waiting for result document: ${error.message}` };
          await sleep(1000);
          continue;
        }
        const frames = extracted.filter((entry) => entry.result);
        const readable = frames.filter((entry) => entry.result.status === 'read');
        if (readable.length > 1) throw new Error('Multiple financial result frames found; no result saved.');
        result = readable[0]?.result || frames[0]?.result;
        if (result) {
          const top = frames.find((entry) => entry.frameId === 0)?.result;
          // An embedded table may inherit the identity displayed by its RA parent.
          if (readable.length === 1 && result.ids.length === 0 && top) result.ids = top.ids;
          result.reason = `${result.reason || 'Financial table not found'} | v${chrome.runtime.getManifest().version} | ${JSON.stringify(frames.map((entry) => entry.result.diagnostic))}`;
        }
        if (result?.status === 'read') {
          const ras = result.ids.filter((id) => /\/R\//.test(id));
          const bids = result.ids.filter((id) => /\/B\//.test(id));
          if ((task.ra_no && ras.length && (ras.length !== 1 || ras[0] !== task.ra_no))
            || (bids.length && (bids.length !== 1 || bids[0] !== task.bid_no))
            || (!result.ids.includes(task.ra_no) && !result.ids.includes(task.bid_no))) {
            throw new Error('Result page does not match the selected bid/RA. Nothing saved.');
          }
          return result;
        }
      }
      await sleep(1000);
    }
    const error = new Error(result?.reason || 'Financial table did not open. Copy status and provide the result page HTML.');
    if (lastResultUrl) error.resultUrl = lastResultUrl;
    throw error;
  }

  async function rememberForegroundTab(run, owned) {
    try {
      const [foreground] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!foreground?.id || owned.has(foreground.id)) return;
      run.foregroundTabId = foreground.id;
      run.foregroundWindowId = foreground.windowId;
    } catch { /* Keep the last known foreground tab. */ }
  }

  function restoreForegroundTab(run, resultTab, focusWindow = false) {
    const foregroundTabId = run.foregroundTabId;
    if (!foregroundTabId || foregroundTabId === resultTab.id) return;
    chrome.tabs.update(foregroundTabId, { active: true }).then(() => {
      if (focusWindow && Number.isInteger(run.foregroundWindowId) && chrome.windows?.update) {
        return chrome.windows.update(run.foregroundWindowId, { focused: true });
      }
      return null;
    }).catch(() => {});
  }

  const acxxelTab = (tab) => {
    try {
      const url = new URL(tab?.url || '');
      return ['localhost:5173', '127.0.0.1:5173', 'acxxelbidding.com', 'www.acxxelbidding.com'].includes(url.host);
    } catch { return false; }
  };

  async function createWorkerWindow(run, source) {
    const originalTabs = await chrome.tabs.query({ windowId: source.windowId });
    const candidates = originalTabs.filter((tab) => tab.id !== source.id);
    candidates.sort((left, right) => Number(acxxelTab(right)) - Number(acxxelTab(left))
      || Math.abs((left.index ?? 0) - (source.index ?? 0)) - Math.abs((right.index ?? 0) - (source.index ?? 0)));
    const foreground = candidates[0];
    if (!foreground?.id) throw new Error('Keep the Acxxel software tab open beside GeM before starting the background scan.');
    run.foregroundTabId = foreground.id;
    run.foregroundWindowId = source.windowId;
    run.originalListWindowId = source.windowId;
    run.originalListIndex = source.index ?? -1;
    const worker = await chrome.windows.create({
      tabId: source.id,
      type: 'popup',
      state: 'minimized',
      focused: false,
    });
    if (!Number.isInteger(worker?.id)) throw new Error('Chrome could not create the background result worker. Scan was not started.');
    run.workerWindowId = worker.id;
    await chrome.tabs.update(foreground.id, { active: true });
    await chrome.windows.update(source.windowId, { focused: true });
  }

  async function restoreListTabAndCloseWorker(run) {
    if (!run.workerWindowId) return;
    let restored = false;
    if (run.listTabId && Number.isInteger(run.originalListWindowId)) {
      try {
        await chrome.tabs.create({ url: 'about:blank', active: true, windowId: run.workerWindowId });
        await chrome.tabs.move(run.listTabId, { windowId: run.originalListWindowId, index: run.originalListIndex });
        restoreForegroundTab(run, { id: run.listTabId }, false);
        restored = true;
      } catch { /* Preserve the GeM list in its worker if its original window was closed. */ }
    }
    if (restored) await chrome.windows.remove(run.workerWindowId).catch(() => {});
    else await chrome.windows.update(run.workerWindowId, { state: 'normal', focused: false }).catch(() => {});
  }

  async function openTaskResult(run, task, kind, directUrl, owned) {
    if (directUrl) {
      const tab = await chrome.tabs.create({ url: directUrl, active: false, windowId: run.workerWindowId });
      owned.add(tab.id);
      run.tabId = tab.id;
      return tab.id;
    }
    // Scripted GeM controls depend on the live Angular filter state. A fresh
    // copy of the URL does not contain those manual filters, so click the card
    // in the isolated dedicated list itself and adopt the result child tab.
    const tab = await chrome.tabs.get(run.listTabId);
    run.tabId = run.listTabId;
    let opened = false;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && !opened) {
      await check(run);
      const current = await chrome.tabs.get(run.listTabId);
      if (current.status === 'complete' && gemUrl(current.url)) {
        await inject(run.listTabId);
        await rememberForegroundTab(run, owned);
        run.awaitingResultChild = true;
        try {
          // Re-scan and click in one synchronous page execution. GeM's Angular
          // list can replace a card between separate extension calls, which
          // made a button present in snapshot() disappear before open().
          const clicked = await chrome.scripting.executeScript({
            target: { tabId: run.listTabId },
            args: [task.bid_no, kind],
            func: (bidNo, resultKind) => {
              const list = globalThis.AcxxelFinancialList;
              const fresh = list.collect(document).find((item) => item.bid_no === bidNo);
              if (!fresh) return false;
              const token = resultKind === 'ra' ? fresh.ra_result_token : fresh.bid_result_token;
              return list.open(document, bidNo, resultKind, token);
            },
          });
          opened = Boolean(clicked[0]?.result);
          if (opened) await sleep(1500);
        } finally {
          run.awaitingResultChild = false;
        }
      }
      if (!opened) await sleep(1000);
    }
    if (!opened) throw new Error(`[v${chrome.runtime.getManifest().version} awarded-fresh-click] View ${kind === 'bid' ? 'Bid' : 'RA'} Results was not found for this bid.`);
    return run.tabId || tab.id;
  }

  function transientResultError(error) {
    return /frame\s+with\s+id\s+\d+\s+is\s+showing\s+error\s+page|frame\s+was\s+removed|no\s+frame\s+with\s+id|cannot\s+access\s+contents|receiving\s+end\s+does\s+not\s+exist|waiting\s+for\s+result\s+document/i.test(error?.message || '');
  }

  async function readTaskWithRecovery(run, task, kind, directUrl, reader, owned) {
    let lastError;
    let retryUrl = directUrl || null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await check(run);
      const existingTabs = new Set(owned);
      let usedListTab = false;
      try {
        // A copied seller-list tab and its real GeM button are used after the
        // first failure. This avoids reopening Chrome's cached error document.
        await openTaskResult(run, task, kind, retryUrl, owned);
        usedListTab = run.tabId === run.listTabId;
        return await reader(run, task);
      } catch (error) {
        lastError = error;
        if (!transientResultError(error) || attempt === 3) throw error;
        if (error.resultUrl && gemUrl(error.resultUrl)) retryUrl = error.resultUrl;
        else retryUrl = null;
        await update(run, 'running', `${task.bid_no}: GeM ${kind === 'bid' ? 'Bid' : 'RA'} Result showed a temporary error page. Reopening (${attempt + 1}/3)...`);
      } finally {
        // Close both the copied seller-list parent and every GeM result child
        // created from it. Nothing from a completed/failed bid is left open.
        for (const tabId of [...owned]) {
          if (existingTabs.has(tabId)) continue;
          await chrome.tabs.remove(tabId).catch(() => {});
          owned.delete(tabId);
        }
        if (usedListTab) await restoreCurrentList(run);
        run.tabId = null;
      }
      await sleep(1500 * attempt);
    }
    throw lastError;
  }

  async function listSnapshot(tabId) {
    await inject(tabId);
    const results = await chrome.scripting.executeScript({ target: { tabId }, func: () => globalThis.AcxxelFinancialList.snapshot(document) });
    return results[0]?.result;
  }
  async function waitList(run, expectedFilters, previous = null, timeout = 30000, expectedPage = null) {
    const deadline = Date.now() + timeout;
    let stable = '';
    let stableCount = 0;
    while (Date.now() < deadline) {
      await check(run);
      const tab = await chrome.tabs.get(run.listTabId);
      if (tab.status === 'complete') {
        if (!gemUrl(tab.url) || !/^\/seller-bids\/?$/.test(new URL(tab.url).pathname)) throw new Error('Selected GeM list tab left seller-bids. Return to the awarded list and retry.');
        const state = await listSnapshot(run.listTabId);
        if (JSON.stringify(state.filters.filter((item) => item.checked).map((item) => item.key).sort()) !== JSON.stringify(expectedFilters.filter((item) => item.checked).map((item) => item.key).sort())) throw new Error('GeM filters changed during pagination. Scan stopped to avoid saving a different bid list.');
        if (state.signature && (!previous || state.signature !== previous.signature) && (!expectedPage || state.page === expectedPage)) {
          const key = `${state.page}:${state.signature}:${state.next}`;
          stableCount = key === stable ? stableCount + 1 : 1;
          stable = key;
          if (stableCount >= 2) return state;
        }
      }
      await sleep(750);
    }
    const error = new Error('Seller list is still showing the previous bid cards.');
    error.code = 'FINANCIAL_PAGE_WAIT';
    throw error;
  }
  async function restoreCurrentList(run) {
    await update(run, 'running', `Restoring filtered seller list page ${run.page} after inline RA result...`);
    let tab = await chrome.tabs.get(run.listTabId);
    const targetUrl = `https://bidplus.gem.gov.in/seller-bids#page-${run.page}`;
    if (!gemUrl(tab.url) || !/^\/seller-bids\/?$/.test(new URL(tab.url).pathname)) {
      await chrome.tabs.update(run.listTabId, { url: targetUrl, active: false });
    } else {
      await chrome.tabs.reload(run.listTabId);
    }
    const loadDeadline = Date.now() + 60000;
    while (Date.now() < loadDeadline) {
      await check(run);
      tab = await chrome.tabs.get(run.listTabId);
      if (tab.status === 'complete' && gemUrl(tab.url) && /^\/seller-bids\/?$/.test(new URL(tab.url).pathname)) break;
      await sleep(1000);
    }
    await inject(run.listTabId);
    const filterDeadline = Date.now() + 45000;
    let ready = false;
    while (Date.now() < filterDeadline && !ready) {
      await check(run);
      const response = await chrome.scripting.executeScript({ target: { tabId: run.listTabId }, args: [run.expectedFilters], func: (expected) => globalThis.AcxxelFinancialList.restoreFilters(document, expected) });
      ready = Boolean(response[0]?.result?.ready);
      if (!ready) await sleep(1500);
    }
    if (!ready) throw new Error('Could not restore the Bid/RA Awarded filters after closing an inline result.');
    await chrome.scripting.executeScript({ target: { tabId: run.listTabId }, args: [run.page], func: (page) => { document.location.hash = `#page-${page}`; } });
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      await check(run);
      const state = await listSnapshot(run.listTabId);
      if (state.page === run.page && state.signature) return;
      await sleep(1000);
    }
    throw new Error(`Could not restore seller list page ${run.page} after reading the RA result.`);
  }
  async function moveList(run, direction, expectedFilters, previous) {
    const expectedPage = direction === 'first' ? 1 : previous.page + 1;
    const verify = (state) => {
      if (state.page !== expectedPage) throw new Error(`Expected page ${expectedPage}, received ${state.page || 'unknown'}. Scan stopped to avoid skipping pages.`);
      return state;
    };
    const waitChanged = async (timeout) => {
      try { return verify(await waitList(run, expectedFilters, previous, timeout, expectedPage)); }
      catch (error) { if (error.code !== 'FINANCIAL_PAGE_WAIT') throw error; return null; }
    };
    // Part A ordering: real Next click, wait for cards, late-response wait,
    // second click only if still unchanged, then hash recovery and final wait.
    for (let attempt = 1; attempt <= 2; attempt++) {
      await check(run);
      const latest = await listSnapshot(run.listTabId);
      if (latest.signature && latest.page === expectedPage && (direction === 'first' || latest.signature !== previous.signature)) return verify(latest);
      const result = await chrome.scripting.executeScript({ target: { tabId: run.listTabId }, args: [direction], func: (direction) => globalThis.AcxxelFinancialList.navigate(document, direction) });
      const navigation = result[0]?.result;
      if (direction === 'first' && navigation === 'already') {
        return verify(await waitList(run, expectedFilters, null, 15000, 1));
      }
      if (!['clicked', 'routed'].includes(navigation)) {
        if (navigation !== 'missing') throw new Error(`Cannot navigate ${direction}: ${navigation || 'missing pagination'}. Scan is incomplete.`);
        await update(run, 'running', `Page ${previous.page}: Next is temporarily missing. Waiting before route recovery (${run.saved || 0} saved)...`);
        const appeared = await waitChanged(10000);
        if (appeared) return appeared;
        continue;
      }
      let state = await waitChanged(15000);
      if (state) return state;
      await update(run, 'running', `Page ${previous.page}: waiting for GeM's delayed page ${expectedPage} response (${run.saved || 0} saved)...`);
      state = await waitChanged(30000);
      if (state) return state;
    }
    await chrome.scripting.executeScript({ target: { tabId: run.listTabId }, args: [previous.page, expectedPage], func: (from, to) => globalThis.AcxxelFinancialList.recoverRoute(document, from, to) });
    const recovered = await waitChanged(20000);
    if (recovered) return recovered;

    // GeM can leave its Angular seller list on an endless spinner even though
    // the URL already points at the next page. Recover the isolated list tab
    // completely, restore the captured filters, and verify the exact next page
    // before continuing. The user's visible GeM tab is never reloaded.
    for (let reloadAttempt = 1; reloadAttempt <= 3; reloadAttempt++) {
      await check(run);
      await update(run, 'running', `Page ${previous.page}: GeM list stalled. Reloading the background list and restoring filters (${reloadAttempt}/3)...`);
      await chrome.tabs.reload(run.listTabId);
      const loadDeadline = Date.now() + 60000;
      let loaded = false;
      while (Date.now() < loadDeadline) {
        await check(run);
        const tab = await chrome.tabs.get(run.listTabId);
        if (tab.status === 'complete') {
          if (!gemUrl(tab.url) || !/^\/seller-bids\/?$/.test(new URL(tab.url).pathname)) {
            throw new Error('Dedicated list tab left seller-bids during recovery. Log in to GeM again.');
          }
          loaded = true;
          break;
        }
        await sleep(1000);
      }
      if (!loaded) continue;
      await inject(run.listTabId);

      const filterDeadline = Date.now() + 45000;
      let filtersReady = false;
      while (Date.now() < filterDeadline && !filtersReady) {
        await check(run);
        const response = await chrome.scripting.executeScript({
          target: { tabId: run.listTabId },
          args: [expectedFilters],
          func: (expected) => globalThis.AcxxelFinancialList.restoreFilters(document, expected),
        });
        filtersReady = Boolean(response[0]?.result?.ready);
        if (!filtersReady) await sleep(1500);
      }
      if (!filtersReady) continue;

      await chrome.scripting.executeScript({
        target: { tabId: run.listTabId },
        args: [expectedPage],
        func: (targetPage) => { document.location.hash = `#page-${targetPage}`; },
      });
      const afterReload = await waitChanged(60000);
      if (afterReload) return afterReload;
    }
    throw new Error(`GeM could not load verified page ${expectedPage} after automatic click, route and reload recovery. Scan is incomplete; ${run.saved || 0} saved records are retained.`);
  }

  async function scan(run) {
    const owned = new Set();
    const workerFocused = (windowId) => {
      if (!run.workerWindowId || windowId !== run.workerWindowId) return;
      chrome.windows.update(run.workerWindowId, { state: 'minimized', focused: false }).catch(() => {});
      if (Number.isInteger(run.foregroundWindowId)) chrome.windows.update(run.foregroundWindowId, { focused: true }).catch(() => {});
    };
    const childCreated = (tab) => {
      // Some GeM window.open paths omit openerTabId. During the tightly scoped
      // result-click window, the only extension-created tab is its result.
      if (tab.openerTabId === run.listTabId || owned.has(tab.openerTabId) || run.awaitingResultChild) {
        owned.add(tab.id);
        run.tabId = tab.id;
        // GeM opens result tabs through its own window.open call, which Chrome
        // activates by default — stealing focus from whatever tab the user is
        // on, including the Acxxel site itself. Push it back to the background
        // immediately so the scan never disturbs the user's current tab.
        chrome.tabs.update(tab.id, { active: false }).catch(() => {});
        restoreForegroundTab(run, tab);
        if (run.workerWindowId && tab.windowId !== run.workerWindowId) {
          chrome.tabs.move(tab.id, { windowId: run.workerWindowId, index: -1 }).catch(() => {});
        }
      }
    };
    chrome.tabs.onCreated.addListener(childCreated);
    chrome.windows.onFocusChanged.addListener(workerFocused);
    let savedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    const failures = [];
    let lastFailure = '';
    try {
      await update(run, 'starting', 'Preparing all-page scan in the selected Bid/RA Awarded tab...');
      const saved = await chrome.storage.local.get(['token', 'apiBase']);
      if (!saved.token) throw new Error('Log in to Acxxel and connect the extension first.');
      const base = new URL(saved.apiBase || 'http://127.0.0.1:8000/api');
      if (!['https://acxxelbidding.com', 'https://www.acxxelbidding.com', 'http://127.0.0.1:8000', 'http://localhost:8000'].includes(base.origin)) throw new Error('Unsupported Acxxel API address.');
      const [source] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!gemUrl(source?.url) || new URL(source.url).pathname !== '/seller-bids') throw new Error('Open the seller-bids list with Bid/RA Awarded selected, then scan.');
      // Read-only discovery: no filter changes, clicks, or navigation in the user's tab.
      await inject(source.id);
      const sourceState = await listSnapshot(source.id);
      if (!sourceState.filters.some((item) => item.checked && /bid\s*\/\s*ra\s+awarded/i.test(item.key))) throw new Error('Select Bid/RA Awarded in the GeM filter sidebar before scanning.');
      if (!sourceState.filters.some((item) => item.checked && /bids?\s*\/\s*ras?\s+already\s+submitted\s*\/\s*participated/i.test(item.key))) throw new Error('Select Bids/RAs Already Submitted/Participated before scanning.');
      if (!sourceState.signature) throw new Error('Wait for the GeM bid cards to load before scanning.');
      run.expectedFilters = sourceState.filters;
      // GeM does not serialize Bid/RA Awarded into the URL and keeps that
      // checkbox disabled in a freshly copied tab. Use the user's already
      // filtered seller-list tab directly; only result documents get separate
      // background tabs. The source tab is never owned or closed by this run.
      run.listTabId = source.id;
      run.usesSourceListTab = true;
      await createWorkerWindow(run, source);
      let pageState = sourceState;
      if (pageState.page !== 1) pageState = await moveList(run, 'first', sourceState.filters, pageState);
      const seenPages = new Set();
      const seenBids = new Set();
      let checkedCount = 0;
      let skippedBeforeDate = 0;
      let skippedMissingDate = 0;
      let stoppedAtPageLimit = false;
      const companyStatusCounts = { qualified: 0, not_evaluated: 0, non_qualified: 0, disqualified: 0, unknown: 0 };
      let pageCount = 0;
      let repeatedRecoveryCount = 0;
      while (true) {
        await check(run);
        if (seenPages.has(pageState.signature)) {
          repeatedRecoveryCount += 1;
          if (repeatedRecoveryCount > 3) throw new Error(`GeM repeatedly returned old bid cards for page ${pageState.page || run.page + 1}. Scan stopped before processing duplicates.`);
          run.page = pageState.page || run.page + 1;
          await update(run, 'running', `Page ${run.page}: GeM returned repeated bid cards. Reloading the dedicated list and restoring filters (${repeatedRecoveryCount}/3)...`);
          await restoreCurrentList(run);
          pageState = await waitList(run, sourceState.filters, null, 45000);
          continue;
        }
        repeatedRecoveryCount = 0;
        seenPages.add(pageState.signature);
        pageCount++;
        run.page = pageState.page;
        checkedCount += pageState.cards.length;
        const tasks = [];
        for (const card of pageState.cards) {
          const key = `${card.bid_no}:${card.ra_no}`;
          if (seenBids.has(key)) continue;
          if (!card.start_date) { skippedMissingDate += 1; seenBids.add(key); continue; }
          if (card.start_date < run.startDateFrom) { skippedBeforeDate += 1; seenBids.add(key); continue; }
          tasks.push(card);
        }
        await update(run, 'running', `Page ${run.page}/${run.lastPage}: ${tasks.length} awarded bids on/after ${run.startDateFrom}; ${savedCount} saved, ${failures.length} failed, ${skippedBeforeDate + skippedMissingDate} date-skipped.${lastFailure ? ` Last failure: ${lastFailure}` : ''}`);
      for (const task of tasks) {
        await check(run);
        seenBids.add(`${task.bid_no}:${task.ra_no}`);
        await update(run, 'running', `Page ${run.page}: reading awarded ${task.bid_no} / ${task.ra_no || 'Bid'} (${savedCount} saved)...`);
        try {
          let bidEvaluation = null;
          let raRanking = null;
          const readErrors = [];
          const cardStatus = validSellerStatus(task.technical_status);
          const needsBidResult = !task.has_ra_result || cardStatus === 'unknown';
          if (task.has_bid_result && needsBidResult) {
            await update(run, 'running', `${task.bid_no}: reading seller status/ranking from View Bid Results (${savedCount} saved, ${failures.length} failed)...`);
            try { bidEvaluation = await readTaskWithRecovery(run, task, 'bid', task.bid_result_url, readResult, owned); }
            catch (error) { readErrors.push(`View Bid Results: ${error.message}`); }
          }
          if (task.has_ra_result) {
            await update(run, 'running', `${task.bid_no}: Technical Status ${cardStatus}; reading final L1/L2/L3 from View RA Results (${savedCount} saved, ${failures.length} failed)...`);
            try { raRanking = await readTaskWithRecovery(run, task, 'ra', task.ra_result_url, readResult, owned); }
            catch (error) { readErrors.push(`View RA Results: ${error.message}`); }
          }
          if (task.has_ra_result && !raRanking) throw new Error(readErrors.join(' | ') || 'View RA Results could not be read.');
          const ranking = raRanking || bidEvaluation;
          if (!ranking) throw new Error(readErrors.join(' | ') || 'No View Bid Results or View RA Results control was available.');
          const combined = combineRankingAndEvaluation(ranking, bidEvaluation, task.technical_status);
          await check(run);
          await update(run, 'saving', `Saving ${task.bid_no} awarded ranking (${combined.companyStatus})...`);
          const response = await fetch(`${base.href.replace(/\/$/, '')}/gem/financial-rankings/`, {
            method: 'POST', signal: AbortSignal.timeout(20000),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saved.token}` },
            body: JSON.stringify({ bid_no: task.bid_no, ra_no: task.ra_no || '', source_type: 'bid_ra_awarded', technical_status: combined.companyStatus, start_date: task.start_date, end_date: task.end_date, sellers: combined.sellers, item_name: combined.sellers[0]?.offeredItem || '' }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || `Save failed (HTTP ${response.status}).`);
          if (payload.saved !== 1 || payload.frontend_visible !== true) {
            throw new Error('API did not confirm that this result is available in the frontend.');
          }
          savedCount += payload.saved;
          createdCount += payload.created || 0;
          updatedCount += payload.updated || 0;
          companyStatusCounts[combined.companyStatus] += 1;
          run.saved = savedCount;
        } catch (error) {
          await check(run);
          lastFailure = `${task.bid_no}: ${error.message}`;
          failures.push(lastFailure);
          await update(run, 'running', `${lastFailure} Continuing page ${run.page}...`);
        } finally {
          for (const id of owned) await chrome.tabs.remove(id).catch(() => {});
          owned.clear();
          run.tabId = null;
        }
      }
        if (Number(run.page) >= run.lastPage) { stoppedAtPageLimit = true; break; }
        if (pageState.next === 'end') break;
        if (pageState.next !== 'available') {
          await update(run, 'running', `Page ${run.page}: Next control is temporarily missing. Starting verified page ${run.page + 1} recovery...`);
        }
        await update(run, 'running', `Page ${run.page} processed. Loading the next page (${savedCount} saved, ${failures.length} failed).${lastFailure ? ` Last failure: ${lastFailure}` : ''}`);
        pageState = await moveList(run, 'next', sourceState.filters, pageState);
      }
      await update(run, failures.length ? 'failed' : 'complete', `${stoppedAtPageLimit ? `Page limit ${run.lastPage} reached` : 'Last available awarded page reached'}: ${pageCount} pages and ${checkedCount} cards checked; ${savedCount} frontend-valid rankings (${createdCount} new, ${updatedCount} refreshed) for Start Date ${run.startDateFrom} onward; ${skippedBeforeDate} older and ${skippedMissingDate} missing-date cards skipped (Qualified ${companyStatusCounts.qualified}, Not Evaluated ${companyStatusCounts.not_evaluated}, Non-Qualified ${companyStatusCounts.non_qualified}, Disqualified ${companyStatusCounts.disqualified}, Unknown ${companyStatusCounts.unknown}). ${failures.join(' | ') || 'The analyser report updates automatically.'}`);
    } catch (error) {
      await update(run, run.cancelled ? 'stopped' : 'failed', `${error.message} (${savedCount} saved, ${failures.length} bid failures).${lastFailure ? ` Last bid failure: ${lastFailure}` : ''}`);
    } finally {
      chrome.tabs.onCreated.removeListener(childCreated);
      chrome.windows.onFocusChanged.removeListener(workerFocused);
      for (const id of owned) await chrome.tabs.remove(id).catch(() => {});
      if (run.listTabId && !run.usesSourceListTab) await chrome.tabs.remove(run.listTabId).catch(() => {});
      await restoreListTabAndCloseWorker(run);
      active = null;
    }
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'financial-ranking') return;
    const sender = port.sender;
    const respond = (response) => { try { port.postMessage(response); } catch { /* Popup closed. */ } };
    port.onMessage.addListener((message) => {
    if (!['FINANCIAL_START', 'FINANCIAL_PAUSE', 'FINANCIAL_RESUME', 'FINANCIAL_STATE'].includes(message.type)) return;
    if (sender.id !== chrome.runtime.id || sender.tab) { respond({ ok: false, error: 'Use the extension popup for financial scans.' }); return; }
    (async () => {
      if (message.type === 'FINANCIAL_START') {
        if (active) throw new Error('An awarded Bid/RA scan is already running.');
        const startDateFrom = message.startDateFrom || '2026-01-01';
        const lastPage = Number(message.lastPage || 65);
        if (!validIsoDate(startDateFrom)) throw new Error('Choose a valid Start Date From.');
        if (!Number.isInteger(lastPage) || lastPage < 1 || lastPage > 5000) throw new Error('Last Page must be between 1 and 5000.');
        active = { status: 'starting', message: `Starting awarded Bid/RA scan from ${startDateFrom} through page ${lastPage}...`, startDateFrom, lastPage };
        void scan(active);
        return active;
      }
      if (message.type === 'FINANCIAL_PAUSE' && active) {
        if (active.status === 'saving') throw new Error('Save is already in progress. Wait for its result.');
        if (active.status === 'paused') return active;
        active.paused = true;
        return { status: 'pausing', message: 'Pausing awarded Bid/RA scan...' };
      }
      if (message.type === 'FINANCIAL_RESUME' && active) {
        if (!active.paused) return active;
        active.paused = false;
        const waiters = active.resumeWaiters || [];
        active.resumeWaiters = [];
        waiters.forEach((resolve) => resolve());
        return { status: 'running', message: 'Resuming awarded Bid/RA scan...' };
      }
      const stored = (await chrome.storage.local.get(KEY))[KEY];
      if (!active && ['starting', 'running', 'saving', 'paused'].includes(stored?.status)) {
        const state = { ...stored, status: 'failed', message: 'Financial scan was interrupted. Check the report before retrying; any leftover scan tab may be closed manually.' };
        await chrome.storage.local.set({ [KEY]: state });
        return state;
      }
      return active || stored;
    })().then((state) => respond({ ok: true, state }), (error) => respond({ ok: false, error: error.message }));
    });
  });
})();
