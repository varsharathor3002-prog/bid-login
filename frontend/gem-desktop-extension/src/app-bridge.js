document.documentElement.dataset.acxxelGemExtension = "ready";

function dispatchBridgeResult(eventName, detail) {
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function sendBridgeMessage(message, resultEvent) {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    dispatchBridgeResult(resultEvent, {
      ok: false,
      error: "Extension was reloaded. Refresh this Acxxel page and try again.",
    });
    return;
  }
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        dispatchBridgeResult(resultEvent, {
          ok: false,
          error: "Extension did not respond. Refresh this Acxxel page and try again.",
        });
        return;
      }
      dispatchBridgeResult(
        resultEvent,
        response || { ok: false, error: "Extension did not respond." }
      );
    });
  } catch {
    dispatchBridgeResult(resultEvent, {
      ok: false,
      error: "Extension was reloaded. Refresh this Acxxel page and try again.",
    });
  }
}

document.addEventListener("acxxel-gem-connect", (event) => {
  const detail = event.detail || {};
  sendBridgeMessage({
    type: "CONNECT_ACXXEL",
    token: detail.token,
    apiBase: detail.apiBase,
  }, "acxxel-gem-connect-result");
});

document.addEventListener("acxxel-gem-start", (event) => {
  sendBridgeMessage({
    type: "START_JOB",
    jobId: event.detail?.jobId,
  }, "acxxel-gem-start-result");
});
