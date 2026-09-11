import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
// Toner-native dropdown vocabulary — same source used at the User config
// step (TonerConfig.jsx), so the Analyser sees the exact same option text.
import {
  BRANDS, CARTRIDGE_TYPES, PRODUCT_CLASSES, COLOURS, TECHNOLOGIES,
  PAGE_YIELDS, YIELD_STANDARDS, CHIPS, PRINT_COVERAGES, WARRANTIES,
  WARRANTY_TYPES, QTY_PER_PACKS, COMPLIANCES, REPLACEMENT_POLICIES, YES_NO,
} from "../User/TonerConfig";

const API_BASE = import.meta.env.VITE_API_URL;

const GENERAL_DOCS = [
  { id: "manufacturer_auth", label: "MANUFACTURER AUTHORIZATION CERTIFICATE" },
  { id: "experience_certificate", label: "EXPERIENCE CERTIFICATE" },
  { id: "past_performance", label: "PAST PERFORMANCE" },
  { id: "oem_annual_turnover", label: "OEM ANNUAL TURNOVER" },
  { id: "atc_acceptance_letter", label: "ATC ACCEPTANCE LETTER" },
  { id: "bidder_financial", label: "BIDDER FINANCIAL STANDING" },
  { id: "non_obsolete", label: "NON OBSOLETE" },
  { id: "non_malicious", label: "NON MALICIOUS CODE" },
  { id: "non_return_hdd", label: "NON RETURN OF HARD DISK" },
  { id: "non_blacklisting", label: "NON BLACKLISTING" },
  { id: "service_support", label: "SERVICE SUPPORT" },
  { id: "ipv6", label: "IPV6" },
  { id: "preloaded_os", label: "PRELOADED OPERATING SYSTEM" },
];

// Mirrors TonerConfig.jsx's own required/optional split — Print Coverage
// and Compliance are marked *Optional there, so they stay out of this list.
const REQUIRED_FIELDS = [
  "bid_no", "dept_name", "organization", "qty", "pincode", "address", "atc",
  "brand", "cartridge_type", "product_class", "colour", "compatibility", "technology",
  "page_yield", "yield_standard", "chip", "warranty", "warranty_type",
  "refillable", "qty_per_pack", "hsn_code", "replacement_policy", "date",
];

const parseList = (value) => {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
};

const Label = ({ children, optional }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {optional && <span className="text-red-500 text-[11px] font-normal ml-1">*Optional</span>}
  </label>
);

const AdminNoteBanner = ({ note }) => {
  if (!note) return null;
  return (
    <div className="mb-6 rounded-xl border-2 border-rose-400 bg-rose-50 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-rose-500 px-4 py-2.5">
        <span className="text-white text-base">⚠️</span>
        <span className="text-white font-bold text-sm tracking-wide uppercase">
          Admin Review Note — Action Required
        </span>
      </div>
      <div className="px-5 py-4">
        <p className="text-rose-900 text-sm leading-relaxed whitespace-pre-wrap font-medium">{note}</p>
      </div>
    </div>
  );
};

