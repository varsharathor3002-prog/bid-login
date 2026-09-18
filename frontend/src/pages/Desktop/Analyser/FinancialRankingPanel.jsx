import { useEffect, useState } from "react";
import { FaEye, FaSearch, FaTrash } from "react-icons/fa";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const COMPANY = "LAPS N TABS TECHNOLOGY PRIVATE LIMITED";
const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` });
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));
const formatDate = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
};
const STATUS_META = {
  qualified: { label: "Qualified", style: "bg-emerald-100 text-emerald-800" },
  not_evaluated: { label: "Not Evaluated", style: "bg-amber-100 text-amber-800" },
  non_qualified: { label: "Non-Qualified", style: "bg-orange-100 text-orange-800" },
  disqualified: { label: "Disqualified", style: "bg-red-100 text-red-800" },
  unknown: { label: "Unknown", style: "bg-slate-100 text-slate-700" },
};
const statusMeta = (value) => STATUS_META[value] || STATUS_META.unknown;
const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "qualified", label: "Qualified" },
  { key: "disqualified", label: "Disqualified" },
  { key: "not_evaluated", label: "Not Evaluated" },
];
const matchesStatus = (row, status) => status === "all" || row.technical_status === status;
const matchesBidNo = (row, search) => {
  const needle = String(search || "").replace(/\s+/g, "").toUpperCase();
  return needle ? String(row.bid_no || "").replace(/\s+/g, "").toUpperCase().includes(needle) : true;
};
const compareLatestFirst = (left, right) => (
  String(right.start_date || "").localeCompare(String(left.start_date || ""))
  || String(right.end_date || "").localeCompare(String(left.end_date || ""))
  || Number(right.id || 0) - Number(left.id || 0)
);
const matchesDateRange = (row, fromDate, toDate) => {
  if (!fromDate && !toDate) return true;
  const value = String(row.start_date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return (!fromDate || value >= fromDate) && (!toDate || value <= toDate);
};
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
            <h2 className="text-base font-bold text-sky-800">Awarded Bid/RA Result — {row.bid_no}</h2>
            {row.item_name && <p className="mt-1 text-xs text-slate-500">{row.item_name}{row.lot_key ? ` (Lot: ${row.lot_key})` : ""}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl font-bold text-gray-400 hover:text-gray-700">&times;</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-700">LAPS N TABS status:</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta(row.technical_status).style}`}>
              {statusMeta(row.technical_status).label}
            </span>
            {row.company_rank
              ? <span className="text-slate-500">Final rank: L{row.company_rank}</span>
              : <span className="text-slate-500">No final RA rank available.</span>}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[700px] w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">S.No.</th>
                  <th className="px-4 py-3 font-semibold">Seller Name</th>
                  <th className="px-4 py-3 font-semibold">Offered Item</th>
                  <th className="px-4 py-3 font-semibold">Total Price</th>
                  <th className="px-4 py-3 font-semibold">Rank</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
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
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${statusMeta(seller.status).style}`}>
                        {statusMeta(seller.status).label}
                      </span>
                    </td>
                  </tr>
                ))}
                {!sellers.length && (
                  <tr><td colSpan="6" className="py-10 text-center text-slate-500">No seller rows saved for this result.</td></tr>
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load(showLoading = false) {
      if (showLoading) setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/gem/financial-rankings/?source_type=bid_ra_awarded`, {
          signal: controller.signal,
          headers: authHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Financial rankings could not be loaded (HTTP ${response.status}).`);
        if (!Array.isArray(payload.results)) throw new Error("Unexpected financial rankings response.");
        if (active && !controller.signal.aborted) {
          setRows(payload.results);
          setError("");
        }
      } catch (err) {
        if (active && !controller.signal.aborted) setError(err.message);
      } finally {
        if (showLoading && active && !controller.signal.aborted) setLoading(false);
      }
    }
    load(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") load(false);
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
      controller.abort();
    };
  }, []);

  const searchedRows = rows
    .filter((row) => matchesBidNo(row, search))
    .sort(compareLatestFirst)
    .filter((row) => matchesDateRange(row, fromDate, toDate));
  const visibleRows = searchedRows.filter((row) => matchesStatus(row, statusFilter));
  const hasDateFilter = Boolean(fromDate || toDate);

  function clearDates() {
    setFromDate("");
    setToDate("");
  }

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
          <h2 className="text-xl font-bold text-slate-900">Awarded Bid/RA Ranking Report</h2>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter awarded bids by LAPS N TABS status">
          {STATUS_FILTERS.map((filter) => {
            const count = searchedRows.filter((row) => matchesStatus(row, filter.key)).length;
            const selected = statusFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setStatusFilter(filter.key)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${selected ? "border-sky-700 bg-sky-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700"}`}
              >
                {filter.label} <span className={selected ? "text-sky-100" : "text-slate-400"}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="awarded-bid-search" className="mb-1.5 block text-xs font-semibold text-slate-600">Search Bid No.</label>
        <div className="relative max-w-xl">
          <FaSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="awarded-bid-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Enter complete or partial Bid No., e.g. 8035070"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-24 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">Clear</button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="Bid start date filter">
        <div className="w-full text-sm font-semibold text-slate-700 sm:w-auto sm:self-center">Bid Start Date</div>
        <label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-slate-600">
          From Date
          <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-500" />
        </label>
        <label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-slate-600">
          To Date
          <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-500" />
        </label>
        {hasDateFilter && <button type="button" onClick={clearDates} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-sky-300 hover:text-sky-700">Clear Dates</button>}
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} Reload the page to retry.</div>}
      {loading ? <p role="status" className="py-12 text-center text-slate-500">Loading awarded Bid/RA report...</p>
        : rows.length ? visibleRows.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[600px] text-left text-sm">
              <caption className="sr-only">Ranking report for all awarded bids and RAs</caption>
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th scope="col" className="w-16 px-4 py-3">S.No.</th>
                  <th scope="col" className="px-4 py-3">Bid No.</th>
                  <th scope="col" className="px-4 py-3">Start Date</th>
                  <th scope="col" className="px-4 py-3">End Date</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">View Result</th>
                  <th scope="col" className="w-24 px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={row.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                    <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4 font-semibold text-sky-800">{row.bid_no}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDate(row.start_date)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDate(row.end_date)}</td>
                    <td className="px-4 py-4">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta(row.technical_status).style}`}>
                        {statusMeta(row.technical_status).label}
                      </span>
                    </td>
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
        ) : <div className="rounded-xl border border-slate-200 bg-white p-12 text-center"><h3 className="font-semibold text-slate-800">No matching bids found</h3><p className="mt-2 text-sm text-slate-500">Change the Bid No., status, or date filter to view saved awarded bids.</p></div>
          : <div className="rounded-xl border border-slate-200 bg-white p-12 text-center"><h3 className="font-semibold text-slate-800">No awarded Bid/RA results saved yet</h3><p className="mt-2 text-sm text-slate-500">Select Bid/RA Awarded on GeM and scan all awarded results from the extension.</p></div>}
      {viewing && <RaResultModal row={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
