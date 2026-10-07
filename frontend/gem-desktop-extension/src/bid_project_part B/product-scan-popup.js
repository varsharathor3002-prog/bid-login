(() => {
  const scanButton = document.getElementById('product-scan');
  const pauseButton = document.getElementById('product-pause');
  const output = document.getElementById('product-state');

  function render(state) {
    const active = ['running', 'paused'].includes(state?.status);
    const paused = state?.status === 'paused';
    scanButton.disabled = active;
    scanButton.textContent = paused ? 'Scan paused...' : active ? 'Scan running...' : 'Scan Products';
    pauseButton.disabled = !active;
    pauseButton.textContent = paused ? 'Resume Scan' : 'Pause Scan';
    output.className = `sync-state ${state?.status || ''}`;
    const updated = state?.updatedAt
      ? ` · Updated ${new Date(state.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
      : '';
    output.textContent = state?.message ? `${state.message}${updated}` : 'Ready to scan. Open your GeM product search first.';
  }

  function command(type) {
    const port = chrome.runtime.connect({ name: 'gem-product-scan' });
    port.onMessage.addListener((reply) => {
      port.disconnect();
      if (reply?.ok) render(reply.state);
      else {
        output.className = 'sync-state failed';
        output.textContent = reply?.error || 'Product Scan request failed.';
        scanButton.disabled = false;
      }
    });
    port.postMessage({ type });
  }

  scanButton.addEventListener('click', () => {
    scanButton.disabled = true;
    command('PRODUCT_SCAN_START');
  });
  pauseButton.addEventListener('click', () => {
    pauseButton.disabled = true;
    command(pauseButton.textContent === 'Resume Scan' ? 'PRODUCT_SCAN_RESUME' : 'PRODUCT_SCAN_PAUSE');
  });
  document.getElementById('product-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(output.textContent); } catch { /* Select the text manually. */ }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.gemProductScan) render(changes.gemProductScan.newValue);
  });
  command('PRODUCT_SCAN_STATE');
})();
