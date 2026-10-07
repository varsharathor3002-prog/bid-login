// "Upload to GeM" from the analyser dashboard's Transfer to GeM tab.
//
// Queues a GeM upload job for the bid and hands it to the Acxxel GeM
// extension, which opens GeM and auto-fills the Add New Offering form.
// Without the extension the GeM login page is opened and the job stays queued.
// Resolves to { ok, message } for the dashboard to show.
const API_URL = import.meta.env.VITE_API_URL;
const GEM_LOGIN_URL = "https://sso.gem.gov.in/ARXSSO/oauth/doLogin";

const currentToken = () =>
  sessionStorage.getItem("token") || localStorage.getItem("token") || "";

const JOB_PATHS = {
  desktop: "desktop-bids",
  workstation: "workstation-bids",
  aio: "aio-bids",
  toner: "toner-bids",
};

function bridgeRequest(requestEvent, resultEvent, detail) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      document.removeEventListener(resultEvent, handleResult);
      reject(new Error("GeM extension did not respond. Reload the extension and refresh this page."));
    }, 5000);
    function handleResult(event) {
      window.clearTimeout(timeout);
      document.removeEventListener(resultEvent, handleResult);
      const result = event.detail || {};
      if (result.ok) resolve(result);
      else reject(new Error(result.error || "GeM extension could not complete the request."));
    }
    document.addEventListener(resultEvent, handleResult);
    document.dispatchEvent(new CustomEvent(requestEvent, { detail }));
  });
}

export async function startGemUpload(product, bidId) {
  const useExtension = document.documentElement.dataset.acxxelGemExtension === "ready";
  // Opened before any await, otherwise the browser blocks the pop-up.
  const gemTab = useExtension ? null : window.open(GEM_LOGIN_URL, "_blank", "noopener,noreferrer");
  const opened = useExtension || gemTab !== null;

  try {
    const response = await fetch(`${API_URL}/${JOB_PATHS[product]}/${bidId}/gem-jobs/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken()}`,
      },
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem("token");
      return { ok: false, message: "Acxxel session expired. Log in again before starting GeM auto-fill." };
    }
    if (response.status === 403) {
      return { ok: false, message: data.error || "Your account is not authorized to start GeM auto-fill for this bid." };
    }
    if (!response.ok) throw new Error(data.error || "Unable to queue GeM upload.");

    if (!useExtension) {
      return {
        ok: true,
        message: opened
          ? "GeM login opened, but auto-fill needs the Acxxel GeM extension. Load it and refresh this page."
          : "Job queued. Allow pop-ups for this site to open the GeM login page.",
      };
    }

    await bridgeRequest("acxxel-gem-connect", "acxxel-gem-connect-result", {
      token: data.extension_token || currentToken(),
      apiBase: API_URL,
    });
    const startResult = await bridgeRequest("acxxel-gem-start", "acxxel-gem-start-result", { jobId: data.id, product });
    if (!startResult.result?.tabId) {
      throw new Error("Chrome did not confirm that the GeM login tab was opened.");
    }
    return { ok: true, message: "GeM opened. Approved fields will fill automatically on Add New Offering." };
  } catch (error) {
    return { ok: false, message: error.message || "Unable to queue GeM upload." };
  }
}
