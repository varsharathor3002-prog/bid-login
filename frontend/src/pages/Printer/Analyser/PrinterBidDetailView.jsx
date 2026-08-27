import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import printerOm052 from "../../../assets/OMO52.png";
import printerOm271 from "../../../assets/OM271.png";
import printerOm050 from "../../../assets/OMO50.png";
import printerOm035 from "../../../assets/OMO35.png";
import printerOm010 from "../../../assets/OMO10.png";
import printerOm235 from "../../../assets/OM235.png";
import printerOm249 from "../../../assets/OM249.png";
import printerOm221 from "../../../assets/OM221.png";
import printerOm240 from "../../../assets/OM240.png";

const API_BASE = import.meta.env.VITE_API_URL;

const FETCH_API = (id) => `${API_BASE}/printer-bids/${id}/`;
const REVIEW_API = (id) => `${API_BASE}/printer-bids/${id}/review/`;
const DOCS_API = (id) => `${API_BASE}/printer-bids/${id}/update-docs/`;
const MATCH_API = (id) => `${API_BASE}/printer-bids/${id}/match-catalogue/`;
const SAVE_MODEL_API = (id) => `${API_BASE}/printer-bids/${id}/save-model-number/`;

const PRINTER_MODEL_IMAGES = {
  OM052: printerOm052,
  OM271: printerOm271,
  OM050: printerOm050,
  OM035: printerOm035,
  OM010: printerOm010,
  OM235: printerOm235,
  OM249: printerOm249,
  OM221: printerOm221,
  OM240: printerOm240,
};

const GENERAL_DOCS = [
  { id: "manufacturer_auth", label: "MANUFACTURER AUTHORIZATION CERTIFICATE" },
  { id: "experience_certificate", label: "EXPERIENCE CERTIFICATE" },
  { id: "past_performance", label: "PAST PERFORMANCE" },
  { id: "oem_annual_turnover", label: "OEM ANNUAL TURNOVER" },
  { id: "atc_acceptance_letter", label: "ATC ACCEPTANCE LETTER" },
  { id: "make_in_india", label: "MAKE IN INDIA" },
  { id: "bidder_financial", label: "BIDDER FINANCIAL STANDING" },
  { id: "non_obsolete", label: "NON OBSOLETE" },
  { id: "non_malicious", label: "NON MALICIOUS CODE" },
  { id: "non_blacklisting", label: "NON BLACKLISTING" },
  { id: "service_support", label: "SERVICE SUPPORT" },
  { id: "ipv6", label: "IPV6" },
  { id: "preloaded_os", label: "PRELOADED OPERATING SYSTEM" },
];

const REQUIRED_FIELDS = [
  "bid_no",
  "dept_name",
  "organization",
  "qty",
  "pincode",
  "address",
  "atc",
  "printing_technology",
  "type_of_printing",
  "cartridge_technology",
  "fax_availability",
  "operating_system_compatibility",
  "mono_print_speed_ppm",
  "colour_print_speed_ppm",
  "auto_duplexing",
  "reduction_enlarge_features",
  "max_scan_area",
  "a4_scan_speed_colour",
  "scan_to_functions",
  "document_feeder_type",
  "feeder_capacity",
  "main_paper_tray_count",
  "total_paper_tray_capacity",
  "bypass_tray_facility",
  "bypass_tray_capacity",
  "connectivity",
  "duty_cycle",
  "onsite_warranty",
  "extended_warranty",
  "date",
  "epbg",
  "freightInstallation",
];

const MULTIFUNCTION_ONLY_FIELDS = [
  "fax_availability",
  "reduction_enlarge_features",
  "max_scan_area",
  "a4_scan_speed_colour",
  "scan_to_functions",
  "document_feeder_type",
  "feeder_capacity",
];

