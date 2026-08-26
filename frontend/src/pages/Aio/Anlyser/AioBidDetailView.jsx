import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  PROCESSORS,
  DVDS,
  WARRANTIES,
} from "../../Desktop/User/DesktopConfig";
// AIO-native RAM/SSD/HDD/OS/screen-size/WiFi/keyboard/motherboard vocabulary
// (see AioConfig.jsx for why these can't just reuse Desktop's lists) — same
// source used at the User config step, so the Analyser sees the exact same
// option text.
import {
  AIO_RAMS, AIO_SSDS, AIO_HDDS, AIO_OS_OPTIONS, AIO_SCREEN_SIZES, AIO_WIFIS,
  AIO_KEYBOARDS, AIO_MOTHERBOARDS, getFilteredAioRams,
} from "../User/AioConfig";
import { fetchComponentRates } from "../../../utils/componentRates";

const API_BASE = import.meta.env.VITE_API_URL;

const GENERAL_DOCS = [
  { id: "manufacturer_auth", label: "MANUFACTURER AUTHORIZATION CERTIFICATE" },
  { id: "experience_certificate", label: "EXPERIENCE CERTIFICATE" },
  { id: "past_performance", label: "PAST PERFORMANCE" },
  { id: "oem_annual_turnover", label: "OEM ANNUAL TURNOVER" },
  { id: "atc_acceptance_letter", label: "ATC ACCEPTANCE LETTER" },
  { id: "bidder_financial", label: "BIDDER FINANCIAL UNDERSTANDINGS" },
  { id: "non_obsolete", label: "NON OBSOLETE" },
  { id: "non_malicious", label: "NON MALICIOUS CODE" },
  { id: "non_return_hdd", label: "NON RETURN OF HARD DISK" },
  { id: "non_blacklisting", label: "NON BLACKLISTING" },
  { id: "service_support", label: "SERVICE SUPPORT" },
  { id: "ipv6", label: "IPV6" },
  { id: "preloaded_os", label: "PRELOADED OPERATING SYSTEM" },
];

const REQUIRED_FIELDS = [
  "bid_no", "dept_name", "organization", "qty", "pincode", "address", "atc",
  "processor", "ram", "hdd", "ssd", "os", "dvd", "wifi", "screen_size",
  "keyboard", "warranty", "motherboard", "date", "epbg",
  "freightInstallation", "hddreturnable",
];

const CONDITIONAL_VERIFICATION_FIELDS = ["pro_descp", "software1", "gp", "motherboard_descp"];

