import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_MAP = {
    desktop: "http://127.0.0.1:8000/api/desktop-bids/list/",
};

export default function AnalyserDashboard({ product = "desktop" }) {

    const [activeTab, setActiveTab] = useState("pending");
    const [bids, setBids] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    useEffect(() => {
        fetchBids();
    }, [product, activeTab]);

    const fetchBids = async () => {

        setLoading(true);
        setError("");

        try {

            const url = `${API_MAP[product]}?status=${activeTab}`;

            const res = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) {
                throw new Error("Server error");
            }

            const data = await res.json();

            setBids(data);

        } catch {

            setError("Backend se connect nahi ho pa raha.");

            setBids([]);

        } finally {

            setLoading(false);

        }
    };

    return (

        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

            {/* ===== TABS ===== */}
            <div className="flex gap-4 px-6 bg-gray-50 border-b border-gray-200">

                <button
                    onClick={() => setActiveTab("pending")}
                    className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2
                    ${
                        activeTab === "pending"
                            ? "text-amber-600 border-b-2 border-amber-600"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    <span>⏳</span>
                    Pending
                </button>

                <button
                    onClick={() => setActiveTab("reviewed")}
                    className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2
                    ${
                        activeTab === "reviewed"
                            ? "text-emerald-600 border-b-2 border-emerald-600"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    <span>✅</span>
                    Reviewed
                </button>

                <button
                    onClick={() => setActiveTab("re-analyze")}
                    className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2
                    ${
                        activeTab === "re-analyze"
                            ? "text-rose-600 border-b-2 border-rose-600"
                            : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    <span>⚠️</span>
                    Re-Analyze
                </button>

            </div>

            {/* ERROR */}
            {error && (
                <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    ⚠️ {error}
                </div>
            )}

            {/* TABLE */}
            <div className="w-full overflow-x-auto">

                <table className="w-full text-left border-separate border-spacing-0">

                    <thead>

                        <tr className="bg-slate-800">

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                S.No.
                            </th>

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                Bid No
                            </th>

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                Model No.
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

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                Status
                            </th>

                            <th className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                                Action
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        {/* LOADING */}
                        {loading && (
                            <tr>
                                <td
                                    colSpan="9"
                                    className="text-center py-16 text-gray-400 font-medium"
                                >
                                    Loading bids...
                                </td>
                            </tr>
                        )}

                        {/* EMPTY */}
                        {!loading && bids.length === 0 && (
                            <tr>
                                <td
                                    colSpan="9"
                                    className="text-center py-16 text-gray-400 font-medium"
                                >
                                    No bids found.
                                </td>
                            </tr>
                        )}

                        {/* DATA */}
                        {!loading &&
                            bids.length > 0 &&
                            bids.map((bid, i) => (

                                <tr
                                    key={bid.id}
                                    className={`bg-white hover:bg-gray-50 transition-colors
                                    
                                    ${
                                        bid.status === "reviewed"
                                            ? "border-l-4 border-l-emerald-500"
                                            : bid.status === "re-analyze"
                                            ? "border-l-4 border-l-rose-500"
                                            : "border-l-4 border-l-amber-500"
                                    }`}
                                >

                                    {/* S.NO */}
                                    <td className="px-5 py-4 text-sm font-bold text-gray-700 border-b border-gray-100">
                                        {i + 1}
                                    </td>

                                    {/* BID NO */}
                                    <td className="px-5 py-4 border-b border-gray-100">
                                        <span className="text-sm font-bold text-blue-600">
                                            {bid.bid_no}
                                        </span>
                                    </td>

                                    {/* MODEL */}
                                    <td className="px-5 py-4 border-b border-gray-100">
                                        <span className="text-sm font-bold text-indigo-600 whitespace-nowrap">
                                            {bid.model_number || bid.model || "—"}
                                        </span>
                                    </td>

                                    {/* DEPARTMENT */}
                                    <td className="px-5 py-4 border-b border-gray-100">
                                        <span className="text-sm font-bold text-gray-800 truncate max-w-[160px] block">
                                            {bid.dept_name || "—"}
                                        </span>
                                    </td>

                                    {/* QTY */}
                                    <td className="px-5 py-4 border-b border-gray-100">
                                        <span className="text-sm font-bold text-gray-700">
                                            {bid.qty || "—"}
                                        </span>
                                    </td>

                                    {/* SUBMITTED BY */}
                                    <td className="px-5 py-4 border-b border-gray-100">
                                        <span className="text-sm font-bold text-gray-700">
                                          {bid.submitted_by || bid.user_name || "—"}
                                        </span>
                                    </td>

                                    {/* DATE */}
                                    <td className="px-5 py-4 border-b border-gray-100">
                                        <span className="text-sm font-bold text-gray-700 whitespace-nowrap">

                                            {bid.date || bid.created_at
                                                ? new Date(
                                                      bid.date || bid.created_at
                                                  ).toLocaleDateString(
                                                      "en-IN",
                                                      {
                                                          day: "2-digit",
                                                          month: "short",
                                                          year: "numeric",
                                                      }
                                                  )
                                                : "—"}

                                        </span>
                                    </td>

                                    {/* STATUS */}
                                    <td className="px-5 py-4 border-b border-gray-100">

                                        {bid.status === "pending" && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                                 Pending
                                            </span>
                                        )}

                                        {bid.status === "reviewed" && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                ✅ Reviewed
                                            </span>
                                        )}

                                        {bid.status === "re-analyze" && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                                                ⚠️ Re-Analyze
                                            </span>
                                        )}

                                    </td>

                                    {/* ACTION */}
                                    <td className="px-5 py-4 border-b border-gray-100">

                                        {bid.status === "reviewed" ? (

                                            <button
                                                onClick={() =>
                                                    navigate(
                                                        `/analyser-dashboard/${product}/bid/${bid.id}`,
                                                        {
                                                            state: {
                                                                bid,
                                                                readOnly: true,
                                                            },
                                                        }
                                                    )
                                                }
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all whitespace-nowrap"
                                            >
                                                View
                                            </button>

                                        ) : (

                                            <button
                                                onClick={() =>
                                                    navigate(
                                                        `/analyser-dashboard/${product}/bid/${bid.id}`,
                                                        {
                                                            state: {
                                                                bid,
                                                                readOnly: false,
                                                            },
                                                        }
                                                    )
                                                }
                                                className={`px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all whitespace-nowrap text-white
                                                
                                                ${
                                                    bid.status === "re-analyze"
                                                        ? "bg-rose-600 hover:bg-rose-700"
                                                        : "bg-amber-600 hover:bg-amber-700"
                                                }`}
                                            >
                                                {bid.status === "re-analyze"
                                                    ? "Resolve"
                                                    : "Review"}
                                            </button>

                                        )}

                                    </td>

                                </tr>

                            ))}

                    </tbody>

                </table>

            </div>

        </div>

    );
}