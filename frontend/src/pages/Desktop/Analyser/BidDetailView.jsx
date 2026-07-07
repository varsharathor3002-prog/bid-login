import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const API_BASE = "https://acxxelbidding.com/api";

const REVIEW_API = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/review/`,
};

const FETCH_API = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/`,
};

const MATCH_API = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/match-catalogue/`,
};

const SAVE_MODEL_API = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/save-model-number/`,
};

const GENERAL_DOCS = [
  { id: "manufacturer_auth", label: "MANUFACTURER AUTHORIZATION CERTIFICATE" },
  { id: "make_in_india", label: "MAKE IN INDIA" },
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

const REQUIRED_FIELDS = [
  "bid_no", "dept_name", "organization", "qty", "pincode",
  "address", "atc", "processor", "ram", "hdd", "ssd1", "ssd2",
  "os", "dvd", "wifi", "monitor", "cabinet", "keyboard",
  "warranty", "motherboard", "date", "epbg",
  "freightInstallation", "hddreturnable", 
];

const Label = ({ children, optional }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {optional && (
      <span className="text-red-500 text-[11px] font-normal ml-1">*Optional</span>
    )}
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
        <p className="text-rose-900 text-sm leading-relaxed whitespace-pre-wrap font-medium">
          {note}
        </p>
      </div>
    </div>
  );
};

