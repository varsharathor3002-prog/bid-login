export function connectGemExtension() {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
  if (!token) return () => {};

  let cancelled = false;
  let attempts = 0;
  const tryConnect = () => {
    if (cancelled) return;
    attempts += 1;
    if (document.documentElement.dataset.acxxelGemExtension === "ready") {
      document.dispatchEvent(new CustomEvent("acxxel-gem-connect", {
        detail: {
          token,
          apiBase: import.meta.env.VITE_API_URL,
        },
      }));
      return;
    }
    if (attempts < 20) window.setTimeout(tryConnect, 250);
  };
  tryConnect();
  return () => { cancelled = true; };
}
