import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL;
const API_MAP = {
   aio: `${API_BASE}/aio-bids/list/`,
};

const ITEMS_PER_PAGE = 10;
const VISIBLE_PAGES = 5;

export default function AioAnalyserDashboard({ product = "aio" }) {

    const [activeTab, setActiveTab] = useState("pending");
    const [bids, setBids] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reAnalyzeCount, setReAnalyzeCount] = useState(0);
    const [gemTransferCount, setGemTransferCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const navigate = useNavigate();

    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set());
        fetchBids();
    }, [product, activeTab]);

    useEffect(() => {
        fetchReAnalyzeCount();
        fetchGemTransferCount();
    }, [product]);

    const fetchReAnalyzeCount = async () => {
        try {
            const res = await fetch(`${API_MAP[product]}?status=re-analyze`);
            if (!res.ok) return;
            const data = await res.json();
            setReAnalyzeCount(data.length);
        } catch {
            setReAnalyzeCount(0);
        }
    };

    const fetchBids = async () => {

        setLoading(true);
        setError("");

        try {

            const requestedStatus = activeTab === "gem-transfer" ? "approved" : activeTab;
            const url = `${API_MAP[product]}?status=${requestedStatus}`;

            const res = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) {
                throw new Error("Server error");
            }

            const data = await res.json();

            const visibleBids =
                activeTab === "gem-transfer"
                    ? data.filter((bid) => bid.is_new_product)
                    : data;
            setBids(visibleBids);
            if (activeTab === "gem-transfer") {
                setGemTransferCount(visibleBids.length);
            }

            if (activeTab === "re-analyze") {
                setReAnalyzeCount(data.length);
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

    const paginatedBids = bids.slice(
        (safePage - 1) * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE
    );

        let startPage = Math.max(1, safePage - Math.floor(VISIBLE_PAGES / 2));
    let endPage = startPage + VISIBLE_PAGES - 1;
    if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - VISIBLE_PAGES + 1);
    }
    const pageNumbers = Array.from(
        { length: endPage - startPage + 1 },
        (_, i) => startPage + i
    );

    const goToPage = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
    };

    const fetchGemTransferCount = async () => {
        try {
            const res = await fetch(`${API_MAP[product]}?status=approved`);
            if (!res.ok) return;
            const data = await res.json();
            setGemTransferCount(
                Array.isArray(data) ? data.filter((bid) => bid.is_new_product).length : 0
            );
        } catch {
            setGemTransferCount(0);
        }
    };

    const isApprovedView = activeTab === "approved" || activeTab === "gem-transfer";
    // Bulk-select checkboxes only on the plain Approved tab (not the GeM
    // transfer view, which is for tracking catalogue transfers, not deleting).
    const showBulkSelect = activeTab === "approved";
    const bodyColSpan = (isApprovedView ? 9 : 8) + (showBulkSelect ? 1 : 0);

    const toggleSelectOne = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        setSelectedIds((prev) => {
            const allSelected = paginatedBids.length > 0 && paginatedBids.every((bid) => prev.has(bid.id));
            const next = new Set(prev);
            if (allSelected) paginatedBids.forEach((bid) => next.delete(bid.id));
            else paginatedBids.forEach((bid) => next.add(bid.id));
            return next;
        });
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        const ok = window.confirm(`Are you sure you want to delete ${ids.length} selected bid${ids.length > 1 ? "s" : ""}?`);
        if (!ok) return;
        setBulkDeleting(true);
        try {
            const results = await Promise.allSettled(
                ids.map((id) => fetch(`${API_BASE}/aio-bids/${id}/delete/`, { method: "DELETE" }))
            );
            const succeededIds = ids.filter((id, i) => results[i].status === "fulfilled" && results[i].value.ok);
            setBids((prev) => prev.filter((b) => !succeededIds.includes(b.id)));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                succeededIds.forEach((id) => next.delete(id));
                return next;
            });
            const failedCount = ids.length - succeededIds.length;
            if (failedCount > 0) alert(`${failedCount} bid(s) could not be deleted.`);
        } catch (error) {
            console.error("handleBulkDelete error: ", error);
            alert("Unable to delete selected bids.");
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleDeleteOne = async (bid) => {
        const ok = window.confirm("Are you sure you want to delete this bid?");
        if (!ok) return;
        setDeletingId(bid.id);
        try {
            const res = await fetch(`${API_BASE}/aio-bids/${bid.id}/delete/`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Delete failed");
            setBids((prev) => prev.filter((b) => b.id !== bid.id));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(bid.id);
                return next;
            });
        } catch (error) {
            console.error("handleDeleteOne error: ", error);
            alert(error.message || "Unable to delete bid.");
        } finally {
            setDeletingId(null);
        }
    };

    return (

        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

            <div className="flex gap-4 px-6 bg-gray-50 border-b border-gray-200 mt-4">

                <button
                    onClick={() => setActiveTab("pending")}
                    className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2
                    ${activeTab === "pending"
                            ? "text-amber-600 border-b-2 border-amber-600"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <span>⏳</span>
                    Pending
                </button>

                <button
                    onClick={() => setActiveTab("approved")}
                    className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2
                    ${activeTab === "approved"
                            ? "text-emerald-600 border-b-2 border-emerald-600"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <span>✅</span>
                    Approved
                </button>

                <button
                    onClick={() => setActiveTab("re-analyze")}
                    className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2
                    ${activeTab === "re-analyze"
                            ? "text-rose-600 border-b-2 border-rose-600"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <span>⚠️</span>
                    Re-Analyze
                    {reAnalyzeCount > 0 && (
                        <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold leading-none text-white shadow-sm">
                            {reAnalyzeCount > 99 ? "99+" : reAnalyzeCount}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab("gem-transfer")}
                    className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2
                    ${activeTab === "gem-transfer"
                            ? "text-blue-600 border-b-2 border-blue-600"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <span>↗</span>
                    Transfer Catalogue to GeM
                    {gemTransferCount > 0 && (
                        <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold leading-none text-white shadow-sm">
                            {gemTransferCount > 99 ? "99+" : gemTransferCount}
                        </span>
                    )}
                </button>

            </div>

            {error && (
                <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    ⚠️ {error}
                </div>
            )}

            {showBulkSelect && selectedIds.size > 0 && (
                <div className="flex items-center justify-end px-6 py-3 mt-4 bg-red-50 border-y border-red-200">
                    <button type="button" onClick={handleBulkDelete} disabled={bulkDeleting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-red-400 hover:bg-red-500 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {bulkDeleting ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
                    </button>
                </div>
            )}

            <div className="w-full overflow-x-auto">

                <table className={`w-full table-fixed text-left border-separate border-spacing-0 [&_th]:!px-2 [&_td]:!px-2 ${activeTab === "gem-transfer" ? "min-w-[1000px]" : ""}`}>

                    <colgroup>
                        <col className={isApprovedView ? "w-[5%]" : "w-[6%]"} />
                        <col className={isApprovedView ? "w-[12%]" : "w-[16%]"} />
                        <col className={isApprovedView ? "w-[15%]" : "w-[18%]"} />
                        <col className={isApprovedView ? "w-[6%]" : "w-[6%]"} />
                        <col className={isApprovedView ? "w-[12%]" : "w-[15%]"} />
                        <col className={isApprovedView ? "w-[11%]" : "w-[13%]"} />
                        {!isApprovedView && <col className="w-[13%]" />}
                        <col className={activeTab === "gem-transfer" ? "w-[20%]" : isApprovedView ? "w-[10%]" : "w-[13%]"} />
                        {isApprovedView && <col className="w-[14%]" />}
                        {isApprovedView && <col className="w-[15%]" />}
                        {showBulkSelect && <col className="w-[8%]" />}
                    </colgroup>

                    <thead>

                        <tr className="bg-slate-800">

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                S.No.
                            </th>

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                Bid No
                            </th>

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                Department
                            </th>

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                Qty
                            </th>

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                Submitted By
                            </th>

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                Date
                            </th>

                            {!isApprovedView && (
                                <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                    Status
                                </th>
                            )}

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                Action
                            </th>

                            {isApprovedView && (
                                <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700">
                                    Approved Details For Bidding
                                </th>
                            )}

                            {isApprovedView && (
                                <th className="w-[15%] !pl-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-l border-slate-700">
                                    Download Docs for the bid
                                </th>
                            )}

                            {showBulkSelect && (
                                <th className="!pl-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-l border-slate-700">
                                    <div className="flex items-center justify-center gap-2">
                                        <input type="checkbox" checked={paginatedBids.length > 0 && paginatedBids.every((bid) => selectedIds.has(bid.id))}
                                            onChange={toggleSelectAll} className="w-4 h-4 accent-red-500 cursor-pointer" />
                                        Delete
                                    </div>
                                </th>
                            )}

                        </tr>

                    </thead>

                    <tbody>

                        {loading && (
                            <tr>
                                <td
                                    colSpan={bodyColSpan}
                                    className="text-center py-16 text-gray-400 font-medium"
                                >
                                    Loading bids...
                                </td>
                            </tr>
                        )}

                        {!loading && bids.length === 0 && (
                            <tr>
                                <td
                                    colSpan={bodyColSpan}
                                    className="text-center py-16 text-gray-400 font-medium"
                                >
                                    {activeTab === "gem-transfer"
                                        ? "No approved manually-created products found."
                                        : "No bids found."}
                                </td>
                            </tr>
                        )}

                        {!loading &&
                            paginatedBids.length > 0 &&
                            paginatedBids.map((bid, i) => (

                                <tr
                                    key={bid.id}
                                    className={`bg-white hover:bg-gray-50 transition-colors
                                    ${bid.status === "approved"
                                            ? "border-l-4 border-l-emerald-500"
                                            : bid.status === "re-analyze"
                                                ? "border-l-4 border-l-rose-500"
                                                : "border-l-4 border-l-amber-500"
                                        }`}
                                >

                                    <td className="px-5 py-4 text-sm font-bold text-gray-700 border-b border-gray-100">
                                        {(safePage - 1) * ITEMS_PER_PAGE + i + 1}
                                    </td>

                                    <td className="overflow-hidden px-5 py-4 border-b border-gray-100">
                                        <span
                                            className="block truncate whitespace-nowrap text-sm font-bold text-blue-600"
                                            title={bid.bid_no}
                                        >
                                            {bid.bid_no}
                                        </span>
                                    </td>

                                    <td className="overflow-hidden px-5 py-4 border-b border-gray-100">
                                        <span
                                            className="block truncate whitespace-nowrap text-sm font-bold text-gray-800"
                                            title={bid.dept_name || ""}
                                        >
                                            {bid.dept_name || "—"}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4 border-b border-gray-100">
                                        <span className="text-sm font-bold text-gray-700">
                                            {bid.qty || "—"}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4 border-b border-gray-100">
                                        <span className="text-sm font-bold text-gray-700">
                                            {bid.submitted_by || bid.user_name || "—"}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4 border-b border-gray-100">
                                        <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
                                            {bid.date || bid.created_at
                                                ? new Date(
                                                    bid.date || bid.created_at
                                                ).toLocaleDateString("en-IN", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })
                                                : "—"}
                                        </span>
                                    </td>

                                    {!isApprovedView && (
                                    <td className="px-5 py-4 border-b border-gray-100">

                                        {bid.status === "pending" && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                                Pending
                                            </span>
                                        )}

                                        {bid.status === "approved" && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                Approved
                                            </span>
                                        )}

                                        {bid.status === "re-analyze" && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                                                ⚠️ Re-Analyze
                                            </span>
                                        )}

                                    </td>
                                    )}

                                    <td className="px-5 py-4 border-b border-gray-100">

                                        {bid.status === "approved" ? (
                                                <button
                                                    onClick={() => activeTab === "gem-transfer"
                                                        ? window.open("https://sso.gem.gov.in/ARXSSO/oauth/doLogin", "_blank", "noopener,noreferrer")
                                                        : navigate(
                                                            `/analyser-dashboard/${product}/bid/${bid.id}`,
                                                            {
                                                                state: {
                                                                    bid,
                                                                    readOnly: true,
                                                                },
                                                            }
                                                        )
                                                    }
                                                    className={activeTab === "gem-transfer"
                                                        ? "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-md text-sm transition whitespace-nowrap"
                                                        : "bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all whitespace-nowrap"}
                                                >
                                                    {activeTab === "gem-transfer" ? "Upload to GeM" : "View"}
                                                </button>

                                        ) : (

                                            <button
                                                onClick={() =>
                                                    navigate(
                                                        `/analyser-dashboard/${product}/bid/${bid.id}`,
                                                        { state: { bid, readOnly: false } }
                                                    )
                                                }
                                                className={`px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all whitespace-nowrap text-white
                                                ${bid.status === "re-analyze"
                                                        ? "bg-rose-600 hover:bg-rose-700"
                                                        : "bg-amber-600 hover:bg-amber-700"
                                                    }`}
                                            >
                                                {bid.status === "re-analyze" ? "Resolve" : "View"}
                                            </button>

                                        )}

                                    </td>

                                    {isApprovedView && (
                                    <td className="!pr-5 py-4 border-b border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigate(
                                                    `/analyser-dashboard/${product}/bid/${bid.id}/approved-details`,
                                                    { state: { bid } }
                                                )
                                            }
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm whitespace-nowrap"
                                        >
                                            Download
                                        </button>
                                        <span className="hidden">
                                            ₹{Number(bid.total_price || 0).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </td>
                                    )}

                                    {isApprovedView && (
                                    <td className="!pl-5 py-4 border-b border-l border-gray-100">
                                        {bid.status === "approved" ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    navigate(
                                                        `/analyser-dashboard/${product}/bid/${bid.id}/downloads`,
                                                        { state: { bid } }
                                                    )
                                                }
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm whitespace-nowrap"
                                            >
                                                Download
                                            </button>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                    )}

                                    {showBulkSelect && (
                                    <td className="!pl-5 py-4 border-b border-l border-gray-100">
                                        <div className="flex items-center justify-center gap-3">
                                            <input type="checkbox" checked={selectedIds.has(bid.id)} onChange={() => toggleSelectOne(bid.id)}
                                                className="w-4 h-4 accent-red-500 cursor-pointer" />
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteOne(bid)}
                                                disabled={deletingId === bid.id}
                                                title="Delete bid"
                                                className="w-8 h-8 flex items-center justify-center rounded-md bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {deletingId === bid.id ? (
                                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                )}
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
                        className="px-3 py-1.5 text-sm font-semibold rounded-md border border-gray-200
                                   text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed
                                   transition-all whitespace-nowrap"
                    >
                        ‹ Prev
                    </button>

                    {pageNumbers.map((page) => (
                        <button
                            key={page}
                            onClick={() => goToPage(page)}
                            className={`w-9 h-9 text-sm font-semibold rounded-md border transition-all
                            ${page === safePage
                                    ? "bg-slate-800 text-white border-slate-800"
                                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                }`}
                        >
                            {page}
                        </button>
                    ))}

                    <button
                        onClick={() => goToPage(safePage + 1)}
                        disabled={safePage === totalPages}
                        className="px-3 py-1.5 text-sm font-semibold rounded-md border border-gray-200
                                   text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed
                                   transition-all whitespace-nowrap"
                    >
                        Next ›
                    </button>

                </div>
            )}

        </div>

    );
}