function GeneralDocsViewPopup({ form }) {
  const [open, setOpen] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState({});
  const [downloadingDocs, setDownloadingDocs] = useState({});

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
      : selectedLabels.map((label, index) => ({
          id: `label_${index}`,
          label,
          viewable: false,
        }));

  const uploadedCount = fallbackDocs.length;

  const getGeneratedPdfUrl = async (docId) => {
    if (!form?.id) throw new Error("Bid ID not found.");
    if (!docId || docId.startsWith("label_")) throw new Error("Document preview is not available for this item.");

    const response = await fetch(`${API_BASE}/desktop-bids/${form.id}/generate-docs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        doc_type: docId,
        optional_ports: form?.optional_ports || "",
      }),
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
      const safeLabel = String(doc.label || doc.id).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/^ +|_+$/g, " ");
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
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group ${
          open ? "bg-orange-50 border-orange-500 ring-1 ring-orange-500" : "bg-white border-gray-200 hover:border-orange-400 hover:shadow-md"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${open ? "bg-orange-200 text-orange-700" : "bg-orange-100 text-orange-600 group-hover:bg-orange-200"}`}>
            📁
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-800">General Documents</div>
            <div className="text-xs text-gray-500">
              {uploadedCount > 0 ? "Click to view selected documents" : "No documents selected"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            uploadedCount === GENERAL_DOCS.length ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
          }`}>
            {uploadedCount}/{GENERAL_DOCS.length} Files
          </span>
        </div>
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
              {fallbackDocs.length > 0 ? (
                fallbackDocs.map((doc) => {
                  const isGenerating = !!generatingDocs[doc.id];
                  const isDownloading = !!downloadingDocs[doc.id];
                  const disabled = doc.viewable === false || isGenerating || isDownloading;
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

function SpecialDocView({ form }) {
  const url = form?.atc_special_document;
  if (!url) return null;

  const fullUrl = url.startsWith("http") ? url : `https://acxxelbidding.com${url}`;
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

const VerifiedInputWrapper = ({ name, children, label, optional, verifiedFields, readOnly, toggleVerification }) => {
  const isVerified = !!verifiedFields[name];
  const isRequired = REQUIRED_FIELDS.includes(name);

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
      <div className={`transition-all duration-200 ${isVerified ? "ring-1 ring-green-500 rounded-md bg-green-50/50" : ""}`}>
        {children}
      </div>
    </div>
  );
};

export default function BidDetailView({ product = "desktop" }) {
  const { state } = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();
  const readOnly = state?.readOnly || false;

  const [form, setForm] = useState(null);
  const [loadingBid, setLoadingBid] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [verifiedFields, setVerifiedFields] = useState({});

  const [modelSearching, setModelSearching] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelMatches, setModelMatches] = useState([]);
  const [showModelResult, setShowModelResult] = useState(false);
  const [noMatchFound, setNoMatchFound] = useState(false);
  const [newModelInput, setNewModelInput] = useState("");
  const [modelInputValue, setModelInputValue] = useState("");

  useEffect(() => {
    fetchBid();
  }, []);

  const normalizeDocUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `https://acxxelbidding.com${url}`;
  };

  const normalizeBid = (bid) => {
    const normalized = { ...bid };
    normalized.atc_special_document = normalizeDocUrl(bid.atc_special_document || "");
    normalized.selected_general_docs = Array.isArray(bid.selected_general_docs) ? bid.selected_general_docs : [];
    normalized.selected_general_doc_labels = Array.isArray(bid.selected_general_doc_labels) ? bid.selected_general_doc_labels : [];
    normalized.ssd1 = bid.ssd1 || bid.ssd || "";
    normalized.ssd1_price = bid.ssd1_price || bid.ssd_price || "";

    normalized.freightInstallation = bid.freightInstallation || "Yes";
    normalized.hddreturnable = bid.hddreturnable || "Yes";
    // Agar "No" hai toh price hamesha 0, warna DB value ya default 1000
    normalized.freightInstallation_price =
      normalized.freightInstallation === "No"
        ? "0"
        : bid.freightInstallation_price !== undefined && bid.freightInstallation_price !== null && bid.freightInstallation_price !== ""
          ? String(bid.freightInstallation_price)
          : "1000";

    normalized.model_number = bid.model_number || bid.model || bid.model_no || "";
    return normalized;
  };

  const shouldShowSavedModelInput = (bid) => {
    const status = bid?.status;
    const reviewStatus = bid?.review_status;
    return (
      readOnly ||
      status === "reviewed" ||
      reviewStatus === "reviewed" ||
      reviewStatus === "approved" ||
      status === "re-analyze" ||
      status === "re_analyze" ||
      reviewStatus === "re-analyze"
    );
  };

  const fetchBid = async () => {
    setLoadingBid(true);
    setMsg("");
    try {
      if (state?.bid) {
        const normalizedData = normalizeBid(state.bid);
        setForm(normalizedData);
        setModelInputValue(shouldShowSavedModelInput(state.bid) ? normalizedData.model_number || "" : "");
        setLoadingBid(false);
        return;
      }

      const bidId = id || state?.id || state?.bid_id;
      if (!bidId) {
        setMsg("Bid ID not found.");
        setLoadingBid(false);
        return;
      }

      const res = await fetch(FETCH_API[product](bidId));
      if (!res.ok) throw new Error("Failed to fetch bid");
      const data = await res.json();
      const normalizedData = normalizeBid(data);
      setForm(normalizedData);
      
      setModelInputValue(shouldShowSavedModelInput(data) ? normalizedData.model_number || "" : "");
    } catch (error) {
      console.log(error);
      setMsg("Error: Unable to load bid data.");
    } finally {
      setLoadingBid(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleModelInputChange = (e) => {
    const val = e.target.value;
    setModelInputValue(val);
    setForm((prev) => ({ ...prev, model_number: val }));
  };

  const toggleVerification = (fieldName) => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    setVerifiedFields((prev) => {
      const newState = { ...prev, [fieldName]: !prev[fieldName] };
      return newState;
    });
    requestAnimationFrame(() => { window.scrollTo(scrollX, scrollY); });
  };

  const handleFindModel = async () => {
    if (!form) return;

    const bidId = id || state?.id || state?.bid_id || form?.id || form?.bid_id;
    if (!bidId) {
      alert("Bid ID not found.");
      return;
    }

    setModelSearching(true);
    setModelMatches([]);
    setShowModelResult(true);
    setNoMatchFound(false);
    setNewModelInput("");

    const matchPayload = {
      ...form,

      // Backend ko current screen values bhejna zaroori hai.
      // SSD2 ko backend ignore karega; SSD matching sirf SSD1 se hogi.
      ssd: form?.ssd1 || form?.ssd || "",
      ssd1: form?.ssd1 || form?.ssd || "",
      ssd_price: form?.ssd1_price || form?.ssd_price || "",
      ssd1_price: form?.ssd1_price || form?.ssd_price || "",

      // None fields ko clear/normal form me bhej rahe hain taaki backend mismatch na kare.
      hdd: form?.hdd || "None",
      dvd: form?.dvd || "None",
      wifi: form?.wifi || "None",

      // These fields are bid/admin specific; backend should ignore them for model matching.
      date: form?.date || "",
      epbg: form?.epbg || "",
      freightInstallation: form?.freightInstallation || "",
      hddreturnable: form?.hddreturnable || "",
      optional_ports: form?.optional_ports || "",
    };

    try {
      const res = await fetch(MATCH_API[product](bidId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchPayload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Server error — unable to find a matching model.");
        return;
      }

      const item = data.match || data.matches?.[0] || null;

      if (!item?.model_no) {
        setModelMatches([]);
        setNoMatchFound(true);

        // Debug help: backend agar best_failed_match bhejta hai to console me dikhega.
        if (data.best_failed_match) {
          console.log("Best failed catalogue match:", data.best_failed_match);
        }
        return;
      }

      const singleModel = {
        modelNo: item.model_no,
        product_id: item.product_id,
        category: item.category,
      };

      setModelMatches([singleModel]);
      setNoMatchFound(false);
    } catch (error) {
      console.error(error);
      alert("Network error — unable to connect to the server.");
    } finally {
      setModelSearching(false);
    }
  };

  const saveModelNumberToDB = async (modelNo) => {
    const bidId = id || state?.id || state?.bid_id || form?.id || form?.bid_id;
    if (!bidId) { alert("Bid ID not found."); return null; }
    const trimmedModelNo = String(modelNo || "").trim();
    if (!trimmedModelNo) { alert("Model number required."); return null; }

    setModelSaving(true);
    try {
      const res = await fetch(SAVE_MODEL_API[product](bidId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_number: trimmedModelNo,
          model: trimmedModelNo,
          model_no: trimmedModelNo,
          modelNo: trimmedModelNo,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || "Model number save failed."); return null; }

      const savedModel = data.model_number || trimmedModelNo;
      const updatedFormData = {
        ...form,
        model_number: savedModel,
        model: data.model || savedModel,
        status: data.status || form?.status,
        review_status: data.review_status || form?.review_status,
      };

      setModelInputValue(savedModel);
      setForm(updatedFormData);
      setMsg("Model number saved successfully ✅");
      return updatedFormData;
    } catch (error) {
      console.error(error);
      alert("Server error — unable to save model number.");
      return null;
    } finally {
      setModelSaving(false);
    }
  };

  const selectModelNumber = async (modelNo) => {
    const updatedData = await saveModelNumberToDB(modelNo);
    if (!updatedData) return;
    setShowModelResult(false);
    setNoMatchFound(false);
    setNewModelInput("");
  };

  const handleCreateNewModel = async () => {
    const trimmed = newModelInput.trim();
    if (!trimmed) { alert("Please enter a model number."); return; }
    const updatedData = await saveModelNumberToDB(trimmed);
    if (!updatedData) return;
    setShowModelResult(false);
    setNoMatchFound(false);
    setNewModelInput("");
  };

  const handleNextClick = async () => {
    if (!allVerified) return;
    const currentModel = modelInputValue.trim();
    if (!currentModel) {
      alert("Please save a Model Number before proceeding.");
      return;
    }

    const updatedBidData = await saveModelNumberToDB(currentModel);
    if (!updatedBidData) return;

    const finalBidId =
      updatedBidData.id || id || state?.id || state?.bid_id || form?.id;

    const snapshot = { ...form }; // form ka snapshot — re-render se safe

    const payload = {
      ...snapshot,
      model_number: currentModel,
      ssd: snapshot.ssd1,
      ssd_price: snapshot.ssd1_price,
      freightInstallation: snapshot.freightInstallation || "Yes",
      freightInstallation_price:
        (snapshot.freightInstallation || "Yes") === "No"
          ? 0
          : snapshot.freightInstallation_price !== "" && snapshot.freightInstallation_price !== undefined
            ? parseFloat(snapshot.freightInstallation_price) || 0
            : 0,
      hddreturnable: snapshot.hddreturnable || "Yes",
      optional_ports: snapshot.optional_ports || "",
      status: "reviewed",
      analyser_username: localStorage.getItem("username") || "",
    };

    try {
      await fetch(REVIEW_API[product](finalBidId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Error saving bid specs:", err);
    }

    navigate("/analyser-document", {
      state: {
        bidData: { ...updatedBidData, ...payload, id: finalBidId, bid_id: finalBidId },
      },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form) { setMsg("Bid details not found."); return; }

    const finalBidId = id || state?.id || state?.bid_id || form?.id || form?.bid_id;
    if (!finalBidId) { setMsg("Bid ID not found. Data could not be saved."); return; }

    setSubmitting(true);
    setMsg("");
    try {
      const payload = {
        ...form,
        ssd: form?.ssd1,
        ssd_price: form?.ssd1_price,
        freightInstallation: form?.freightInstallation || "Yes",
        freightInstallation_price:
          (form?.freightInstallation || "Yes") === "No"
            ? 0
            : form?.freightInstallation_price !== "" && form?.freightInstallation_price !== undefined
              ? parseFloat(form?.freightInstallation_price) || 0
              : 0,
        optional_ports: form?.optional_ports || "",
        status: "reviewed",
        analyser_username: localStorage.getItem("username") || "",
      };

      const res = await fetch(REVIEW_API[product](finalBidId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setMsg("Bid reviewed successfully and forwarded to Admin ✅");
        setForm((prev) => ({ ...prev, status: "reviewed", review_status: "reviewed" }));
        setTimeout(() => navigate("/analyser-dashboard/desktop"), 1200);
      } else {
        setMsg(data.error || "Data Save Failed");
      }
    } catch {
      setMsg("Server error — unable to save bid data.");
    } finally {
      setSubmitting(false);
    }
  };

  const requiredVerifiedCount = REQUIRED_FIELDS.filter((f) => !!verifiedFields[f]).length;
  const allVerified = REQUIRED_FIELDS.every((f) => !!verifiedFields[f]);

  const HeaderBackButton = () => (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-200 shadow-sm"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );

  if (loadingBid) {
    return (
      <div className="p-20 text-center text-gray-400 font-medium tracking-widest animate-pulse">
        LOADING BID DETAILS...
      </div>
    );
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

  const isReAnalyze = form?.status === "re-analyze" || form?.status === "re_analyze" || form?.review_status === "re-analyze";
  const isReviewed = form?.status === "reviewed" || form?.review_status === "reviewed";
  const isPending = !isReAnalyze && !isReviewed;
  const hasExistingModel = !!form?.model_number && form.model_number.trim() !== "";

  const inputCls     = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white";
  const flexInputCls = "flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100";
  const priceCls     = "w-20 border border-gray-200 rounded-md px-1 py-2 text-xs text-center text-gray-500 bg-gray-50 cursor-not-allowed";
  const textareaCls  = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 bg-white";

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl pb-10">
      <div className="flex items-center justify-between mb-6 pt-2 border-b pb-4">
        <div className="flex items-center gap-4">
          <HeaderBackButton />
          <h5 className="text-xl font-bold text-gray-800">
            {readOnly
              ? "✅ View Reviewed Desktop Bid"
              : isReAnalyze
              ? "⚠️ Re-Analyze Desktop Bid"
              : "⏳ Review & Accept Desktop Bid"}
          </h5>
        </div>
        {isReAnalyze && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">
            ⚠️ Re-Analyze Required
          </span>
        )}
        {isPending && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
            ⏳ Pending
          </span>
        )}
        {readOnly && isReviewed && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
            ✅ Reviewed
          </span>
        )}
      </div>

      {isReAnalyze && form?.admin_note && <AdminNoteBanner note={form.admin_note} />}

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded text-sm font-medium ${msg.includes("✅") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {msg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="bid_no" label="Bid Number">
            <input type="text" name="bid_no" value={form?.bid_no || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="dept_name" label="Department">
            <input type="text" name="dept_name" value={form?.dept_name || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="organization" label="Organization">
            <input type="text" name="organization" value={form?.organization || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="qty" label="Quantity">
            <input type="number" name="qty" value={form?.qty || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="pincode" label="Pincode">
            <input type="text" name="pincode" value={form?.pincode || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <div className="md:col-span-2 lg:col-span-3">
            <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="address" label="Address">
              <input type="text" name="address" value={form?.address || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
            </VerifiedInputWrapper>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="atc" label="ATC (Additional Terms & Conditions)">
              <textarea name="atc" value={form?.atc || ""} onChange={handleChange} disabled={readOnly} rows={4} className={textareaCls} />
            </VerifiedInputWrapper>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <Label>Compliance Documents</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {form?.atc_special_document ? (
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
            <div className="flex gap-2">
              <input type="text" name="processor" value={form?.processor || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.processor_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="ram" label="RAM">
            <div className="flex gap-2">
              <input type="text" name="ram" value={form?.ram || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.ram_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="hdd" label="Hard Disk Drive">
            <div className="flex gap-2">
              <input type="text" name="hdd" value={form?.hdd || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.hdd_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="ssd1" label="Solid State Drive 1">
            <div className="flex gap-2">
              <input type="text" name="ssd1" value={form?.ssd1 || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.ssd1_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="ssd2" label="Solid State Drive 2">
            <div className="flex gap-2">
              <input type="text" name="ssd2" value={form?.ssd2 || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.ssd2_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="os" label="OS">
            <div className="flex gap-2">
              <input type="text" name="os" value={form?.os || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.os_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="dvd" label="DVD">
            <div className="flex gap-2">
              <input type="text" name="dvd" value={form?.dvd || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.dvd_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="wifi" label="WiFi Bluetooth">
            <div className="flex gap-2">
              <input type="text" name="wifi" value={form?.wifi || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.wifi_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="monitor" label="Monitor">
            <div className="flex gap-2">
              <input type="text" name="monitor" value={form?.monitor || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.monitor_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="cabinet" label="Cabinet">
            <div className="flex gap-2">
              <input type="text" name="cabinet" value={form?.cabinet || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.cabinet_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="keyboard" label="Keyboard & Mouse">
            <div className="flex gap-2">
              <input type="text" name="keyboard" value={form?.keyboard || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.keyboard_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="warranty" label="Warranty">
            <div className="flex gap-2">
              <input type="text" name="warranty" value={form?.warranty || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.warranty_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="motherboard" label="Motherboard">
            <div className="flex gap-2">
              <input type="text" name="motherboard" value={form?.motherboard || ""} onChange={handleChange} disabled={readOnly} className={flexInputCls} />
              <input type="text" value={form?.motherboard_price || ""} readOnly disabled placeholder="Price" className={priceCls} />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="pro_descp" label="Processor Description" optional>
            <textarea name="pro_descp" value={form?.pro_descp || ""} onChange={handleChange} disabled={readOnly} rows={2} className={textareaCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="software1" label="Additional Software" optional>
            <textarea name="software1" value={form?.software1 || ""} onChange={handleChange} disabled={readOnly} rows={2} className={textareaCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="gp" label="Graphics Description" optional>
            <textarea name="gp" value={form?.gp || ""} onChange={handleChange} disabled={readOnly} rows={2} className={textareaCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="motherboard_descp" label="Motherboard Description" optional>
            <textarea name="motherboard_descp" value={form?.motherboard_descp || ""} onChange={handleChange} disabled={readOnly} rows={2} className={textareaCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="date" label="Bid End Date">
            <input type="date" name="date" value={form?.date || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="epbg" label="EPBG (%)">
            <input type="text" name="epbg" value={form?.epbg || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="freightInstallation" label="Freight & Installation">
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex gap-2">
                <select 
                  name="freightInstallation" 
                  value={form?.freightInstallation ?? "Yes"} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      freightInstallation: val,
                      freightInstallation_price: val === "No" ? 0 : prev.freightInstallation_price,
                    }));
                  }}
                  disabled={readOnly}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                <input 
                  type="number" 
                  name="freightInstallation_price" 
                  value={form?.freightInstallation_price ?? ""} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((prev) => ({ ...prev, freightInstallation_price: val }));
                  }}
                  disabled={readOnly || (form?.freightInstallation ?? "Yes") === "No"}
                  placeholder="Enter Amount"
                  className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                />
              </div>
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="hddreturnable" label="HDD Return Option">
            <div className="flex gap-2">
              <select name="hddreturnable" value={form?.hddreturnable || "Yes"} onChange={handleChange} disabled={readOnly}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white">
                <option value="Yes">Yes</option>
                <option value="None">None</option>
              </select>
              <input type="text" name="hddreturnable_price" value={form?.hddreturnable_price || ""} onChange={handleChange} disabled={readOnly}
                placeholder="Price" className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white" />
            </div>
          </VerifiedInputWrapper>

          {/* Optional Ports (single field) */}
          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="optional_ports" label="Optional Ports" optional>
            <textarea name="optional_ports" value={form?.optional_ports || ""} onChange={handleChange} disabled={readOnly} rows={2} className={textareaCls} placeholder="e.g. Serial Port, Display Port, USB Type-C" />
          </VerifiedInputWrapper>
        </div>

        <div className="mt-8 mb-4">
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
                className={`mt-4 ${isReAnalyze && hasExistingModel ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-700 hover:bg-slate-800'} disabled:bg-slate-400 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm`}
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
                        {modelMatches[0].category && (
                          <div className="text-xs text-gray-500 mt-1">{modelMatches[0].category}</div>
                        )}
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

        <div className="mb-10 flex gap-3 items-center flex-wrap">
          {!readOnly && (
            <button
              type="button"
              disabled={!allVerified || submitting || modelSaving}
              onClick={handleNextClick}
              className={`font-semibold px-8 py-2.5 rounded-md text-sm transition flex items-center gap-2 ${
                allVerified ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {!allVerified ? (
                <>
                  <span>Next</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-300">
                    {requiredVerifiedCount} / {REQUIRED_FIELDS.length} Verified
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
          )}

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-slate-800 hover:text-white hover:border-slate-800 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition-all duration-200 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            {readOnly ? "Back" : "Cancel"}
          </button>
        </div>
      </form>
    </div>
  );
}