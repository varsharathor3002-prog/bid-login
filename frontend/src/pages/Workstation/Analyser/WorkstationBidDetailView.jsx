import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  INTEL_PROCESSORS, INTEL_XEON_PROCESSORS, AMD_THREADRIPPER_PROCESSORS,
  INTEL_MOTHERBOARDS, INTEL_XEON_MOTHERBOARDS, AMD_MOTHERBOARDS,
  RAMS, REGISTERED_RAMS, SSDS, HDDS, GRAPHICS_CARDS, CABINETS, KEYBOARDS,
  POWER_SUPPLIES, OS_OPTIONS, MONITORS, WARRANTIES, getPriceFromLocalData,
  getFilteredRams, getFilteredIntelMotherboards, getFilteredAmdMotherboards,
} from "../User/WorkstationConfig";

const API_BASE = "http://127.0.0.1:8000/api";
const MATCH_API = (id) => `${API_BASE}/workstation-bids/${id}/match-catalogue/`;
const SAVE_MODEL_API = (id) => `${API_BASE}/workstation-bids/${id}/save-model-number/`;

const FIELDS = [
  ["bid_no", "Bid Number"], ["model_number", "Model Number"], ["dept_name", "Department"],
  ["organization", "Organization"], ["qty", "Quantity"], ["pincode", "Buyer Pincode"],
  ["processor", "Processor"], ["processor_price", "Processor Price"],
  ["ram", "RAM"], ["ram_price", "RAM Price"], ["hdd", "HDD"], ["hdd_price", "HDD Price"],
  ["ssd1", "SSD 1"], ["ssd1_price", "SSD 1 Price"], ["ssd2", "SSD 2"], ["ssd2_price", "SSD 2 Price"],
  ["graphics", "Graphics Card"], ["graphics_price", "Graphics Price"], ["motherboard", "Motherboard"],
  ["motherboard_price", "Motherboard Price"], ["os", "OS"], ["os_price", "OS Price"],
  ["monitor", "Monitor"], ["monitor_price", "Monitor Price"], ["cabinet", "Cabinet"],
  ["cabinet_price", "Cabinet Price"], ["keyboard", "Keyboard & Mouse"], ["keyboard_price", "Keyboard Price"],
  ["power_supply", "Power Supply"], ["power_supply_price", "Power Supply Price"], ["warranty", "Warranty"],
  ["warranty_price", "Warranty Price"], ["date", "Bid End Date", "date"], ["epbg", "EPBG (%)"],
];

const TOP_FIELDS = FIELDS.slice(0, 6).filter(([name]) => name !== "model_number");
const SPEC_FIELDS = FIELDS.slice(6);
const PRICE_FIELD_BY_NAME = {
  processor: "processor_price",
  ram: "ram_price",
  hdd: "hdd_price",
  ssd1: "ssd1_price",
  ssd2: "ssd2_price",
  graphics: "graphics_price",
  motherboard: "motherboard_price",
  os: "os_price",
  monitor: "monitor_price",
  cabinet: "cabinet_price",
  keyboard: "keyboard_price",
  power_supply: "power_supply_price",
  warranty: "warranty_price",
};
const PRICE_FIELD_NAMES = new Set(Object.values(PRICE_FIELD_BY_NAME));
const PROCESSORS = [...INTEL_PROCESSORS, ...INTEL_XEON_PROCESSORS, ...AMD_THREADRIPPER_PROCESSORS];
const ALL_MOTHERBOARDS = [...INTEL_MOTHERBOARDS, ...INTEL_XEON_MOTHERBOARDS, ...AMD_MOTHERBOARDS];
const optionsFor = (name, form) => ({
  processor: PROCESSORS,
  ram: getFilteredRams(form?.processor),
  hdd: HDDS,
  ssd1: SSDS,
  ssd2: SSDS,
  graphics: GRAPHICS_CARDS,
  motherboard: [...getFilteredIntelMotherboards(form?.processor), ...getFilteredAmdMotherboards(form?.processor)],
  os: OS_OPTIONS,
  monitor: MONITORS,
  cabinet: CABINETS,
  keyboard: KEYBOARDS,
  power_supply: POWER_SUPPLIES,
  warranty: WARRANTIES,
}[name] || []);
const REQUIRED_FIELDS = [
  "bid_no", "dept_name", "organization", "qty", "pincode", "address", "atc",
  "processor", "ram", "hdd", "ssd1", "ssd2", "graphics", "motherboard", "os",
  "monitor", "cabinet", "keyboard", "power_supply", "warranty", "date", "epbg",
];
const CONDITIONAL_FIELDS = ["pro_descp", "motherboard_descp", "gp", "software1", "extra_requirements"];

