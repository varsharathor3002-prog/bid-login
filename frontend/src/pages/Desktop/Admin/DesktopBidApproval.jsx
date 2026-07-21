import { useEffect, useRef, useState } from "react";
import {
  PROCESSORS, RAMS, HDDS, SSDS, OS_OPTIONS, DVDS, WIFIS, MONITORS,
  CABINETS, KEYBOARDS, WARRANTIES, MOTHERBOARDS, getPriceFromLocalData,
} from "../User/DesktopConfig";

const API_BASE = import.meta.env.VITE_API_URL;

const SPEC_OPTIONS = {
  processor: PROCESSORS,
  ram: RAMS,
  hdd: HDDS,
  ssd1: SSDS,
  ssd2: SSDS,
  os: OS_OPTIONS,
  dvd: DVDS,
  wifi: WIFIS,
  monitor: MONITORS,
  cabinet: CABINETS,
  keyboard: KEYBOARDS,
  warranty: WARRANTIES,
  motherboard: MOTHERBOARDS,
};

const PRICE_FIELDS = [
  "processor_price", "ram_price", "hdd_price", "ssd1_price", "ssd2_price",
  "os_price", "dvd_price", "wifi_price", "monitor_price", "cabinet_price",
  "keyboard_price", "warranty_price", "motherboard_price", "pro_descp_price",
  "motherboard_descp_price", "software1_price", "gp_price",
  "freightInstallation_price", "hddreturnable_price",
];

const toPrice = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculateTotalPrice = (values) =>
  PRICE_FIELDS.reduce((total, field) => total + toPrice(values?.[field]), 0);

const TABS = [
  { id: "pending", label: "Pending", icon: "⏳", color: "text-amber-600", border: "border-amber-600" },
  { id: "re-analyze", label: "Re-Analyze", icon: "⚠️", color: "text-rose-600", border: "border-rose-600" },
  { id: "approved", label: "Approved", icon: "✅", color: "text-emerald-600", border: "border-emerald-600" },
];

const GENERAL_DOCS = [
  { id: "manufacturer_auth", label: "MANUFACTURER AUTHORIZATION CERTIFICATE" },
  { id: "experience_certificate", label: "EXPERIENCE CERTIFICATE" },
  { id: "past_performance", label: "PAST PERFORMANCE" },
  { id: "oem_annual_turnover", label: "OEM ANNUAL TURNOVER" },
  { id: "warranty", label: "WARRANTY" },
  { id: "bidder_financial", label: "BIDDER FINANCIAL UNDERSTANDINGS" },
  { id: "non_obsolete", label: "NON OBSOLETE" },
  { id: "data_sheet", label: "DATA SHEET" },
  { id: "non_malicious", label: "NON MALICIOUS CODE" },
  { id: "non_return_hdd", label: "NON RETURN OF HARD DISK" },
  { id: "technical_compliance", label: "TECHNICAL COMPLIANCE" },
  { id: "non_blacklisting", label: "NON BLACKLISTING" },
  { id: "service_support", label: "SERVICE SUPPORT CONSIGNEE LOCATION" },
  { id: "ipv6", label: "IPV6" },
  { id: "preloaded_os", label: "PRELOADED OPERATING SYSTEM" },
];

const PriceField = ({ label, name, priceName, form, handleChange, options, isTextArea = false, optional = false }) => (
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
      ) : options ? (
        <select
          name={name}
          value={form?.[name] || ""}
          onChange={handleChange}
          className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select</option>
          {form?.[name] && !options.some((option) => option.name === form[name]) && (
            <option value={form[name]}>{form[name]}</option>
          )}
          {options.map((option) => (
            <option key={option.name} value={option.name}>{option.name}</option>
          ))}
          <option value="None">None</option>
        </select>
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
          value={form?.[priceName] ?? ""}
          onChange={handleChange}
          autoComplete="off"
          placeholder="Price"
          className="w-28 border border-blue-300 rounded-md px-2 py-2 text-sm text-center bg-white outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  </div>
);

