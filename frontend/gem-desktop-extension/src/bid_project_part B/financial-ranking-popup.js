(() => {
  const start = document.getElementById('financial-start');
  const stop = document.getElementById('financial-stop');
  const output = document.getElementById('financial-state');
  function render(state) {
    start.disabled = ['starting', 'running', 'saving', 'stopping'].includes(state?.status);
    stop.disabled = !start.disabled || state?.status === 'saving';
    output.textContent = state?.message || 'No financial results scanned yet.';
    output.className = `sync-state ${state?.status || ''}`;
  }
  async function command(type) {
    try {
      const response = await new Promise((resolve, reject) => {
        const port = chrome.runtime.connect({ name: 'financial-ranking' });
        port.onMessage.addListener((reply) => { resolve(reply); port.disconnect(); });
        port.onDisconnect.addListener(() => reject(new Error(chrome.runtime.lastError?.message || 'Financial controller disconnected.')));
        port.postMessage({ type });
      });
      if (!response?.ok) throw new Error(response?.error || 'Financial scan request failed.');
      render(response.state);
    } catch (error) { output.textContent = error.message; }
  }
  start.addEventListener('click', () => { start.disabled = true; command('FINANCIAL_START'); });
  stop.addEventListener('click', () => command('FINANCIAL_STOP'));
  document.getElementById('financial-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(output.textContent); }
    catch { output.textContent += ' Copy failed; select and copy this status manually.'; }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.financialEvalSyncState) render(changes.financialEvalSyncState.newValue);
  });
  command('FINANCIAL_STATE');
})();
