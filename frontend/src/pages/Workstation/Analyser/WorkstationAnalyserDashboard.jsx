import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaTrash } from "react-icons/fa";

const API_BASE = "http://127.0.0.1:8000/api";
const API_URL = `${API_BASE}/workstation-bids/list/`;
const ITEMS_PER_PAGE = 8;
const VISIBLE_PAGES = 5;

export default function WorkstationAnalyserDashboard() {
  const [activeTab, setActiveTab] = useState(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    return ["pending", "approved", "re-analyze"].includes(status) ? status : "pending";
  });
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reAnalyzeCount, setReAnalyzeCount] = useState(0);
  const [gemTransferCount, setGemTransferCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBidIds, setSelectedBidIds] = useState(new Set());
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setCurrentPage(1);
    setSelectedBidIds(new Set());
    fetchBids();
  }, [activeTab]);

  useEffect(() => {
    fetchReAnalyzeCount();
    fetchGemTransferCount();
  }, []);

  const fetchGemTransferCount = async () => {
    try {
      const res = await fetch(`${API_URL}?status=approved&role=analyser`);
      const data = res.ok ? await res.json() : [];
      setGemTransferCount(Array.isArray(data) ? data.filter((bid) => bid.is_new_product).length : 0);
    } catch { setGemTransferCount(0); }
  };

  const fetchReAnalyzeCount = async () => {
    try {
      const res = await fetch(`${API_URL}?status=re-analyze&role=analyser`);
      if (!res.ok) return;
      const data = await res.json();
      setReAnalyzeCount(Array.isArray(data) ? data.length : 0);
    } catch {
      // keep existing count
    }
  };

  const fetchBids = async () => {
    setLoading(true);
    setError("");
    try {
      const requestedStatus = activeTab === "gem-transfer" ? "approved" : activeTab;
      const res = await fetch(`${API_URL}?status=${requestedStatus}&role=analyser`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      const visible = activeTab === "gem-transfer" && Array.isArray(data) ? data.filter((bid) => bid.is_new_product) : data;
      setBids(Array.isArray(visible) ? visible : []);
      if (activeTab === "gem-transfer") setGemTransferCount(Array.isArray(visible) ? visible.length : 0);
      if (activeTab === "re-analyze") {
        setReAnalyzeCount(Array.isArray(data) ? data.length : 0);
      }
    } catch {
      setError("Unable to connect to the backend.");
      setBids([]);
    } finally {
      setLoading(false);
    }
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

  const normalizedStatus = (bid) => {
    const status = bid.status || bid.review_status || activeTab;
    return status === "re_analyze" ? "re-analyze" : status;
  };
  const isApprovedView = activeTab === "approved" || activeTab === "gem-transfer";

  const deleteBid = async (bid) => {
    if (!window.confirm(`Permanently delete bid ${bid.bid_no}?`)) return;
    setDeletingId(bid.id);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/workstation-bids/${bid.id}/delete/`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Bid could not be deleted.");
      setBids((current) => current.filter((item) => item.id !== bid.id));
      setSelectedBidIds((current) => {
        const next = new Set(current);
        next.delete(bid.id);
        return next;
      });
      fetchGemTransferCount();
    } catch (deleteError) {
      setError(deleteError.message || "Bid could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  };

  const bulkDeleteBids = async () => {
    const ids = [...selectedBidIds];
    if (!ids.length || !window.confirm(`Permanently delete ${ids.length} selected workstation bid(s)?`)) return;
    setBulkDeleting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/workstation-bids/bulk-delete/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Selected bids could not be deleted.");
      const deletedIds = new Set(data.deleted_ids || ids);
      setBids((current) => current.filter((bid) => !deletedIds.has(bid.id)));
      setSelectedBidIds(new Set());
      fetchGemTransferCount();
    } catch (deleteError) {
      setError(deleteError.message || "Selected bids could not be deleted.");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex gap-4 px-6 bg-gray-50 border-b border-gray-200 mt-4">
        <button
          onClick={() => setActiveTab("pending")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "pending" ? "text-amber-600 border-b-2 border-amber-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>⌛</span><span>Pending</span>
        </button>

        <button
          onClick={() => setActiveTab("approved")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "approved" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>✅</span><span>Approved</span>
        </button>

        <button
          onClick={() => setActiveTab("re-analyze")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "re-analyze" ? "text-rose-600 border-b-2 border-rose-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>⚠️</span><span>Re-Analyze</span>
          {reAnalyzeCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
              {reAnalyzeCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("gem-transfer")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === "gem-transfer" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
          <span>↗</span><span>Transfer Catalogue to GeM</span>
          {gemTransferCount > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{gemTransferCount > 99 ? "99+" : gemTransferCount}</span>}
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
          {error}
        </div>
      )}

      <div className="w-full overflow-hidden">
        <table className={`w-full table-fixed text-left border-separate border-spacing-0 [&_th]:!px-2 [&_td]:!px-2 ${activeTab === "gem-transfer" ? "min-w-[1000px]" : ""}`}>
          <colgroup>
            <col className={isApprovedView ? "w-[5%]" : "w-[6%]"} />
            <col className={isApprovedView ? "w-[12%]" : "w-[16%]"} />
            <col className={isApprovedView ? "w-[15%]" : "w-[18%]"} />
            <col className="w-[6%]" />
            <col className={isApprovedView ? "w-[12%]" : "w-[15%]"} />
            <col className={isApprovedView ? "w-[11%]" : "w-[13%]"} />
            {!isApprovedView && <col className="w-[13%]" />}
            <col className={activeTab === "gem-transfer" ? "w-[20%]" : isApprovedView ? "w-[10%]" : "w-[13%]"} />
            {isApprovedView && <col className="w-[14%]" />}
            {isApprovedView && <col className="w-[15%]" />}
            {activeTab === "approved" && <col className="w-[8%]" />}
          </colgroup>
          <thead>
            <tr className="bg-slate-800">
              {["S.No.", "Bid No", "Department", "Qty", "Submitted By", "Date"].map((head) => (
                <th key={head} className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                  {head}
                </th>
              ))}
              {!isApprovedView && <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">Status</th>}
              <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">Action</th>
              {isApprovedView && (
                <th className="pr-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                  Approved Details<br />For Bidding
                </th>
              )}
              {isApprovedView && (
                <th className="pl-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-l border-slate-700">
                  Download Docs for the bid
                </th>
              )}
              {activeTab === "approved" && (
                <th className="border-b border-l border-slate-700 px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-white">
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
                <td colSpan={activeTab === "approved" ? 10 : isApprovedView ? 9 : 8} className="text-center py-16 text-gray-400 font-medium">
                  Loading bids...
                </td>
              </tr>
            )}

            {!loading && bids.length === 0 && (
              <tr>
                <td colSpan={activeTab === "approved" ? 10 : isApprovedView ? 9 : 8} className="text-center py-16 text-gray-400 font-medium">
                  No bids found.
                </td>
              </tr>
            )}

            {!loading &&
              paginatedBids.map((bid, i) => {
                const status = normalizedStatus(bid);
                const rowColor =
                  status === "approved"
                    ? "border-l-4 border-l-emerald-500"
                    : status === "re-analyze"
                      ? "border-l-4 border-l-rose-500"
                      : "border-l-4 border-l-amber-500";

                return (
                  <tr key={bid.id} className={`bg-white hover:bg-gray-50 transition-colors ${rowColor}`}>
                    <td className="px-5 py-4 text-sm font-bold text-gray-700 border-b border-gray-100">
                      {(safePage - 1) * ITEMS_PER_PAGE + i + 1}
                    </td>
                    <td className="px-5 py-4 border-b border-gray-100">
                      <span className="text-sm font-bold text-blue-600">{bid.bid_no}</span>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-100">
                      <span className="text-sm font-bold text-gray-800 truncate max-w-[160px] block">{bid.dept_name || "-"}</span>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-100">
                      <span className="text-sm font-bold text-gray-700">{bid.qty || "-"}</span>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-100">
                      <span className="text-sm font-bold text-gray-700">{bid.submitted_by || bid.user_name || "-"}</span>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-100">
                      <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
                        {bid.date || bid.created_at
                          ? new Date(bid.date || bid.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </span>
                    </td>
                    {!isApprovedView && <td className="px-5 py-4 border-b border-gray-100">
                      {status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                          Pending
                        </span>
                      )}
                      {status === "approved" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          Approved
                        </span>
                      )}
                      {status === "re-analyze" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                          Re-Analyze
                        </span>
                      )}
                    </td>}
                    <td className="px-5 py-4 border-b border-gray-100">
                      {status === "approved" || activeTab === "gem-transfer" ? (
                        <button
                          onClick={() => activeTab === "gem-transfer"
                            ? window.open("https://sso.gem.gov.in/ARXSSO/oauth/doLogin", "_blank", "noopener,noreferrer")
                            : navigate(`/analyser-dashboard/workstation/bid/${bid.id}`, { state: { bid, readOnly: true } })}
                          className={activeTab === "gem-transfer"
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-md text-sm transition whitespace-nowrap"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all whitespace-nowrap"}
                        >
                          {activeTab === "gem-transfer" ? "Upload to GeM" : "View"}
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/analyser-dashboard/workstation/bid/${bid.id}`, { state: { bid, readOnly: false } })}
                          className={`px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all whitespace-nowrap text-white ${
                            status === "re-analyze" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
                          }`}
                        >
                          {status === "re-analyze" ? "Resolve" : "View"}
                        </button>
                      )}
                    </td>
                    {isApprovedView && (
                      <td className="pr-5 py-4 border-b border-gray-100">
                        <button type="button" onClick={() => navigate(`/analyser-dashboard/workstation/bid/${bid.id}`, { state: { bid, readOnly: true } })} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm whitespace-nowrap">
                          Download<span className="hidden">
                          ₹{Number(bid.final_amount || bid.total_price || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          </span>
                        </button>
                      </td>
                    )}
                    {isApprovedView && (
                      <td className="pl-5 py-4 border-b border-l border-gray-100">
                        <button
                          type="button"
                          onClick={() => navigate(`/analyser-dashboard/workstation/bid/${bid.id}/downloads`, { state: { bid } })}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm whitespace-nowrap"
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
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
                            {deletingId === bid.id ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                            ) : <FaTrash aria-hidden="true" />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
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
            Prev
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
            Next
          </button>
        </div>
      )}
    </div>
  );
}
