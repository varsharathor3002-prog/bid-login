import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const TABS = [
  { id: "pending", label: "Pending", icon: "⏳", color: "text-amber-600", border: "border-amber-600" },
  { id: "re-analyze", label: "Re-Analyze", icon: "⚠️", color: "text-rose-600", border: "border-rose-600" },
  { id: "approved", label: "Approved", icon: "✅", color: "text-emerald-600", border: "border-emerald-600" },
];

const GENERAL_DOCS = [
  ["manufacturer_auth", "MANUFACTURER AUTHORIZATION CERTIFICATE"], ["warranty", "WARRANTY"],
  ["bidder_financial", "BIDDER FINANCIAL UNDERSTANDINGS"], ["non_obsolete", "NON OBSOLETE"],
  ["data_sheet", "DATA SHEET"], ["non_malicious", "NON MALICIOUS CODE"],
  ["non_return_hdd", "NON RETURN OF HARD DISK"], ["technical_compliance", "TECHNICAL COMPLIANCE"],
  ["non_blacklisting", "NON BLACKLISTING"], ["service_support", "SERVICE SUPPORT CONSIGNEE LOCATION"],
  ["ipv6", "IPV6"], ["preloaded_os", "PRELOADED OPERATING SYSTEM"],
];

const BID_FIELDS = [
  ["bid_no", "Bid Number"], ["model_number", "Model Number"], ["dept_name", "Department"],
  ["organization", "Organization"], ["qty", "Quantity", "number"], ["pincode", "Pincode"],
  ["date", "Bid End Date", "date"], ["address", "Address"], ["local_content", "Local Content (%)"],
];

const PRINTER_FIELDS = [
    ["printing_technology", "Printing Technology"],
    ["cartridge_technology", "Cartridge Technology"], ["type_of_printing", "Type of Printing"],
    ["printer_type", "Printer Type"], ["fax_availability", "Availability of Fax"],
    ["operating_system_compatibility", "Operating System Compatibility"],
    ["auto_duplexing", "Auto Duplexing Printing/Copying (2-sided Feature)"],
    ["reduction_enlarge_features", "Reduction and Enlarge Features"],
    ["mono_print_speed_ppm", "Minimum Print Speed A4 Monochrome (Black) (PPM) - Laser/LED MFPs"],
    ["colour_print_speed_ppm", "Minimum Print Speed A4 Colour (PPM) - Laser/LED MFPs"],
    ["max_scan_area", "Maximum Scan Area (Platen/ADF)"], ["a4_scan_speed_colour", "A4 Scan Speed Colour (Image Per Minute) @ 200 x 200 DPI"],
    ["scan_to_functions", "Scan To Functions"],
    ["document_feeder_type", "Original Document Feeder Type (For Scanning and Copying)"], ["feeder_capacity", "Feeder Capacity (Number of Sheets)"],
    ["main_paper_tray_count", "Number of Main Paper Tray"], ["total_paper_tray_capacity", "Total Main Paper Tray Combined Capacity (75 GSM)"],
    ["bypass_tray_facility", "Bypass Tray Facility"], ["bypass_tray_capacity", "Bypass Tray Capacity (75 GSM)"],
    ["connectivity", "Connectivity"], ["duty_cycle", "Duty Cycle (Prints/Month)"],
    ["onsite_warranty", "On Site Warranty (In Year)"], ["extended_warranty", "Extended Warranty (in Years) over and above standard warranty"],
    ["epbg", "EPBG (%)", "number"], ["freightInstallation", "Freight and Installation"],
    ["final_amount", "Final Price *", "number"], ["extra_requirements", "Extra Requirements", "textarea"],
];

const MULTIFUNCTION_ONLY_FIELDS = new Set([
  "fax_availability",
  "reduction_enlarge_features",
  "max_scan_area",
  "a4_scan_speed_colour",
  "scan_to_functions",
  "document_feeder_type",
  "feeder_capacity",
]);

const getPrinterTypeLabel = (value) =>
  String(value || "").toLowerCase().includes("multifunction")
    ? "Multifunction Printer"
    : "Printer";