const FIELD_GROUPS = [
  { name: "Bid Number", key: "bid_no" },
  { name: "Department", key: "dept_name" },
  { name: "Organization", key: "organization" },
  { name: "Quantity", key: "qty" },
  { name: "Buyer Pincode", key: "pincode" },
  { name: "Address", key: "address", type: "textarea" },
  { name: "ATC", key: "atc", type: "textarea", optional: true },
  { name: "Cartridge Technology", key: "cartridge_technology" },
  { name: "Printing Technology", key: "printing_technology" },
  { name: "Type of Printing", key: "type_of_printing" },
  { name: "Availability of Fax", key: "fax_availability" },
  { name: "Operating System Compatibility", key: "operating_system_compatibility" },
  { name: "Minimum Print Speed A4 Monochrome (Black) (PPM) - Laser/LED MFPs", key: "mono_print_speed_ppm" },
  { name: "Minimum Print Speed A4 Colour (PPM) - Laser/LED MFPs", key: "colour_print_speed_ppm" },
  { name: "Auto Duplexing Printing/Copying (2-sided Feature)", key: "auto_duplexing" },
  { name: "Maximum Scan Area (Platen/ADF)", key: "max_scan_area" },
  { name: "A4 Scan Speed Colour (Image Per Minute) @ 200 x 200 DPI", key: "a4_scan_speed_colour" },
  { name: "Scan To Functions", key: "scan_to_functions" },
  { name: "Original Document Feeder Type (For Scanning and Copying)", key: "document_feeder_type" },
  { name: "Feeder Capacity (Number of Sheets)", key: "feeder_capacity" },
  { name: "Number of Main Paper Tray", key: "main_paper_tray_count" },
  { name: "Total Main Paper Tray Combined Capacity (75 GSM)", key: "total_paper_tray_capacity" },
  { name: "Bypass Tray Facility", key: "bypass_tray_facility" },
  { name: "Bypass Tray Capacity (75 GSM)", key: "bypass_tray_capacity" },
  { name: "Connectivity", key: "connectivity" },
  { name: "Duty Cycle (Prints/Month)", key: "duty_cycle" },
  { name: "On Site Warranty (In Year)", key: "onsite_warranty" },
  { name: "Extended Warranty (in Years) over and above standard warranty", key: "extended_warranty" },
  { name: "Bid End Date", key: "date", type: "date" },
  { name: "Freight and Installation", key: "freightInstallation" },
  { name: "EPBG (%)", key: "epbg" },
  { name: "Extra Requirements", key: "extra_requirements", type: "textarea", optional: true },
  { name: "Model Number", key: "model_number" },
];