const TEXT_FIELDS = [
  ["address", "Address"], ["atc", "ATC (Additional Terms & Conditions)"], ["pro_descp", "Processor Description"],
  ["software1", "Additional Software"], ["gp", "Graphics Description"],
  ["motherboard_descp", "Motherboard Description"], ["extra_requirements", "Extra Requirements"],
  ["optional_ports", "Optional Ports"], 
];

const USER_DOCS = [
  { id: "manufacturer_auth", label: "MANUFACTURER AUTHORIZATION CERTIFICATE" },
  { id: "bidder_financial", label: "BIDDER FINANCIAL STANDING" },
  { id: "non_obsolete", label: "NON OBSOLETE" },
  { id: "non_malicious", label: "NON MALICIOUS CODE" },
  { id: "non_return_hdd", label: "NON RETURN OF HARD DISK" },
  { id: "non_blacklisting", label: "NON BLACKLISTING" },
  { id: "service_support", label: "SERVICE SUPPORT" },
  { id: "ipv6", label: "IPV6" },
  { id: "preloaded_os", label: "PRELOADED OPERATING SYSTEM" },
];

const fullMediaUrl = (url) => !url ? "" : url.startsWith("http") ? url : `http://127.0.0.1:8000${url}`;

const AdminNoteBanner = ({ note }) => {
  if (!note) return null;
  return (
    <div className="mx-6 mt-4 rounded-xl border-2 border-rose-400 bg-rose-50 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-rose-500 px-4 py-2.5">
        <span className="text-white font-bold text-sm tracking-wide uppercase">
          Admin Review Note - Action Required
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

const VerifiedField = ({ name, label, optional, required, verifiedFields, readOnly, onToggle, children }) => {
  const checked = !!verifiedFields[name];
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {optional && <span className="ml-1 text-[11px] font-normal text-red-500">*Optional</span>}
        </label>
        {!readOnly && (
          <input type="checkbox" checked={checked} onChange={() => onToggle(name)}
            title={required ? "Required - must verify" : "Optional"}
            className="w-3.5 h-3.5 rounded cursor-pointer accent-green-600" />
        )}
      </div>
      <div className={checked ? "ring-1 ring-green-500 rounded-md bg-green-50/50" : ""}>{children}</div>
    </div>
  );
};

function GeneralDocsViewPopup({ form }) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState({});
  const [downloading, setDownloading] = useState({});
  const bidId = form?.id || form?.bid_id;
  const selectedIds = Array.isArray(form?.selected_general_docs) ? form.selected_general_docs : [];
  const selectedLabels = Array.isArray(form?.selected_general_doc_labels) ? form.selected_general_doc_labels : [];
  const docs = selectedIds.length
    ? selectedIds.map((docId, index) => USER_DOCS.find((doc) => doc.id === docId) || { id: docId, label: selectedLabels[index] || docId })
    : selectedLabels.map((label, index) => ({ id: `label_${index}`, label, viewable: false }));

  const getGeneratedPdfUrl = async (doc) => {
    if (!bidId || doc.viewable === false) return;
    const response = await fetch(`${API_BASE}/workstation-bids/${bidId}/generate-docs/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, doc_type: doc.id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.pdf_url) throw new Error(data.error || "The document could not be generated.");
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
            <div className="text-xs text-gray-500">{docs.length > 0 ? "Click to view selected documents" : "No documents selected"}</div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          docs.length > 0 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-500"
        }`}>
          {docs.length}/{USER_DOCS.length} Files
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
                ))
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

