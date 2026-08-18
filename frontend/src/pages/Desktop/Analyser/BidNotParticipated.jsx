import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_URL;
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: true,
}).format(new Date(value)) : "-";
const itemCategory = (row) => {
  const item = String(row.product_name || "").toLowerCase();
  const matches = {
    printer: /printer|multifunction|\bmfp\b/.test(item),
    aio: /all[ -]*in[ -]*one|\baio\b/.test(item),
    workstation: /workstation/.test(item),
    high_end_desktop: /high[ -]*(?:end|level)[^,;]*desktop/.test(item),
    entry_mid_desktop: /(?:entry|mid(?:dle)?)[^,;]*desktop/.test(item),
    toner: /toner|cartridge/.test(item),
  };
  const matchedTypes = Object.entries(matches).filter(([, matched]) => matched).map(([type]) => type);
  // Bunch Bid means the clean Item field itself contains multiple distinct
  // product categories. Do not trust the older stored product_type flag: it
  // was derived from the whole PDF and incorrectly marked single items.
  if (/bunch|\bboq\b/.test(item) || matchedTypes.length > 1) return "bunch_bid";
  if (matchedTypes.length === 1) return matchedTypes[0];
  if (/desktop computer/.test(item)) return "entry_mid_desktop";
  return "other";
};

