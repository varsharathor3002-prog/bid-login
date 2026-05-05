import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_MAP = {
  desktop: "http://127.0.0.1:8000/api/desktop-bids/list/",
};

export default function AnalyserDashboard({ product = "desktop" }) {
  const [activeTab, setActiveTab] = useState("pending");
  const [bids, setBids]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const navigate                  = useNavigate();

  useEffect(() => {
    fetchBids();
  }, [product, activeTab]);

  const fetchBids = async () => {
    setLoading(true);
    setError("");
    try {
      const url = `${API_MAP[product]}?status=${activeTab}`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setBids(data);
    } catch {
      setError("Backend se connect nahi ho pa raha. Demo data dikh raha hai.");
      setBids([
        { id: 1, bid_no: "GEM/2026/001", dept_name: "Education Dept",  qty: 50, status: "pending",  created_at: "2026-05-01", submitted_by: "ravi"  },
        { id: 2, bid_no: "GEM/2026/002", dept_name: "Health Ministry",  qty: 20, status: "pending",  created_at: "2026-05-02", submitted_by: "priya" },
        { id: 3, bid_no: "GEM/2026/003", dept_name: "Defence Dept",     qty: 10, status: "reviewed", created_at: "2026-05-03", submitted_by: "amit"  },
      ].filter(b => b.status === activeTab));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>

      {/* Page Title */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-800 capitalize">
          {product} Bids
          <span className="ml-2 text-sm font-normal text-gray-400">({bids.length} total)</span>
        </h2>
        <button onClick={fetchBids} className="text-sm text-blue-600 hover:underline">
          ↻ Refresh
        </button>
      </div>

      {/* Tabs — Pending / Reviewed */}
      <div className="flex gap-2 mb-5 border-b border-gray-200">
        {["pending", "reviewed"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 text-sm font-semibold capitalize rounded-t-lg transition
              ${activeTab === tab
                ? "bg-blue-600 text-white border-b-2 border-blue-600"
                : "text-gray-500 hover:text-blue-600"}`}
          >
            {tab === "pending" ? "⏳" : "✅"} {tab}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm px-4 py-2 rounded-lg mb-4">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-400">
          Loading {activeTab} bids...
        </div>
      )}

      {/* Empty */}
      {!loading && bids.length === 0 && (
        <div className="flex items-center justify-center h-40 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          No {activeTab} {product} bids found.
        </div>
      )}

      {/* Table */}
      {!loading && bids.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-xs border-b border-gray-200">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Bid No</th>
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
                <tr key={bid.id} className="border-t border-gray-100 hover:bg-blue-50 transition">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 font-bold text-blue-700">{bid.bid_no}</td>
                  <td className="px-4 py-3 text-gray-700">{bid.dept_name}</td>
                  <td className="px-4 py-3 text-gray-700">{bid.qty}</td>
                  <td className="px-4 py-3 text-gray-500">{bid.submitted_by || "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(bid.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold
                      ${bid.status === "pending"  ? "bg-yellow-100 text-yellow-700" : ""}
                      ${bid.status === "reviewed" ? "bg-green-100 text-green-700"   : ""}
                      ${bid.status === "approved" ? "bg-blue-100 text-blue-700"     : ""}
                    `}>
                      {bid.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        navigate(
                          `/analyser-dashboard/${product}/bid/${bid.id}`,
                          { state: { bid } }
                        )
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg transition font-semibold"
                    >
                      Review →
                    </button>
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