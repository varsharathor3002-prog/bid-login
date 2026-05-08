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
        <div>

            {/* TABS */}
            <div className="flex gap-3 mb-5 border-b border-gray-200 pb-2">

                <button
                    onClick={() => setActiveTab("pending")}
                    className={`px-5 py-2 text-sm font-semibold rounded-t-lg transition
                    ${
                        activeTab === "pending"
                            ? "bg-yellow-500 text-white"
                            : "text-gray-500 hover:text-yellow-600"
                    }`}
                >
                    ⏳ Pending
                </button>

                <button
                    onClick={() => setActiveTab("reviewed")}
                    className={`px-5 py-2 text-sm font-semibold rounded-t-lg transition
                    ${
                        activeTab === "reviewed"
                            ? "bg-green-600 text-white"
                            : "text-gray-500 hover:text-green-600"
                    }`}
                >
                    ✅ Reviewed
                </button>

                <button
                    onClick={() => setActiveTab("re-analyze")}
                    className={`px-5 py-2 text-sm font-semibold rounded-t-lg transition
                    ${
                        activeTab === "re-analyze"
                            ? "bg-red-600 text-white"
                            : "text-red-600 hover:bg-red-50"
                    }`}
                >
                    🔴 Re-Analyse
                </button>

            </div>

            {/* ERROR */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">
                    ⚠️ {error}
                </div>
            )}

            {/* LOADING */}
            {loading && (
                <div className="flex items-center justify-center h-40 text-gray-400">
                    Loading bids...
                </div>
            )}

            {/* EMPTY */}
            {!loading && bids.length === 0 && (
                <div className="flex items-center justify-center h-40 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    No bids found.
                </div>
            )}

            {/* TABLE */}
            {!loading && bids.length > 0 && (

                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">

                    <table className="w-full text-sm">

                        <thead>
                            <tr className="bg-gray-50 text-gray-500 uppercase text-xs border-b border-gray-200">

                                <th className="px-4 py-3 text-left">S.No.</th>

                                <th className="px-4 py-3 text-left">Bid No</th>

                                <th className="px-4 py-3 text-left">Model No.</th>

                                <th className="px-4 py-3 text-left">Department</th>

                                <th className="px-4 py-3 text-left">Qty</th>

                                <th className="px-4 py-3 text-left">Submitted By</th>

                                <th className="px-4 py-3 text-left">Date</th>

                                <th className="px-4 py-3 text-left">Status</th>

                                <th className="px-4 py-3 text-left">Action</th>

                            </tr>
                        </thead>

                        <tbody>

                            {bids.map((bid, i) => (

                                <tr
                                    key={bid.id}
                                    className="border-t border-gray-100 hover:bg-blue-50 transition"
                                >

                                    <td className="px-4 py-3 text-gray-400">
                                        {i + 1}
                                    </td>

                                    <td className="px-4 py-3 font-bold text-blue-700">
                                        {bid.bid_no}
                                    </td>

                                    <td className="px-4 py-3 text-indigo-600 font-semibold">
                                        {bid.model_number || "—"}
                                    </td>

                                    <td className="px-4 py-3 text-gray-700">
                                        {bid.dept_name}
                                    </td>

                                    <td className="px-4 py-3 text-gray-700">
                                        {bid.qty}
                                    </td>

                                    <td className="px-4 py-3 text-gray-600 font-medium">
                                        {bid.submitted_by || "—"}
                                    </td>

                                    <td className="px-4 py-3 text-gray-400 text-xs">
                                        {new Date(
                                            bid.created_at
                                        ).toLocaleDateString("en-IN")}
                                    </td>

                                    {/* STATUS */}
                                    <td className="px-4 py-3">

                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold

                                            ${
                                                bid.status === "pending"
                                                    ? "bg-yellow-100 text-yellow-700"
                                                    : ""
                                            }

                                            ${
                                                bid.status === "reviewed"
                                                    ? "bg-green-100 text-green-700"
                                                    : ""
                                            }

                                            ${
                                                bid.status === "re-analyze"
                                                    ? "bg-red-100 text-red-700"
                                                    : ""
                                            }
                                        `}
                                        >
                                            {bid.status}
                                        </span>

                                    </td>

                                    {/* ACTION */}
                                    <td className="px-4 py-3">

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
                                                className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg transition font-semibold"
                                            >
                                                View →
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
                                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg transition font-semibold"
                                            >
                                                Review →
                                            </button>

                                        )}

                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            )}

        </div>
    );
}