let liveRateByName = {};
const getPriceFromCatalog = (categoryList, value) => {
  const item = categoryList.find((entry) => entry.name === value);
  return item ? liveRateByName[item.name] ?? item.price : "";
};

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
    const response = await fetch(`${API_BASE}/aio-bids/${form.id}/generate-docs/`, {
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
      // Fetch fresh bytes (bypassing any HTTP/browser cache) and open as a
      // blob URL instead of window.open(pdfUrl) directly — otherwise a
      // previously-viewed doc_type at a stale URL can render cached content
      // in the new tab even though the server just generated fresh output.
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

export default function AioBidDetailView() {
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
    fetchComponentRates("aio").then((rates) => {
      liveRateByName = Object.fromEntries(rates.map((rate) => [rate.name, Number(rate.price)]));
    }).catch((error) => console.error("Component rates:", error));
  }, []);

  useEffect(() => {
    fetchBid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same to same as Desktop's job-status poll (BidDetailView.jsx) — only
  // runs when opened from the "Transfer Catalogue to GeM" tab on an approved
  // bid, refreshing the upload job's status every 5s.
  useEffect(() => {
    if (!showGemUpload || !readOnly || !form?.id || form?.status !== "approved") return undefined;
    let stopped = false;
    const loadJob = async () => {
      const response = await fetch(`${API_BASE}/gem/aio-jobs/?bid_id=${form.id}`, {
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
        const res = await fetch(`${API_BASE}/aio-bids/${bidId}/`);
        if (!res.ok) throw new Error("Failed to fetch bid");
        data = await res.json();
      }
      setForm(data);
      // Same to same as Desktop's shouldShowSavedModelInput: only pre-fill the
      // Assigned Model box for a bid that already went through Find Model once
      // (viewing read-only, already analyzed/approved, or back for
      // re-analysis) — a fresh pending bid always starts with an empty box so
      // the analyser has to actually run Find Model, not see stale text.
      const shouldShowSavedModel = readOnly || ["analyzed", "approved", "re-analyze", "rejected"].includes(data.status);
      setModelInputValue(shouldShowSavedModel ? data.model_number || "" : "");
      // Same to same as Desktop's BidDetailView: verifiedFields is never
      // restored from the saved bid on load, even for re-analyze — the
      // analyser has to actually re-tick every checkbox again, not see them
      // all pre-checked from the previous pass.
    } catch {
      setMsg("Error: Unable to load bid data.");
    } finally {
      setLoadingBid(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const optionLists = {
      processor: PROCESSORS, ram: AIO_RAMS, hdd: AIO_HDDS, ssd: AIO_SSDS, os: AIO_OS_OPTIONS,
      dvd: DVDS, wifi: AIO_WIFIS, screen_size: AIO_SCREEN_SIZES, keyboard: AIO_KEYBOARDS,
      warranty: WARRANTIES, motherboard: AIO_MOTHERBOARDS,
    };

    setForm((prev) => {
      const next = { ...prev, [name]: value };
      const options = optionLists[name];
      const priceField = name === "screen_size" ? "screen_price" : `${name}_price`;
      if (options) {
        next[priceField] = value === "None" ? "" : getPriceFromCatalog(options, value);
      }
      return next;
    });
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
    setShowModelResult(true);
    setNoMatchFound(false);
    setNewModelInput("");
    try {
      const res = await fetch(`${API_BASE}/aio-bids/${id}/match-catalogue/`, {
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
        return;
      }
      setModelMatches([{ modelNo: item.model_no, product_id: item.product_id }]);
      setNoMatchFound(false);
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
      const res = await fetch(`${API_BASE}/aio-bids/${id}/save-model-number/`, {
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
      // AioBid stores the model across two DB fields (model_no + model,
      // concatenated into the model_number the API returns) — updating only
      // the synthetic model_number here left form.model/form.model_no stale.
      // handleNextClick later spreads the whole form into the /review/ POST,
      // and the backend's _assign() blindly re-applies every whitelisted
      // field, so those stale values silently wiped the model back to the
      // "AXL-AIO000-" default the moment the bid reached Admin — same root
      // cause behind Admin's model box and Transfer-to-GeM tab being empty.
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
    const trimmed = newModelInput.trim();
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

  const conditionalRequiredFields = CONDITIONAL_VERIFICATION_FIELDS.filter(
    (field) => String(form?.[field] ?? "").trim() !== ""
  );
  const activeRequiredFields = [...REQUIRED_FIELDS, ...conditionalRequiredFields];
  const requiredVerifiedCount = activeRequiredFields.filter((field) => !!verifiedFields[field]).length;
  const allVerified = activeRequiredFields.every((field) => !!verifiedFields[field]);

  // Same to same as Desktop's handleNextClick (BidDetailView.jsx): saves the
  // verified model number, then hands the bid off to the Step 2/2 "General
  // Documents" page (AioAnalyserDocument.jsx) instead of sending straight to
  // Admin from here — Warranty/Technical Compliance/Data Sheet are generated
  // on that page, matching Desktop's Analyserdocument.jsx.
  const handleNextClick = async () => {
    if (!allVerified) return;
    const currentModel = modelInputValue.trim();
    if (!currentModel) {
      alert("Please find/save a Model Number before proceeding.");
      return;
    }
    const saved = await saveModelNumberToDB(currentModel);
    if (!saved) return;

    navigate("/analyser-dashboard/aio/document", {
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

  // Same to same as Desktop's handleGemJobUpload — opens the real GeM login
  // page and queues a tracked upload job. If the Acxxel GeM extension is
  // loaded it also dispatches the same bridge events Desktop's does, but the
  // extension doesn't yet recognize the "aio_gem_upload" workflow, so it will
  // just leave the job queued for manual completion until it's updated —
  // exactly the same graceful fallback Desktop shows when its own extension
  // isn't loaded.
  const handleAioGemJobUpload = async () => {
    const gemPortal = window.open("https://mkp.gem.gov.in/login", "_blank", "noopener,noreferrer");
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
      const response = await fetch(`${API_BASE}/aio-bids/${bidId}/gem-jobs/`, {
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
  const flexInputCls = "flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100";
  const priceCls = "w-20 shrink-0 border border-gray-200 rounded-md px-1 py-2 text-xs text-center text-gray-500 bg-gray-50 cursor-not-allowed";
  const textareaCls = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 bg-white";

  const PriceSelect = ({ name, options, hideNone }) => {
    const priceField = name === "screen_size" ? "screen_price" : `${name}_price`;
    return (
      <div className="flex w-full min-w-0 gap-2">
        <select name={name} value={form[name] || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls}>
          <option value="">Select</option>
          {options.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
          {!hideNone && <option value="None">None</option>}
        </select>
        <input type="text" value={form[priceField] || ""} readOnly disabled placeholder="Price" className={priceCls} />
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl pb-10">
      <div className="flex items-center justify-between mb-6 pt-2 border-b pb-4">
        <div className="flex items-center gap-4">
          <HeaderBackButton />
          <h5 className="text-xl font-bold text-gray-800">
            {readOnly ? "✅ View Reviewed AIO Bid" : isReAnalyze ? "⚠️ Re-Analyze AIO Bid" : "⏳ Review & Accept AIO Bid"}
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

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="processor" label="Processor">
          <PriceSelect name="processor" options={PROCESSORS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="ram" label="RAM">
          <PriceSelect name="ram" options={getFilteredAioRams(form.processor)} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="hdd" label="Hard Disk Drive">
          <PriceSelect name="hdd" options={AIO_HDDS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="ssd" label="Solid State Drive">
          <PriceSelect name="ssd" options={AIO_SSDS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="os" label="Operating System">
          <PriceSelect name="os" options={AIO_OS_OPTIONS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="dvd" label="DVD">
          <PriceSelect name="dvd" options={DVDS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="wifi" label="WiFi Bluetooth">
          <PriceSelect name="wifi" options={AIO_WIFIS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="screen_size" label="Screen Size">
          <PriceSelect name="screen_size" options={AIO_SCREEN_SIZES} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="keyboard" label="Keyboard & Mouse">
          <PriceSelect name="keyboard" options={AIO_KEYBOARDS} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="warranty" label="Warranty">
          <PriceSelect name="warranty" options={WARRANTIES} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="motherboard" label="Motherboard">
          <PriceSelect name="motherboard" options={AIO_MOTHERBOARDS} hideNone />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="pro_descp" label="Processor Description" optional required={conditionalRequiredFields.includes("pro_descp")}>
          <textarea name="pro_descp" value={form.pro_descp || ""} onChange={handleChange} disabled={readOnly} rows={2} className={textareaCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="software1" label="Additional Software" optional required={conditionalRequiredFields.includes("software1")}>
          <textarea name="software1" value={form.software1 || ""} onChange={handleChange} disabled={readOnly} rows={2} className={textareaCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="gp" label="Graphics Description" optional required={conditionalRequiredFields.includes("gp")}>
          <textarea name="gp" value={form.gp || ""} onChange={handleChange} disabled={readOnly} rows={2} className={textareaCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="motherboard_descp" label="Motherboard Description" optional required={conditionalRequiredFields.includes("motherboard_descp")}>
          <textarea name="motherboard_descp" value={form.motherboard_descp || ""} onChange={handleChange} disabled={readOnly} rows={2} className={textareaCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="date" label="Bid End Date">
          <input type="date" name="date" value={form.date || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="epbg" label="EPBG (%)">
          <input type="text" name="epbg" value={form.epbg ?? ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="freightInstallation" label="Freight & Installation">
          <div className="flex gap-2">
            <select name="freightInstallation" value={form.freightInstallation || "Yes"} onChange={handleChange} disabled={readOnly} className={inputCls}>
              <option>Yes</option>
              <option>No</option>
            </select>
            <input type="text" name="freightInstallation_price" value={form.freightInstallation_price ?? ""} onChange={handleChange} disabled={readOnly} placeholder="Price" className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white" />
          </div>
        </VerifiedInputWrapper>

        <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="hddreturnable" label="HDD Return Option">
          <div className="flex gap-2">
            <select name="hddreturnable" value={form.hddreturnable || "Yes"} onChange={handleChange} disabled={readOnly} className={inputCls}>
              <option>Yes</option>
              <option>No</option>
            </select>
            <input type="text" name="hddreturnable_price" value={form.hddreturnable_price ?? ""} onChange={handleChange} disabled={readOnly} placeholder="Price" className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white" />
          </div>
        </VerifiedInputWrapper>

        {/* Same to same as Desktop's BidDetailView: Total Approved Price only
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
                onClick={handleAioGemJobUpload}
                disabled={gemStarting}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold px-6 py-2.5 rounded-md text-sm transition"
              >
                Upload to GeM
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Same to same as Desktop's BidDetailView: this box always renders
          (readOnly just disables the input and hides Find Model) — it was
          previously wrapped in `!readOnly &&`, which hid the Assigned Model
          box entirely on the read-only "Transfer Catalogue to GeM" view. */}
      <div className="mt-8">
          <div className="relative flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-300 w-fit">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Assigned Model</label>
              <input
                type="text"
                name="model_number"
                value={modelInputValue}
                onChange={handleModelInputChange}
                placeholder={readOnly ? "No model assigned" : "Search model..."}
                disabled={readOnly}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none w-64 font-semibold disabled:bg-gray-100 disabled:text-gray-600"
              />
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={handleFindModel}
                disabled={modelSearching || modelSaving}
                className={`mt-4 ${isReAnalyze && hasExistingModel ? "bg-amber-600 hover:bg-amber-700" : "bg-slate-700 hover:bg-slate-800"} disabled:bg-slate-400 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm`}
              >
                {modelSearching ? "Searching..." : (isReAnalyze && hasExistingModel) ? "Change Model" : "Find Model"}
              </button>
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
                  <span className="text-sm font-bold text-gray-700">AIO Catalogue Model</span>
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
                    <div className="text-gray-400 text-sm animate-pulse">Searching aio_specs catalogue for a matching model...</div>
                  </div>
                ) : noMatchFound ? (
                  <div className="p-5">
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      <span className="text-2xl leading-none mt-0.5">⚠️</span>
                      <div>
                        <div className="text-sm font-bold text-amber-800">No exact matching model found</div>
                        <div className="text-xs text-amber-700 mt-0.5">
                          You can create a new model number and save it as the Assigned Model.
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newModelInput}
                        onChange={(e) => setNewModelInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !modelSaving) handleCreateNewModel(); }}
                        placeholder="Create new model number..."
                        autoFocus
                        className="flex-1 border border-blue-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                      <button type="button" onClick={handleCreateNewModel} disabled={modelSaving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md text-sm font-bold transition shadow-sm whitespace-nowrap">
                        {modelSaving ? "Saving..." : "Save"}
                      </button>
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

      {!readOnly && (
        <div className="mt-6 pt-6">
          {/* Same to same as Desktop's BidDetailView: Next first, then
              Cancel, left-aligned — Desktop's step 1 has no Reject button at
              all (only Admin can reject/re-analyze a bid). */}
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
                    {requiredVerifiedCount} / {activeRequiredFields.length} Verified
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
  );
}