const Field = ({ item, form, onChange }) => {
  const [name, label, type = "text"] = item;
  const isFinalPrice = name === "final_amount";
  const classes = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  return (
    <div className={`${type === "textarea" ? "md:col-span-2 lg:col-span-3" : ""} ${isFinalPrice ? "rounded-md border-2 border-emerald-300 bg-emerald-50 p-4 shadow-sm" : ""}`}>
      <label className={`mb-1 block text-sm ${isFinalPrice ? "font-bold text-emerald-800" : "font-medium text-gray-700"}`}>{label}</label>
      {type === "textarea" ? (
        <textarea name={name} value={form[name] ?? ""} onChange={onChange} rows={2} className={`${classes} resize-none`} />
      ) : isFinalPrice ? (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-bold text-emerald-700">Rs.</span>
          <input
            name={name}
            type={type}
            min="0"
            step="0.01"
            value={form[name] ?? ""}
            onChange={onChange}
            className="w-full rounded-md border-2 border-emerald-500 bg-white py-2.5 pl-11 pr-3 text-base font-bold text-emerald-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
          />
        </div>
      ) : (
        <input name={name} type={type} value={form[name] ?? ""} onChange={onChange} className={classes} />
      )}
    </div>
  );
};

const MakeInIndiaView = ({ form }) => {
  const [working, setWorking] = useState("");
  const bidId = form?.id || form?.bid_id;

  const generatePdf = async () => {
    if (!bidId) throw new Error("Bid ID not found.");
    const response = await fetch(`${API_BASE}/printer-bids/${bidId}/generate-docs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doc_type: "make_in_india",
        model_number: form?.model_number || form?.model || "",
        local_content: form?.local_content || "",
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.pdf_url) throw new Error(data.error || "Unable to generate document.");
    return data.pdf_url;
  };

  const handleDocument = async (download = false) => {
    setWorking(download ? "download" : "view");
    try {
      const pdfUrl = await generatePdf();
      if (!download) window.open(pdfUrl, "_blank", "noopener,noreferrer");
      else {
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error("Unable to download document.");
        const blobUrl = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `make_in_india_${bidId}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error) { alert(error.message); } finally { setWorking(""); }
  };

  return <div className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 transition hover:border-gray-300 hover:bg-gray-100">
    <div className="flex items-center gap-3">
      <div className="rounded-full bg-green-100 p-2 text-green-600">📄</div>
      <div><p className="text-sm font-bold text-gray-800">Make in India</p><p className="text-xs text-gray-500">{form?.model_number ? `Model: ${form.model_number}` : "No model"}{form?.local_content ? ` • Local: ${form.local_content}%` : ""}</p></div>
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={() => handleDocument(false)} disabled={!!working} className="rounded border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 disabled:opacity-50">{working === "view" ? "Generating..." : "View File"}</button>
      <button type="button" onClick={() => handleDocument(true)} disabled={!!working} className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{working === "download" ? "Downloading..." : "Download"}</button>
    </div>
  </div>;
};

