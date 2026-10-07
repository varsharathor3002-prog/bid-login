(() => {
  // Product Scan: works like the Bid To Be Participated scan. The user opens a
  // GeM Market search (any category, any filters); the scan reads the open
  // page in that tab, reads each product's page one by one, saves the page's
  // products, clicks Next in the tab and repeats until the last page.
  // Only acxxel products are taken. Desktop (Entry and Mid Level / High End)
  // products update the Desktop directory + Desktop_Product.xlsx; every other
  // category gets its own Excel.
  const KEY = 'gemProductScan';
  const BRAND = 'acxxel';
  const DESKTOP_CATEGORY = /^(entry and mid level|high end) desktop computer/i;
  const { parseProduct, fetchText } = globalThis.AcxxelGemProduct;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let run = null;

  async function update(changes) {
    const state = { ...(await chrome.storage.local.get(KEY))[KEY], ...changes, updatedAt: Date.now() };
    await chrome.storage.local.set({ [KEY]: state });
    return state;
  }

  // Runs in the GeM tab: the page the user is looking at.
  function readOpenPage() {
    const root = document.querySelector('#search-results') || document.body;
    const text = root.innerText || '';
    const showing = text.match(/Showing\s+([\d\s-]+)products\s+of\s+(\d+)\s+products/i);
    const heading = document.querySelector('.browse-node-name, #search-results h1, h1')?.innerText || '';
    return {
      showing: showing ? showing[0] : '',
      total: Number(showing?.[2] || 0),
      page: Number(root.querySelector('.pagination .current')?.innerText || 1),
      category: (root.querySelector('.bn-breadcrumbs')?.innerText || '').replace(/^\s*in\s+/i, '').trim() || heading.trim(),
      // [path, brand on the card] so other brands are skipped unopened.
      links: [...new Map([...root.querySelectorAll('a[href*="-cat.html"]')].map((a) => {
        const card = a.closest('li') || a.parentElement;
        const brand = (card?.querySelector('.variant-brand')?.innerText || '').replace(/^\s*Brand:\s*/i, '').trim();
        return [new URL(a.getAttribute('href'), location.origin).pathname, brand];
      })).entries()],
      hasNext: Boolean(root.querySelector('.pagination a.next_page')),
    };
  }

  // Runs in the GeM tab.
  function clickNext() {
    const next = (document.querySelector('#search-results') || document.body).querySelector('.pagination a.next_page');
    if (!next) return false;
    next.click();
    return true;
  }

  async function readPage(tabId) {
    const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: readOpenPage });
    return result?.result;
  }

  // GeM loads the next page by AJAX or by a full page load; wait for either.
  async function nextPage(tabId, before) {
    await chrome.scripting.executeScript({ target: { tabId }, func: clickNext });
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      await sleep(800);
      await check();
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status !== 'complete') continue;
        const page = await readPage(tabId);
        if (page?.showing && page.showing !== before.showing && page.links.length) return page;
      } catch (error) {
        if (/No tab with id/i.test(error.message)) throw new Error('The GeM tab was closed. Open the search again and restart the scan.');
      }
    }
    throw new Error(`GeM page ${before.page + 1} did not load. Click Scan Products to retry from the open page.`);
  }

  function resumeSignal() {
    return new Promise((resolve) => { run.resume = resolve; });
  }

  async function check() {
    if (!run?.paused) return;
    await update({ status: 'paused', message: `Scan paused on page ${run.page}. ${run.saved} products saved so far.` });
    await resumeSignal();
    await update({ status: 'running', message: `Scan resumed on page ${run.page}.` });
  }

  async function savePage(category, products) {
    if (DESKTOP_CATEGORY.test(category)) {
      const withModel = products.filter((p) => p.model_no);
      if (!withModel.length) return 0;
      await api('/catalogue/replace-from-gem-market/', {
        method: 'POST',
        body: JSON.stringify({ products: withModel, total: withModel.length, mode: 'update' }),
      });
      run.target = 'Desktop directory + Desktop_Product.xlsx';
      return withModel.length;
    }
    const result = await api('/catalogue/gem-category-excel/', {
      method: 'POST',
      body: JSON.stringify({ category, products }),
    });
    run.target = result.file;
    return products.length;
  }

  async function scan(tabId) {
    try {
      let page = await readPage(tabId);
      if (!page?.total || !page.links.length) throw new Error('Open a GeM Market search with products (category + filters), then click Scan Products.');
      const category = page.category || 'GeM Search';
      run.total = page.total;
      const seen = new Set();
      while (true) {
        run.page = page.page;
        const products = [];
        const fresh = page.links.filter(([link]) => !seen.has(link));
        fresh.forEach(([link]) => seen.add(link));
        const links = fresh.filter(([, brand]) => !brand || brand.toLowerCase() === BRAND).map(([link]) => link);
        run.skipped += fresh.length - links.length;
        for (const [index, link] of links.entries()) {
          await check();
          const url = `https://mkp.gem.gov.in${link}`;
          const product = { url, ...parseProduct(await fetchText(url)) };
          // The card brand can be missing; the product page is authoritative.
          if (product.brand.toLowerCase() !== BRAND) { run.skipped += 1; continue; }
          if (!product.pairs.length) { run.failed.push(url); continue; }
          products.push(product);
          run.read += 1;
          await update({ message: `Page ${page.page}: reading product ${index + 1} of ${links.length} (${product.model_no || product.title}). ${run.saved} saved so far.`, page: page.page, read: run.read });
          await sleep(250);
        }
        if (products.length) {
          run.saved += await savePage(category, products);
          // GeM lists some models several times; Excel keeps one row each.
          products.forEach((p) => run.models.add((p.model_no || p.url).toUpperCase()));
        }
        await update({ message: `Page ${page.page} saved. ${run.saved} products saved so far (${category}).`, saved: run.saved });
        if (!page.hasNext) break;
        await check();
        page = await nextPage(tabId, page);
      }
      const notes = [];
      if (run.skipped) notes.push(`${run.skipped} other-brand product(s) skipped (only acxxel is taken)`);
      if (run.failed.length) notes.push(`${run.failed.length} product page(s) had no specifications`);
      await update({
        status: 'complete',
        message: `Scan complete: ${run.read} products read, ${run.saved} saved to ${run.target || 'Excel'} (${run.models.size} different model numbers; GeM lists some models more than once).${notes.length ? ` ${notes.join('; ')}.` : ''}`,
      });
    } catch (error) {
      await update({ status: 'failed', message: `${error.message} ${run.saved} products were already saved.` });
    } finally {
      run = null;
    }
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'gem-product-scan') return;
    const respond = (response) => { try { port.postMessage(response); } catch { /* Popup closed. */ } };
    port.onMessage.addListener((message) => {
      if (port.sender?.id !== chrome.runtime.id || port.sender?.tab) {
        respond({ ok: false, error: 'Use the extension popup for the Product Scan.' });
        return;
      }
      (async () => {
        if (message.type === 'PRODUCT_SCAN_START') {
          if (run) throw new Error('Product Scan is already running.');
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab?.id || !/^https:\/\/mkp\.gem\.gov\.in\//i.test(tab.url || '')) {
            throw new Error('Open your GeM Market product search in the active tab first.');
          }
          run = { page: 0, read: 0, saved: 0, skipped: 0, failed: [], paused: false, models: new Set() };
          const state = await update({ status: 'running', message: 'Product Scan started on the open GeM page...', read: 0, saved: 0, page: 0 });
          scan(tab.id);
          return state;
        }
        if (message.type === 'PRODUCT_SCAN_PAUSE' && run) {
          run.paused = true;
          return update({ status: 'paused', message: `Pausing after the current product (page ${run.page}).` });
        }
        if (message.type === 'PRODUCT_SCAN_RESUME' && run) {
          run.paused = false;
          run.resume?.();
          return update({ status: 'running', message: `Scan resumed on page ${run.page}.` });
        }
        const stored = (await chrome.storage.local.get(KEY))[KEY] || null;
        if (!run && ['running', 'paused'].includes(stored?.status)) {
          return update({ status: 'failed', message: 'Product Scan was interrupted. Open the search page and click Scan Products again.' });
        }
        return stored;
      })().then((state) => respond({ ok: true, state }), (error) => respond({ ok: false, error: error.message }));
    });
  });
})();
