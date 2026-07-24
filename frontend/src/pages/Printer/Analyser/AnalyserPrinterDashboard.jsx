import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL;
const API_URL = `${API_BASE}/printer-bids/list/`;

const ITEMS_PER_PAGE = 10;
const VISIBLE_PAGES = 5;

export default function AnalyserPrinterDashboard() {
  const [activeTab, setActiveTab] = useState("pending");
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reAnalyzeCount, setReAnalyzeCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

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
        setError("Backend se printer bids load nahi ho pa rahi hain.");
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
    setActiveTab(tab);
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
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "pending" ? "text-amber-600 border-b-2 border-amber-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>⏳</span>
          Pending
        </button>

        <button
          onClick={() => handleTabChange("approved")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "approved" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span>✅</span>
          Approved
        </button>

        <button
          onClick={() => handleTabChange("re-analyze")}
          className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2 ${
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
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-800">
              <th className="w-[3%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">S.No.</th>
              <th className="w-[10%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Bid No</th>
              <th className="w-[12%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Department</th>
              <th className="w-[10%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Printer Type</th>
              <th className="w-[9%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Type Of Printing</th>
              <th className="w-[4%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Qty</th>
              <th className="w-[9%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Submitted By</th>
              <th className="w-[9%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Date</th>
              <th className="w-[8%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Status</th>
              <th className="w-[7%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Action</th>
              {activeTab === "approved" && (
                <th className="w-[9%] px-1 py-4 text-[10px] font-bold text-white uppercase border-b border-slate-700">Price Approved</th>
              )}
              {activeTab === "approved" && (
                <th className="w-[10%] px-2 py-4 text-[10px] font-bold text-white uppercase border-b border-l border-slate-700">Download Docs for the bid</th>
              )}
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={activeTab === "approved" ? 12 : 10} className="text-center py-16 text-gray-400 font-medium">
                  Loading printer bids...
                </td>
              </tr>
            )}

            {!loading && bids.length === 0 && (
              <tr>
                <td colSpan={activeTab === "approved" ? 12 : 10} className="text-center py-16 text-gray-400 font-medium">
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
                <td className="px-2 py-4 border-b border-gray-100">
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
                  <td className="px-1 py-4 border-b border-gray-100">
                    <span className="whitespace-nowrap text-[11px] font-bold text-emerald-700">
                      ₹{Number(bid.final_amount || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                )}
                {activeTab === "approved" && (
                  <td className="px-2 py-4 border-b border-l border-gray-100">
                    <button
                      type="button"
                      onClick={() => navigate(`/analyser-dashboard/printer/bid/${bid.id}/downloads`, { state: { bid } })}
                      className="whitespace-nowrap rounded bg-blue-600 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-blue-700"
                    >
                      Download
                    </button>
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
