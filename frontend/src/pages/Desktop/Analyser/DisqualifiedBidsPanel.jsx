import { useEffect, useState } from "react";
import { FaEye } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL;

function EvaluationHistoryModal({ bid, onClose }) {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={onClose}>
      <div className="max-h-[85vh] w-full max-w-6xl overflow-hidden bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <h2 className="text-base font-bold text-sky-800">Reason for Technical Evaluation</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl font-bold text-gray-400 hover:text-gray-700">&times;</button>
        </div>
        <div className="overflow-auto p-6">
          <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Bid No.", bid.bid_no || "-"],
              ["Department Name And Address", bid.department || "-"],
              ["Disqualified Date", bid.disqualified_at ? new Date(bid.disqualified_at).toLocaleString("en-IN") : "-"],
              ["Items", bid.item_name || "-"],
              ["Technical Status", bid.technical_status || bid.status || "Disqualified"],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          <h3 className="mb-3 text-sm font-bold text-gray-800">Technical Evaluation History</h3>
          <table className="min-w-[850px] w-full text-left text-sm">
            <thead className="bg-gray-300 text-gray-900">
              <tr>
                <th className="w-40 px-3 py-3 font-semibold">Date Time</th>
                <th className="w-32 px-3 py-3 font-semibold">Status</th>
                <th className="w-[34%] px-3 py-3 font-semibold">Reason</th>
                <th className="px-3 py-3 font-semibold">Comment</th>
              </tr>
            </thead>
            <tbody>
              {(bid.history || []).map((row, index) => (
                <tr key={`${row.date_time}-${index}`} className="border-b border-gray-100 align-top">
                  <td className="px-3 py-3 text-gray-700">{row.date_time ? new Date(row.date_time).toLocaleString("en-IN") : "-"}</td>
                  <td className="px-3 py-3 text-gray-700">{row.status || "-"}</td>
                  <td className="px-3 py-3 text-gray-700">{row.reason || "-"}</td>
                  <td className="px-3 py-3 text-gray-700">{row.comment || "-"}</td>
                </tr>
              ))}
              {!bid.history?.length && (
                <tr><td colSpan="4" className="py-10 text-center text-gray-500">Evaluation history has not been synced from GeM yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DisqualifiedBidsPanel({ showProductFilter = false }) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const query = new URLSearchParams({ status: "disqualified", year: "2026" });
        const response = await fetch(`${API_BASE}/gem/bid-results/?${query}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        });
        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
          ? await response.json()
          : {};
        if (!response.ok) {
          throw new Error(payload.error || `Disqualified bids could not be loaded (HTTP ${response.status}).`);
        }
        if (active) setRows(payload.results || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const timer = window.setInterval(load, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (loading) return <div className="py-16 text-center text-sm font-medium text-gray-500">Loading disqualified bids...</div>;
  if (error) return <div className="m-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

  return (
    <div className="bg-white">
      {showProductFilter && (
        <div className="border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Disqualified Bid</h2>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full text-left">
        <thead className="bg-slate-800 text-[11px] uppercase tracking-wider text-white">
          <tr>
            <th className="w-12 px-4 py-4">S.No.</th>
            <th className="w-48 px-4 py-4">Bid No.</th>
            <th className="px-4 py-4">Department Name And Address</th>
            <th className="w-44 px-4 py-4">Disqualified Date</th>
            <th className="w-56 px-4 py-4">Items</th>
            <th className="w-52 px-4 py-4">Technical Status</th>
            <th className="w-20 px-4 py-4 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
              <td className="px-4 py-4 text-sm font-bold text-gray-700">{index + 1}</td>
              <td className="px-4 py-4 text-sm font-bold text-blue-700">{row.bid_no}</td>
              <td className="px-4 py-4 text-sm text-gray-700">{row.department || "-"}</td>
              <td className="px-4 py-4 text-sm text-gray-700">{row.disqualified_at ? new Date(row.disqualified_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</td>
              <td className="px-4 py-4 text-sm font-medium text-gray-800">{row.item_name || "-"}</td>
              <td className="px-4 py-4">
                <button type="button" onClick={() => setSelected(row)} className="inline-flex items-center gap-1.5 font-bold text-red-600 hover:text-red-800">
                  <span>Disqualified</span>
                  <FaEye className="text-lg text-blue-600" aria-hidden="true" />
                </button>
              </td>
              <td className="px-4 py-4 text-center">
                <span className="text-xs font-semibold text-slate-500" title="Permanent audit record">Protected</span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan="7" className="py-16 text-center text-sm text-gray-500">No disqualified bids have been synced from GeM yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>
      {selected && <EvaluationHistoryModal bid={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
