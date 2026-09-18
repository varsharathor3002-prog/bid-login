(() => {
  const start = document.getElementById('financial-start');
  const pause = document.getElementById('financial-pause');
  const output = document.getElementById('financial-state');
  const terminalStatuses = new Set(['failed', 'authentication_required']);
  const terminalTtlMs = 15000;
  let expiryTimer = null;
  function render(state) {
    if (expiryTimer) clearTimeout(expiryTimer);
    const updatedAt = Number(state?.updatedAt || 0);
    const terminal = terminalStatuses.has(state?.status) && updatedAt > 0;
    const remaining = terminal ? terminalTtlMs - (Date.now() - updatedAt) : 0;
    if (terminal && remaining <= 0) {
      chrome.storage.local.remove('financialEvalSyncState');
      state = null;
    } else if (terminal) {
      expiryTimer = setTimeout(() => render(state), remaining + 25);
    }
    const active = ['starting', 'running', 'saving', 'paused'].includes(state?.status);
    const paused = state?.status === 'paused';
    start.disabled = active;
    pause.disabled = !active || state?.status === 'starting' || state?.status === 'saving';
    pause.textContent = paused ? 'Resume Scan' : 'Pause Scan';
    output.textContent = state?.message || 'Ready to scan. Refresh the GeM page if required.';
    output.className = `sync-state ${state?.status || ''}`;
  }
  async function command(type, options = {}) {
    try {
      const response = await new Promise((resolve, reject) => {
        const port = chrome.runtime.connect({ name: 'financial-ranking' });
        port.onMessage.addListener((reply) => { resolve(reply); port.disconnect(); });
        port.onDisconnect.addListener(() => reject(new Error(chrome.runtime.lastError?.message || 'Financial controller disconnected.')));
        port.postMessage({ type, ...options });
      });
      if (!response?.ok) throw new Error(response?.error || 'Awarded Bid/RA scan request failed.');
      render(response.state);
    } catch (error) { output.textContent = error.message; }
  }
  start.addEventListener('click', () => {
    start.disabled = true;
    command('FINANCIAL_START');
  });
  pause.addEventListener('click', () => {
    const resuming = pause.textContent === 'Resume Scan';
    pause.disabled = true;
    command(resuming ? 'FINANCIAL_RESUME' : 'FINANCIAL_PAUSE');
  });
  document.getElementById('financial-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(output.textContent); }
    catch { output.textContent += ' Copy failed; select and copy this status manually.'; }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.financialEvalSyncState) render(changes.financialEvalSyncState.newValue);
  });
  command('FINANCIAL_STATE');
})();
