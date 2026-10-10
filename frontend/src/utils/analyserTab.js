import { useEffect, useState } from "react";

// The analyser dashboard's section (Pending / Approved / Re-Analyze / Transfer
// to GeM) survives a refresh and coming Back from a bid: it is kept in the
// URL (?status=approved) and, as a fallback, in this browser tab's session.
const TABS = ["pending", "approved", "re-analyze", "gem-transfer"];

export function useAnalyserTab(product) {
  const key = `analyser_tab_${product}`;
  const [tab, setTab] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("status");
    if (TABS.includes(fromUrl)) return fromUrl;
    try {
      const saved = sessionStorage.getItem(key);
      if (TABS.includes(saved)) return saved;
    } catch {
      // Storage blocked: start on Pending.
    }
    return "pending";
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, tab);
    } catch {
      // Storage blocked: the URL still keeps the section.
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("status") !== tab) {
      url.searchParams.set("status", tab);
      window.history.replaceState(window.history.state, "", url);
    }
  }, [key, tab]);

  return [tab, setTab];
}
