import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL;
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
}).format(new Date(value)) : "-";

export default function UserAssignedBids() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
  const load = async () => {
    try {
      const response = await fetch(`${API_BASE}/gem/bid-assignments/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Assigned bids could not be loaded.");
      setRows(data.results || []); setError("");
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); const timer = setInterval(() => document.visibilityState === "visible" && load(), 30000); return () => clearInterval(timer); }, []);
  return <div className="bg-white shadow-sm">
    <div className="border-b border-gray-200 p-5">
      <h2 className="text-lg font-bold text-slate-900">Bid To Be Participated</h2>
      <p className="mt-1 text-xs text-slate-500">Bids assigned to you by the analyser.</p>
    </div>
    {error && <div className="m-5 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-x-auto"><table className="min-w-[800px] w-full text-left text-sm">
      <thead className="bg-slate-800 text-xs uppercase text-white"><tr>
        <th className="px-4 py-4">S.No.</th><th className="px-4 py-4">Bid No.</th><th className="px-4 py-4">Start Date & Time</th><th className="px-4 py-4">End Date & Time</th><th className="px-4 py-4">Item</th>
      </tr></thead><tbody>
        {rows.map((row, index) => <tr key={row.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
          <td className="px-4 py-4 font-bold">{index + 1}</td>
          <td className="px-4 py-4 font-bold text-blue-700">{row.pdf_url ? <a href={row.pdf_url} target="_blank" rel="noreferrer" className="underline">{row.bid_no}</a> : row.bid_no}</td>
          <td className="px-4 py-4">{formatDateTime(row.bid_date)}</td><td className="px-4 py-4 font-semibold text-emerald-700">{formatDateTime(row.end_date)}</td>
          <td className="max-w-md px-4 py-4 font-medium">{row.item}</td>
        </tr>)}
        {!rows.length && <tr><td colSpan="5" className="py-16 text-center text-gray-500">No bids have been assigned to you yet.</td></tr>}
      </tbody>
    </table></div>
  </div>;
}
