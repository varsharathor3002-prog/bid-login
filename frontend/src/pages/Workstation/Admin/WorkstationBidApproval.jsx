import { useEffect, useRef, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";
const TABS = [
  { id: "pending", label: "Pending", color: "text-amber-600", border: "border-amber-600" },
  { id: "re-analyze", label: "Re-Analyze", color: "text-rose-600", border: "border-rose-600" },
  { id: "approved", label: "Approved", color: "text-emerald-600", border: "border-emerald-600" },
];

const ROWS_PER_PAGE = 8;
const PAGE_WINDOW = 5;

const FIELDS = [
  ["bid_no", "Bid Number"], ["model_number", "Model Number"], ["dept_name", "Department"],
  ["organization", "Organization"], ["qty", "Quantity"], ["pincode", "Pincode"], ["date", "Bid End Date", "date"],
  ["processor", "Processor"], ["processor_price", "Processor Price"], ["ram", "RAM"], ["ram_price", "RAM Price"],
  ["hdd", "HDD"], ["hdd_price", "HDD Price"], ["ssd1", "SSD 1"], ["ssd1_price", "SSD 1 Price"],
  ["ssd2", "SSD 2"], ["ssd2_price", "SSD 2 Price"], ["graphics", "Graphics Card"], ["graphics_price", "Graphics Price"],
  ["motherboard", "Motherboard"], ["motherboard_price", "Motherboard Price"], ["os", "OS"], ["os_price", "OS Price"],
  ["monitor", "Monitor"], ["monitor_price", "Monitor Price"], ["cabinet", "Cabinet"], ["cabinet_price", "Cabinet Price"],
  ["keyboard", "Keyboard & Mouse"], ["keyboard_price", "Keyboard Price"], ["power_supply", "Power Supply"],
  ["power_supply_price", "Power Supply Price"], ["warranty", "Warranty"], ["warranty_price", "Warranty Price"], ["epbg", "EPBG (%)"],
];

const TEXT_FIELDS = [
  ["address", "Address"], ["atc", "ATC"], ["pro_descp", "Processor Description"],
  ["motherboard_descp", "Motherboard Description"], ["gp", "Graphics Description"],
  ["software1", "Additional Software"], ["extra_requirements", "Extra Requirements"],
  ["optional_ports", "Optional Ports"],
];

const PriceField = ({ label, name, priceName, form, handleChange, isTextArea = false, optional = false }) => (
  <div className="col-span-1">
    <div className="flex items-center gap-2 mb-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {optional && <span className="text-red-500 text-[11px]">*Optional</span>}
    </div>
    <div className="flex gap-2">
      {isTextArea ? (
        <textarea
          name={name}
          value={form?.[name] || ""}
          onChange={handleChange}
          rows={2}
          autoComplete="off"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <input
          type="text"
          name={name}
          value={form?.[name] || ""}
          onChange={handleChange}
          autoComplete="off"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      {priceName && (
        <input
          type="text"
          name={priceName}
          value={form?.[priceName] || ""}
          onChange={handleChange}
          autoComplete="off"
          placeholder="Price"
          className="w-28 border border-blue-300 rounded-md px-2 py-2 text-sm text-center bg-white outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  </div>
);

const fullMediaUrl = (url) => !url ? "" : url.startsWith("http") ? url : `http://127.0.0.1:8000${url}`;

const USER_DOCS = [
  { id: "manufacturer_auth", label: "MANUFACTURER AUTHORIZATION CERTIFICATE" },
  { id: "bidder_financial", label: "BIDDER FINANCIAL UNDERSTANDINGS" },
  { id: "non_obsolete", label: "NON OBSOLETE" },
  { id: "non_malicious", label: "NON MALICIOUS CODE" },
  { id: "non_return_hdd", label: "NON RETURN OF HARD DISK" },
  { id: "non_blacklisting", label: "NON BLACKLISTING" },
  { id: "service_support", label: "SERVICE SUPPORT" },
  { id: "ipv6", label: "IPV6" },
  { id: "preloaded_os", label: "PRELOADED OPERATING SYSTEM" },
];

function GeneralDocsView({ form }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [generating, setGenerating] = useState({});
  const [downloading, setDownloading] = useState({});
  const bidId = form?.id || form?.bid_id;
  const selectedIds = Array.isArray(form?.selected_general_docs) ? form.selected_general_docs : [];
  const selectedLabels = Array.isArray(form?.selected_general_doc_labels) ? form.selected_general_doc_labels : [];
  const docs = selectedIds.length
    ? selectedIds.map((docId, index) => USER_DOCS.find((doc) => doc.id === docId) || { id: docId, label: selectedLabels[index] || docId })
    : selectedLabels.map((label, index) => ({ id: `label_${index}`, label, viewable: false }));

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

  const getGeneratedPdfUrl = async (doc) => {
    if (!bidId || doc.viewable === false) return "";
    const response = await fetch(`${API_BASE}/workstation-bids/${bidId}/generate-docs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, doc_type: doc.id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.pdf_url) throw new Error(data.error || "Unable to generate document.");
    return data.pdf_url;
  };

  const handleView = async (doc) => {
    setGenerating((prev) => ({ ...prev, [doc.id]: true }));
    try {
      const pdfUrl = await getGeneratedPdfUrl(doc);
      if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error.message || "Unable to open document.");
    } finally {
      setGenerating((prev) => ({ ...prev, [doc.id]: false }));
    }
  };

  const handleDownload = async (doc) => {
    setDownloading((prev) => ({ ...prev, [doc.id]: true }));
    try {
      const pdfUrl = await getGeneratedPdfUrl(doc);
      if (!pdfUrl) return;
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Download failed.");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeLabel = String(doc.label || doc.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      link.href = blobUrl;
      link.download = `${safeLabel || doc.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert(error.message || "Download failed.");
    } finally {
      setDownloading((prev) => ({ ...prev, [doc.id]: false }));
    }
  };

  return (
    <div ref={dropdownRef} className="relative w-full md:col-span-2">
      <button type="button" onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-200 ${
          open ? "bg-orange-50 border-orange-500 ring-1 ring-orange-500" : "bg-white border-gray-200 hover:border-orange-400 hover:shadow-md"
        }`}>
        <div className="text-left">
          <div className="text-sm font-bold text-gray-800">General Documents</div>
          <div className="text-xs text-gray-500">{docs.length > 0 ? "Click to view selected documents" : "No documents selected"}</div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          docs.length > 0 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-500"
        }`}>
          {docs.length}/{USER_DOCS.length} Files
        </span>
      </button>

      {open && (
        <>
          <div className="absolute top-full left-0 right-0 mt-2 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
              <span className="text-sm font-semibold text-orange-800">Selected General Documents</span>
              <span className="text-xs font-semibold px-2 py-[2px] rounded-full bg-green-100 text-green-700">{docs.length} Total</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
              {docs.length ? docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-green-50">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white text-xs">✓</div>
                  <span className="flex-1 text-sm text-gray-800 font-medium">{doc.label}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleView(doc)} disabled={doc.viewable === false || generating[doc.id] || downloading[doc.id]}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition">
                      {generating[doc.id] ? "Generating..." : "View File"}
                    </button>
                    <button type="button" onClick={() => handleDownload(doc)} disabled={doc.viewable === false || generating[doc.id] || downloading[doc.id]}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition">
                      {downloading[doc.id] ? "Downloading..." : "Download"}
                    </button>
                  </div>
                </div>
              )) : <div className="p-8 text-center text-gray-500 text-sm">No documents selected.</div>}
            </div>
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-700 font-medium px-3 py-1 rounded hover:bg-gray-200 transition">
                Close Panel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MakeInIndiaView({ form }) {
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const bidId = form?.id || form?.bid_id;

  const getGeneratedPdfUrl = async () => {
    if (!bidId) throw new Error("Bid ID not found.");
    const response = await fetch(`${API_BASE}/workstation-bids/${bidId}/generate-docs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        doc_type: "make_in_india",
        local_content: form?.local_content || "",
        model_number: form?.model_number || "",
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.pdf_url) throw new Error(data.error || "Unable to generate Make in India.");
    return data.pdf_url;
  };

  const handleView = async () => {
    setGenerating(true);
    try {
      const pdfUrl = await getGeneratedPdfUrl();
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error.message || "Unable to open Make in India.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const pdfUrl = await getGeneratedPdfUrl();
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Download failed.");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `make_in_india_${bidId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert(error.message || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-green-50 border-green-200 flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-green-900">Make in India</div>
        <div className="text-xs text-green-700">
          {form?.model_number ? `Model: ${form.model_number}` : "Generate certificate"}
          {form?.local_content && ` - Local: ${form.local_content}%`}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleView} disabled={generating || downloading}
          className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50 disabled:opacity-50">
          {generating ? "Generating..." : "View File"}
        </button>
        <button type="button" onClick={handleDownload} disabled={generating || downloading}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50">
          {downloading ? "Downloading..." : "Download"}
        </button>
      </div>
    </div>
  );
}

function SpecialDocView({ form }) {
  const url = form?.atc_special_document;
  if (!url) return <div className="text-sm text-gray-400">No file uploaded.</div>;
  const fullUrl = fullMediaUrl(url);
  const filename = url.split("/").pop() || "special_document";

  const handleDownload = async () => {
    try {
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error("Download failed.");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert("Download failed.");
    }
  };

  return (
    <div className="w-full p-4 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 flex items-center justify-between group">
      <div>
        <div className="text-sm font-bold text-purple-900">Special Document</div>
        <div className="text-xs text-purple-700">ATC Specific Requirement</div>
      </div>
      <div className="flex items-center gap-2">
        <a href={fullUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-white border border-purple-200 rounded hover:bg-purple-50 transition">
          View File
        </a>
        <button type="button" onClick={handleDownload} className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 shadow-sm transition">
          Download
        </button>
      </div>
    </div>
  );
}

export default function WorkstationBidApproval() {
  const [activeTab, setActiveTab] = useState("pending");
  const [bids, setBids] = useState([]);
  const [reAnalyzeCount, setReAnalyzeCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchBids = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/workstation-bids/list/?status=${activeTab}&role=admin`);
      setBids(res.ok ? await res.json() : []);
    } catch {
      setBids([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchReAnalyzeCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/workstation-bids/list/?status=re-analyze&role=admin`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setReAnalyzeCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setReAnalyzeCount(0);
    }
  };

  useEffect(() => {
    fetchBids();
    fetchReAnalyzeCount();
    setCurrentPage(1);
  }, [activeTab]);

  const openModal = (bid) => {
    setSelected(bid);
    setForm({ ...bid });
    setAdminNote(bid.admin_note || "");
    setMsg("");
  };

  const closeModal = () => {
    setSelected(null);
    setForm({});
    setAdminNote("");
    setMsg("");
  };

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAction = async (status) => {
    setSubmitting(true);
    setMsg("");
    try {
      const payload = {
        ...form,
        status,
        admin_note: adminNote,
        admin_username: localStorage.getItem("admin_username") || localStorage.getItem("username") || "",
      };
      const res = await fetch(`${API_BASE}/workstation-bids/${selected.id}/admin-review/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Admin review failed.");
      setMsg(status === "approved" ? "Bid approved successfully." : "Bid sent to re-analyze.");
      await fetchBids();
      await fetchReAnalyzeCount();
      setTimeout(closeModal, 700);
    } catch (err) {
      setMsg(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const StatusBadge = ({ status }) => {
    if (status === "approved") {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Approved</span>;
    }
    if (status === "pending") {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Pending</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">Re-Analyze</span>;
  };

  const totalPages = Math.max(1, Math.ceil(bids.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * ROWS_PER_PAGE;
  const pageBids = bids.slice(startIdx, startIdx + ROWS_PER_PAGE);
  let pageStart = Math.max(1, safePage - Math.floor(PAGE_WINDOW / 2));
  let pageEnd = Math.min(totalPages, pageStart + PAGE_WINDOW - 1);
  pageStart = Math.max(1, pageEnd - PAGE_WINDOW + 1);
  const pageNums = Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button type="button" onClick={() => window.history.back()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-200 shadow-sm m-4">
        Back
      </button>

      <div className="flex gap-3 px-6 pt-3 bg-gray-50 border-b border-gray-200 overflow-visible">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[52px] px-4 py-3 text-sm font-semibold transition-all flex items-center gap-2 rounded-t-lg border-b-2 ${
              activeTab === tab.id ? `${tab.color} ${tab.border} bg-white` : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <span>{tab.label}</span>
            {tab.id === "re-analyze" && reAnalyzeCount > 0 && (
              <span className="ml-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center leading-none shadow-sm">
                {reAnalyzeCount > 99 ? "99+" : reAnalyzeCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="bg-slate-800 text-white text-xs uppercase">
            <tr>{["S.No.", "Analyser", "Department", "Bid No", "Model", "Status", "Action"].map((h) => <th key={h} className="px-4 py-4 text-center">{h}</th>)}</tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7" className="py-14 text-center text-gray-400">Loading bids...</td></tr>}
            {!loading && bids.length === 0 && <tr><td colSpan="7" className="py-14 text-center text-gray-400">No workstation bids found.</td></tr>}
            {!loading && pageBids.map((bid, index) => (
              <tr key={bid.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-sm text-gray-700 text-center">{startIdx + index + 1}</td>
                <td className="px-4 py-4 text-sm text-gray-700 text-center truncate">{bid.analyser_display_name || "-"}</td>
                <td className="px-4 py-4 text-sm text-gray-700 text-center truncate">{bid.dept_name || "-"}</td>
                <td className="px-4 py-4 text-sm text-blue-600 font-semibold text-center truncate">{bid.bid_no}</td>
                <td className="px-4 py-4 text-sm text-gray-700 text-center truncate">{bid.model_number || "-"}</td>
                <td className="px-4 py-4 text-center">
                  <div className="flex justify-center"><StatusBadge status={bid.status || activeTab} /></div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex justify-center">
                    <button type="button" onClick={() => openModal(bid)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-xs font-semibold transition-colors">View</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center px-6 py-4 border-t border-gray-100 bg-gray-50 gap-4">
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{startIdx + 1}-{Math.min(startIdx + ROWS_PER_PAGE, bids.length)}</span>{" "}
            of <span className="font-semibold text-gray-700">{bids.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button type="button" disabled={safePage === 1} onClick={() => setCurrentPage((p) => p - 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800">
              Prev
            </button>
            {pageNums.map((p) => (
              <button key={p} type="button" onClick={() => setCurrentPage(p)}
                className={`w-8 h-8 rounded-md text-xs font-semibold border transition-all ${
                  p === safePage ? "bg-slate-800 text-white border-slate-800 shadow-sm" : "bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800"
                }`}>
                {p}
              </button>
            ))}
            <button type="button" disabled={safePage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800">
              Next
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-4">
                <button type="button" onClick={closeModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-200 shadow-sm">
                  Back
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Review & Update Workstation</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Bid No: <span className="text-blue-600 font-semibold ml-1">{selected.bid_no}</span></p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="text-2xl text-gray-400 hover:text-gray-700 leading-none">x</button>
            </div>

            {msg && (
              <div className="mx-6 mt-4">
                <div className={`px-4 py-3 rounded-md text-sm font-medium ${msg.toLowerCase().includes("approved") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {msg}
                </div>
              </div>
            )}

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ["bid_no", "Bid Number"],
                ["model_number", "Model Number"],
                ["dept_name", "Department"],
                ["organization", "Organization"],
                ["qty", "Quantity"],
                ["pincode", "Pincode"],
              ].map(([name, label]) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    name={name}
                    value={form[name] || ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Local Content (%)</label>
                <input
                  type="text"
                  name="local_content"
                  value={form.local_content || ""}
                  onChange={handleChange}
                  placeholder="Enter %"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEXT_FIELDS.filter(([name]) => name === "address" || name === "atc").map(([name, label]) => (
                  <div key={name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <textarea
                      name={name}
                      value={form[name] || ""}
                      onChange={handleChange}
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Compliance Documents</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SpecialDocView form={form} />
                  <GeneralDocsView form={form} />
                  <MakeInIndiaView form={form} />
                </div>
              </div>

              <PriceField label="Processor" name="processor" priceName="processor_price" form={form} handleChange={handleChange} />
              <PriceField label="RAM" name="ram" priceName="ram_price" form={form} handleChange={handleChange} />
              <PriceField label="Hard Disk Drive" name="hdd" priceName="hdd_price" form={form} handleChange={handleChange} />
              <PriceField label="Solid State Drive 1" name="ssd1" priceName="ssd1_price" form={form} handleChange={handleChange} />
              <PriceField label="Solid State Drive 2" name="ssd2" priceName="ssd2_price" form={form} handleChange={handleChange} />
              <PriceField label="Graphics Card" name="graphics" priceName="graphics_price" form={form} handleChange={handleChange} />
              <PriceField label="Motherboard" name="motherboard" priceName="motherboard_price" form={form} handleChange={handleChange} />
              <PriceField label="OS" name="os" priceName="os_price" form={form} handleChange={handleChange} />
              <PriceField label="Monitor" name="monitor" priceName="monitor_price" form={form} handleChange={handleChange} />
              <PriceField label="Cabinet" name="cabinet" priceName="cabinet_price" form={form} handleChange={handleChange} />
              <PriceField label="Keyboard & Mouse" name="keyboard" priceName="keyboard_price" form={form} handleChange={handleChange} />
              <PriceField label="Power Supply" name="power_supply" priceName="power_supply_price" form={form} handleChange={handleChange} />
              <PriceField label="Warranty" name="warranty" priceName="warranty_price" form={form} handleChange={handleChange} />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bid End Date</label>
                <input
                  type="date"
                  name="date"
                  value={form.date || ""}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EPBG (%)</label>
                <input
                  type="text"
                  name="epbg"
                  value={form.epbg || ""}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <PriceField label="Processor Description" name="pro_descp" isTextArea optional form={form} handleChange={handleChange} />
              <PriceField label="Motherboard Description" name="motherboard_descp" isTextArea optional form={form} handleChange={handleChange} />
              <PriceField label="Graphics Description" name="gp" isTextArea optional form={form} handleChange={handleChange} />
              <PriceField label="Additional Software" name="software1" isTextArea optional form={form} handleChange={handleChange} />
              <PriceField label="Extra Requirements" name="extra_requirements" isTextArea optional form={form} handleChange={handleChange} />

              <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEXT_FIELDS.filter(([name]) => name === "optional_ports").map(([name, label]) => (
                  <div key={name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <textarea
                      name={name}
                      value={form[name] || ""}
                      onChange={handleChange}
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>

              {selected.review_status !== "approved" && (
                <div className="md:col-span-2 lg:col-span-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <label className="block text-sm font-bold text-amber-800 mb-2">Admin Review Note</label>
                  <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3}
                    className="w-full border border-amber-200 rounded-md px-3 py-2 text-sm resize-none outline-none" />
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              {selected.review_status !== "approved" && (
                <>
                  <button type="button" disabled={submitting} onClick={() => handleAction("approved")} className="px-8 py-2.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:bg-emerald-400">Approve Bid</button>
                  <button type="button" disabled={submitting} onClick={() => handleAction("re-analyze")} className="px-8 py-2.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:bg-rose-400">Send to Re-Analyze</button>
                </>
              )}
              <button type="button" onClick={closeModal} className="px-8 py-2.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