export default function BidNotParticipated() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [itemFilter, setItemFilter] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [employeeBids, setEmployeeBids] = useState([]);
  const [selectedEmployeeBidIds, setSelectedEmployeeBidIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const itemLabels = {
    high_end_desktop: "High End Desktop Computer",
    entry_mid_desktop: "Entry and Mid Level Desktop Computer",
    printer: "Printer", aio: "AIO", workstation: "Workstation",
    toner: "Toner", bunch_bid: "Bunch Bid", other: "Other",
  };
  const itemOrder = ["high_end_desktop", "entry_mid_desktop", "printer", "aio", "workstation", "toner", "bunch_bid", "other"];
  const itemTypes = itemOrder;
  const filteredRows = itemFilter === "all"
    ? rows
    : rows.filter((row) => itemCategory(row) === itemFilter);
  const toggleBid = (id) => setSelectedIds((current) => {
    if (current.includes(id)) return current.filter((value) => value !== id);
    setError("");
    return [...current, id];
  });
  const assignBids = async () => {
    if (!assignedTo || !selectedIds.length) { setSuccess(""); setError("Select a user and at least one bid."); return; }
    setAssigning(true);
    try {
      const employeeName = employees.find((employee) => String(employee.id) === String(assignedTo))?.username || "user";
      const response = await fetch(`${API_BASE}/gem/bid-assignments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ action: "assign", assigned_to: Number(assignedTo), opportunity_ids: selectedIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Bids could not be assigned.");
      setRows((current) => current.filter((row) => !selectedIds.includes(row.id)));
      setEmployees((current) => current.map((employee) => String(employee.id) === String(assignedTo)
        ? { ...employee, active_count: Number(employee.active_count || 0) + Number(data.assigned || selectedIds.length) }
        : employee));
      setSelectedIds([]);
      setError("");
      setSuccess(`${data.assigned || selectedIds.length} bids assigned to ${employeeName} successfully.`);
      window.setTimeout(() => setSuccess(""), 8000);
    } catch (err) { setSuccess(""); setError(err.message); }
    finally { setAssigning(false); }
  };
  useEffect(() => {
    let active = true;
    setSelectedEmployeeBidIds([]);
    if (!assignedTo) { setEmployeeBids([]); return () => { active = false; }; }
    const loadEmployeeBids = async () => {
      try {
        const response = await fetch(`${API_BASE}/gem/bid-assignments/?employee=${assignedTo}`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` },
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && active) {
          setEmployeeBids((data.results || []).filter((row) => ["assigned", "in_progress", "participated"].includes(row.status)));
        }
      } catch { if (active) setEmployeeBids([]); }
    };
    loadEmployeeBids();
    const timer = window.setInterval(() => document.visibilityState === "visible" && loadEmployeeBids(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [assignedTo]);
  const hideAssignedBid = async (row) => {
    const warning = row.status === "participated"
      ? `Remove participated bid ${row.bid_no} from only analyser dashboard?`
      : `This bid is not participated yet. Remove ${row.bid_no} from only analyser dashboard?`;
    if (!window.confirm(warning)) return;
    try {
      const response = await fetch(`${API_BASE}/gem/bid-assignments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ action: "hide", assignment_id: row.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Bid could not be removed.");
      setEmployeeBids((current) => current.filter((item) => item.id !== row.id)); setError("");
    } catch (err) { setError(err.message); }
  };
  const hideSelectedAssignedBids = async () => {
    const selected = employeeBids.filter((row) => selectedEmployeeBidIds.includes(row.id));
    const pending = selected.filter((row) => row.status !== "participated").length;
    if (!window.confirm(`${selected.length} bids remove from only analyser dashboard?${pending ? ` ${pending} bids are not participated yet.` : ""}`)) return;
    try {
      const response = await fetch(`${API_BASE}/gem/bid-assignments/`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` }, body: JSON.stringify({ action: "bulk_hide", assignment_ids: selectedEmployeeBidIds }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Bids could not be removed.");
      setEmployeeBids((current) => current.filter((row) => !selectedEmployeeBidIds.includes(row.id))); setSelectedEmployeeBidIds([]); setError("");
    } catch (err) { setError(err.message); }
  };
  const deleteBid = async (row) => {
    if (!window.confirm(`Delete bid ${row.bid_no}?`)) return;
    setDeletingId(row.id);
    try {
      const response = await fetch(`${API_BASE}/gem/bid-opportunities/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({ action: "delete", id: row.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Bid could not be deleted.");
      setRows((current) => current.filter((item) => item.id !== row.id));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/gem/bid-opportunities/`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Eligible bids could not be loaded.");
        if (active) { setRows(data.results || []); setError(""); }
        const assignmentResponse = await fetch(`${API_BASE}/gem/bid-assignments/`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token") || ""}` },
        });
        const assignmentData = await assignmentResponse.json().catch(() => ({}));
        if (assignmentResponse.ok && active) setEmployees(assignmentData.employees || []);
      } catch (err) { if (active) setError(err.message); }
    };
    load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && load(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return (
    <div className="bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">Bid To Be Participated</h2>
        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="item-filter" className="text-sm font-semibold text-slate-700">Item:</label>
          <select id="item-filter" value={itemFilter} onChange={(event) => setItemFilter(event.target.value)}
            className="min-w-48 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
            <option value="all">All Items ({rows.length})</option>
            {itemTypes.map((type) => <option key={type} value={type}>
              {itemLabels[type] || type} ({rows.filter((row) => itemCategory(row) === type).length})
            </option>)}
          </select>
          <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}
            className="min-w-56 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">
            <option value="">Assign to user...</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>
              {employee.username} - {employee.email} ({employee.active_count} active)
            </option>)}
          </select>
          <button type="button" onClick={assignBids} disabled={assigning || !selectedIds.length || !assignedTo}
            className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-40">
            {assigning ? "Assigning..." : `Assign Selected (${selectedIds.length})`}
          </button>
        </div>
      </div>
      {error && <div className="m-5 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="m-5 border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{success}</div>}
      {assignedTo && <div className="border-b border-blue-100 bg-blue-50/40 px-5 py-4">
        {selectedEmployeeBidIds.length > 0 && <button type="button" onClick={hideSelectedAssignedBids} className="mb-3 inline-flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"><FaTrash /> Delete Selected ({selectedEmployeeBidIds.length})</button>}
        <div className="overflow-x-auto rounded border border-blue-100 bg-white">
          <table className="min-w-[850px] w-full text-left text-sm">
            <thead className="bg-blue-100 text-xs uppercase text-blue-900"><tr>
              <th className="px-3 py-3">S.No.</th><th className="px-3 py-3">Bid No.</th><th className="px-3 py-3">Start Date &amp; Time</th><th className="px-3 py-3">End Date &amp; Time</th><th className="px-3 py-3">Item</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-center">Action</th>
            </tr></thead>
            <tbody>{employeeBids.map((row, index) => <tr key={row.id} className="border-b border-gray-100">
              <td className="px-3 py-3 font-bold">{index + 1}</td>
              <td className="px-3 py-3 font-bold text-blue-700">{row.pdf_url ? <a href={row.pdf_url} target="_blank" rel="noreferrer" className="underline">{row.bid_no}</a> : row.bid_no}</td>
              <td className="px-3 py-3">{formatDateTime(row.bid_date)}</td><td className="px-3 py-3">{formatDateTime(row.end_date)}</td>
              <td className="max-w-md px-3 py-3">{row.item}</td><td className="px-3 py-3 font-semibold capitalize">{row.status.replace("_", " ")}</td>
              <td className="px-3 py-3 text-center"><div className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedEmployeeBidIds.includes(row.id)} onChange={() => setSelectedEmployeeBidIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} className="h-4 w-4 accent-red-600" aria-label={`Select ${row.bid_no}`} /><button type="button" onClick={() => hideAssignedBid(row)}
                className="rounded p-2 text-red-600 hover:bg-red-50 hover:text-red-700" title="Remove from analyser dashboard" aria-label={`Remove ${row.bid_no}`}><FaTrash aria-hidden="true" /></button></div></td>
            </tr>)}</tbody>
          </table>
          {!employeeBids.length && <div className="py-8 text-center text-sm text-gray-500">No active bids are assigned to this user.</div>}
        </div>
      </div>}
      {!assignedTo && <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-slate-800 text-xs uppercase text-white"><tr>
            <th className="px-5 py-4">Select</th><th className="px-5 py-4">S.No.</th><th className="px-5 py-4">Bid No.</th><th className="px-5 py-4">Start Date &amp; Time</th><th className="px-5 py-4">End Date &amp; Time</th><th className="px-5 py-4">Item</th><th className="px-5 py-4 text-center">Action</th>
          </tr></thead>
          <tbody>{filteredRows.map((row, index) => <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-5 py-4"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleBid(row.id)} className="h-4 w-4" /></td>
            <td className="px-5 py-4 text-sm font-semibold text-gray-600">{index + 1}</td>
            <td className="px-5 py-4 font-bold text-blue-700">
              {row.pdf_url ? <a href={row.pdf_url} target="_blank" rel="noreferrer"
                className="underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                title="Open/download GeM bid PDF">{row.bid_no}</a> : row.bid_no}
            </td>
            <td className="px-5 py-4 text-sm text-gray-700">{formatDateTime(row.bid_date)}</td>
            <td className="px-5 py-4 text-sm font-semibold text-emerald-700">{formatDateTime(row.end_date)}</td>
            <td className="px-5 py-4 text-sm font-medium text-gray-800">{row.product_name}</td>
            <td className="px-5 py-4 text-center">
              <button type="button" onClick={() => deleteBid(row)} disabled={deletingId === row.id}
                className="rounded p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Delete bid" aria-label={`Delete bid ${row.bid_no}`}>
                <FaTrash aria-hidden="true" />
              </button>
            </td>
          </tr>)}</tbody>
        </table>
        {!filteredRows.length && !error && <div className="py-16 text-center text-sm text-gray-500">No eligible bids found for this item.</div>}
      </div>}
    </div>
  );
}
