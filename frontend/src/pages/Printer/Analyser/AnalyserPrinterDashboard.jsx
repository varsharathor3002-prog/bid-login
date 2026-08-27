import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaTrash } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL;
const API_URL = `${API_BASE}/printer-bids/list/`;

const ITEMS_PER_PAGE = 10;
const VISIBLE_PAGES = 5;

export default function AnalyserPrinterDashboard() {
  const [activeTab, setActiveTab] = useState(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    return ["pending", "approved", "re-analyze"].includes(status) ? status : "pending";
  });
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reAnalyzeCount, setReAnalyzeCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBidIds, setSelectedBidIds] = useState(new Set());
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const loadBids = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_URL}?status=${activeTab}&role=analyser`, {
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error("Server error");

        const data = await res.json();
        if (cancelled) return;
        const nextBids = Array.isArray(data) ? data : [];
        setBids(nextBids);
        if (activeTab === "re-analyze") setReAnalyzeCount(nextBids.length);
      } catch {
        if (cancelled) return;
        setError("Unable to load printer bids from the backend.");
        setBids([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadBids();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;

    const loadReAnalyzeCount = async () => {
      try {
        const res = await fetch(`${API_URL}?status=re-analyze&role=analyser`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setReAnalyzeCount(Array.isArray(data) ? data.length : 0);
      } catch {
        if (!cancelled) setReAnalyzeCount(0);
      }
    };

    loadReAnalyzeCount();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTabChange = (tab) => {
    setCurrentPage(1);
    setSelectedBidIds(new Set());
    setActiveTab(tab);
  };

  const deleteBid = async (bid, confirmDelete = true) => {
    if (confirmDelete && !window.confirm(`Permanently delete bid ${bid.bid_no}?`)) return false;
    setDeletingId(bid.id);
    try {
      const response = await fetch(`${API_BASE}/printer-bids/${bid.id}/delete/`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Bid could not be deleted.");
      setBids((current) => current.filter((item) => item.id !== bid.id));
      setSelectedBidIds((current) => {
        const next = new Set(current);
        next.delete(bid.id);
        return next;
      });
      return true;
    } catch (deleteError) {
      setError(deleteError.message || "Bid could not be deleted.");
      return false;
    } finally {
      setDeletingId(null);
    }
  };

  const bulkDeleteBids = async () => {
    const selectedBids = bids.filter((bid) => selectedBidIds.has(bid.id));
    if (!selectedBids.length || !window.confirm(`Permanently delete ${selectedBids.length} selected printer bid(s)?`)) return;
    setBulkDeleting(true);
    setError("");
    for (const bid of selectedBids) await deleteBid(bid, false);
    setBulkDeleting(false);
  };

  const totalPages = Math.max(1, Math.ceil(bids.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBids = bids.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  let startPage = Math.max(1, safePage - Math.floor(VISIBLE_PAGES / 2));
  let endPage = startPage + VISIBLE_PAGES - 1;
  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - VISIBLE_PAGES + 1);
  }
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const formatDate = (value) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return value;
    }
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex gap-4 px-6 bg-gray-50 border-b border-gray-200 mt-4">
        <button
          onClick={() => handleTabChange("pending")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 outline-none focus:outline-none focus-visible:outline-none ${
            activeTab === "pending" ? "text-amber-600 border-b-2 border-amber-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>⏳</span>
          Pending
        </button>

        <button
          onClick={() => handleTabChange("approved")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 outline-none focus:outline-none focus-visible:outline-none ${
            activeTab === "approved" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>✅</span>
          Approved
        </button>

        <button
          onClick={() => handleTabChange("re-analyze")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 outline-none focus:outline-none focus-visible:outline-none ${
            activeTab === "re-analyze" ? "text-rose-600 border-b-2 border-rose-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>⚠️</span>
          Re-Analyze
          {reAnalyzeCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
              {reAnalyzeCount}
            </span>
          )}
        </button>
        {activeTab === "approved" && selectedBidIds.size > 0 && (
          <button type="button" onClick={bulkDeleteBids} disabled={bulkDeleting}
            className="ml-auto inline-flex min-h-9 items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
            <FaTrash aria-hidden="true" />
            {bulkDeleting ? "Deleting..." : `Delete Selected (${selectedBidIds.size})`}
          </button>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed text-left border-separate border-spacing-0 [&_th]:!px-1.5 [&_th]:!text-xs [&_tbody_span]:!text-sm [&_tbody_td]:!px-1.5 [&_tbody_td]:!text-sm [&_tbody_button]:!text-xs">
          <thead>
            <tr className="bg-slate-800">
              <th className="w-[4%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">S.No.</th>
              <th className="w-[9%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">Bid No</th>
              <th className="w-[12%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Department</th>
              <th className="w-[10%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Printer Type</th>
              <th className="w-[8%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Type Of Printing</th>
              <th className="w-[4%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Qty</th>
              <th className="w-[8%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Submitted By</th>
              <th className="w-[8%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Date</th>
              {activeTab === "pending" && (
                <th className="w-[8%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Status</th>
              )}
              <th className="w-[7%] !pl-3 py-4 text-[10px] font-bold text-white uppercase border-b border-l border-slate-700">Action</th>
              {activeTab === "approved" && (
                <th className="w-[11%] px-2 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Approved Details For Bidding</th>
              )}
              {activeTab === "approved" && (
                <th className="w-[11%] px-2 py-4 text-[10px] font-bold text-white uppercase border-b border-l border-slate-700">Download Docs for the bid</th>
              )}
              {activeTab === "approved" && (
                <th className="w-[8%] px-2 py-4 text-[10px] font-bold text-white uppercase border-b border-l border-slate-700">
                  <div className="flex items-center justify-center gap-2">
                    <input type="checkbox" aria-label="Select all bids on this page"
                      checked={paginatedBids.length > 0 && paginatedBids.every((bid) => selectedBidIds.has(bid.id))}
                      onChange={(event) => setSelectedBidIds((current) => {
                        const next = new Set(current);
                        paginatedBids.forEach((bid) => event.target.checked ? next.add(bid.id) : next.delete(bid.id));
                        return next;
                      })}
                      className="h-4 w-4 accent-red-600" />
                    <span>Delete</span>
                  </div>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={activeTab === "approved" ? 12 : activeTab === "re-analyze" ? 9 : 10} className="text-center py-16 text-gray-400 font-medium">
                  Loading printer bids...
                </td>
              </tr>
            )}

            {!loading && bids.length === 0 && (
              <tr>
                <td colSpan={activeTab === "approved" ? 12 : activeTab === "re-analyze" ? 9 : 10} className="text-center py-16 text-gray-400 font-medium">
                  No printer bids found.
                </td>
              </tr>
            )}

            {!loading && paginatedBids.length > 0 && paginatedBids.map((bid, i) => (
              <tr
                key={bid.id}
                className={`bg-white hover:bg-gray-50 transition-colors ${
                  bid.status === "approved"
                    ? "border-l-4 border-l-emerald-500"
                    : bid.status === "re-analyze"
                    ? "border-l-4 border-l-rose-500"
                    : "border-l-4 border-l-amber-500"
                }`}
              >
                <td className="px-2 py-4 text-xs font-bold text-gray-700 border-b border-gray-100">
                  {(safePage - 1) * ITEMS_PER_PAGE + i + 1}
                </td>
                <td className="break-words px-2 py-4 border-b border-gray-100">
                  <span className="text-xs font-bold text-blue-600">{bid.bid_no}</span>
                </td>
                <td className="break-words px-2 py-4 border-b border-gray-100">
                  <span className="block text-xs font-bold text-gray-800">
                    {bid.dept_name || "-"}
                  </span>
                </td>
                <td className="break-words px-2 py-4 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">
                    {bid.printer_type === "Multifunction Printer" ? "Multifunction Printer" : "Printer"}
                  </span>
                </td>
                <td className="break-words px-2 py-4 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">
                    {bid.type_of_printing || "-"}
                  </span>
                </td>
                <td className="px-2 py-4 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-700">{bid.qty || "-"}</span>
                </td>
                <td className="break-words px-2 py-4 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-700">{bid.submitted_by || bid.user_name || "-"}</span>
                </td>
                <td className="px-2 py-4 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-700 whitespace-nowrap">
                    {formatDate(bid.date || bid.created_at)}
                  </span>
                </td>
                {activeTab === "pending" && (
                <td className="px-2 py-4 border-b border-gray-100">
                  {bid.status === "pending" && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                      Pending
                    </span>
                  )}
                  {bid.status === "approved" && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                      Approved
                    </span>
                  )}
                  {bid.status === "re-analyze" && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                      ⚠️ Re-Analyze
                    </span>
                  )}
                </td>
                )}
                <td className="!pl-3 py-4 border-b border-l border-gray-100">
                  <button
                    onClick={() =>
                      navigate(`/analyser-dashboard/printer/bid/${bid.id}`, {
                        state: { bid, readOnly: bid.status === "approved" },
                      })
                    }
                    className={`px-3 py-2 rounded text-[11px] font-bold uppercase tracking-wide shadow-sm transition-all whitespace-nowrap text-white ${
                      bid.status === "approved"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : bid.status === "re-analyze"
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-amber-600 hover:bg-amber-700"
                    }`}
                  >
                    {bid.status === "approved" ? "View" : bid.status === "re-analyze" ? "Resolve" : "View"}
                  </button>
                </td>
                {activeTab === "approved" && (
                  <td className="px-2 py-4 border-b border-gray-100">
                    <button type="button"
                      onClick={() => navigate(`/analyser-dashboard/printer/bid/${bid.id}/approved-details`, { state: { bid } })}
                      className="whitespace-nowrap rounded bg-blue-600 px-2 py-1.5 text-[10px] font-bold uppercase tracking-normal text-white shadow-sm hover:bg-blue-700">
                      Download
                    </button>
                  </td>
                )}
                {activeTab === "approved" && (
                  <td className="px-2 py-4 border-b border-l border-gray-100">
                    <button
                      type="button"
                      onClick={() => navigate(`/analyser-dashboard/printer/bid/${bid.id}/downloads`, { state: { bid } })}
                      className="whitespace-nowrap rounded bg-blue-600 px-2 py-1.5 text-[10px] font-bold uppercase tracking-normal text-white shadow-sm hover:bg-blue-700"
                    >
                      Download
                    </button>
                  </td>
                )}
                {activeTab === "approved" && (
                  <td className="border-b border-l border-gray-100 px-2 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <input type="checkbox" aria-label={`Select bid ${bid.bid_no}`}
                        checked={selectedBidIds.has(bid.id)}
                        onChange={(event) => setSelectedBidIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(bid.id); else next.delete(bid.id);
                          return next;
                        })}
                        className="h-4 w-4 shrink-0 accent-red-600" />
                      <button type="button" onClick={() => deleteBid(bid)} disabled={deletingId === bid.id}
                        title="Permanently delete bid"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-red-50 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50">
                        {deletingId === bid.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-200 border-t-red-600" /> : <FaTrash aria-hidden="true" />}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-4 border-t border-gray-100">
          <button
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage === 1}
            className="px-3 py-1.5 text-sm font-semibold rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            ‹ Prev
          </button>

          {pageNumbers.map((page) => (
            <button
              key={page}
              onClick={() => goToPage(page)}
              className={`w-9 h-9 text-sm font-semibold rounded-md border transition-all ${
                page === safePage ? "bg-slate-800 text-white border-slate-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage === totalPages}
            className="px-3 py-1.5 text-sm font-semibold rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}