export default function WorkstationBidDetailView() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const showGemUpload = location.state?.showGemUpload === true;
  const verificationBidId = id || location.state?.bid?.id || location.state?.id || location.state?.bid_id || "unknown";
  const verificationStorageKey = `workstation_bid_verified_fields_${verificationBidId}`;
  const [form, setForm] = useState(location.state?.bid || {});
  const [readOnly] = useState(!!location.state?.readOnly);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [modelSearching, setModelSearching] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelMatches, setModelMatches] = useState([]);
  const [showModelResult, setShowModelResult] = useState(false);
  const [noMatchFound, setNoMatchFound] = useState(false);
  const [newModelInput, setNewModelInput] = useState("");
  const [modelInputValue, setModelInputValue] = useState(location.state?.bid?.model_number || "");
  const [verifiedFields, setVerifiedFields] = useState(() => {
    try {
      const saved = sessionStorage.getItem(verificationStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [gemStarting, setGemStarting] = useState(false);

  useEffect(() => {
    const loadBid = async () => {
      try {
        const res = await fetch(`${API_BASE}/workstation-bids/${id}/`);
        if (res.ok) {
          const data = await res.json();
          setForm(data);
          setModelInputValue(data.model_number || data.model || data.model_no || "");
        }
      } catch {
        setMsg("Unable to load workstation bid.");
      }
    };
    loadBid();
  }, [id]);

  useEffect(() => {
    sessionStorage.setItem(verificationStorageKey, JSON.stringify(verifiedFields));
  }, [verificationStorageKey, verifiedFields]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      const options = optionsFor(name, next);
      if (options.length) next[PRICE_FIELD_BY_NAME[name]] = value === "None" ? "" : getPriceFromLocalData(options, value);
      if (name === "processor") {
        const compatibleRams = getFilteredRams(value);
        const compatibleBoards = [...getFilteredIntelMotherboards(value), ...getFilteredAmdMotherboards(value)];
        if (prev.ram && !compatibleRams.some((item) => item.name === prev.ram)) { next.ram = ""; next.ram_price = ""; }
        if (prev.motherboard && !compatibleBoards.some((item) => item.name === prev.motherboard)) { next.motherboard = ""; next.motherboard_price = ""; }
      }
      return next;
    });
  };

  const handleModelInputChange = (e) => {
    const value = e.target.value;
    setModelInputValue(value);
    setForm((prev) => ({ ...prev, model_number: value }));
  };

  const toggleVerification = (name) => {
    const { scrollX, scrollY } = window;
    setVerifiedFields((prev) => ({ ...prev, [name]: !prev[name] }));
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
  };

  const saveModelNumberToDB = async (modelNo) => {
    const trimmedModelNo = String(modelNo || "").trim();
    if (!trimmedModelNo) {
      alert("Please save a Model Number before proceeding.");
      return null;
    }
    setModelSaving(true);
    try {
      const res = await fetch(SAVE_MODEL_API(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          model_number: trimmedModelNo,
          model: trimmedModelNo,
          model_no: trimmedModelNo,
          modelNo: trimmedModelNo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Model number save failed.");
      const savedModel = data.model_number || trimmedModelNo;
      const updatedForm = {
        ...form,
        model_number: savedModel,
        model: data.model || savedModel,
        status: data.status || form?.status,
        review_status: data.review_status || form?.review_status,
      };
      setModelInputValue(savedModel);
      setForm(updatedForm);
      return updatedForm;
    } catch (error) {
      alert(error.message || "Server error - unable to save model number.");
      return null;
    } finally {
      setModelSaving(false);
    }
  };

  const handleFindModel = async () => {
    setModelSearching(true);
    setModelMatches([]);
    setShowModelResult(false);
    setNoMatchFound(false);
    setNewModelInput("");
    try {
      const matchPayload = {
        ...form,
        ssd: form?.ssd1 || form?.ssd || "",
        ssd1: form?.ssd1 || form?.ssd || "",
        hdd: form?.hdd || "None",
        dvd: form?.dvd || "None",
        wifi: form?.wifi || "None",
        optional_ports: form?.optional_ports || "",
      };
      const res = await fetch(MATCH_API(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Server error - unable to find a matching model.");
      const item = data.match || data.matches?.[0] || null;
      if (!item?.model_no) {
        setModelMatches([]);
        setNoMatchFound(true);
        setShowModelResult(false);
        if (data.best_failed_match) console.log("Best failed workstation match:", data.best_failed_match);
        return;
      }
      setModelMatches([{ modelNo: item.model_no, product_id: item.product_id, category: item.category }]);
      setShowModelResult(true);
    } catch (error) {
      alert(error.message || "Network error - unable to connect to the server.");
    } finally {
      setModelSearching(false);
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
    const trimmed = modelInputValue.trim();
    if (!trimmed) {
      alert("Please enter a model number.");
      return;
    }
    const updatedData = await saveModelNumberToDB(trimmed);
    if (!updatedData) return;
    setShowModelResult(false);
    setNoMatchFound(false);
    setNewModelInput("");
  };

  const handleGemUpload = () => {
    setGemStarting(true);
    const gemWindow = window.open("https://mkp.gem.gov.in/", "_blank", "noopener,noreferrer");
    setMsg(gemWindow ? "GeM opened. Log in manually and add this approved workstation offering." : "Please allow pop-ups to open GeM.");
    setGemStarting(false);
  };

  const handleSave = async () => {
    const conditionalRequired = CONDITIONAL_FIELDS.filter((name) => String(form?.[name] || "").trim());
    const required = [...REQUIRED_FIELDS, ...conditionalRequired];
    if (!required.every((name) => verifiedFields[name])) {
      setMsg(`Please verify all required fields (${required.filter((name) => verifiedFields[name]).length}/${required.length}).`);
      return;
    }
    const currentModel = modelInputValue.trim();
    if (!currentModel) {
      alert("Please save a Model Number before proceeding.");
      return;
    }
    const updatedBidData = await saveModelNumberToDB(currentModel);
    if (!updatedBidData) return;
    setLoading(true);
    setMsg("");
    try {
      const payload = {
        ...updatedBidData,
        model_number: currentModel,
        analyser_username: localStorage.getItem("analyser_username") || localStorage.getItem("username") || "",
      };
      const res = await fetch(`${API_BASE}/workstation-bids/${id}/review/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Review save failed.");
      navigate(`/analyser-dashboard/workstation/bid/${id}/documents`, {
        state: { bidData: { ...updatedBidData, ...payload, bid_id: id } },
      });
    } catch (err) {
      setMsg(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const isReAnalyze = form?.status === "re-analyze" || form?.status === "re_analyze" || form?.review_status === "re-analyze";
  const isReviewed = form?.status === "reviewed" || form?.review_status === "reviewed";
  const isApproved = form?.status === "approved" || form?.review_status === "approved";
  const isPending = !isReAnalyze && !isReviewed && !isApproved;
  const conditionalRequired = CONDITIONAL_FIELDS.filter((name) => String(form?.[name] || "").trim());
  const activeRequiredFields = [...REQUIRED_FIELDS, ...conditionalRequired];
  const verifiedCount = activeRequiredFields.filter((name) => verifiedFields[name]).length;
  const allVerified = activeRequiredFields.every((name) => verifiedFields[name]);

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl pb-10 bg-white">
      <div className="flex items-center justify-between mb-6 pt-2 border-b pb-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(-1)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:border-slate-800 hover:bg-slate-800 hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h5 className="text-xl font-bold text-gray-800">
            {readOnly
              ? "✅ View Reviewed Workstation Bid"
              : isReAnalyze
              ? "⚠️ Re-Analyze Workstation Bid"
              : "⌛ Review & Accept Workstation Bid"}
          </h5>
        </div>
          {isReAnalyze && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">⚠️ Re-Analyze Required</span>
          )}
          {isPending && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">⌛ Pending</span>
          )}
          {readOnly && isReviewed && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">✅ Reviewed</span>
          )}
          {readOnly && isApproved && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">✅ Approved</span>
          )}
      </div>

      {isReAnalyze && form?.admin_note && <AdminNoteBanner note={form.admin_note} />}

      {msg && <div className="mb-4 px-4 py-2 rounded bg-red-50 text-red-700 text-sm font-medium border border-red-200">{msg}</div>}

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 ${isPending ? "[&_label]:!font-semibold [&_label]:!text-slate-800 [&_input]:!border-blue-300 [&_input]:!text-slate-900 [&_input]:placeholder:!text-slate-500 [&_select]:!border-blue-300 [&_select]:!text-slate-900 [&_textarea]:!border-blue-300 [&_textarea]:!text-slate-900" : ""} ${readOnly && isApproved ? "[&_select]:!appearance-none" : ""}`}>
        {TOP_FIELDS.map(([name, label, type]) => (
          <VerifiedField key={name} name={name} label={label} required verifiedFields={verifiedFields} readOnly={readOnly} onToggle={toggleVerification}>
            <input
              type={type || "text"}
              name={name}
              value={form[name] || ""}
              onChange={handleChange}
              readOnly={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-50"
            />
          </VerifiedField>
        ))}

        <div className="contents">
          {TEXT_FIELDS.filter(([name]) => name === "address" || name === "atc").map(([name, label]) => (
            <div key={name} className="md:col-span-2 lg:col-span-3">
              <VerifiedField name={name} label={label} required verifiedFields={verifiedFields} readOnly={readOnly} onToggle={toggleVerification}>
                <textarea
                  name={name}
                  value={form[name] || ""}
                  onChange={handleChange}
                  readOnly={readOnly}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-50"
                />
              </VerifiedField>
            </div>
          ))}
        </div>

        <div className="md:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Compliance Documents</label>
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

        {SPEC_FIELDS.filter(([name]) => !PRICE_FIELD_NAMES.has(name)).map(([name, label, type]) => {
          const priceField = PRICE_FIELD_BY_NAME[name];
          const options = optionsFor(name, form);
          const hasSavedCustomValue = form[name] && !options.some((option) => option.name === form[name]);
          return (
            <VerifiedField key={name} name={name} label={label} required={REQUIRED_FIELDS.includes(name)} verifiedFields={verifiedFields} readOnly={readOnly} onToggle={toggleVerification}>
              {priceField ? (
                <div className="flex gap-2">
                  <select
                    name={name}
                    value={form[name] || ""}
                    onChange={handleChange}
                    disabled={readOnly}
                    className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
                  >
                    <option value="">Select {label}</option>
                    {hasSavedCustomValue && <option value={form[name]}>{form[name]}</option>}
                    {options.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
                  </select>
                  <input
                    type="text"
                    value={form[priceField] || ""}
                    readOnly
                    disabled
                    placeholder="Price"
                    className="w-24 shrink-0 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50 cursor-not-allowed"
                  />
                </div>
              ) : (
                <input
                  type={type || "text"}
                  name={name}
                  value={form[name] || ""}
                  onChange={handleChange}
                  readOnly={readOnly}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-50"
                />
              )}
            </VerifiedField>
          );
        })}

        <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEXT_FIELDS.filter(([name]) => name !== "address" && name !== "atc" && name !== "optional_ports").map(([name, label]) => (
            <VerifiedField key={name} name={name} label={label} optional required={conditionalRequired.includes(name)} verifiedFields={verifiedFields} readOnly={readOnly} onToggle={toggleVerification}>
              <textarea
                name={name}
                value={form[name] || ""}
                onChange={handleChange}
                readOnly={readOnly}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-50"
              />
            </VerifiedField>
          ))}
        </div>

        <VerifiedField name="optional_ports" label="Optional Ports" optional required={false} verifiedFields={verifiedFields} readOnly={readOnly} onToggle={toggleVerification}>
          <textarea
            name="optional_ports"
            value={form.optional_ports || ""}
            onChange={handleChange}
            readOnly={readOnly}
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-50"
          />
        </VerifiedField>

        {readOnly && isApproved && (
          <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-slate-300 bg-slate-50 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-semibold text-slate-800">Total Approved Price</label>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">₹</span>
                <input readOnly disabled value={Number(form?.final_amount || form?.total_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  className="w-48 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-right text-lg font-semibold text-slate-800" />
              </div>
            </div>
          </div>
        )}

        {showGemUpload && readOnly && isApproved && (
          <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-indigo-950 mb-1">GeM upload</label>
                <div className="w-full border border-indigo-200 bg-white rounded-md px-3 py-2 text-sm text-slate-700">Manual login in the GeM tab</div>
                <p className="text-xs text-indigo-700 mt-2">Approved workstation model: <span className="font-semibold">{form.model_number || "-"}</span></p>
              </div>
              <button type="button" onClick={handleGemUpload} disabled={gemStarting}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold px-6 py-2.5 rounded-md text-sm transition">
                {gemStarting ? "Opening..." : "Upload to GeM"}
              </button>
            </div>
          </div>
        )}
      <div className={isPending ? "min-w-0" : "md:col-start-2 md:row-start-3 lg:col-start-3 lg:row-start-2"}>
        <div className={`relative flex items-center gap-2 rounded-lg border p-2 ${isPending ? "w-fit border-blue-300 bg-blue-50/60 shadow-sm" : "h-full border-gray-300 bg-gray-50"}`}>
          <div className="flex flex-col">
            <label className={`mb-1 text-sm font-bold ${isPending ? "text-blue-900" : "text-gray-700"}`}>Assigned Model</label>
            <input
              type="text"
              name="model_number"
              value={modelInputValue}
              onChange={handleModelInputChange}
              placeholder={readOnly ? "No model assigned" : noMatchFound ? "Enter model number manually..." : "Search model..."}
              disabled={readOnly || modelSearching || showModelResult}
              className="border border-blue-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={noMatchFound ? handleCreateNewModel : handleFindModel}
              disabled={modelSearching || modelSaving || showModelResult}
              className={`mt-4 whitespace-nowrap ${noMatchFound ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-700 hover:bg-slate-800"} disabled:bg-slate-400 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm`}
            >
              {modelSaving ? "Saving..." : modelSearching ? "Searching..." : noMatchFound ? "Save Model" : form?.model_number ? "Change Model" : "Find Model"}
            </button>
          )}

          {noMatchFound && !readOnly && !showModelResult && (
            <div className="ml-1 w-52 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-800">
              <span className="font-bold">No matching model found.</span>{" "}Please create a new model number.
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
                  Close x
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
                      <div className="text-xs text-amber-700 mt-0.5">Please recheck your specs or create another bid.</div>
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
                      {modelMatches[0].category && <div className="text-xs text-gray-500 mt-1">{modelMatches[0].category}</div>}
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

      <div className="mt-5 mb-10 flex gap-3 items-center flex-wrap">
        {!readOnly && (
          <button
            type="button"
            disabled={loading || modelSaving || !allVerified}
            onClick={handleSave}
            className={`order-2 flex items-center gap-2 rounded-md px-8 py-2.5 text-sm font-semibold transition ${
              allVerified
                ? "bg-blue-600 text-white shadow-md hover:bg-blue-700"
                : "cursor-not-allowed bg-gray-200 text-gray-400"
            }`}
          >
            {loading || modelSaving ? (
              "Saving..."
            ) : !allVerified ? (
              <>
                <span>Next</span>
                <span className="rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                  {verifiedCount} / {activeRequiredFields.length} Verified
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
          className={`${readOnly ? "" : "order-1"} flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-8 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:border-slate-800 hover:bg-slate-800 hover:text-white`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          {readOnly ? "Back" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
