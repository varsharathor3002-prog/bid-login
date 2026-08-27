import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaTrash } from "react-icons/fa";

const API_MAP = {
   desktop: `${import.meta.env.VITE_API_URL}/desktop-bids/list/`,
};

const ITEMS_PER_PAGE = 10;
const VISIBLE_PAGES = 5;

export default function AnalyserDashboard({ product = "desktop" }) {

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

            setError("Unable to connect to the backend.");
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

    const deleteBid = async (bid) => {
        if (!window.confirm(`Permanently delete bid ${bid.bid_no}?`)) return;
        setDeletingId(bid.id);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/desktop-bids/${bid.id}/delete/`, { method: "DELETE" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Bid could not be deleted.");
            setBids((current) => current.filter((item) => item.id !== bid.id));
            setSelectedBidIds((current) => {
                const next = new Set(current);
                next.delete(bid.id);
                return next;
            });
            fetchReAnalyzeCount();
            fetchGemTransferCount();
        } catch (deleteError) {
            setError(deleteError.message || "Bid could not be deleted.");
        } finally {
            setDeletingId(null);
        }
    };

    const bulkDeleteBids = async () => {
        const ids = [...selectedBidIds];
        if (!ids.length) return;
        if (!window.confirm(`Permanently delete ${ids.length} selected desktop bid(s)?`)) return;
        setBulkDeleting(true);
        setError("");
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/desktop-bids/bulk-delete/`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Selected bids could not be deleted.");
            const deletedIds = new Set(data.deleted_ids || ids);
            setBids((current) => current.filter((bid) => !deletedIds.has(bid.id)));
            setSelectedBidIds(new Set());
            fetchReAnalyzeCount();
            fetchGemTransferCount();
        } catch (deleteError) {
            setError(deleteError.message || "Selected bids could not be deleted.");
        } finally {
            setBulkDeleting(false);
        }
    };

    return (

        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

            <div className="flex items-center gap-4 px-6 bg-gray-50 border-b border-gray-200 mt-4">

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
                        {activeTab === "approved" && <col className="w-[8%]" />}
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

                            {activeTab === "approved" && (
                                <th className="px-2 py-4 text-[11px] font-bold uppercase tracking-wider text-white border-b border-l border-slate-700">
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
                                <td
                                    colSpan={activeTab === "approved" ? 10 : isApprovedView ? 9 : 8}
                                    className="text-center py-16 text-gray-400 font-medium"
                                >
                                    Loading bids...
                                </td>
                            </tr>
                        )}

                        {!loading && bids.length === 0 && (
                            <tr>
                                <td
                                    colSpan={activeTab === "approved" ? 10 : isApprovedView ? 9 : 8}
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

                                        <div className="flex items-center gap-2">

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
                                                        ? "inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-7 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all duration-200 hover:-translate-y-0.5 hover:from-indigo-700 hover:via-violet-700 hover:to-purple-700 hover:shadow-xl whitespace-nowrap"
                                                        : "bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all whitespace-nowrap"}
                                                >
                                                    {activeTab === "gem-transfer" && <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.25" d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v4a1 1 0 001 1h12a1 1 0 001-1v-4" /></svg>}
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

                                        </div>

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
                                                ) : (
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
