import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL;
const labels = { assigned: "Assigned", in_progress: "In Progress", participated: "Participated", skipped: "Skipped", expired: "Expired" };
const dt = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

export default function AdminBidAssignments() {
  const [rows, setRows] = useState([]); const [employees, setEmployees] = useState([]);
  const [employee, setEmployee] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const removeAssignment = async (row) => {
    const warning = row.status === "participated"
      ? `Remove participated bid ${row.bid_no} from only admin dashboard?`
      : `This bid is not participated yet. Remove ${row.bid_no} from only admin dashboard?`;
    if (!window.confirm(warning)) return;
    setDeletingId(row.id);
    try {
      const response = await fetch(`${API_BASE}/gem/bid-assignments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ action: "hide", assignment_id: row.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Bid could not be removed.");
      setRows((current) => current.filter((item) => item.id !== row.id)); setError("");
    } catch (err) { setError(err.message); }
    finally { setDeletingId(null); }
  };
  const removeSelected = async () => {
    const selected = rows.filter((row) => selectedIds.includes(row.id));
    const pending = selected.filter((row) => row.status !== "participated").length;
    if (!window.confirm(`${selected.length} bids remove from only admin dashboard?${pending ? ` ${pending} bids are not participated yet.` : ""}`)) return;
    setDeletingId("bulk");
    try {
      const response = await fetch(`${API_BASE}/gem/bid-assignments/`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` }, body: JSON.stringify({ action: "bulk_hide", assignment_ids: selectedIds }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Bids could not be removed.");
      setRows((current) => current.filter((row) => !selectedIds.includes(row.id))); setSelectedIds([]); setError("");
    } catch (err) { setError(err.message); } finally { setDeletingId(null); }
  };
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const query = new URLSearchParams(); if (employee) query.set("employee", employee);
        const response = await fetch(`${API_BASE}/gem/bid-assignments/?${query}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` } });
        const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Assignments could not be loaded.");
        if (active) { setRows(data.results || []); setEmployees(data.employees || []); setError(""); }
      } catch (err) { if (active) setError(err.message); }
    };
    load(); const timer = setInterval(() => document.visibilityState === "visible" && load(), 30000); return () => { active = false; clearInterval(timer); };
  }, [employee]);
  return <div className="bg-white">
    <div className="border-b border-gray-200 p-5"><h2 className="text-lg font-bold text-slate-900">Bid Assignment Tracking</h2><p className="mt-1 text-xs text-slate-500">See which bid is assigned to which user and its current progress.</p>
      <div className="mt-4 flex gap-3"><select value={employee} onChange={(e) => setEmployee(e.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm"><option value="">All Users</option>{employees.map((u) => <option key={u.id} value={u.id}>{u.username} - {u.email} ({u.active_count} active)</option>)}</select>
      {selectedIds.length > 0 && <button type="button" onClick={removeSelected} disabled={deletingId === "bulk"} className="inline-flex min-h-9 items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"><FaTrash aria-hidden="true" /> Delete Selected ({selectedIds.length})</button>}
      </div>
    </div>
    {error && <div className="m-5 bg-red-50 p-3 text-red-700">{error}</div>}
    <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="bg-slate-800 text-xs uppercase text-white"><tr><th className="p-4">S.No.</th><th className="p-4">Bid No.</th><th className="p-4">Item</th><th className="p-4">Assigned To</th><th className="p-4">Assigned By</th><th className="p-4">Assigned At</th><th className="p-4">Status</th><th className="p-4 text-center">Action</th></tr></thead>
    <tbody>{rows.map((row,i) => <tr key={row.id} className="border-b border-gray-100"><td className="p-4 font-bold">{i+1}</td><td className="p-4 font-bold text-blue-700">{row.bid_no}</td><td className="max-w-md p-4">{row.item}</td><td className="p-4"><b>{row.assigned_to.username}</b><br/><span className="text-xs text-gray-500">{row.assigned_to.email}</span></td><td className="p-4">{row.assigned_by}</td><td className="p-4">{dt(row.assigned_at)}</td><td className="p-4 font-bold">{labels[row.status] || row.status}</td><td className="p-4 text-center"><div className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} className="h-4 w-4 accent-red-600" aria-label={`Select ${row.bid_no}`} /><button type="button" onClick={() => removeAssignment(row)} disabled={deletingId === row.id} className="rounded p-2 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40" title="Remove from admin dashboard" aria-label={`Remove ${row.bid_no}`}><FaTrash aria-hidden="true" /></button></div></td></tr>)}{!rows.length && <tr><td colSpan="8" className="py-16 text-center text-gray-500">No assignments found.</td></tr>}</tbody></table></div>
  </div>;
}
