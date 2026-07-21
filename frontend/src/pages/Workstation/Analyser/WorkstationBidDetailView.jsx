import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import WorkstationDocument from "../User/WorkstationDocument";

const API_BASE = "http://127.0.0.1:8000/api";
const MATCH_API = (id) => `${API_BASE}/workstation-bids/${id}/match-catalogue/`;
const SAVE_MODEL_API = (id) => `${API_BASE}/workstation-bids/${id}/save-model-number/`;

const FIELDS = [
  ["bid_no", "Bid Number"], ["model_number", "Model Number"], ["dept_name", "Department"],
  ["organization", "Organization"], ["qty", "Quantity"], ["pincode", "Pincode"],
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

const TEXT_FIELDS = [
  ["address", "Address"], ["atc", "ATC"], ["pro_descp", "Processor Description"],
  ["motherboard_descp", "Motherboard Description"], ["gp", "Graphics Description"],
  ["software1", "Additional Software"], ["extra_requirements", "Extra Requirements"],
  ["optional_ports", "Optional Ports"], 
];

const ANALYSER_DOCS = [
  { id: "warranty", label: "WARRANTY" },
  { id: "technical_compliance", label: "TECHNICAL COMPLIANCE" },
  { id: "data_sheet", label: "DATA SHEET" },
];

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
    if (!response.ok || !data.pdf_url) throw new Error(data.error || "Document generate nahi hua.");
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
  const [form, setForm] = useState(location.state?.bid || {});
  const [readOnly] = useState(!!location.state?.readOnly);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [modelSearching, setModelSearching] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelMatches, setModelMatches] = useState([]);
  const [showModelResult, setShowModelResult] = useState(false);
  const [noMatchFound, setNoMatchFound] = useState(false);
  const [newModelInput, setNewModelInput] = useState("");
  const [modelInputValue, setModelInputValue] = useState(location.state?.bid?.model_number || "");

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleModelInputChange = (e) => {
    const value = e.target.value;
    setModelInputValue(value);
    setForm((prev) => ({ ...prev, model_number: value }));
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
    setShowModelResult(true);
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
        if (data.best_failed_match) console.log("Best failed workstation match:", data.best_failed_match);
        return;
      }
      setModelMatches([{ modelNo: item.model_no, product_id: item.product_id, category: item.category }]);
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
    const trimmed = newModelInput.trim();
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

  const handleSave = async () => {
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
      setStep(2);
    } catch (err) {
      setMsg(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <WorkstationDocument
        bidData={{ ...form, bid_id: id }}
        onBack={() => setStep(1)}
        onSuccess={() => navigate("/analyser-dashboard/workstation")}
        submitLabel="Forward to Admin"
        analyserMode
        docOptions={ANALYSER_DOCS}
      />
    );
  }

  const isReAnalyze = form?.status === "re-analyze" || form?.status === "re_analyze" || form?.review_status === "re-analyze";
  const isReviewed = form?.status === "reviewed" || form?.review_status === "reviewed";
  const isPending = !isReAnalyze && !isReviewed;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-xl">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(-1)} className="px-3 py-1.5 rounded border text-sm font-semibold hover:bg-slate-800 hover:text-white">Back</button>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Review Workstation Bid</h2>
            <p className="text-sm text-gray-500">Bid No: <span className="font-semibold text-blue-600">{form.bid_no || "-"}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isReAnalyze && (
            <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold border border-rose-300">Re-Analyze Required</span>
          )}
          {isPending && (
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-300">Pending</span>
          )}
          {readOnly && isReviewed && (
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-300">Reviewed</span>
          )}
          {readOnly && <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">Read Only</span>}
        </div>
      </div>

      {isReAnalyze && form?.admin_note && <AdminNoteBanner note={form.admin_note} />}

      {msg && <div className="mx-6 mt-4 p-3 rounded bg-red-50 text-red-700 text-sm border border-red-200">{msg}</div>}

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOP_FIELDS.map(([name, label, type]) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type || "text"}
              name={name}
              value={form[name] || ""}
              onChange={handleChange}
              readOnly={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-50"
            />
          </div>
        ))}

        <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEXT_FIELDS.filter(([name]) => name === "address" || name === "atc").map(([name, label]) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <textarea
                name={name}
                value={form[name] || ""}
                onChange={handleChange}
                readOnly={readOnly}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-50"
              />
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
          return (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              {priceField ? (
                <div className="flex gap-2">
                  <input
                    type={type || "text"}
                    name={name}
                    value={form[name] || ""}
                    onChange={handleChange}
                    readOnly={readOnly}
                    className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-50"
                  />
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
            </div>
          );
        })}

        <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEXT_FIELDS.filter(([name]) => name !== "address" && name !== "atc").map(([name, label]) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <textarea
                name={name}
                value={form[name] || ""}
                onChange={handleChange}
                readOnly={readOnly}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500 read-only:bg-gray-50"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pb-4">
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
              className="mt-4 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm"
            >
              {modelSearching ? "Searching..." : form?.model_number ? "Change Model" : "Find Model"}
            </button>
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
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <div className="text-sm font-bold text-amber-800">No exact matching model found</div>
                    <div className="text-xs text-amber-700 mt-0.5">You can create a new model number and save it as the Assigned Model.</div>
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
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <div className="text-sm font-bold text-green-800">Model found</div>
                    <div className="text-lg font-extrabold text-blue-700 mt-1">{modelMatches[0].modelNo}</div>
                    {modelMatches[0].category && <div className="text-xs text-gray-500 mt-1">{modelMatches[0].category}</div>}
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

      <div className="px-6 pb-6 flex gap-3">
        {!readOnly && (
          <button type="button" disabled={loading || modelSaving} onClick={handleSave} className="px-8 py-2.5 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold">
            {loading || modelSaving ? "Saving..." : "Next"}
          </button>
        )}
        <button type="button" onClick={() => navigate(-1)} className="px-8 py-2.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold">Cancel</button>
      </div>
    </div>
  );
}