(() => {
  const expanded = globalThis.AcxxelFinancialExpanded || new WeakSet();
  globalThis.AcxxelFinancialExpanded = expanded;
  const text = (node) => String(node?.innerText || node?.textContent || '').replace(/\s+/g, ' ').trim();
  const ids = (value, kind) => [...new Set((value.match(new RegExp(`GEM\\s*/\\s*\\d{4}\\s*/\\s*${kind}\\s*/\\s*\\d+`, 'gi')) || []).map((id) => id.replace(/\s+/g, '').toUpperCase()))];
  // Same MAIN-world Angular/jQuery click bridge used by gem-bid-sync.js.
  function activate(control) {
    const doc = control.ownerDocument;
    if (!doc) { control.click(); return; }
    control.scrollIntoView({ block: 'center', inline: 'center' });
    const clickId = `financial-page-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    control.setAttribute('data-acxxel-click-id', clickId);
    let clicked = false;
    const ack = (event) => { if (event.detail?.clickId === clickId) clicked = event.detail.clicked; };
    doc.addEventListener('acxxel-gem-control-clicked', ack);
    try {
      doc.dispatchEvent(new CustomEvent('acxxel-gem-click-control', { detail: { clickId } }));
      if (!clicked) throw new Error('GeM page click bridge is unavailable. Reload the GeM tab after reloading the extension.');
    } finally {
      doc.removeEventListener('acxxel-gem-control-clicked', ack);
      control.removeAttribute('data-acxxel-click-id');
    }
  }
  function visible(node) {
    if (!node.getBoundingClientRect) return true;
    const style = node.ownerDocument.defaultView.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }
  function enabled(node) {
    return Boolean(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true' && !/(^|\s)disabled(\s|$)/i.test(node.className || '');
  }
  // Ported from Part A mainPaginationNextState: broad control discovery,
  // modal exclusion, main pager scoring and disabled-parent detection.
  function mainNext(doc) {
    const candidates = [...doc.querySelectorAll('button, a, [role=button], li')].filter((node) => {
      if (!visible(node) || node.closest('[role=dialog], .modal, .modal-dialog, .modal-content, .ngdialog-content')) return false;
      const label = [text(node), node.getAttribute('aria-label'), node.getAttribute('title'), node.getAttribute('rel')].filter(Boolean).join(' ');
      return /^next\s*(?:page)?\s*$/i.test(text(node)) || /\bnext\s+page\b/i.test(label);
    }).map((node) => {
      const clickable = node.matches('li') ? node.querySelector('a, button, [role=button]') || node : node.closest('a, button, [role=button], li') || node;
      const parent = clickable.closest('[class*=pagination], [class*=pager], [class*=paging], nav');
      return { node: clickable, score: (parent ? 100 : 0) + Math.max(0, clickable.getBoundingClientRect?.().top || 0) };
    }).sort((a, b) => b.score - a.score);
    return candidates[0]?.node || null;
  }
  function resultKind(control) {
    const label = text(control) || control.value || '';
    return /^view\s+ra\s+results?$/i.test(label) ? 'ra'
      : /^view\s+bid\s+results?$/i.test(label) ? 'bid' : null;
  }
  function safeResultUrl(control, doc) {
    const raw = control?.getAttribute?.('href');
    const scripted = ['ng-click', 'data-ng-click', 'onclick'].some((name) => control?.hasAttribute?.(name));
    if (scripted || !raw || /^(#|javascript:)/i.test(raw)) return null;
    const url = new URL(raw, doc.location.href);
    return url.protocol === 'https:' && url.hostname.endsWith('.gem.gov.in') ? url.href : null;
  }
  function cards(doc) {
    const found = new Map();
    for (const control of doc.querySelectorAll('a, button, [role=button], input[type=button]')) {
      const kind = resultKind(control);
      if (!kind) continue;
      let card = control.parentElement;
      while (card) {
        const value = text(card);
        const bids = ids(value, 'B');
        if (bids.length > 1) break;
        const status = value.match(/technical\s+status\s*:\s*(disqualified|qualified)\b/i);
        if (bids.length === 1 && status) {
          const ras = ids(value, 'R');
          const existing = found.get(bids[0]) || { card, bid_no: bids[0], ra_no: ras.length === 1 ? ras[0] : null, technical_status: status[1].toLowerCase() };
          existing[`${kind}_control`] = control;
          existing[`${kind}_result_url`] = safeResultUrl(control, doc);
          found.set(bids[0], existing);
          break;
        }
        card = card.parentElement;
      }
    }
    return [...found.values()];
  }
  function collect(doc) {
    return cards(doc).map(({ bid_no, ra_no, technical_status, bid_control, ra_control, bid_result_url, ra_result_url }) => {
      const token = (kind, control) => {
        if (!control) return null;
        const value = `acxxel-${kind}-${bid_no.replace(/[^a-z0-9]/gi, '-')}`;
        control.setAttribute('data-acxxel-financial-result', value);
        return value;
      };
      return {
        bid_no, ra_no, technical_status,
        has_bid_result: Boolean(bid_control), has_ra_result: Boolean(ra_control),
        bid_result_token: token('bid', bid_control), ra_result_token: token('ra', ra_control),
        bid_result_url, ra_result_url,
      };
    });
  }
  function open(doc, bidNo, kind = 'ra', resultToken = null) {
    const card = cards(doc).find((item) => item.bid_no === bidNo);
    let control = resultToken ? doc.querySelector?.(`[data-acxxel-financial-result="${resultToken}"]`) : null;
    if (control && resultKind(control) !== kind) control = null;
    if (!control) control = card?.[`${kind}_control`];
    if (!control) {
      // During Angular re-render GeM can temporarily detach the Technical
      // Status text used by cards(), while the bid number and result control
      // remain clickable. Resolve the smallest bid-bearing ancestor without
      // relying on status text, and never fall back to a different bid.
      const wanted = String(bidNo || '').replace(/\s+/g, '').toUpperCase();
      const matches = [];
      for (const candidate of doc.querySelectorAll('a, button, [role=button], input[type=button]')) {
        if (resultKind(candidate) !== kind) continue;
        let root = candidate.parentElement;
        while (root && root !== doc.body) {
          const bidIds = ids(text(root), 'B');
          if (bidIds.includes(wanted)) { matches.push(candidate); break; }
          if (bidIds.length) break;
          root = root.parentElement;
        }
      }
      if (matches.length === 1) control = matches[0];
    }
    if (!control) return false;
    control.setAttribute('target', '_self');
    activate(control);
    return true;
  }
  function expand(doc) {
    for (const control of doc.querySelectorAll('a, button, [role=button], [data-toggle=collapse], [data-bs-toggle=collapse], .panel-heading, .accordion-header')) {
      if (/^(?:\d+\.\s*)?financial\s+evaluation$/i.test(text(control)) && control.getAttribute('aria-expanded') !== 'true' && !expanded.has(control)) {
        expanded.add(control);
        control.click();
      }
    }
  }
  function filterLabel(node) {
    const label = [...(node.labels || [])].map(text).join(' ') || node.getAttribute('aria-label')
      || text(node.closest('label')) || text(node.nextElementSibling)
      || [...(node.parentElement?.childNodes || [])].filter((child) => child.nodeType === 3).map((child) => child.textContent).join(' ');
    return String(label || '').replace(/\s+/g, ' ').replace(/\s*\(\d+\)\s*$/, '').replace(/:\s*$/, '').trim();
  }
  function filterControls(doc) {
    const inputs = [...doc.querySelectorAll('input[type=checkbox], input[type=radio]')];
    const anchor = inputs.find((node) => /^financial\s+evaluated$/i.test(filterLabel(node)));
    let root = anchor?.parentElement;
    while (root && root !== doc.body) {
      if (/financial\s+evaluated/i.test(text(root)) && /bids?\s*\/\s*ras?\s+already|by\s+bid\s*type/i.test(text(root))) break;
      root = root.parentElement;
    }
    // Never capture bid-row selection boxes, notification preferences, or modals.
    if (!root || root === doc.body) root = anchor?.closest('[id*=filter], [class*=filter], aside');
    if (!root) return [];
    return inputs.filter((node) => root.contains(node)).map((node) => {
      const label = filterLabel(node);
      return { node, label, key: `${node.type}:${label.toLowerCase()}`, checked: Boolean(node.checked) };
    }).filter((control) => control.label);
  }
  function filters(doc) {
    const unique = new Map();
    for (const { key, checked } of filterControls(doc)) unique.set(key, { key, checked: checked || unique.get(key)?.checked || false });
    return [...unique.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
  function restoreFilters(doc, expected) {
    const controls = filterControls(doc);
    if (!controls.length) return { ready: false, reason: 'Financial Evaluated filter sidebar is not loaded. Check GeM login in the scan tab.' };
    const selected = new Set(expected.filter((item) => item.checked).map((item) => item.key));
    // Select the intended radio/checkbox options first. Clicking an unchecked
    // radio cannot deselect it and previously caused an endless restore loop.
    for (const key of selected) {
      const matches = controls.filter((control) => control.key === key);
      if (!matches.length) return { ready: false, reason: `Selected filter not found: ${key}` };
      if (!matches.some((control) => control.checked)) {
        const control = matches.find((item) => !item.node.disabled);
        if (!control) return { ready: false, reason: `Selected filter is disabled: ${key}` };
        control.node.click();
        return { ready: false, reason: `Selecting ${control.label}` };
      }
    }
    for (const control of controls) {
      if (control.checked && !selected.has(control.key)) {
        if (control.node.type === 'radio') return { ready: false, reason: `Unexpected selected radio filter: ${control.label}` };
        if (control.node.disabled) return { ready: false, reason: `Cannot clear disabled filter: ${control.label}` };
        control.node.click();
        return { ready: false, reason: `Clearing ${control.label}` };
      }
    }
    return { ready: true };
  }
  function pager(doc) {
    const nodes = [...doc.querySelectorAll('[class*=pagination] a, [class*=pagination] button, [class*=pagination] li, [class*=pager] a, [class*=pager] button, a[rel=next], button[aria-label*="Next"], a[aria-label*="Next"], .next, .pagination-next')];
    const disabled = (node) => !enabled(node) || Boolean(node.closest('.disabled, [aria-disabled=true]'));
    const control = (node) => node?.matches('li') ? node.querySelector('a, button') || node : node;
    const current = doc.querySelector('[class*=pagination] .active, [class*=pagination] [aria-current=page]');
    const page = Number(text(current)) || Number(doc.location.hash.match(/page-(\d+)/)?.[1]) || null;
    const next = mainNext(doc) || control(nodes.find((node) => /^(next(?:\s+page)?|›|»|>)$/i.test(text(node)) || node.getAttribute('rel') === 'next' || /^next\b/i.test(node.getAttribute('aria-label') || '') || node.matches('.next, .pagination-next')))
      || control(nodes.find((node) => page && text(node) === String(page + 1)));
    const first = control(nodes.find((node) => /^(1|first(?:\s+page)?|«)$/i.test(text(node))));
    return { page, next, first, disabled };
  }
  function snapshot(doc) {
    const state = pager(doc);
    return { cards: collect(doc), signature: cards(doc).filter((item) => visible(item.card)).map((item) => item.bid_no).sort().join('|'), page: state.page,
      next: !state.next ? 'missing' : state.disabled(state.next) ? 'end' : 'available', filters: filters(doc) };
  }
  function navigate(doc, direction) {
    const state = pager(doc);
    if (direction === 'first' && state.page === 1) return 'already';
    const node = direction === 'first' ? state.first : state.next;
    if (direction === 'first' && (!node || state.disabled(node))) {
      // GeM hides page 1 outside its sliding pagination window. Use its known
      // seller-list route, keeping all filter state and the user's tab intact.
      if (!/^\/seller-bids\/?$/.test(doc.location.pathname || '')) return 'missing';
      if (doc.location.hash === '#page-1') return 'stuck';
      doc.location.hash = '#page-1';
      return 'routed';
    }
    if (!node) return 'missing';
    if (state.disabled(node)) return 'end';
    activate(node);
    return 'clicked';
  }
  async function recoverRoute(doc, from, to) {
    if (!/^\/seller-bids\/?$/.test(doc.location.pathname || '')) return false;
    if (doc.location.hash.toLowerCase() === `#page-${to}`) {
      doc.location.hash = `#page-${from}`;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    doc.location.hash = `#page-${to}`;
    return true;
  }
  globalThis.AcxxelFinancialList = Object.freeze({ collect, open, expand, filters, restoreFilters, snapshot, navigate, recoverRoute });
})();
