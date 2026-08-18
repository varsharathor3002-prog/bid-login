import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL;
const statusLabels = {
  assigned: "Assigned", in_progress: "In Progress", participated: "Participated",
  skipped: "Not Eligible / Skipped", expired: "Expired",
};
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
}).format(new Date(value)) : "-";

export default function UserAssignedBids() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
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
  const updateStatus = async (row, status) => {
    setBusyId(row.id);
    try {
      const response = await fetch(`${API_BASE}/gem/bid-assignments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "status", assignment_id: row.id, status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Status could not be updated.");
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  };
  const removeBid = async (row) => {
    const warning = row.status === "participated"
      ? `Remove participated bid ${row.bid_no} from only your dashboard?`
      : `This bid is not participated yet. Remove ${row.bid_no} from only your dashboard?`;
    if (!window.confirm(warning)) return;
    setBusyId(row.id);
    try {
      const response = await fetch(`${API_BASE}/gem/bid-assignments/`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "hide", assignment_id: row.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Bid could not be removed.");
      setRows((current) => current.filter((item) => item.id !== row.id)); setError("");
    } catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  };
  const removeSelected = async () => {
    const selected = rows.filter((row) => selectedIds.includes(row.id));
    const pending = selected.filter((row) => row.status !== "participated").length;
    if (!window.confirm(`${selected.length} bids remove from only your dashboard?${pending ? ` ${pending} bids are not participated yet.` : ""}`)) return;
    setBusyId("bulk");
    try {
      const response = await fetch(`${API_BASE}/gem/bid-assignments/`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "bulk_hide", assignment_ids: selectedIds }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Bids could not be removed.");
      setRows((current) => current.filter((row) => !selectedIds.includes(row.id))); setSelectedIds([]); setError("");
    } catch (err) { setError(err.message); } finally { setBusyId(null); }
  };
  return <div className="bg-white shadow-sm">
    <div className="border-b border-gray-200 p-5">
      <h2 className="text-lg font-bold text-slate-900">Bid To Be Participated</h2>
      <p className="mt-1 text-xs text-slate-500">Bids assigned to you by the analyser.</p>
      {selectedIds.length > 0 && <button type="button" onClick={removeSelected} disabled={busyId === "bulk"} className="mt-4 inline-flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40"><FaTrash /> Delete Selected ({selectedIds.length})</button>}
    </div>
    {error && <div className="m-5 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-sm">
      <thead className="bg-slate-800 text-xs uppercase text-white"><tr>
        <th className="px-4 py-4">S.No.</th><th className="px-4 py-4">Bid No.</th><th className="px-4 py-4">Start Date & Time</th><th className="px-4 py-4">End Date & Time</th><th className="px-4 py-4">Item</th><th className="px-4 py-4 text-center">Participated</th><th className="px-4 py-4 text-center">Action</th>
      </tr></thead><tbody>
        {rows.map((row, index) => <tr key={row.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
          <td className="px-4 py-4 font-bold">{index + 1}</td>
          <td className="px-4 py-4 font-bold text-blue-700">{row.pdf_url ? <a href={row.pdf_url} target="_blank" rel="noreferrer" className="underline">{row.bid_no}</a> : row.bid_no}</td>
          <td className="px-4 py-4">{formatDateTime(row.bid_date)}</td><td className="px-4 py-4 font-semibold text-emerald-700">{formatDateTime(row.end_date)}</td>
          <td className="max-w-md px-4 py-4 font-medium">{row.item}</td>
          <td className="px-4 py-4 text-center"><input type="checkbox" checked={row.status === "participated"}
            disabled={busyId === row.id || row.status === "expired"}
            onChange={(event) => updateStatus(row, event.target.checked ? "participated" : "assigned")}
            className="h-5 w-5 accent-emerald-600" aria-label={`Mark ${row.bid_no} participated`} /></td>
          <td className="px-4 py-4 text-center"><div className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} className="h-4 w-4 accent-red-600" aria-label={`Select ${row.bid_no}`} /><button type="button" onClick={() => removeBid(row)} disabled={busyId === row.id}
            className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-40" title="Remove bid" aria-label={`Remove bid ${row.bid_no}`}>
            <FaTrash aria-hidden="true" />
          </button></div></td>
        </tr>)}
        {!rows.length && <tr><td colSpan="7" className="py-16 text-center text-gray-500">No bids have been assigned to you yet.</td></tr>}
      </tbody>
    </table></div>
  </div>;
}