function GeneralDocsViewPopup({ form }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [generatingDocs, setGeneratingDocs] = useState({});
  const [downloadingDocs, setDownloadingDocs] = useState({});
  const bidId = form?.id || form?.bid_id;

  const knownDocIds = GENERAL_DOCS.map((doc) => doc.id);
  const rawSelectedDocs = Array.isArray(form?.selected_general_docs) ? form.selected_general_docs : [];
  const rawSelectedLabels = Array.isArray(form?.selected_general_doc_labels) ? form.selected_general_doc_labels : [];

  const selectedIds = rawSelectedDocs.some((item) => knownDocIds.includes(item))
    ? rawSelectedDocs
    : rawSelectedLabels.filter((item) => knownDocIds.includes(item));

  const selectedLabels = rawSelectedLabels.some((item) => knownDocIds.includes(item))
    ? rawSelectedDocs
    : rawSelectedLabels;

  const availableDocs = GENERAL_DOCS.filter((doc) => selectedIds.includes(doc.id));
  const fallbackDocs =
    availableDocs.length > 0
      ? availableDocs
      : selectedLabels.map((label, index) => ({ id: `label_${index}`, label, viewable: false }));
  const displayDocs = [...fallbackDocs];
  const uploadedCount = displayDocs.length;

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

  const getGeneratedPdfUrl = async (docId) => {
    if (!bidId) throw new Error("Bid ID not found.");
    if (!docId || docId.startsWith("label_")) throw new Error("Document preview not available.");
    const response = await fetch(`${API_BASE}/desktop-bids/${bidId}/generate-docs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_type: docId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to generate document.");
    if (!data.pdf_url) throw new Error("Generated PDF URL was not received.");
    return data.pdf_url;
  };

  const handleViewDocument = async (docId) => {
    setGeneratingDocs((prev) => ({ ...prev, [docId]: true }));
    try {
      const pdfUrl = await getGeneratedPdfUrl(docId);
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error.message || "Unable to open document.");
    } finally {
      setGeneratingDocs((prev) => ({ ...prev, [docId]: false }));
    }
  };

  const handleDownloadDocument = async (doc) => {
    setDownloadingDocs((prev) => ({ ...prev, [doc.id]: true }));
    try {
      const pdfUrl = await getGeneratedPdfUrl(doc.id);
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Unable to download document.");
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
      setDownloadingDocs((prev) => ({ ...prev, [doc.id]: false }));
    }
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group ${
          open
            ? "bg-orange-50 border-orange-500 ring-1 ring-orange-500"
            : "bg-white border-gray-200 hover:border-orange-400 hover:shadow-md"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${open ? "bg-orange-200 text-orange-700" : "bg-orange-100 text-orange-600 group-hover:bg-orange-200"}`}>
            📁
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-800">Bid Documents</div>
            <div className="text-xs text-gray-500">
              {uploadedCount > 0 ? "Separate certificates and indexed ATC bundle" : "No documents selected"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${uploadedCount > 0 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
            {uploadedCount} Items
          </span>
        </div>
      </button>
      {open && (
        <>
          <div className="absolute top-full left-0 right-0 mt-2 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
              <span className="text-sm font-semibold text-orange-800">Approved Bid Documents</span>
              <span className="text-xs font-semibold px-2 py-[2px] rounded-full bg-green-100 text-green-700">{uploadedCount} Total</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
              {displayDocs.length > 0 ? (
                displayDocs.map((doc) => {
                  const isGenerating = !!generatingDocs[doc.id];
                  const isDownloading = !!downloadingDocs[doc.id];
                  const disabled = doc.viewable === false || isGenerating || isDownloading;
                  return (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3 transition-colors bg-white hover:bg-green-50">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white text-xs">✓</div>
                      <span className="flex-1 text-sm text-gray-800 font-medium">{doc.label}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleViewDocument(doc.id)} disabled={disabled}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition">
                          {isGenerating ? "Generating..." : "View File"}
                        </button>
                        <button type="button" onClick={() => handleDownloadDocument(doc)} disabled={disabled}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition">
                          {isDownloading ? "Downloading..." : "Download"}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">No documents selected.</div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button type="button" onClick={() => setOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium px-3 py-1 rounded hover:bg-gray-200 transition">
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
    const requestBody = {
      doc_type: "make_in_india",
      local_content: form?.local_content || "",
      model_number: form?.model_number || form?.model || "",
    };
    const response = await fetch(`${API_BASE}/desktop-bids/${bidId}/generate-docs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to generate document.");
    if (!data.pdf_url) throw new Error("Generated PDF URL was not received.");
    return data.pdf_url;
  };

  const handleView = async () => {
    setGenerating(true);
    try {
      const pdfUrl = await getGeneratedPdfUrl();
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error.message || "Unable to open document.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const pdfUrl = await getGeneratedPdfUrl();
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Unable to download document.");
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
    <div className="w-full p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-green-100 text-green-600">📄</div>
        <div className="text-left">
          <div className="text-sm font-bold text-gray-800">Make in India</div>
          <div className="text-xs text-gray-500">
            {form?.model_number ? `Model: ${form.model_number}` : "No model"}
            {form?.local_content && ` • Local: ${form.local_content}%`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleView} disabled={generating}
          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition">
          {generating ? "Generating..." : "View File"}
        </button>
        <button type="button" onClick={handleDownload} disabled={downloading}
          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition">
          {downloading ? "Downloading..." : "Download"}
        </button>
      </div>
    </div>
  );
}

function SpecialDocView({ form }) {
  const url = form?.atc_special_document;
  if (!url) return null;
  const fullUrl = url.startsWith("http") ? url : `${import.meta.env.VITE_API_URL}${url}`;
  const filename = url.split("/").pop() || "special_document";
  const handleDownload = async () => {
    try {
      const res = await fetch(fullUrl);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert("Download failed");
    }
  };
  return (
    <div className="w-full p-4 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-purple-200 text-purple-700">✅</div>
        <div className="text-left">
          <div className="text-sm font-bold text-purple-900">Special Document</div>
          <div className="text-xs text-purple-700">ATC Specific Requirement</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a href={fullUrl} target="_blank" rel="noreferrer"
          className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-white border border-purple-200 rounded hover:bg-purple-50 transition">
          View File
        </a>
        <button type="button" onClick={handleDownload}
          className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 shadow-sm transition">
          Download
        </button>
      </div>
    </div>
  );
}

export default function DesktopBidApproval() {
  const [activeTab, setActiveTab] = useState("pending");
  const [bids, setBids] = useState([]);
  const [reAnalyzeCount, setReAnalyzeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);
  const ROWS_PER_PAGE = 10;
  const MAX_PAGE_BTNS = 5;

  useEffect(() => {
    fetchBids();
    fetchReAnalyzeCount();
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (!selected) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selected]);

  const getAnalyserName = (bid) =>
    bid.analyser_name || bid.analyzer_name || bid.analyser || bid.analyzer ||
    bid.analysed_by || bid.analyzed_by || bid.created_by || bid.user_name || "-";

  const sortBids = (data) => {
    return [...data].sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0);
      const dateB = new Date(b.updated_at || b.created_at || 0);
      return dateB - dateA;
    });
  };

  const fetchBids = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/desktop-bids/list/?status=${activeTab}&role=admin`);
      if (!res.ok) throw new Error(`Failed with status ${res.status}`);
      const data = await res.json();
      const normalized = data.map((bid) => ({
        ...bid,
        analyser_display_name: getAnalyserName(bid),
        model_number: bid.model_number || bid.model || "",
        ssd1: bid.ssd1 || bid.ssd || "",
        ssd1_price: bid.ssd1_price || bid.ssd_price || "",
        freightInstallation: bid.freightInstallation || "Yes",
        freightInstallation_price: (bid.freightInstallation || "Yes") === "No" ? 0 : bid.freightInstallation_price || bid.freight_price || 0,
        local_content: bid.local_content || "",
      }));
      setBids(sortBids(normalized));
    } catch (error) {
      console.error("fetchBids error: ", error);
      setBids([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchReAnalyzeCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/desktop-bids/list/?status=re-analyze&role=admin`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setReAnalyzeCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setReAnalyzeCount(0);
    }
  };

  const formatSubmittedDate = (bid) => {
    const raw = bid.created_at || bid.date;
    if (!raw) return "-";
    const d = new Date(raw);
    if (isNaN(d)) return raw;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const handleDelete = async (bid) => {
    const ok = window.confirm("Are you sure you want to delete this bid?");
    if (!ok) return;
    setDeletingId(bid.id);
    try {
      const res = await fetch(`${API_BASE}/desktop-bids/${bid.id}/delete/`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setBids((prev) => prev.filter((b) => b.id !== bid.id));
      fetchReAnalyzeCount();
    } catch (error) {
      console.error("handleDelete error: ", error);
      alert(error.message || "Unable to delete bid.");
    } finally {
      setDeletingId(null);
    }
  };

  const openModal = (bid) => {
    const formattedBid = {
      ...bid,
      analyser_display_name: getAnalyserName(bid),
      freightInstallation: bid.freightInstallation || "Yes",
      freightInstallation_price: (bid.freightInstallation || "Yes") === "No" ? 0 : bid.freightInstallation_price || bid.freight_price || 0,
      local_content: bid.local_content || "",
      optional_ports: bid.optional_ports || "",
    };
    formattedBid.total_price =
      toPrice(bid.total_price) > 0
        ? bid.total_price
        : calculateTotalPrice(formattedBid);
    setSelected(formattedBid);
    setForm({ ...formattedBid });
    setAdminNote(formattedBid.admin_note || "");
    setMsg("");
  };

  const closeModal = () => {
    setSelected(null);
    setForm({});
    setAdminNote("");
    setMsg("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === "total_price") return { ...prev, total_price: value };

      const next = { ...prev, [name]: value };
      const options = SPEC_OPTIONS[name];
      if (options) {
        next[`${name}_price`] = value === "None" ? 0 : getPriceFromLocalData(options, value);
      }

      if (PRICE_FIELDS.includes(name) || options) {
        next.total_price = calculateTotalPrice(next);
      }
      return next;
    });
  };

  const handleAction = async (action) => {
    setSubmitting(true);
    setMsg("");
    try {
      const formData = new FormData();
      Object.keys(form).forEach((key) => {
        formData.append(key, form[key] ?? "");
      });
      formData.set("ssd", form.ssd1 || "");
      formData.set("ssd_price", form.ssd1_price || "");
      formData.set("freightInstallation_price", form.freightInstallation_price || form.freight_price || "");
      formData.set("model_number", form.model_number || form.model || "");
      formData.set("local_content", form.local_content || "");
            formData.set("optional_ports", form.optional_ports || "");
      formData.set("status", action);
      formData.set("admin_note", adminNote);
      formData.set("admin_username", localStorage.getItem("username") || "");

      const res = await fetch(`${API_BASE}/desktop-bids/${form.id}/admin-review/`, {
        method: "PATCH",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setMsg(action === "approved" ? "✅ Bid Approved Successfully!" : "⚠️ Sent back to Analyser");
        setTimeout(() => {
          closeModal();
          fetchBids();
          fetchReAnalyzeCount();
        }, 1200);
      } else {
        setMsg(data.error || "Something went wrong");
      }
    } catch (error) {
      console.error("handleAction error: ", error);
      setMsg("Server error");
    } finally {
      setSubmitting(false);
    }
  };

  const StatusBadge = ({ status }) => {
    if (status === "approved")
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">✅ Approved</span>;
    if (status === "pending")
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">⏳ Pending</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">⚠️ Re-Analyze</span>;
  };

  const TABLE_HEADS = [
    { label: "S.No", width: "w-16" },
    { label: "Analyser", width: "w-36" },
    { label: "Department", width: "w-40" },
    { label: "Bid No", width: "w-36" },
    { label: "Model", width: "w-40" },
    { label: "Submitted On", width: "w-32" },
    { label: "Status", width: "w-32" },
    { label: "Action", width: "w-32" },
  ];

  const totalPages = Math.ceil(bids.length / ROWS_PER_PAGE);
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const pageBids = bids.slice(startIdx, startIdx + ROWS_PER_PAGE);
  const half = Math.floor(MAX_PAGE_BTNS / 2);
  let pageStart = Math.max(1, currentPage - half);
  let pageEnd = Math.min(totalPages, pageStart + MAX_PAGE_BTNS - 1);
  if (pageEnd - pageStart < MAX_PAGE_BTNS - 1) pageStart = Math.max(1, pageEnd - MAX_PAGE_BTNS + 1);
  const pageNums = [];
  for (let p = pageStart; p <= pageEnd; p++) pageNums.push(p);

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button type="button" onClick={() => window.history.back()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-200 shadow-sm m-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {}
      <div className="flex gap-3 px-6 pt-3 bg-gray-50 border-b border-gray-200 overflow-visible">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`min-h-[52px] px-4 py-3 text-sm font-semibold transition-all flex items-center gap-2 rounded-t-lg border-b-2 ${
              activeTab === tab.id
                ? `${tab.color} ${tab.border} bg-white shadow-sm`
                : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-white"
            }`}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.id === "re-analyze" && reAnalyzeCount > 0 && (
              <span className="ml-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center leading-none shadow-sm">
                {reAnalyzeCount > 99 ? "99+" : reAnalyzeCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {}
      {loading ? (
        <div className="p-20 text-center text-gray-400">Loading...</div>
      ) : bids.length === 0 ? (
        <div className="p-20 text-center text-gray-400">No records found</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-slate-800">
                  {TABLE_HEADS.map((head) => (
                    <th key={head.label} className={`${head.width} px-4 py-4 text-[11px] font-bold text-white uppercase tracking-wide text-center`}>
                      {head.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageBids.map((bid, i) => (
                  <tr key={bid.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 text-sm text-gray-700 text-center">{startIdx + i + 1}</td>
                    <td className="px-4 py-4 text-sm text-gray-700 text-center truncate">{bid.analyser_display_name}</td>
                    <td className="px-4 py-4 text-sm text-gray-700 text-center truncate">{bid.dept_name}</td>
                    <td className="px-4 py-4 text-sm text-blue-600 font-semibold text-center truncate">{bid.bid_no}</td>
                    <td className="px-4 py-4 text-sm text-gray-700 text-center truncate">{bid.model_number}</td>
                    <td className="px-4 py-4 text-sm text-gray-700 text-center truncate">{formatSubmittedDate(bid)}</td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex justify-center">
                        <StatusBadge status={bid.status} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <button type="button" onClick={() => openModal(bid)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-xs font-semibold transition-colors">
                          View
                        </button>
                        {activeTab === "approved" && (
                          <button type="button" onClick={() => handleDelete(bid)} disabled={deletingId === bid.id}
                            title="Delete bid"
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            {deletingId === bid.id ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center px-6 py-4 border-t border-gray-100 bg-gray-50 gap-4">
              <p className="text-xs text-gray-500">
                Showing <span className="font-semibold text-gray-700">{startIdx + 1}–{Math.min(startIdx + ROWS_PER_PAGE, bids.length)}</span>{" "}
                of <span className="font-semibold text-gray-700">{bids.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </button>
                {pageStart > 1 && (
                  <>
                    <button type="button" onClick={() => setCurrentPage(1)}
                      className="w-8 h-8 rounded-md text-xs font-semibold border bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all">
                      1
                    </button>
                    {pageStart > 2 && <span className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">…</span>}
                  </>
                )}
                {pageNums.map((p) => (
                  <button key={p} type="button" onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-md text-xs font-semibold border transition-all ${
                      p === currentPage
                        ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800"
                    }`}>
                    {p}
                  </button>
                ))}
                {pageEnd < totalPages && (
                  <>
                    {pageEnd < totalPages - 1 && <span className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">…</span>}
                    <button type="button" onClick={() => setCurrentPage(totalPages)}
                      className="w-8 h-8 rounded-md text-xs font-semibold border bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all">
                      {totalPages}
                    </button>
                  </>
                )}
                <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800">
                  Next
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-4">
                <button type="button" onClick={closeModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-200 shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Review & Update Desktop</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Bid No: <span className="text-blue-600 font-semibold ml-1">{selected.bid_no}</span>
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="text-2xl text-gray-400 hover:text-gray-700 leading-none">×</button>
            </div>

            {msg && (
              <div className="mx-6 mt-4">
                <div className={`px-4 py-3 rounded-md text-sm font-medium ${msg.includes("✅") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {msg}
                </div>
              </div>
            )}

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bid Number</label>
                  <input type="text" name="bid_no" value={form?.bid_no || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model Number</label>
                  <input type="text" name="model_number" value={form?.model_number || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input type="text" name="dept_name" value={form?.dept_name || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                  <input type="text" name="organization" value={form?.organization || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input type="text" name="qty" value={form?.qty || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input type="text" name="pincode" value={form?.pincode || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bid End Date</label>
                  <input type="date" name="date" value={form?.date || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" name="address" value={form?.address || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Local Content (%)</label>
                  <input type="text" name="local_content" value={form?.local_content || ""} onChange={handleChange}
                    placeholder="Enter %" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ATC</label>
                  <textarea name="atc" value={form?.atc || ""} onChange={handleChange} rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Compliance Documents</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {form?.atc_special_document ? (
                      <SpecialDocView form={form} />
                    ) : (
                      <div className="p-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
                        No Special Document
                      </div>
                    )}
                    <GeneralDocsViewPopup form={form} />
                    <MakeInIndiaView form={form} />
                  </div>
                </div>

                <PriceField label="Processor" name="processor" priceName="processor_price" options={SPEC_OPTIONS.processor} form={form} handleChange={handleChange} />
                <PriceField label="RAM" name="ram" priceName="ram_price" options={SPEC_OPTIONS.ram} form={form} handleChange={handleChange} />
                <PriceField label="Hard Disk Drive" name="hdd" priceName="hdd_price" options={SPEC_OPTIONS.hdd} form={form} handleChange={handleChange} />
                <PriceField label="Solid State Drive 1" name="ssd1" priceName="ssd1_price" options={SPEC_OPTIONS.ssd1} form={form} handleChange={handleChange} />
                <PriceField label="Solid State Drive 2" name="ssd2" priceName="ssd2_price" options={SPEC_OPTIONS.ssd2} form={form} handleChange={handleChange} />
                <PriceField label="OS" name="os" priceName="os_price" options={SPEC_OPTIONS.os} form={form} handleChange={handleChange} />
                <PriceField label="DVD" name="dvd" priceName="dvd_price" options={SPEC_OPTIONS.dvd} form={form} handleChange={handleChange} />
                <PriceField label="WiFi Bluetooth" name="wifi" priceName="wifi_price" options={SPEC_OPTIONS.wifi} form={form} handleChange={handleChange} />
                <PriceField label="Monitor" name="monitor" priceName="monitor_price" options={SPEC_OPTIONS.monitor} form={form} handleChange={handleChange} />
                <PriceField label="Cabinet" name="cabinet" priceName="cabinet_price" options={SPEC_OPTIONS.cabinet} form={form} handleChange={handleChange} />
                <PriceField label="Keyboard & Mouse" name="keyboard" priceName="keyboard_price" options={SPEC_OPTIONS.keyboard} form={form} handleChange={handleChange} />
                <PriceField label="Warranty" name="warranty" priceName="warranty_price" options={SPEC_OPTIONS.warranty} form={form} handleChange={handleChange} />
                <PriceField label="Motherboard" name="motherboard" priceName="motherboard_price" options={SPEC_OPTIONS.motherboard} form={form} handleChange={handleChange} />
                <PriceField label="Processor Description" name="pro_descp" priceName="pro_descp_price" isTextArea optional form={form} handleChange={handleChange} />
                <PriceField label="Motherboard Description" name="motherboard_descp" priceName="motherboard_descp_price" isTextArea optional form={form} handleChange={handleChange} />
                <PriceField label="Additional Software" name="software1" priceName="software1_price" isTextArea optional form={form} handleChange={handleChange} />
                <PriceField label="Graphics Description" name="gp" priceName="gp_price" isTextArea optional form={form} handleChange={handleChange} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EPBG (%)</label>
                  <input type="text" name="epbg" value={form?.epbg || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Freight & Installation</label>
                  <div className="flex gap-2">
                    <input type="text" value={form?.freightInstallation || "Yes"} readOnly
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50" />
                    <input type="text" name="freightInstallation_price"
                      value={form?.freightInstallation_price || ""}
                      onChange={handleChange}
                      disabled={(form?.freightInstallation || "Yes") === "No"}
                      placeholder="Price" className="w-28 border border-blue-300 rounded-md px-2 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HDD Return Option</label>
                  <div className="flex gap-2">
                    <select name="hddreturnable" value={form?.hddreturnable || ""} onChange={handleChange}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="Yes">Yes</option>
                      <option value="None">None</option>
                    </select>
                    <input type="text" name="hddreturnable_price" value={form?.hddreturnable_price || ""} onChange={handleChange}
                      placeholder="Price" className="w-28 border border-blue-300 rounded-md px-2 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-slate-300 bg-slate-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="block text-sm font-semibold text-slate-800">Total Approved Price</label>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        name="total_price"
                        value={form?.total_price ?? ""}
                        onChange={handleChange}
                        readOnly={selected?.status === "approved" || selected?.review_status === "approved"}
                        disabled={selected?.status === "approved" || selected?.review_status === "approved"}
                        className="w-48 rounded-md border border-slate-300 bg-white px-3 py-2 text-right text-lg font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-700"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1 bg-gray-300"></div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Optional Ports (Filled by Analyser)</span>
                    <div className="h-px flex-1 bg-gray-300"></div>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Optional Ports
                    <span className="text-blue-500 text-[11px] font-normal ml-1">(Optional)</span>
                  </label>
                  <textarea name="optional_ports" value={form?.optional_ports || ""} onChange={handleChange}
                    rows={2} placeholder="e.g. Serial Port, Display Port, USB Type-C"
                    className="w-full border border-blue-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/30 resize-none" />
                </div>

                {selected.status !== "approved" && (
                  <div className="md:col-span-2 lg:col-span-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <label className="block text-sm font-bold text-amber-800 mb-2">Admin Review Note</label>
                    <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3}
                      placeholder="Write review note... (e.g., Please add optional ports if required)"
                      className="w-full border border-amber-200 rounded-md px-3 py-2 text-sm resize-none outline-none" />
                  </div>
                )}
              </div>

              <div className="mt-8 flex gap-3 flex-wrap">
                {selected.status === "pending" && (
                  <>
                    <button type="button" disabled={submitting} onClick={() => handleAction("approved")}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition">
                      {submitting ? "Processing..." : "✅ Approve Bid"}
                    </button>
                    <button type="button" disabled={submitting} onClick={() => handleAction("re-analyze")}
                      className="bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition">
                      {submitting ? "Processing..." : "⚠️ Send to Re-Analyze"}
                    </button>
                  </>
                )}
                <button type="button" onClick={closeModal}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