function SpecialDocView({ form }) {
  const url = form?.atc_special_document;
  if (!url) return null;
  const filename = url.split("/").pop() || "special_document";

  const handleDownload = async () => {
    try {
      const res = await fetch(url);
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
        <a href={url} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-white border border-purple-200 rounded hover:bg-purple-50 transition">
          View File
        </a>
        <button type="button" onClick={handleDownload} className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 shadow-sm transition">
          Download
        </button>
      </div>
    </div>
  );
}

function GeneralDocsViewPopup({ form }) {
  const [open, setOpen] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState({});
  const [downloadingDocs, setDownloadingDocs] = useState({});

  const selectedIds = parseList(form?.selected_general_docs);
  const docs = GENERAL_DOCS.filter((doc) => selectedIds.includes(doc.id));
  const uploadedCount = docs.length;

  const getGeneratedPdfUrl = async (docId) => {
    if (!form?.id) throw new Error("Bid ID not found.");
    const response = await fetch(`${API_BASE}/toner-bids/${form.id}/generate-docs/`, {
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
      const response = await fetch(pdfUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to open document.");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
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
      link.href = blobUrl;
      link.download = `${doc.id}.pdf`;
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
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group ${
          open ? "bg-orange-50 border-orange-500 ring-1 ring-orange-500" : "bg-white border-gray-200 hover:border-orange-400 hover:shadow-md"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${open ? "bg-orange-200 text-orange-700" : "bg-orange-100 text-orange-600 group-hover:bg-orange-200"}`}>📁</div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-800">General Documents</div>
            <div className="text-xs text-gray-500">{uploadedCount > 0 ? "Click to view selected documents" : "No documents selected"}</div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${uploadedCount === GENERAL_DOCS.length ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
          {uploadedCount}/{GENERAL_DOCS.length} Files
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
              <span className="text-sm font-semibold text-orange-800">Selected General Documents</span>
              <span className="text-xs font-semibold px-2 py-[2px] rounded-full bg-green-100 text-green-700">{uploadedCount} Total</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
              {docs.length > 0 ? (
                docs.map((doc) => {
                  const isGenerating = !!generatingDocs[doc.id];
                  const isDownloading = !!downloadingDocs[doc.id];
                  const disabled = isGenerating || isDownloading;
                  return (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3 transition-colors bg-white hover:bg-green-50">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white">✓</div>
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

const VerifiedInputWrapper = ({ name, children, label, optional, required, verifiedFields, readOnly, toggleVerification }) => {
  const isVerified = !!verifiedFields[name];
  const isRequired = required ?? REQUIRED_FIELDS.includes(name);

  return (
    <div className="col-span-1 relative group">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {optional && <span className="text-red-500 text-[11px] font-normal ml-1">*Optional</span>}
        </label>
        {!readOnly && (
          <input type="checkbox" checked={isVerified} onChange={() => toggleVerification(name)}
            title={isRequired ? "Required — must verify" : "Optional"}
            className="w-3.5 h-3.5 border-gray-300 rounded cursor-pointer accent-green-600 focus:ring-green-500" />
        )}
      </div>
      <div className={`transition-all duration-200 ${isVerified ? "ring-1 ring-green-500 rounded-md bg-green-50/50" : ""}`}>{children}</div>
    </div>
  );
};

export default function TonerBidDetailView() {
  const { state } = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();
  const readOnly = state?.readOnly || false;
  const showGemUpload = state?.showGemUpload === true;

  const [form, setForm] = useState(null);
  const [gemStarting, setGemStarting] = useState(false);
  const [gemJob, setGemJob] = useState(null);
  const [loadingBid, setLoadingBid] = useState(true);
  const [msg, setMsg] = useState("");
  const [verifiedFields, setVerifiedFields] = useState({});
  const [modelInputValue, setModelInputValue] = useState("");
  const [modelSearching, setModelSearching] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelMatches, setModelMatches] = useState([]);
  const [showModelResult, setShowModelResult] = useState(false);
  const [noMatchFound, setNoMatchFound] = useState(false);
  const [newModelInput, setNewModelInput] = useState("");

  useEffect(() => {
    fetchBid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same to same as AIO's job-status poll (AioBidDetailView.jsx) — only runs
  // when opened from the "Transfer Catalogue to GeM" tab on an approved bid,
  // refreshing the upload job's status every 5s.
  useEffect(() => {
    if (!showGemUpload || !readOnly || !form?.id || form?.status !== "approved") return undefined;
    let stopped = false;
    const loadJob = async () => {
      const response = await fetch(`${API_BASE}/gem/toner-jobs/?bid_id=${form.id}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token") || ""}` },
      });
      const data = await response.json().catch(() => []);
      if (!stopped && response.ok && Array.isArray(data) && data[0]) {
        setGemJob(data[0]);
        setForm((prev) => ({
          ...prev,
          gem_account: data[0].account_label,
          gem_status: data[0].status,
          gem_error: data[0].error || data[0].rejection_reason || "",
        }));
      }
    };
    loadJob();
    const timer = window.setInterval(loadJob, 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [showGemUpload, readOnly, form?.id, form?.status]);

  const fetchBid = async () => {
    setLoadingBid(true);
    setMsg("");
    try {
      let data = state?.bid;
      if (!data) {
        const bidId = id || state?.id || state?.bid_id;
        if (!bidId) {
          setMsg("Bid ID not found.");
          setLoadingBid(false);
          return;
        }
        const res = await fetch(`${API_BASE}/toner-bids/${bidId}/`);
        if (!res.ok) throw new Error("Failed to fetch bid");
        data = await res.json();
      }
      setForm(data);
      // Same to same as AIO's shouldShowSavedModel: only pre-fill the
      // Assigned Model box for a bid that already went through Find Model
      // once — a fresh pending bid always starts with an empty box so the
      // analyser has to actually run Find Model, not see stale text.
      const shouldShowSavedModel = readOnly || ["analyzed", "approved", "re-analyze", "rejected"].includes(data.status);
      setModelInputValue(shouldShowSavedModel ? data.model_number || "" : "");
    } catch {
      setMsg("Error: Unable to load bid data.");
    } finally {
      setLoadingBid(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleVerification = (fieldName) => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    setVerifiedFields((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
  };

  const handleModelInputChange = (e) => setModelInputValue(e.target.value);

  const handleFindModel = async () => {
    if (!form) return;
    setModelSearching(true);
    setModelMatches([]);
    setShowModelResult(false);
    setNoMatchFound(false);
    setNewModelInput("");
    try {
      const res = await fetch(`${API_BASE}/toner-bids/${id}/match-catalogue/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Server error — unable to find a matching model.");
        return;
      }
      const item = data.match;
      if (!item?.model_no) {
        setModelMatches([]);
        setNoMatchFound(true);
        setShowModelResult(false);
        return;
      }
      setModelMatches([{ modelNo: item.model_no, product_id: item.product_id }]);
      setNoMatchFound(false);
      setShowModelResult(true);
    } catch (error) {
      console.error(error);
      alert("Network error — unable to connect to the server.");
    } finally {
      setModelSearching(false);
    }
  };

  const saveModelNumberToDB = async (modelNo) => {
    const trimmedModelNo = String(modelNo || "").trim();
    if (!trimmedModelNo) {
      alert("Model number required.");
      return null;
    }
    setModelSaving(true);
    try {
      const res = await fetch(`${API_BASE}/toner-bids/${id}/save-model-number/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_number: trimmedModelNo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Model number save failed.");
        return null;
      }
      const savedModel = data.model_number || trimmedModelNo;
      setModelInputValue(savedModel);
      // TonerBid stores the model across two DB fields (model_no + model,
      // concatenated into the model_number the API returns) — updating only
      // the synthetic model_number here left form.model/form.model_no stale,
      // same risk AIO's own detail view guards against.
      setForm((prev) => ({ ...prev, model_number: savedModel, model: savedModel, model_no: "" }));
      setMsg("Model number saved successfully ✅");
      return savedModel;
    } catch (error) {
      console.error(error);
      alert("Server error — unable to save model number.");
      return null;
    } finally {
      setModelSaving(false);
    }
  };

  const selectModelNumber = async (modelNo) => {
    const saved = await saveModelNumberToDB(modelNo);
    if (!saved) return;
    setShowModelResult(false);
    setNoMatchFound(false);
    setNewModelInput("");
  };

  const handleCreateNewModel = async () => {
    const trimmed = modelInputValue.trim();
    if (!trimmed) {
      alert("Please enter a model number.");
      return;
    }
    const saved = await saveModelNumberToDB(trimmed);
    if (!saved) return;
    setShowModelResult(false);
    setNoMatchFound(false);
    setNewModelInput("");
  };

  const requiredVerifiedCount = REQUIRED_FIELDS.filter((field) => !!verifiedFields[field]).length;
  const allVerified = REQUIRED_FIELDS.every((field) => !!verifiedFields[field]);

  // Same to same as AIO's handleNextClick: saves the verified model number,
  // then hands the bid off to the Step 2/2 "General Documents" page
  // (TonerAnalyserDocument.jsx) instead of sending straight to Admin here.
  const handleNextClick = async () => {
    if (!allVerified) return;
    const currentModel = modelInputValue.trim();
    if (!currentModel) {
      alert("Please find/save a Model Number before proceeding.");
      return;
    }
    const saved = await saveModelNumberToDB(currentModel);
    if (!saved) return;

    navigate("/analyser-dashboard/toner/document", {
      state: {
        bidData: {
          ...form,
          id,
          bid_id: id,
          model_number: saved,
          analyser_username: localStorage.getItem("analyser_username") || localStorage.getItem("username") || "",
          verified_fields: Object.keys(verifiedFields).filter((key) => verifiedFields[key]),
        },
      },
    });
  };

  // Same to same as AIO's handleAioGemJobUpload — opens the real GeM login
  // page and queues a tracked upload job.
  const handleTonerGemJobUpload = async () => {
    const gemPortal = window.open("https://sso.gem.gov.in/ARXSSO/oauth/doLogin", "_blank", "noopener,noreferrer");
    const bidId = id || state?.id || state?.bid_id || form?.id || form?.bid_id;
    if (!bidId) {
      setMsg(gemPortal
        ? "GeM login opened. Bid ID was not found, so auto-fill was not queued."
        : "Allow pop-ups for this site to open the GeM login page.");
      return;
    }
    setGemStarting(true);
    setMsg("");
    try {
      const response = await fetch(`${API_BASE}/toner-bids/${bidId}/gem-jobs/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        localStorage.removeItem("token");
        setMsg("GeM login opened. Acxxel auto-fill was not connected for this upload.");
        return;
      }
      if (response.status === 403) {
        setMsg("GeM login opened. Acxxel auto-fill was not connected for this upload.");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Unable to queue GeM upload.");
      setGemJob(data);
      setForm((prev) => ({ ...prev, gem_account: data.account_label, gem_status: data.status, gem_error: "" }));
      if (document.documentElement.dataset.acxxelGemExtension !== "ready") {
        setMsg("Job queued. Complete the upload manually in the GeM tab that just opened.");
      } else {
        setMsg("GeM login opened. Job queued for the extension.");
      }
    } catch (error) {
      setMsg(error.message || "Unable to queue GeM upload.");
    } finally {
      setGemStarting(false);
    }
  };

  const HeaderBackButton = () => (
    <button type="button" onClick={() => navigate(-1)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-200 shadow-sm">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );

  if (loadingBid) {
    return <div className="p-20 text-center text-gray-400 font-medium tracking-widest animate-pulse">LOADING BID DETAILS...</div>;
  }

  if (!form) {
    return (
      <div className="p-20 text-center">
        <div className="text-red-500 font-semibold mb-4">Bid Details Not Found</div>
        {msg && <div className="text-sm text-gray-500 mb-4">{msg}</div>}
        <HeaderBackButton />
      </div>
    );
  }

  const isReAnalyze = form.status === "re-analyze" || form.status === "rejected";
  const isAnalyzed = form.status === "analyzed";
  const isApproved = form.status === "approved";
  const isPending = !isReAnalyze && !isAnalyzed && !isApproved;
  const hasExistingModel = !!form?.model_number && form.model_number.trim() !== "";

  const inputCls = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white";
  const textareaCls = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 bg-white";

  const Select = ({ name, options }) => (
    <select name={name} value={form[name] || ""} onChange={handleChange} disabled={readOnly} className={inputCls}>
      <option value="">Select</option>
      {form[name] && !options.includes(form[name]) && <option value={form[name]}>{form[name]}</option>}
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl pb-10 bg-white">
      <div className="flex items-center justify-between mb-6 pt-2 border-b pb-4">
        <div className="flex items-center gap-4">
          <HeaderBackButton />
          <h5 className="text-xl font-bold text-gray-800">
            {readOnly ? "✅ View Reviewed Toner Bid" : isReAnalyze ? "⚠️ Re-Analyze Toner Bid" : "⏳ Review & Accept Toner Bid"}
          </h5>
        </div>
        {isReAnalyze && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">⚠️ Re-Analyze Required</span>
        )}
        {isPending && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">⏳ Pending</span>
        )}
        {isAnalyzed && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-300">📤 Sent to Admin</span>
        )}
        {isApproved && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">✅ Approved</span>
        )}
      </div>

      {isReAnalyze && form.admin_note && <AdminNoteBanner note={form.admin_note} />}

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded text-sm font-medium ${msg.includes("✅") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{msg}</div>
      )}

      <div
        className={`${isPending
          ? "[&_label]:!font-semibold [&_label]:!text-slate-800 [&_input]:!border-blue-300 [&_input]:!text-slate-900 [&_input]:placeholder:!text-slate-500 [&_select]:!border-blue-300 [&_select]:!text-slate-900 [&_textarea]:!border-blue-300 [&_textarea]:!text-slate-900 [&_textarea]:placeholder:!text-slate-500"
          : ""} ${readOnly && isApproved ? "[&_select]:!appearance-none" : ""}`}
      >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="bid_no" label="Bid Number">
          <input type="text" name="bid_no" value={form.bid_no || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="dept_name" label="Department">
          <input type="text" name="dept_name" value={form.dept_name || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="organization" label="Organization">
          <input type="text" name="organization" value={form.organization || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="qty" label="Quantity">
          <input type="number" name="qty" value={form.qty || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="pincode" label="Buyer Pincode">
          <input type="text" name="pincode" value={form.pincode || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
        </VerifiedInputWrapper>

        <div className="md:col-span-2 lg:col-span-3">
          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="address" label="Address">
            <input type="text" name="address" value={form.address || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>
        </div>

        <div className="md:col-span-2 lg:col-span-3">
          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="atc" label="ATC (Additional Terms & Conditions)">
            <textarea name="atc" value={form.atc || ""} onChange={handleChange} disabled={readOnly} rows={4} className={textareaCls} />
          </VerifiedInputWrapper>
        </div>

        <div className="md:col-span-2 lg:col-span-3">
          <Label>Compliance Documents</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {form.atc_special_document ? (
              <SpecialDocView form={form} />
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
                No Special Document Attached
              </div>
            )}
            <GeneralDocsViewPopup form={form} />
          </div>
        </div>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="brand" label="Brand">
          <Select name="brand" options={BRANDS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="cartridge_type" label="Cartridge Type">
          <Select name="cartridge_type" options={CARTRIDGE_TYPES} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="product_class" label="Product Class">
          <Select name="product_class" options={PRODUCT_CLASSES} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="colour" label="Colour">
          <Select name="colour" options={COLOURS} />
        </VerifiedInputWrapper>

        <div className="md:col-span-2 lg:col-span-3">
          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="compatibility" label="Compatibility">
            <textarea name="compatibility" value={form.compatibility || ""} onChange={handleChange} disabled={readOnly} rows={2} className={textareaCls} />
          </VerifiedInputWrapper>
        </div>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="technology" label="Technology">
          <Select name="technology" options={TECHNOLOGIES} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="page_yield" label="Page Yield">
          <Select name="page_yield" options={PAGE_YIELDS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="yield_standard" label="Yield Standard">
          <Select name="yield_standard" options={YIELD_STANDARDS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="chip" label="Chip">
          <Select name="chip" options={CHIPS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="print_coverage" label="Print Coverage" optional>
          <Select name="print_coverage" options={PRINT_COVERAGES} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="warranty" label="Warranty">
          <Select name="warranty" options={WARRANTIES} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="warranty_type" label="Warranty Type">
          <Select name="warranty_type" options={WARRANTY_TYPES} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="refillable" label="Refillable">
          <Select name="refillable" options={YES_NO} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="qty_per_pack" label="Quantity per Pack">
          <Select name="qty_per_pack" options={QTY_PER_PACKS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="hsn_code" label="HSN Code">
          <input type="text" name="hsn_code" value={form.hsn_code || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="compliance" label="Compliance" optional>
          <Select name="compliance" options={COMPLIANCES} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="replacement_policy" label="Replacement Policy">
          <Select name="replacement_policy" options={REPLACEMENT_POLICIES} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="date" label="Bid End Date">
          <input type="date" name="date" value={form.date || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
        </VerifiedInputWrapper>

        {/* Same to same as AIO's BidDetailView: Total Approved Price only
            shows when opened from the "Transfer Catalogue to GeM" tab. */}
        {showGemUpload && readOnly && isApproved && (
          <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-slate-300 bg-slate-50 p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="block text-sm font-semibold text-slate-800">Total Approved Price</label>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">₹</span>
                <input
                  type="text"
                  value={
                    Number(form?.total_price) > 0
                      ? Number(form.total_price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : ""
                  }
                  readOnly
                  disabled
                  placeholder="0.00"
                  className="w-48 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-right text-lg font-semibold text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {readOnly && isApproved && (
          <div className="md:col-span-2 lg:col-span-3 border border-indigo-200 bg-indigo-50 p-4 rounded-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-indigo-950 mb-1">GeM upload</label>
                <div className="w-full border border-indigo-200 bg-white rounded-md px-3 py-2 text-sm text-slate-700">
                  Manual login in the GeM tab
                </div>
                <p className="text-xs text-indigo-700 mt-2">
                  Status: <span className="font-semibold">{String(form?.gem_status || "not_started").replaceAll("_", " ")}</span>
                  {form?.gem_error ? ` - ${form.gem_error}` : ""}
                  {gemJob?.progress ? ` - ${gemJob.progress}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={handleTonerGemJobUpload}
                disabled={gemStarting}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold px-6 py-2.5 rounded-md text-sm transition"
              >
                Upload to GeM
              </button>
            </div>
          </div>
        )}

      <div className={isPending ? "min-w-0" : "md:col-start-2 md:row-start-3 lg:col-start-3 lg:row-start-2"}>
          <div className={`relative flex items-center gap-2 rounded-lg border p-2 ${isPending ? "w-fit border-blue-300 bg-blue-50/60 shadow-sm" : "w-fit border-gray-300 bg-gray-50"}`}>
            <div className="flex flex-col">
              <label className={`mb-1 text-sm font-bold ${isPending ? "text-blue-900" : "text-gray-700"}`}>Assigned Model</label>
              <input
                type="text"
                name="model_number"
                value={modelInputValue}
                onChange={handleModelInputChange}
                placeholder={readOnly ? "No model assigned" : noMatchFound ? "Enter model number manually..." : "Search model..."}
                disabled={readOnly || modelSearching || showModelResult}
                className={`rounded border px-3 py-1.5 text-sm outline-none w-64 font-semibold focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 ${isPending ? "border-blue-300 bg-white text-slate-900 placeholder:text-slate-500" : "border-gray-300 text-gray-800"}`}
              />
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={noMatchFound ? handleCreateNewModel : handleFindModel}
                disabled={modelSearching || modelSaving || showModelResult}
                className={`mt-4 whitespace-nowrap ${noMatchFound ? "bg-blue-600 hover:bg-blue-700" : isReAnalyze && hasExistingModel ? "bg-amber-600 hover:bg-amber-700" : "bg-slate-700 hover:bg-slate-800"} disabled:bg-slate-400 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm`}
              >
                {modelSaving ? "Saving..." : modelSearching ? "Searching..." : noMatchFound ? "Save Model" : (isReAnalyze && hasExistingModel) ? "Change Model" : "Find Model"}
              </button>
            )}

            {noMatchFound && !readOnly && !showModelResult && (
              <div className="ml-1 w-52 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-800">
                <span className="font-bold">No matching model found.</span>{" "}
                Please create a new model number.
              </div>
            )}

            {readOnly && isReAnalyze && hasExistingModel && (
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                  ✅ Assigned
                </span>
              </div>
            )}

            {showModelResult && !readOnly && (
              <div className="absolute left-0 top-full mt-2 w-[420px] bg-white border border-gray-300 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50">
                  <span className="text-sm font-bold text-gray-700">Catalogue Model</span>
                  <button
                    type="button"
                    onClick={() => { setShowModelResult(false); setNoMatchFound(false); setNewModelInput(""); }}
                    className="text-xs text-red-500 font-semibold hover:text-red-700"
                  >
                    Close ✕
                  </button>
                </div>

                {modelSearching ? (
                  <div className="p-6 text-center">
                    <div className="text-gray-400 text-sm animate-pulse">Searching catalogue for a matching model...</div>
                  </div>
                ) : noMatchFound ? (
                  <div className="p-5">
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      <span className="text-2xl leading-none mt-0.5">⚠️</span>
                      <div>
                        <div className="text-sm font-bold text-amber-800">No 100% accurate model match found</div>
                        <div className="text-xs text-amber-700 mt-0.5">
                          Please recheck your specs or create another bid.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : modelMatches.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="text-sm text-gray-500 font-medium">No model found.</div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                      <span className="text-xl leading-none">✅</span>
                      <div>
                        <div className="text-sm font-bold text-green-800">Model found</div>
                        <div className="text-lg font-extrabold text-blue-700 mt-1">{modelMatches[0].modelNo}</div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => selectModelNumber(modelMatches[0].modelNo)} disabled={modelSaving}
                        className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded font-semibold transition">
                        {modelSaving ? "Saving..." : "Use This Model"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="mt-6 pt-6">
          <div className="mb-10 mt-4 flex gap-3 items-center flex-wrap">
            <button
              type="button"
              disabled={!allVerified || !modelInputValue.trim() || modelSaving}
              onClick={handleNextClick}
              className={`font-semibold px-8 py-2.5 rounded-md text-sm transition flex items-center gap-2 ${
                allVerified && modelInputValue.trim() ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {modelSaving ? (
                "Saving..."
              ) : !allVerified ? (
                <>
                  <span>Next</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-300">
                    {requiredVerifiedCount} / {REQUIRED_FIELDS.length} Verified
                  </span>
                </>
              ) : !modelInputValue.trim() ? (
                <>
                  <span>Next</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-300">
                    Find Model first
                  </span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
            <button type="button" onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-slate-800 hover:text-white hover:border-slate-800 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition-all duration-200 shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Cancel
            </button>
          </div>
        </div>
      )}

      {readOnly && (
        <div className="mb-10 mt-4 flex justify-start">
          <button type="button" onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-slate-800 hover:text-white hover:border-slate-800 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition-all duration-200 shadow-sm">
            Back
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
