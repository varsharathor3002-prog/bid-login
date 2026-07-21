import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000/api";
const API_URL = `${API_BASE}/workstation-bids/list/`;
const ITEMS_PER_PAGE = 8;
const VISIBLE_PAGES = 5;

export default function WorkstationAnalyserDashboard() {
  const [activeTab, setActiveTab] = useState("pending");
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reAnalyzeCount, setReAnalyzeCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    setCurrentPage(1);
    fetchBids();
  }, [activeTab]);

  useEffect(() => {
    fetchReAnalyzeCount();
  }, []);

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
      const res = await fetch(`${API_URL}?status=${activeTab}&role=analyser`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setBids(Array.isArray(data) ? data : []);
      if (activeTab === "re-analyze") {
        setReAnalyzeCount(Array.isArray(data) ? data.length : 0);
      }
    } catch {
      setError("Backend se connect nahi ho pa raha.");
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

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex gap-4 px-6 bg-gray-50 border-b border-gray-200 mt-4">
        <button
          onClick={() => setActiveTab("pending")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "pending" ? "text-amber-600 border-b-2 border-amber-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>Pending</span>
        </button>

        <button
          onClick={() => setActiveTab("reviewed")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "reviewed" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>Reviewed</span>
        </button>

        <button
          onClick={() => setActiveTab("re-analyze")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "re-analyze" ? "text-rose-600 border-b-2 border-rose-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>Re-Analyze</span>
          {reAnalyzeCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
              {reAnalyzeCount}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-800">
              {["S.No.", "Bid No", "Department", "Qty", "Submitted By", "Date", "Status", "Action"].map((head) => (
                <th key={head} className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="8" className="text-center py-16 text-gray-400 font-medium">
                  Loading bids...
                </td>
              </tr>
            )}

            {!loading && bids.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-16 text-gray-400 font-medium">
                  No bids found.
                </td>
              </tr>
            )}

            {!loading &&
              paginatedBids.map((bid, i) => {
                const status = normalizedStatus(bid);
                const rowColor =
                  status === "reviewed"
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
                    <td className="px-5 py-4 border-b border-gray-100">
                      {status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                          Pending
                        </span>
                      )}
                      {status === "reviewed" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          Reviewed
                        </span>
                      )}
                      {status === "re-analyze" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                          Re-Analyze
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 border-b border-gray-100">
                      {status === "reviewed" ? (
                        <button
                          onClick={() => navigate(`/analyser-dashboard/workstation/bid/${bid.id}`, { state: { bid, readOnly: true } })}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all whitespace-nowrap"
                        >
                          View
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/analyser-dashboard/workstation/bid/${bid.id}`, { state: { bid, readOnly: false } })}
                          className={`px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all whitespace-nowrap text-white ${
                            status === "re-analyze" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
                          }`}
                        >
                          {status === "re-analyze" ? "Resolve" : "Review"}
                        </button>
                      )}
                    </td>
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