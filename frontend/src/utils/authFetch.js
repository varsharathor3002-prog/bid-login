// Sends this tab's login token with every backend request.
//
// The backend uses the token to decide who did what (bid submitter, analyser,
// admin), so names can't be mixed up when different roles are logged in on
// different tabs of the same browser. sessionStorage is per tab, so it wins
// over the localStorage copy that every tab shares.
const API_URL = import.meta.env.VITE_API_URL || "";

const currentToken = () =>
  sessionStorage.getItem("token") || localStorage.getItem("token") || "";

export function installAuthFetch() {
  if (!API_URL || window.__authFetchInstalled) return;
  window.__authFetchInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const token = currentToken();
    if (!token || !url.startsWith(API_URL)) return nativeFetch(input, init);

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    return nativeFetch(input, { ...init, headers });
  };
}
