(() => {
  const KEY = 'financialEvalSyncState';
  let active = null;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const gemUrl = (value) => {
    try { const url = new URL(value); return url.protocol === 'https:' && url.hostname.endsWith('.gem.gov.in'); }
    catch { return false; }
  };
  async function update(run, status, message) {
    run.status = status;
    run.message = message;
    await chrome.storage.local.set({ [KEY]: { status, message, tabId: run.tabId || null, listTabId: run.listTabId || null, page: run.page || 0, saved: run.saved || 0, updatedAt: Date.now() } });
  }
  function check(run) { if (run.cancelled) throw new Error('Financial scan stopped.'); }

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
      check(run);
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

  async function openTaskResult(run, task, kind, directUrl, owned) {
    if (directUrl) {
      const tab = await chrome.tabs.create({ url: directUrl, active: false });
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
      check(run);
      const current = await chrome.tabs.get(run.listTabId);
      if (current.status === 'complete' && gemUrl(current.url)) {
        await inject(run.listTabId);
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
    if (!opened) throw new Error(`[v3.59 fresh-click] View ${kind === 'bid' ? 'Bid' : 'RA'} Results was not found for this bid.`);
    return run.tabId || tab.id;
  }

  function transientResultError(error) {
    return /frame\s+with\s+id\s+\d+\s+is\s+showing\s+error\s+page|frame\s+was\s+removed|no\s+frame\s+with\s+id|cannot\s+access\s+contents|receiving\s+end\s+does\s+not\s+exist|waiting\s+for\s+result\s+document/i.test(error?.message || '');
  }

  async function readTaskWithRecovery(run, task, kind, directUrl, reader, owned) {
    let lastError;
    let retryUrl = directUrl || null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      check(run);
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
      check(run);
      const tab = await chrome.tabs.get(run.listTabId);
      if (tab.status === 'complete') {
        if (!gemUrl(tab.url) || !/^\/seller-bids\/?$/.test(new URL(tab.url).pathname)) throw new Error('Dedicated list tab left seller-bids. Log in to GeM and retry.');
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
      check(run);
      tab = await chrome.tabs.get(run.listTabId);
      if (tab.status === 'complete' && gemUrl(tab.url) && /^\/seller-bids\/?$/.test(new URL(tab.url).pathname)) break;
      await sleep(1000);
    }
    await inject(run.listTabId);
    const filterDeadline = Date.now() + 45000;
    let ready = false;
    while (Date.now() < filterDeadline && !ready) {
      check(run);
      const response = await chrome.scripting.executeScript({ target: { tabId: run.listTabId }, args: [run.expectedFilters], func: (expected) => globalThis.AcxxelFinancialList.restoreFilters(document, expected) });
      ready = Boolean(response[0]?.result?.ready);
      if (!ready) await sleep(1500);
    }
    if (!ready) throw new Error('Could not restore the Financial Evaluated filters after closing an inline RA result.');
    await chrome.scripting.executeScript({ target: { tabId: run.listTabId }, args: [run.page], func: (page) => { document.location.hash = `#page-${page}`; } });
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      check(run);
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
      check(run);
      const latest = await listSnapshot(run.listTabId);
      if (latest.signature && latest.signature !== previous.signature && latest.page === expectedPage) return verify(latest);
      const result = await chrome.scripting.executeScript({ target: { tabId: run.listTabId }, args: [direction], func: (direction) => globalThis.AcxxelFinancialList.navigate(document, direction) });
      const navigation = result[0]?.result;
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
      check(run);
      await update(run, 'running', `Page ${previous.page}: GeM list stalled. Reloading the background list and restoring filters (${reloadAttempt}/3)...`);
      await chrome.tabs.reload(run.listTabId);
      const loadDeadline = Date.now() + 60000;
      let loaded = false;
      while (Date.now() < loadDeadline) {
        check(run);
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
        check(run);
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
    const childCreated = (tab) => {
      // Some GeM window.open paths omit openerTabId. During the tightly scoped
      // result-click window, the only extension-created tab is its result.
      if (owned.has(tab.openerTabId) || run.awaitingResultChild) {
        owned.add(tab.id);
        run.tabId = tab.id;
        // GeM opens result tabs through its own window.open call, which Chrome
        // activates by default — stealing focus from whatever tab the user is
        // on, including the Acxxel site itself. Push it back to the background
        // immediately so the scan never disturbs the user's current tab.
        chrome.tabs.update(tab.id, { active: false }).catch(() => {});
      }
    };
    chrome.tabs.onCreated.addListener(childCreated);
    let savedCount = 0;
    const failures = [];
    let lastFailure = '';
    try {
      await update(run, 'starting', 'Preparing all-page qualified RA scan in a separate list tab...');
      const saved = await chrome.storage.local.get(['token', 'apiBase']);
      if (!saved.token) throw new Error('Log in to Acxxel and connect the extension first.');
      const base = new URL(saved.apiBase || 'http://127.0.0.1:8000/api');
      if (!['https://acxxelbidding.com', 'https://www.acxxelbidding.com', 'http://127.0.0.1:8000', 'http://localhost:8000'].includes(base.origin)) throw new Error('Unsupported Acxxel API address.');
      const [source] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!gemUrl(source?.url) || new URL(source.url).pathname !== '/seller-bids') throw new Error('Open the seller-bids list with Financial Evaluated selected, then scan.');
      // Read-only discovery: no filter changes, clicks, or navigation in the user's tab.
      await inject(source.id);
      const sourceState = await listSnapshot(source.id);
      if (!sourceState.filters.some((item) => item.checked && /financial\s+evaluated/i.test(item.key))) throw new Error('Select Financial Evaluated in the GeM filter sidebar before scanning.');
      if (!sourceState.filters.some((item) => item.checked && /bids?\s*\/\s*ras?\s+already\s+submitted\s*\/\s*participated/i.test(item.key))) throw new Error('Select Bids/RAs Already Submitted/Participated before scanning.');
      if (!sourceState.signature) throw new Error('Wait for the GeM bid cards to load before scanning.');
      run.expectedFilters = sourceState.filters;
      const listUrl = new URL(source.url);
      listUrl.hash = 'page-1';
      const listTab = await chrome.tabs.create({ url: listUrl.href, active: false });
      run.listTabId = listTab.id;
      // Reproduce checkbox/radio filters only in the dedicated list tab.
      let restored = false;
      let restoreReason = 'Waiting for dedicated GeM tab to load.';
      const restoreDeadline = Date.now() + 60000;
      while (Date.now() < restoreDeadline && !restored) {
        check(run);
        const tab = await chrome.tabs.get(run.listTabId);
        if (tab.status === 'complete' && (!gemUrl(tab.url) || !/^\/seller-bids\/?$/.test(new URL(tab.url).pathname))) throw new Error('Dedicated tab redirected away from seller-bids. Log in to GeM again.');
        if (tab.status === 'complete' && gemUrl(tab.url)) {
          await inject(run.listTabId);
          const response = await chrome.scripting.executeScript({ target: { tabId: run.listTabId }, args: [sourceState.filters], func: (expected) => globalThis.AcxxelFinancialList.restoreFilters(document, expected) });
          restored = response[0]?.result?.ready;
          restoreReason = response[0]?.result?.reason || 'Waiting for filter update.';
          if (!restored) await update(run, 'starting', restoreReason);
        }
        if (!restored) await sleep(1500);
      }
      if (!restored) throw new Error(`Could not reproduce selected filters: ${restoreReason} (v${chrome.runtime.getManifest().version}).`);
      let pageState = await waitList(run, sourceState.filters);
      if (pageState.page !== 1) pageState = await moveList(run, 'first', sourceState.filters, pageState);
      const seenPages = new Set();
      const seenBids = new Set();
      let checkedCount = 0;
      let companyQualifiedCount = 0;
      let pageCount = 0;
      let repeatedRecoveryCount = 0;
      while (true) {
        check(run);
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
        // This is the logged-in seller's own seller-bids list. Therefore the
        // card-level Technical Status is Laps N Tabs' qualification status.
        // Do not add an unrelated View Bid Results gate before the RA result.
        const tasks = pageState.cards.filter((card) => card.technical_status === 'qualified' && !seenBids.has(`${card.bid_no}:${card.ra_no}`));
        companyQualifiedCount += tasks.length;
        await update(run, 'running', `Page ${run.page}: ${tasks.length} Laps N Tabs-qualified bids found; ${savedCount} financial rankings saved, ${failures.length} failed so far.${lastFailure ? ` Last failure: ${lastFailure}` : ''}`);
      for (const task of tasks) {
        check(run);
        seenBids.add(`${task.bid_no}:${task.ra_no}`);
        const resultKind = task.has_ra_result ? 'ra' : 'bid';
        const resultLabel = resultKind === 'ra' ? 'View RA Results' : 'View Bid Results';
        const resultUrl = resultKind === 'ra' ? task.ra_result_url : task.bid_result_url;
        await update(run, 'running', `Page ${run.page}: opening ${task.bid_no} / ${task.ra_no || 'Bid'} via ${resultLabel} (${savedCount} saved)...`);
        try {
          await update(run, 'running', `${task.bid_no}: Technical Status is Qualified. Reading L1/L2/L3 from ${resultLabel}...`);
          const result = await readTaskWithRecovery(run, task, resultKind, resultUrl, readResult, owned);
          check(run);
          await update(run, 'saving', `Saving ${task.bid_no} financial report...`);
          const response = await fetch(`${base.href.replace(/\/$/, '')}/gem/financial-rankings/`, {
            method: 'POST', signal: AbortSignal.timeout(20000),
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saved.token}` },
            body: JSON.stringify({ bid_no: task.bid_no, ra_no: task.ra_no || '', technical_status: 'qualified', sellers: result.sellers, item_name: result.sellers[0]?.offeredItem || '' }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || `Save failed (HTTP ${response.status}).`);
          savedCount += 1;
          run.saved = savedCount;
        } catch (error) {
          check(run);
          lastFailure = `${task.bid_no}: ${error.message}`;
          failures.push(lastFailure);
          await update(run, 'running', `${lastFailure} Continuing page ${run.page}...`);
        } finally {
          for (const id of owned) await chrome.tabs.remove(id).catch(() => {});
          owned.clear();
          run.tabId = null;
        }
      }
        if (pageState.next === 'end') break;
        if (pageState.next !== 'available') {
          await update(run, 'running', `Page ${run.page}: Next control is temporarily missing. Starting verified page ${run.page + 1} recovery...`);
        }
        await update(run, 'running', `Page ${run.page} processed. Loading the next page (${savedCount} saved, ${failures.length} failed).${lastFailure ? ` Last failure: ${lastFailure}` : ''}`);
        pageState = await moveList(run, 'next', sourceState.filters, pageState);
      }
      await update(run, failures.length ? 'failed' : 'complete', `All ${pageCount} pages read: ${checkedCount} bids checked; Laps N Tabs qualified in ${companyQualifiedCount}; ${savedCount} financial rankings saved. ${failures.join(' | ') || 'Refresh the analyser report.'}`);
    } catch (error) {
      await update(run, run.cancelled ? 'stopped' : 'failed', `${error.message} (${savedCount} saved, ${failures.length} bid failures).${lastFailure ? ` Last bid failure: ${lastFailure}` : ''}`);
    } finally {
      chrome.tabs.onCreated.removeListener(childCreated);
      for (const id of owned) await chrome.tabs.remove(id).catch(() => {});
      if (run.listTabId) await chrome.tabs.remove(run.listTabId).catch(() => {});
      active = null;
    }
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'financial-ranking') return;
    const sender = port.sender;
    const respond = (response) => { try { port.postMessage(response); } catch { /* Popup closed. */ } };
    port.onMessage.addListener((message) => {
    if (!['FINANCIAL_START', 'FINANCIAL_STOP', 'FINANCIAL_STATE'].includes(message.type)) return;
    if (sender.id !== chrome.runtime.id || sender.tab) { respond({ ok: false, error: 'Use the extension popup for financial scans.' }); return; }
    (async () => {
      if (message.type === 'FINANCIAL_START') {
        if (active) throw new Error('A financial scan is already running.');
        active = { status: 'starting', message: 'Starting financial scan...' };
        void scan(active);
        return active;
      }
      if (message.type === 'FINANCIAL_STOP' && active) {
        if (active.status === 'saving') throw new Error('Save is already in progress. Wait for its result.');
        active.cancelled = true;
        return { status: 'stopping', message: 'Stopping financial scan...' };
      }
      const stored = (await chrome.storage.local.get(KEY))[KEY];
      if (!active && ['starting', 'running', 'saving', 'stopping'].includes(stored?.status)) {
        const state = { ...stored, status: 'failed', message: 'Financial scan was interrupted. Check the report before retrying; any leftover scan tab may be closed manually.' };
        await chrome.storage.local.set({ [KEY]: state });
        return state;
      }
      return active || stored;
    })().then((state) => respond({ ok: true, state }), (error) => respond({ ok: false, error: error.message }));
    });
  });
})();