const PrinterDocumentsView = ({ form, documentUrl }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [working, setWorking] = useState("");
  const [uploading, setUploading] = useState(false);
  const bidId = form?.id || form?.bid_id;
  const selected = Array.isArray(form?.selected_general_docs) ? form.selected_general_docs : [];
  const labels = Array.isArray(form?.selected_general_doc_labels) ? form.selected_general_doc_labels : [];
  const docs = GENERAL_DOCS.filter(([id]) => selected.includes(id)).map(([id, label]) => ({ id, label }));
  const displayDocs = docs.length ? docs : labels.map((label, index) => ({ id: selected[index] || `label-${index}`, label }));

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [open]);

  const generate = async (doc, download = false) => {
    if (!bidId || doc.id.startsWith("label-")) return;
    setWorking(`${doc.id}-${download ? "download" : "view"}`);
    try {
      const response = await fetch(`${API_BASE}/printer-bids/${bidId}/generate-docs/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc_type: doc.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.pdf_url) throw new Error(data.error || "Unable to generate document.");
      if (!download) window.open(data.pdf_url, "_blank", "noopener,noreferrer");
      else {
        const fileResponse = await fetch(data.pdf_url); const blob = await fileResponse.blob(); const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.download = `${doc.id}.pdf`; link.click(); URL.revokeObjectURL(url);
      }
    } catch (error) { alert(error.message); } finally { setWorking(""); }
  };

  const uploadDocument = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !bidId) return;
    setUploading(true);
    try {
      const payload = new FormData();
      payload.append("atc_special_document", file);
      payload.append("selected_general_docs", JSON.stringify(selected));
      payload.append("selected_general_doc_labels", JSON.stringify(labels));
      if (form?.model_number) payload.append("model_number", form.model_number);
      const response = await fetch(`${API_BASE}/printer-bids/${bidId}/update-docs/`, { method: "POST", body: payload });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Document upload failed.");
      alert("Document uploaded successfully.");
    } catch (error) { alert(error.message); } finally { setUploading(false); event.target.value = ""; }
  };

  return <div className="md:col-span-2 lg:col-span-3">
    <label className="mb-2 block text-sm font-medium text-gray-700">Compliance Documents</label>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className={`rounded-lg border p-4 ${documentUrl ? "border-purple-200 bg-purple-50" : "border-dashed border-gray-300 bg-gray-50"}`}>
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-gray-800">Special Document</p><p className="text-xs text-gray-500">{documentUrl ? "ATC Specific Requirement" : "No Special Document"}</p></div><div className="flex gap-2">{documentUrl && <a href={documentUrl} target="_blank" rel="noreferrer" className="rounded border border-purple-200 bg-white px-3 py-1.5 text-xs font-medium text-purple-700">View File</a>}<label className="cursor-pointer rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700">{uploading ? "Uploading..." : "Upload"}<input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={uploadDocument} disabled={uploading} className="hidden" /></label></div></div>
      </div>
      <div ref={dropdownRef} className="relative">
        <button type="button" onClick={() => setOpen((value) => !value)} className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition ${open ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white hover:border-orange-400"}`}>
          <div><p className="text-sm font-bold text-gray-800">📁 General Documents</p><p className="text-xs text-gray-500">Click to view selected documents</p></div><span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">{displayDocs.length}/{GENERAL_DOCS.length} Files</span>
        </button>
        {open && <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border bg-white shadow-2xl">
          {displayDocs.length ? displayDocs.map((doc) => <div key={doc.id} className="flex items-center gap-2 border-b px-4 py-3 last:border-0"><span className="flex-1 text-xs font-medium text-gray-700">{doc.label}</span><button type="button" onClick={() => generate(doc)} disabled={!!working} className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{working === `${doc.id}-view` ? "Generating..." : "View"}</button><button type="button" onClick={() => generate(doc, true)} disabled={!!working} className="rounded bg-green-600 px-2.5 py-1 text-xs text-white">{working === `${doc.id}-download` ? "..." : "Download"}</button></div>) : <p className="p-6 text-center text-sm text-gray-400">No documents selected.</p>}
        </div>}
      </div>
      <MakeInIndiaView form={form} />
    </div>
  </div>;
};

export default function PrinterBidApproval() {
  const [activeTab, setActiveTab] = useState(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    return ["pending", "approved", "re-analyze"].includes(status) ? status : "pending";
  });
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [reAnalyzeCount, setReAnalyzeCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 10;
  const MAX_PAGE_BTNS = 5;

  const fetchBids = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/printer-bids/list/?status=${activeTab}&role=admin`);
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.error || "Printer bids could not be loaded.");
      setBids(Array.isArray(data) ? data : []);
    } catch (err) {
      setBids([]);
      setError(err.message || "Printer bids could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const fetchReAnalyzeCount = async () => {
    try {
      const response = await fetch(`${API_BASE}/printer-bids/list/?status=re-analyze&role=admin`);
      const data = await response.json().catch(() => []);
      setReAnalyzeCount(response.ok && Array.isArray(data) ? data.length : 0);
    } catch { setReAnalyzeCount(0); }
  };

  useEffect(() => {
    fetchBids();
    fetchReAnalyzeCount();
    setCurrentPage(1);
  }, [activeTab]);

  const sortedBids = useMemo(() => [...bids].sort((a, b) =>
    new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
  ), [bids]);

  const closeModal = () => {
    setSelected(null); setForm({}); setAdminNote(""); setMessage("");
  };

  const openModal = (bid) => {
    setSelected(bid); setForm({ ...bid }); setAdminNote(bid.admin_note || ""); setMessage("");
  };

  const handleAction = async (status) => {
    if (status === "approved" && (!String(form.final_amount ?? "").trim() || Number(form.final_amount) <= 0)) {
      const validationMessage = "Please enter a valid Final Price before approving the bid.";
      setMessage(validationMessage);
      window.alert(validationMessage);
      return;
    }
    setSubmitting(true); setMessage("");
    try {
      const response = await fetch(`${API_BASE}/printer-bids/${selected.id}/admin-review/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form, status, admin_note: adminNote,
          admin_username: localStorage.getItem("admin_username") || localStorage.getItem("username") || "",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Admin review failed.");
      setMessage(status === "approved" ? "Bid approved successfully." : "Bid sent for re-analysis.");
      await fetchBids();
      window.setTimeout(closeModal, 700);
    } catch (err) {
      setMessage(err.message || "Something went wrong.");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (bid) => {
    if (!window.confirm("Are you sure you want to delete this printer bid?")) return;
    setDeletingId(bid.id);
    try {
      const response = await fetch(`${API_BASE}/printer-bids/${bid.id}/delete/`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Delete failed");
      setBids((current) => current.filter((item) => item.id !== bid.id));
    } catch (err) {
      window.alert(err.message || "Unable to delete printer bid.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }) : "-";

  const documentUrl = form.atc_special_document && (form.atc_special_document.startsWith("http")
    ? form.atc_special_document : `${API_BASE}${form.atc_special_document}`);

  const StatusBadge = ({ status }) => {
    if (status === "approved") return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">✅ Approved</span>;
    if (status === "pending") return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">⏳ Pending</span>;
    return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">⚠️ Re-Analyze</span>;
  };

  const totalPages = Math.ceil(sortedBids.length / ROWS_PER_PAGE);
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const pageBids = sortedBids.slice(startIdx, startIdx + ROWS_PER_PAGE);
  const half = Math.floor(MAX_PAGE_BTNS / 2);
  let pageStart = Math.max(1, currentPage - half);
  let pageEnd = Math.min(totalPages, pageStart + MAX_PAGE_BTNS - 1);
  if (pageEnd - pageStart < MAX_PAGE_BTNS - 1) pageStart = Math.max(1, pageEnd - MAX_PAGE_BTNS + 1);
  const pageNums = [];
  for (let page = pageStart; page <= pageEnd; page += 1) pageNums.push(page);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <button type="button" onClick={() => window.history.back()}
        className="m-4 flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:border-slate-800 hover:bg-slate-800 hover:text-white">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>

      <div className="flex gap-3 overflow-visible border-b border-gray-200 bg-gray-50 px-6 pt-3">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`flex min-h-[52px] items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-sm font-semibold transition-all ${activeTab === tab.id ? `${tab.color} ${tab.border} bg-white shadow-sm` : "border-transparent text-gray-500 hover:bg-white hover:text-gray-700"}`}>
            <span>{tab.icon}</span><span>{tab.label}</span>
            {tab.id === "re-analyze" && reAnalyzeCount > 0 && <span className="ml-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white shadow-sm">{reAnalyzeCount > 99 ? "99+" : reAnalyzeCount}</span>}
          </button>
        ))}
      </div>

      {error && <div className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="bg-slate-800">{["S.No.", "Analyser", "Department", "Printer Type", "Bid No", "Model", "Submitted On", "Status", "Action"].map((h) => <th key={h} className="px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wide text-white">{h}</th>)}</tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="9" className="py-14 text-center text-gray-400">Loading printer bids...</td></tr>}
            {!loading && !sortedBids.length && <tr><td colSpan="9" className="py-14 text-center text-gray-400">No printer bids found.</td></tr>}
            {!loading && pageBids.map((bid, index) => (
              <tr key={bid.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                <td className="px-4 py-4 text-center text-sm text-gray-700">{startIdx + index + 1}</td>
                <td className="truncate px-4 py-4 text-center text-sm text-gray-700">{bid.analyser_display_name || bid.analyser_username || "-"}</td>
                <td className="truncate px-4 py-4 text-center text-sm text-gray-700">{bid.dept_name || "-"}</td>
                <td className="px-4 py-4 text-center text-sm font-medium text-gray-700">{getPrinterTypeLabel(bid.printer_type)}</td>
                <td className="truncate px-4 py-4 text-center text-sm font-semibold text-blue-600">{bid.bid_no || "-"}</td>
                <td className="truncate px-4 py-4 text-center text-sm text-gray-700">{bid.model_number || "-"}</td>
                <td className="whitespace-nowrap px-4 py-4 text-center text-sm text-gray-700">{formatDate(bid.updated_at || bid.created_at)}</td>
                <td className="px-4 py-4 text-center"><div className="flex justify-center"><StatusBadge status={activeTab} /></div></td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button type="button" onClick={() => openModal(bid)} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700">View</button>
                    {activeTab === "approved" && (
                      <button
                        type="button"
                        onClick={() => handleDelete(bid)}
                        disabled={deletingId === bid.id}
                        title="Delete bid"
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === bid.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && <div className="flex items-center justify-center gap-4 border-t border-gray-100 bg-gray-50 px-6 py-4">
        <p className="text-xs text-gray-500">Showing <span className="font-semibold text-gray-700">{startIdx + 1}–{Math.min(startIdx + ROWS_PER_PAGE, sortedBids.length)}</span> of <span className="font-semibold text-gray-700">{sortedBids.length}</span></p>
        <div className="flex items-center gap-1">
          <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-all hover:border-slate-800 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Prev</button>
          {pageNums.map((page) => <button key={page} type="button" onClick={() => setCurrentPage(page)} className={`h-8 w-8 rounded-md border text-xs font-semibold transition-all ${page === currentPage ? "border-slate-800 bg-slate-800 text-white" : "border-gray-300 bg-white text-gray-600 hover:border-slate-800 hover:bg-slate-800 hover:text-white"}`}>{page}</button>)}
          <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-all hover:border-slate-800 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Next</button>
        </div>
      </div>}

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 px-4 py-8">
          <div className="mx-auto w-full max-w-7xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between rounded-t-xl border-b bg-gray-50 px-6 py-4">
              <div className="flex items-center gap-4">
                <button type="button" onClick={closeModal} className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition-all hover:border-slate-800 hover:bg-slate-800 hover:text-white">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>Back
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Review & Update Printer</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-gray-500">Bid No: <span className="ml-1 font-semibold text-blue-600">{selected.bid_no}</span></p>
                    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                      {getPrinterTypeLabel(form.printer_type)}
                    </span>
                  </div>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="text-2xl text-gray-500 hover:text-gray-900" aria-label="Close">×</button>
            </div>
            {message && <div className="mx-6 mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}
            <div className="p-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                {BID_FIELDS.map((item) => <Field key={item[0]} item={item} form={form} onChange={(e) => setForm((old) => ({ ...old, [e.target.name]: e.target.value }))} />)}

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">ATC</label>
                  <textarea name="atc" value={form.atc ?? ""} onChange={(e) => setForm((old) => ({ ...old, atc: e.target.value }))} rows={4} className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>

                <PrinterDocumentsView form={form} documentUrl={documentUrl} />

                {PRINTER_FIELDS
                  .filter(([name]) => getPrinterTypeLabel(form.printer_type) === "Multifunction Printer" || !MULTIFUNCTION_ONLY_FIELDS.has(name))
                  .map((item) => <Field key={item[0]} item={item} form={form} onChange={(e) => setForm((old) => ({ ...old, [e.target.name]: e.target.value }))} />)}

                {selected.status !== "approved" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 md:col-span-2 lg:col-span-3"><label className="mb-2 block text-sm font-bold text-amber-800">Admin Review Note</label><textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} className="w-full resize-none rounded-md border border-amber-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100" /></div>}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 border-t px-6 py-5">
              {selected.status !== "approved" && <><button type="button" disabled={submitting} onClick={() => handleAction("approved")} className="rounded bg-emerald-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{submitting ? "Saving..." : "Approve Bid"}</button><button type="button" disabled={submitting} onClick={() => handleAction("re-analyze")} className="rounded bg-rose-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Send to Re-Analyze</button></>}
              <button type="button" onClick={closeModal} className="rounded bg-gray-200 px-8 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
