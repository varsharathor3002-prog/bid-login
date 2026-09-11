import { useEffect, useState } from "react";
import { FaEye, FaTrash } from "react-icons/fa";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const COMPANY = "LAPS N TABS TECHNOLOGY PRIVATE LIMITED";
const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` });
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));
// GeM keeps appending new trailing decorations after the seller name
// (MSE/MII badge, social-category notes, "Under PMA", combinations of
// these...). Rather than enumerate every pattern, treat the seller as a
// match when the name starts with our company name followed by a bracket or
// the word "Under" — a genuinely different, longer company name (e.g.
// "... LIMITED AND CO") never starts that way.
const isCompany = (name) => {
  const normalized = String(name ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  if (normalized === COMPANY) return true;
  if (!normalized.startsWith(COMPANY)) return false;
  const rest = normalized.slice(COMPANY.length).trimStart();
  return rest.startsWith("(") || /^UNDER\b/.test(rest);
};
// "Under PMA" is an administrative tag GeM appends, not part of the seller's
// identity. Strip it for display only; the raw name is still saved as-is.
const displayName = (name) => String(name ?? "").replace(/\s*under\s+pma\s*/gi, " ").replace(/\s+/g, " ").trim();

function RaResultModal({ row, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const allSellers = [...(row.sellers || [])].sort((a, b) => a.rank - b.rank);
  // Only L1-L3 plus our company's own row (wherever it ranks), not the full seller list.
  const sellers = allSellers.filter((seller) => seller.rank <= 3);
  for (const seller of allSellers) {
    if (isCompany(seller.sellerName) && !sellers.includes(seller)) sellers.push(seller);
  }
  sellers.sort((a, b) => a.rank - b.rank);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-sky-800">RA Result — {row.bid_no}</h2>
            {row.item_name && <p className="mt-1 text-xs text-slate-500">{row.item_name}{row.lot_key ? ` (Lot: ${row.lot_key})` : ""}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl font-bold text-gray-400 hover:text-gray-700">&times;</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[700px] w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">S.No.</th>
                  <th className="px-4 py-3 font-semibold">Seller Name</th>
                  <th className="px-4 py-3 font-semibold">Offered Item</th>
                  <th className="px-4 py-3 font-semibold">Total Price</th>
                  <th className="px-4 py-3 font-semibold">Rank</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((seller, index) => (
                  <tr key={`${seller.sellerName}-${index}`} className={`border-t border-slate-100 align-top ${isCompany(seller.sellerName) ? "bg-emerald-50" : ""}`}>
                    <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{displayName(seller.sellerName)}</td>
                    <td className="px-4 py-3 text-slate-600">{seller.offeredItem}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-800">{money(seller.totalPrice)}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">L{seller.rank}</td>
                  </tr>
                ))}
                {!sellers.length && (
                  <tr><td colSpan="5" className="py-10 text-center text-slate-500">No seller rows saved for this result.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FinancialRankingPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/gem/financial-rankings/?qualified_only=1`, {
          signal: controller.signal,
          headers: authHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Financial rankings could not be loaded (HTTP ${response.status}).`);
        if (!Array.isArray(payload.results)) throw new Error("Unexpected financial rankings response.");
        if (!controller.signal.aborted) setRows(payload.results);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const qualified = rows.filter((row) => row.technical_status === "qualified");

  async function handleDelete(row) {
    if (!window.confirm(`Permanently delete bid ${row.bid_no} from the database?`)) return;
    setDeletingId(row.id);
    try {
      const response = await fetch(`${API_BASE}/gem/financial-rankings/${row.id}/`, { method: "DELETE", headers: authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Record could not be deleted.");
      setRows((current) => current.filter((item) => item.id !== row.id));
      if (viewing?.id === row.id) setViewing(null);
    } catch (err) {
      setError(err.message || "Record could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Financial Ranking Report</h2>
        </div>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} Reload the page to retry.</div>}
      {loading ? <p role="status" className="py-12 text-center text-slate-500">Loading financial report...</p>
        : !qualified.length ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center"><h3 className="font-semibold text-slate-800">No qualified financial results saved yet</h3><p className="mt-2 text-sm text-slate-500">Scan Qualified RA Results from the extension on the GeM seller-bids list; results will appear here.</p></div>
        : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[600px] text-left text-sm">
              <caption className="sr-only">Financial ranking report for qualified bids</caption>
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th scope="col" className="w-16 px-4 py-3">S.No.</th>
                  <th scope="col" className="px-4 py-3">Bid No.</th>
                  <th scope="col" className="px-4 py-3">View RA Result</th>
                  <th scope="col" className="w-24 px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {qualified.map((row, index) => (
                  <tr key={row.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                    <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4 font-semibold text-sky-800">{row.bid_no}</td>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => setViewing(row)} className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:text-sky-900">
                        <FaEye aria-hidden="true" /> View
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.id}
                        className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Permanently delete from database"
                        aria-label={`Permanently delete bid ${row.bid_no}`}
                      >
                        <FaTrash className="text-sm" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {viewing && <RaResultModal row={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