function getPrinterModelImage(modelNo) {
  const normalizedModel = String(modelNo || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return PRINTER_MODEL_IMAGES[normalizedModel] || null;
}

function AdminNoteBanner({ note }) {
  if (!note) return null;
  return (
    <div className="mb-6 rounded-xl border-2 border-rose-400 bg-rose-50 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-rose-500 px-4 py-2.5">
        <span className="text-white font-bold text-sm tracking-wide uppercase">
          Admin Review Note - Action Required
        </span>
      </div>
      <div className="px-5 py-4">
        <p className="text-rose-900 text-sm leading-relaxed whitespace-pre-wrap font-medium">{note}</p>
      </div>
    </div>
  );
}

const Label = ({ children, optional }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {optional && <span className="text-red-500 text-[11px] font-normal ml-1">*Optional</span>}
  </label>
);

function GeneralDocsViewPopup({ form }) {
  const [open, setOpen] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState({});
  const [downloadingDocs, setDownloadingDocs] = useState({});

  const selectedIds = Array.isArray(form?.selected_general_docs) ? form.selected_general_docs : [];
  const selectedLabels = Array.isArray(form?.selected_general_doc_labels) ? form.selected_general_doc_labels : [];
  const isApproved = form?.status === "approved" || form?.review_status === "approved";
  const visibleIds = isApproved && !selectedIds.includes("make_in_india")
    ? [...selectedIds, "make_in_india"]
    : selectedIds;
  const docs = visibleIds.length
    ? GENERAL_DOCS.filter((doc) => visibleIds.includes(doc.id))
    : selectedLabels.map((label, index) => ({ id: `label_${index}`, label, viewable: false }));

  const handleView = async (doc) => {
    if (!form?.id || doc.viewable === false) return;
    setGeneratingDocs((prev) => ({ ...prev, [doc.id]: true }));
    try {
      const response = await fetch(`${API_BASE}/printer-bids/${form.id}/generate-docs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, doc_type: doc.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.pdf_url) throw new Error(data.error || "Unable to generate document.");
      window.open(data.pdf_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error.message || "Unable to open document.");
    } finally {
      setGeneratingDocs((prev) => ({ ...prev, [doc.id]: false }));
    }
  };

  const handleDownload = async (doc) => {
    if (!form?.id || doc.viewable === false) return;
    setDownloadingDocs((prev) => ({ ...prev, [doc.id]: true }));
    try {
      const response = await fetch(`${API_BASE}/printer-bids/${form.id}/generate-docs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, doc_type: doc.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.pdf_url) throw new Error(data.error || "Unable to generate document.");
      const fileResponse = await fetch(data.pdf_url);
      if (!fileResponse.ok) throw new Error("Unable to download document.");
      const blobUrl = URL.createObjectURL(await fileResponse.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${String(doc.label || doc.id).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
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
        onClick={() => setOpen((prev) => !prev)}
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
            <div className="text-xs text-gray-500">{docs.length > 0 ? "Click to view selected documents" : "No documents selected"}</div>
          </div>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          {docs.length}/{GENERAL_DOCS.length} Files
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
              <span className="text-sm font-semibold text-orange-800">Selected General Documents</span>
              <span className="text-xs font-semibold px-2 py-[2px] rounded-full bg-green-100 text-green-700">{docs.length} Total</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
              {docs.length ? (
                docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-green-50">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white text-xs">✓</div>
                    <span className="flex-1 text-sm text-gray-800 font-medium">{doc.label}</span>
                    <button
                      type="button"
                      onClick={() => handleView(doc)}
                      disabled={doc.viewable === false || generatingDocs[doc.id] || downloadingDocs[doc.id]}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {generatingDocs[doc.id] ? "Generating..." : "View File"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      disabled={doc.viewable === false || generatingDocs[doc.id] || downloadingDocs[doc.id]}
                      className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {downloadingDocs[doc.id] ? "Downloading..." : "Download"}
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">No documents selected.</div>
              )}
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

  const fullUrl = url.startsWith("http") ? url : `${import.meta.env.VITE_API_URL.replace("/api", "")}${url}`;
  const filename = url.split("/").pop() || "special_document";

  const handleDownload = async () => {
    try {
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error("Download failed");
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
      alert("Download failed");
    }
  };

  return (
    <div className="w-full p-4 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition-all duration-200 flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-purple-200 text-purple-700">✓</div>
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

const VerifiedInputWrapper = ({ name, label, children, verifiedFields, toggleVerification, readOnly, optional, alignTwoLineLabel = false }) => {
  const isVerified = !!verifiedFields[name];

  return (
    <div className="col-span-1 relative group">
      <div className={`flex justify-between mb-1 ${alignTwoLineLabel ? "min-h-[2.75rem] items-start" : "items-center"}`}>
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {optional && <span className="text-red-500 text-[11px] font-normal ml-1">*Optional</span>}
        </label>
        {!readOnly && REQUIRED_FIELDS.includes(name) && (
          <input
            type="checkbox"
            checked={isVerified}
            onChange={() => toggleVerification(name)}
            className="w-3.5 h-3.5 border-gray-300 rounded cursor-pointer accent-green-600 focus:ring-green-500"
          />
        )}
      </div>
      <div className={`transition-all duration-200 ${isVerified ? "ring-1 ring-green-500 rounded-md bg-green-50/50" : ""}`}>
        {children}
      </div>
    </div>
  );
};

export default function PrinterBidDetailView() {
  const { state } = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();
  const readOnly = !!state?.readOnly;
  const verificationBidId = id || state?.bid?.id || state?.id || state?.bid_id || "unknown";
  const verificationStorageKey = `printer_bid_verified_fields_${verificationBidId}`;

  const [form, setForm] = useState(null);
  const [loadingBid, setLoadingBid] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [verifiedFields, setVerifiedFields] = useState(() => {
    try {
      const saved = sessionStorage.getItem(verificationStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [modelSearching, setModelSearching] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [showModelResult, setShowModelResult] = useState(false);
  const [noMatchFound, setNoMatchFound] = useState(false);
  const [noMatchMessage, setNoMatchMessage] = useState("");
  const [modelMatches, setModelMatches] = useState([]);
  const [modelInputValue, setModelInputValue] = useState("");
  const isMultifunctionBid = String(form?.printer_type || "").toLowerCase().includes("multifunction");
  const activeRequiredFields = isMultifunctionBid
    ? REQUIRED_FIELDS
    : REQUIRED_FIELDS.filter((field) => !MULTIFUNCTION_ONLY_FIELDS.includes(field));

  useEffect(() => {
    fetchBid();
  }, []);

  useEffect(() => {
    sessionStorage.setItem(verificationStorageKey, JSON.stringify(verifiedFields));
  }, [verificationStorageKey, verifiedFields]);

  const normalizeDocUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${import.meta.env.VITE_API_URL.replace("/api", "")}${url}`;
  };

  const normalizeBid = (bid) => ({
    ...bid,
    atc_special_document: normalizeDocUrl(bid.atc_special_document || ""),
    selected_general_docs: Array.isArray(bid.selected_general_docs) ? bid.selected_general_docs : [],
    selected_general_doc_labels: Array.isArray(bid.selected_general_doc_labels) ? bid.selected_general_doc_labels : [],
    freightInstallation: bid.freightInstallation || "Yes",
    model_number: bid.model_number || bid.model || "",
  });

  const fetchBid = async () => {
    setLoadingBid(true);
    setMsg("");
    try {
      const bidId = id || state?.bid?.id || state?.id || state?.bid_id;
      if (!bidId) throw new Error("Bid ID not found");

      const res = await fetch(FETCH_API(bidId));
      if (!res.ok) throw new Error("Failed to fetch bid");
      const data = await res.json();
      const normalized = normalizeBid(data);
      setForm(normalized);
      setModelInputValue(normalized.model_number || "");
    } catch {
      // Navigation state can keep the page usable during a temporary API issue,
      // but it must never replace the latest database record during normal use.
      if (state?.bid) {
        const normalized = normalizeBid(state.bid);
        setForm(normalized);
        setModelInputValue(normalized.model_number || "");
        setMsg("Latest bid data could not be refreshed. Showing the previously loaded copy.");
      } else {
        setMsg("Error: Unable to load printer bid data.");
      }
    } finally {
      setLoadingBid(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleVerification = (field) => {
    setVerifiedFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const saveModelNumberToDB = async (modelNo) => {
    const bidId = id || form?.id || form?.bid_id;
    if (!bidId || !modelNo.trim()) return null;

    setModelSaving(true);
    try {
      const res = await fetch(SAVE_MODEL_API(bidId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_number: modelNo.trim(),
          model: modelNo.trim(),
          model_no: modelNo.trim(),
          modelNo: modelNo.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Model number save failed.");
      const savedModel = data.model_number || modelNo.trim();
      setForm((prev) => ({ ...prev, model_number: savedModel }));
      setModelInputValue(savedModel);
      return savedModel;
    } catch (error) {
      alert(error.message || "Unable to save model number.");
      return null;
    } finally {
      setModelSaving(false);
    }
  };

  const handleFindModel = async () => {
    const bidId = id || form?.id || form?.bid_id;
    if (!bidId || !form) return;

    setModelSearching(true);
    setShowModelResult(true);
    setNoMatchFound(false);
    setNoMatchMessage("");
    setModelMatches([]);

    try {
      const res = await fetch(MATCH_API(bidId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Matching failed.");

      const item = data.match || data.matches?.[0] || null;
      if (!item?.model_no) {
        setNoMatchFound(true);
        setNoMatchMessage(
          data.message || "Please recheck your specs or create another bid."
        );
        return;
      }

      setModelMatches([
        {
          modelNo: item.model_no,
          category: item.category || "",
          source: item.source || "printer_excel",
          image: getPrinterModelImage(item.model_no),
        },
      ]);
    } catch (error) {
      alert(error.message || "Unable to find model.");
    } finally {
      setModelSearching(false);
    }
  };

  const selectModelNumber = async (modelNo) => {
    const persistedModel = await saveModelNumberToDB(modelNo);
    if (!persistedModel) return;
    setShowModelResult(false);
    setNoMatchFound(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form) return;

    const bidId = id || form.id || form.bid_id;
    if (!bidId) {
      setMsg("Bid ID not found.");
      return;
    }

    const allVerified = activeRequiredFields.every((field) => !!verifiedFields[field]);
    if (!readOnly && !allVerified) {
      setMsg("Please verify all required fields before forwarding.");
      return;
    }

    setSubmitting(true);
    setMsg("");
    try {
      let savedModel = modelInputValue.trim();
      if (savedModel) {
        const persistedModel = await saveModelNumberToDB(savedModel);
        if (persistedModel) savedModel = persistedModel;
      }

      const payload = {
        ...form,
        model_number: savedModel,
        analyser_username: localStorage.getItem("analyser_username") || localStorage.getItem("username") || "",
      };

      const reviewRes = await fetch(REVIEW_API(bidId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const reviewData = await reviewRes.json().catch(() => ({}));
      if (!reviewRes.ok) {
        throw new Error(reviewData.error || "Review save failed.");
      }

      const docForm = new FormData();
      docForm.append("analyser_username", payload.analyser_username);
      docForm.append("model_number", savedModel);
      docForm.append("selected_analyser_docs", JSON.stringify([]));
      docForm.append("selected_analyser_doc_labels", JSON.stringify([]));

      const docsRes = await fetch(DOCS_API(bidId), {
        method: "POST",
        body: docForm,
      });
      const docsData = await docsRes.json().catch(() => ({}));
      if (!docsRes.ok) {
        throw new Error(docsData.error || "Analyser submit failed.");
      }

      setMsg("Printer bid reviewed successfully and forwarded to Admin.");
      setTimeout(() => navigate("/analyser-dashboard/printer"), 1200);
    } catch (error) {
      setMsg(error.message || "Unable to save printer review.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextClick = async () => {
    if (readOnly) return;

    const bidId = id || form?.id || form?.bid_id;
    if (!bidId) {
      setMsg("Bid ID not found.");
      return;
    }

    const allVerified = activeRequiredFields.every((field) => !!verifiedFields[field]);
    if (!allVerified) return;

    const currentModel = modelInputValue.trim();
    if (!currentModel) {
      alert("Please save a Model Number before proceeding.");
      return;
    }

    const persistedModel = await saveModelNumberToDB(currentModel);
    if (!persistedModel) return;

    const payload = {
      ...form,
      id: bidId,
      bid_id: bidId,
      model_number: persistedModel,
      analyser_username: localStorage.getItem("analyser_username") || localStorage.getItem("username") || "",
    };

    try {
      await fetch(REVIEW_API(bidId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Unable to save printer review before document step.", error);
    }

    navigate("/analyser-dashboard/printer/document", {
      state: {
        bidData: payload,
      },
    });
  };

  if (loadingBid) {
    return <div className="p-20 text-center text-gray-400 font-medium tracking-widest animate-pulse">LOADING PRINTER BID...</div>;
  }

  if (!form) {
    return (
      <div className="p-20 text-center">
        <div className="text-red-500 font-semibold mb-4">Printer Bid Details Not Found</div>
        {msg && <div className="text-sm text-gray-500 mb-4">{msg}</div>}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mx-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:border-slate-800 hover:bg-slate-800 hover:text-white"
        >
          Back
        </button>
      </div>
    );
  }

  const isReAnalyze = form?.status === "re-analyze" || form?.review_status === "re-analyze";
  const isReviewed = form?.status === "reviewed" || form?.review_status === "reviewed";
  const isApproved = form?.status === "approved" || form?.review_status === "approved";
  const isPending = !isReAnalyze && !isReviewed && !isApproved;
  const printerTypeLabel = String(form?.printer_type || "").toLowerCase().includes("multifunction")
    ? "Multifunction Printer"
    : "Printer";
  const inputCls = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white";
  const textareaCls = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 bg-white";
  const requiredVerifiedCount = activeRequiredFields.filter((field) => !!verifiedFields[field]).length;
  const allVerified = activeRequiredFields.every((field) => !!verifiedFields[field]);

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl pb-10 bg-white">
      <div className="flex items-center justify-between mb-6 pt-2 border-b pb-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:border-slate-800 hover:bg-slate-800 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h5 className="text-xl font-bold text-gray-800">
            {readOnly
              ? "✅ View Reviewed Printer Bid"
              : isReAnalyze
              ? "⚠️ Re-Analyze Printer Bid"
              : "⏳ Review & Accept Printer Bid"}
          </h5>
        </div>

        {isReAnalyze && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">
            ⚠️ Re-Analyze Required • {printerTypeLabel}
          </span>
        )}
        {isPending && !readOnly && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
            ⏳ Pending • {printerTypeLabel}
          </span>
        )}
        {readOnly && isReviewed && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
            ✅ Reviewed • {printerTypeLabel}
          </span>
        )}
        {readOnly && isApproved && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
            ✅ Approved • {printerTypeLabel}
          </span>
        )}
      </div>

      {isReAnalyze && form?.admin_note && <AdminNoteBanner note={form.admin_note} />}

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded text-sm font-medium ${msg.toLowerCase().includes("success") || msg.toLowerCase().includes("forwarded") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {msg}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`${isPending
          ? "[&_label]:!font-semibold [&_label]:!text-slate-800 [&_input]:!border-blue-300 [&_input]:!text-slate-900 [&_input]:placeholder:!text-slate-500 [&_select]:!border-blue-300 [&_select]:!text-slate-900 [&_textarea]:!border-blue-300 [&_textarea]:!text-slate-900 [&_textarea]:placeholder:!text-slate-500"
          : ""} ${readOnly ? "[&_select]:!appearance-none" : ""}`}
      >
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

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="pincode" label="Buyer Pincode">
            <input type="text" name="pincode" value={form?.pincode || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          {readOnly && (
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-gray-700">Assigned Model</label>
              <input type="text" value={modelInputValue} disabled
                placeholder="No model assigned"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 disabled:bg-gray-100" />
            </div>
          )}

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

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="cartridge_technology" label="Cartridge Technology">
            <input type="text" name="cartridge_technology" value={form?.cartridge_technology || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="printing_technology" label="Printing Technology">
            <input type="text" name="printing_technology" value={form?.printing_technology || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="type_of_printing" label="Type of Printing">
            <input type="text" name="type_of_printing" value={form?.type_of_printing || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          {isMultifunctionBid && (
            <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="fax_availability" label="Availability of Fax">
              <input type="text" name="fax_availability" value={form?.fax_availability || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
            </VerifiedInputWrapper>
          )}

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="operating_system_compatibility" label="Operating System Compatibility">
            <input type="text" name="operating_system_compatibility" value={form?.operating_system_compatibility || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="mono_print_speed_ppm" label="Minimum Print Speed A4 Monochrome (Black) (PPM) - Laser/LED MFPs">
            <input type="text" name="mono_print_speed_ppm" value={form?.mono_print_speed_ppm || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="colour_print_speed_ppm" label="Minimum Print Speed A4 Colour (PPM) - Laser/LED MFPs">
            <input type="text" name="colour_print_speed_ppm" value={form?.colour_print_speed_ppm || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="auto_duplexing" label="Auto Duplexing Printing/Copying (2-sided Feature)">
            <input type="text" name="auto_duplexing" value={form?.auto_duplexing || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          {isMultifunctionBid && (
            <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="reduction_enlarge_features" label="Reduction and Enlarge Features">
              <input type="text" name="reduction_enlarge_features" value={form?.reduction_enlarge_features || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
            </VerifiedInputWrapper>
          )}

          {isMultifunctionBid && (
            <>
              <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="max_scan_area" label="Maximum Scan Area (Platen/ADF)">
                <input type="text" name="max_scan_area" value={form?.max_scan_area || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
              </VerifiedInputWrapper>
              <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="a4_scan_speed_colour" label="A4 Scan Speed Colour (Image Per Minute) @ 200 x 200 DPI">
                <input type="text" name="a4_scan_speed_colour" value={form?.a4_scan_speed_colour || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
              </VerifiedInputWrapper>
              <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="scan_to_functions" label="Scan To Functions">
                <input type="text" name="scan_to_functions" value={form?.scan_to_functions || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
              </VerifiedInputWrapper>
              <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="document_feeder_type" label="Original Document Feeder Type (For Scanning and Copying)">
                <input type="text" name="document_feeder_type" value={form?.document_feeder_type || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
              </VerifiedInputWrapper>
              <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="feeder_capacity" label="Feeder Capacity (Number of Sheets)">
                <input type="text" name="feeder_capacity" value={form?.feeder_capacity || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
              </VerifiedInputWrapper>
            </>
          )}

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="main_paper_tray_count" label="Number of Main Paper Tray">
            <input type="text" name="main_paper_tray_count" value={form?.main_paper_tray_count || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="total_paper_tray_capacity" label="Total Main Paper Tray Combined Capacity (75 GSM)">
            <input type="text" name="total_paper_tray_capacity" value={form?.total_paper_tray_capacity || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="bypass_tray_facility" label="Bypass Tray Facility">
            <input type="text" name="bypass_tray_facility" value={form?.bypass_tray_facility || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="bypass_tray_capacity" label="Bypass Tray Capacity (75 GSM)">
            <input type="text" name="bypass_tray_capacity" value={form?.bypass_tray_capacity || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="connectivity" label="Connectivity">
            <input type="text" name="connectivity" value={form?.connectivity || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="duty_cycle" label="Duty Cycle (Prints/Month)">
            <input type="text" name="duty_cycle" value={form?.duty_cycle || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="onsite_warranty" label="On Site Warranty (In Year)">
            <input type="text" name="onsite_warranty" value={form?.onsite_warranty || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
          </VerifiedInputWrapper>

          {!readOnly && (
            <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="extended_warranty" label="Extended Warranty (in Years) over and above standard warranty">
              <input type="text" name="extended_warranty" value={form?.extended_warranty || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
            </VerifiedInputWrapper>
          )}

          <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {readOnly && (
              <VerifiedInputWrapper alignTwoLineLabel verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="extended_warranty" label="Extended Warranty (in Years) over and above standard warranty">
                <input type="text" name="extended_warranty" value={form?.extended_warranty || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
              </VerifiedInputWrapper>
            )}
            <VerifiedInputWrapper alignTwoLineLabel={readOnly} verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="date" label="Bid End Date">
              <input type="date" name="date" value={form?.date || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
            </VerifiedInputWrapper>

            <VerifiedInputWrapper alignTwoLineLabel={readOnly} verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="freightInstallation" label="Freight and Installation">
              <select name="freightInstallation" value={form?.freightInstallation ?? "Yes"} onChange={handleChange} disabled={readOnly} className={inputCls}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </VerifiedInputWrapper>

            {!readOnly && (
              <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="epbg" label="EPBG (%)">
                <input type="text" name="epbg" value={form?.epbg || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
              </VerifiedInputWrapper>
            )}

          </div>

        </div>

        <div className="mt-6 mb-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {readOnly && (
            <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="epbg" label="EPBG (%)">
              <input type="text" name="epbg" value={form?.epbg || ""} onChange={handleChange} disabled={readOnly} className={inputCls} />
            </VerifiedInputWrapper>
          )}
          <VerifiedInputWrapper verifiedFields={verifiedFields} readOnly={readOnly} toggleVerification={toggleVerification} name="extra_requirements" label="Extra Requirements" optional>
            <textarea name="extra_requirements" value={form?.extra_requirements || ""} onChange={handleChange} disabled={readOnly} rows={readOnly ? 1 : 2} className={textareaCls} />
          </VerifiedInputWrapper>

          {!readOnly && (
          <div className="min-w-0">
          <div className="relative flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50/60 p-2 shadow-sm w-fit">
            <div className="flex flex-col">
              <label className="mb-1 text-sm font-bold text-blue-900">Assigned Model</label>
              <input
                type="text"
                name="model_number"
                value={modelInputValue}
                readOnly
                placeholder="Model will be assigned by Find Model"
                className="w-64 cursor-not-allowed rounded border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-600 outline-none"
              />
            </div>

            {getPrinterModelImage(modelInputValue) && (
              <div className="mt-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <img src={getPrinterModelImage(modelInputValue)} alt={modelInputValue || "Assigned printer model"} className="h-full w-full object-contain p-1" />
              </div>
            )}

            {!readOnly && (
              <button
                type="button"
                onClick={handleFindModel}
                disabled={modelSearching || modelSaving}
                className="mt-4 rounded bg-slate-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:bg-slate-400"
              >
                {modelSearching ? "Searching..." : "Find Model"}
              </button>
            )}

            {showModelResult && !readOnly && (
              <div className="absolute left-0 top-full mt-2 w-[420px] bg-white border border-gray-300 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50">
                  <span className="text-sm font-bold text-gray-700">Catalogue Model</span>
                  <button
                    type="button"
                    onClick={() => { setShowModelResult(false); setNoMatchFound(false); setModelMatches([]); }}
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
                          {noMatchMessage || "Please recheck your specs or create another bid."}
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
                      {modelMatches[0].image && (
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-green-200 bg-white shadow-sm">
                          <img src={modelMatches[0].image} alt={modelMatches[0].modelNo} className="h-full w-full object-contain p-1" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-green-800">Model found</div>
                        <div className="text-lg font-extrabold text-blue-700 mt-1">{modelMatches[0].modelNo}</div>
                        {modelMatches[0].category && <div className="text-xs text-gray-500 mt-1">{modelMatches[0].category}</div>}
                        <div className="mt-1 text-[11px] text-green-700">Excel printer catalogue match</div>
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
          )}
        </div>

        <div className="mb-10 flex gap-3 items-center flex-wrap">
          {!readOnly && (
            <button
              type="button"
              disabled={!allVerified || submitting || modelSaving}
              onClick={handleNextClick}
              className={`order-2 font-semibold px-8 py-2.5 rounded-md text-sm transition flex items-center gap-2 ${
                allVerified ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {!allVerified ? (
                <>
                  <span>Next</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-300">
                    {requiredVerifiedCount} / {activeRequiredFields.length} Verified
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
            className={`${readOnly ? "" : "order-1"} flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-slate-800 hover:text-white hover:border-slate-800 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition-all duration-200 shadow-sm`}
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
