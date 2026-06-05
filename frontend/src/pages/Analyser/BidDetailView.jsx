import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";

const API_BASE = "http://127.0.0.1:8000/api";

const REVIEW_API = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/review/`,
};

const FETCH_API = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/`,
};

const EXCEL_FILE_URL = "/Desktop_product.xlsx";

const GENERAL_DOCS = [
  { id: "exp", label: "Experience Criteria", key: "general_exp" },
  { id: "perf", label: "Past Performance", key: "general_perf" },
  { id: "turn", label: "Bidder Turnover", key: "general_turn" },
  { id: "cert", label: "Certificate (Requested in ATC)", key: "general_cert" },
  { id: "oem", label: "OEM Authorization Certificate", key: "general_oem" },
  { id: "oemT", label: "OEM Annual Turnover", key: "general_oemT" },
];

const REQUIRED_FIELDS = [
  "bid_no", "dept_name", "organization", "qty", "pincode",
  "address", "atc", "processor", "ram", "hdd", "ssd1", "ssd2",
  "os", "dvd", "wifi", "monitor", "cabinet", "keyboard",
  "warranty", "motherboard", "date", "epbg",
  "freight_price", "hddreturnable",
];

const Label = ({ children, optional }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {optional && (
      <span className="text-red-500 text-[11px] font-normal ml-1">
        *Optional
      </span>
    )}
  </label>
);

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/gb/g, "")
    .replace(/tb/g, "000")
    .replace(/inch/g, "")
    .replace(/"/g, "")
    .replace(/-/g, " ")
    .trim();
};

const isBlankOrNA = (value) => {
  const v = cleanValue(value);
  return !v || v === "na" || v === "none" || v === "null" || v === "select";
};

const matchSpec = (formValue, excelValue) => {
  if (isBlankOrNA(formValue)) return true;
  if (isBlankOrNA(excelValue)) return false;

  const f = cleanValue(formValue);
  const e = cleanValue(excelValue);

  return e.includes(f) || f.includes(e);
};

const getExcelValue = (row, key) => {
  return row?.[key] ?? "";
};

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

  const availableDocs = GENERAL_DOCS.filter((doc) => form?.[doc.key]);
  const uploadedCount = availableDocs.length;

  const handleDownload = async (url, filename) => {
    try {
      const fullUrl = url.startsWith("http")
        ? url
        : `http://127.0.0.1:8000${url}`;

      const res = await fetch(fullUrl);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert("Download failed");
    }
  };

  return (
    <div className="relative w-full">
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
          <div
            className={`p-2 rounded-full ${
              open
                ? "bg-orange-200 text-orange-700"
                : "bg-orange-100 text-orange-600 group-hover:bg-orange-200"
            }`}
          >
            📁
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-800">
              General Documents
            </div>
            <div className="text-xs text-gray-500">
              {uploadedCount > 0
                ? "Click to view uploaded files"
                : "No documents uploaded"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {uploadedCount > 0 ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {uploadedCount} Files
            </span>
          ) : (
            <span className="text-xs text-gray-400">None</span>
          )}
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
              <span className="text-sm font-semibold text-orange-800">
                Uploaded General Documents
              </span>
              <span className="text-xs font-semibold px-2 py-[2px] rounded-full bg-green-100 text-green-700">
                {uploadedCount} Total
              </span>
            </div>

            <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
              {availableDocs.length > 0 ? (
                availableDocs.map((doc) => {
                  const url = form?.[doc.key];
                  const fullUrl =
                    url && !url.startsWith("http")
                      ? `http://127.0.0.1:8000${url}`
                      : url;
                  const filename = url ? url.split("/").pop() : "";

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 px-4 py-3 transition-colors bg-white hover:bg-green-50"
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white">
                        ✓
                      </div>

                      <span className="flex-1 text-sm text-gray-800 font-medium">
                        {doc.label}
                      </span>

                      <div className="flex items-center gap-3">
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDownload(fullUrl, filename)}
                          className="text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No documents found.
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium px-3 py-1 rounded hover:bg-gray-200 transition"
              >
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

  const fullUrl = url.startsWith("http")
    ? url
    : `http://127.0.0.1:8000${url}`;

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
        <div className="p-2 rounded-full bg-purple-200 text-purple-700">
          ✅
        </div>
        <div className="text-left">
          <div className="text-sm font-bold text-purple-900">
            Special Document
          </div>
          <div className="text-xs text-purple-700">
            ATC Specific Requirement
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={fullUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-white border border-purple-200 rounded hover:bg-purple-50 transition"
        >
          View File
        </a>

        <button
          type="button"
          onClick={handleDownload}
          className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 shadow-sm transition"
        >
          Download
        </button>
      </div>
    </div>
  );
}

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
  const [modelMatches, setModelMatches] = useState([]);
  const [showModelResult, setShowModelResult] = useState(false);

  useEffect(() => {
    fetchBid();
  }, []);

  const normalizeDocUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `http://127.0.0.1:8000${url}`;
  };

  const normalizeBid = (bid) => {
    const docFields = [
      "upload_document",
      "atc_special_document",
      "general_exp",
      "general_perf",
      "general_turn",
      "general_cert",
      "general_oem",
      "general_oemT",
    ];

    const normalized = { ...bid };

    docFields.forEach((f) => {
      normalized[f] = normalizeDocUrl(bid[f]);
    });

    normalized.ssd1 = bid.ssd1 || bid.ssd || "";
    normalized.ssd1_price = bid.ssd1_price || bid.ssd_price || "";

    if (!normalized.upload_document) {
      normalized.upload_document = normalizeDocUrl(
        bid.document || bid.bid_document || ""
      );
    }

    return normalized;
  };

  const fetchBid = async () => {
    setLoadingBid(true);
    setMsg("");

    try {
      if (state?.bid) {
        setForm(normalizeBid(state.bid));
        setLoadingBid(false);
        return;
      }

      const bidId = id || state?.id || state?.bid_id;

      if (!bidId) {
        setMsg("Bid ID nahi mila.");
        setLoadingBid(false);
        return;
      }

      const res = await fetch(FETCH_API[product](bidId));

      if (!res.ok) throw new Error("Failed to fetch bid");

      const data = await res.json();
      setForm(normalizeBid(data));
    } catch (error) {
      console.log(error);
      setMsg("Error: Data load nahi ho pa raha.");
    } finally {
      setLoadingBid(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleVerification = (fieldName) => {
    setVerifiedFields((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  const handleFindModel = async () => {
    if (!form) return;

    setModelSearching(true);
    setModelMatches([]);
    setShowModelResult(true);

    try {
      const res = await fetch(EXCEL_FILE_URL);

      if (!res.ok) {
        alert("Excel file public folder me nahi mili.");
        setModelSearching(false);
        return;
      }

      const arrayBuffer = await res.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
      });

      const matchedRows = rows
        .map((row) => {
          const checks = [
            {
              label: "Processor",
              formValue: form.processor,
              excelValue: getExcelValue(row, "Processor"),
            },
            {
              label: "RAM",
              formValue: form.ram,
              excelValue: getExcelValue(row, "RAM"),
            },
            {
              label: "HDD",
              formValue: form.hdd,
              excelValue: getExcelValue(row, "HDD"),
            },
            {
              label: "SSD",
              formValue: form.ssd1 || form.ssd,
              excelValue: getExcelValue(row, "SSD"),
            },
            {
              label: "OS",
              formValue: form.os,
              excelValue: getExcelValue(row, "OS"),
            },
            {
              label: "DVD",
              formValue: form.dvd,
              excelValue: getExcelValue(row, "DVD RW"),
            },
            {
              label: "Wi-Fi",
              formValue: form.wifi,
              excelValue: getExcelValue(row, "Wi-Fi"),
            },
            {
              label: "Motherboard",
              formValue: form.motherboard,
              excelValue: getExcelValue(row, "Motherboard"),
            },
            {
              label: "Monitor",
              formValue: form.monitor,
              excelValue: getExcelValue(row, "Monitor"),
            },
            {
              label: "Cabinet",
              formValue: form.cabinet,
              excelValue: getExcelValue(row, "Cabinet"),
            },
            {
              label: "Keyboard",
              formValue: form.keyboard,
              excelValue: getExcelValue(row, "Keyboard"),
            },
            {
              label: "Warranty",
              formValue: form.warranty,
              excelValue: getExcelValue(row, "Warranty"),
            },
          ];

          const activeChecks = checks.filter((c) => !isBlankOrNA(c.formValue));

          const matchedSpecs = activeChecks.filter((c) =>
            matchSpec(c.formValue, c.excelValue)
          );

          return {
            modelNo: getExcelValue(row, "Model No"),
            row,
            totalSpecs: activeChecks.length,
            matchedCount: matchedSpecs.length,
            matchedSpecs,
            checks,
          };
        })
        .filter((item) => item.modelNo && item.matchedCount > 0)
        .sort((a, b) => b.matchedCount - a.matchedCount);

      setModelMatches(matchedRows);
    } catch (error) {
      console.log(error);
      alert("Excel read karne me error aa raha hai.");
    } finally {
      setModelSearching(false);
    }
  };

  const selectModelNumber = (modelNo) => {
    setForm((prev) => ({
      ...prev,
      model_number: modelNo,
    }));

    setShowModelResult(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form) {
      setMsg("Bid details not found.");
      return;
    }

    const finalBidId =
      id || state?.id || state?.bid_id || form?.id || form?.bid_id;

    if (!finalBidId) {
      setMsg("Bid ID not found. Data save nahi hua.");
      return;
    }

    setSubmitting(true);
    setMsg("");

    try {
      const payload = {
        ...form,
        ssd: form?.ssd1,
        ssd_price: form?.ssd1_price,
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
        setMsg("Data Save & Forwarded to Admin ✅");
        setForm((prev) => ({
          ...prev,
          status: "reviewed",
          review_status: "reviewed",
        }));

        setTimeout(() => navigate("/analyser-dashboard/desktop"), 1200);
      } else {
        setMsg(data.error || "Data Save Failed");
      }
    } catch {
      setMsg("Server error — Data save nahi hua.");
    } finally {
      setSubmitting(false);
    }
  };

  const requiredVerifiedCount = REQUIRED_FIELDS.filter(
    (f) => !!verifiedFields[f]
  ).length;

  const allVerified = REQUIRED_FIELDS.every((f) => !!verifiedFields[f]);

  const VerifiedInputWrapper = ({ name, children, label, optional }) => {
    const isVerified = !!verifiedFields[name];
    const isRequired = REQUIRED_FIELDS.includes(name);

    return (
      <div className="col-span-1 relative group">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {optional && (
              <span className="text-red-500 text-[11px] font-normal ml-1">
                *Optional
              </span>
            )}
          </label>

          {!readOnly && (
            <input
              type="checkbox"
              checked={isVerified}
              onChange={() => toggleVerification(name)}
              title={isRequired ? "Required — must verify" : "Optional"}
              className="w-3.5 h-3.5 border-gray-300 rounded cursor-pointer accent-green-600 focus:ring-green-500"
            />
          )}
        </div>

        <div
          className={`transition-all duration-200 ${
            isVerified ? "ring-1 ring-green-500 rounded-md bg-green-50/50" : ""
          }`}
        >
          {children}
        </div>
      </div>
    );
  };

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
        <div className="text-red-500 font-semibold mb-4">
          Bid Details Not Found
        </div>

        {msg && <div className="text-sm text-gray-500 mb-4">{msg}</div>}

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition"
        >
          Back
        </button>
      </div>
    );
  }

  const isReAnalyze =
    form?.status === "re-analyze" || form?.status === "re_analyze";

  const inputCls =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white";

  const flexInputCls =
    "flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100";

  const priceCls =
    "w-20 border border-gray-200 rounded-md px-1 py-2 text-xs text-center text-gray-500 bg-gray-50 cursor-not-allowed";

  const textareaCls =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100 bg-white";

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl pb-10">
      <div className="flex items-center justify-between mb-6 pt-2 border-b pb-4">
        <h5 className="text-xl font-bold text-gray-800">
          {readOnly
            ? "View Reviewed Desktop Bid"
            : isReAnalyze
            ? "⚠️ Re-Analyze Desktop Bid"
            : "Review & Accept Desktop Bid"}
        </h5>

        {isReAnalyze && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">
            ⚠️ Re-Analyze Required
          </span>
        )}
      </div>

      {isReAnalyze && form?.admin_note && (
        <AdminNoteBanner note={form.admin_note} />
      )}

      {msg && (
        <div
          className={`mb-4 px-4 py-2 rounded text-sm font-medium ${
            msg.includes("✅")
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {msg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <VerifiedInputWrapper name="bid_no" label="Bid Number">
            <input
              type="text"
              name="bid_no"
              value={form?.bid_no || ""}
              onChange={handleChange}
              disabled={readOnly}
              className={inputCls}
            />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="dept_name" label="Department">
            <input
              type="text"
              name="dept_name"
              value={form?.dept_name || ""}
              onChange={handleChange}
              disabled={readOnly}
              className={inputCls}
            />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="organization" label="Organization">
            <input
              type="text"
              name="organization"
              value={form?.organization || ""}
              onChange={handleChange}
              disabled={readOnly}
              className={inputCls}
            />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="qty" label="Quantity">
            <input
              type="number"
              name="qty"
              value={form?.qty || ""}
              onChange={handleChange}
              disabled={readOnly}
              className={inputCls}
            />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="pincode" label="Pincode">
            <input
              type="text"
              name="pincode"
              value={form?.pincode || ""}
              onChange={handleChange}
              disabled={readOnly}
              className={inputCls}
            />
          </VerifiedInputWrapper>

          <div className="md:col-span-2 lg:col-span-3">
            <VerifiedInputWrapper name="address" label="Address">
              <input
                type="text"
                name="address"
                value={form?.address || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={inputCls}
              />
            </VerifiedInputWrapper>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <VerifiedInputWrapper
              name="atc"
              label="ATC (Additional Terms & Conditions)"
            >
              <textarea
                name="atc"
                value={form?.atc || ""}
                onChange={handleChange}
                disabled={readOnly}
                rows={4}
                className={textareaCls}
              />
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

          <VerifiedInputWrapper name="processor" label="Processor">
            <div className="flex gap-2">
              <input
                type="text"
                name="processor"
                value={form?.processor || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.processor_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="ram" label="RAM">
            <div className="flex gap-2">
              <input
                type="text"
                name="ram"
                value={form?.ram || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.ram_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="hdd" label="Hard Disk Drive">
            <div className="flex gap-2">
              <input
                type="text"
                name="hdd"
                value={form?.hdd || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.hdd_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="ssd1" label="Solid State Drive 1">
            <div className="flex gap-2">
              <input
                type="text"
                name="ssd1"
                value={form?.ssd1 || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.ssd1_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="ssd2" label="Solid State Drive 2">
            <div className="flex gap-2">
              <input
                type="text"
                name="ssd2"
                value={form?.ssd2 || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.ssd2_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="os" label="OS">
            <div className="flex gap-2">
              <input
                type="text"
                name="os"
                value={form?.os || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.os_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="dvd" label="DVD">
            <div className="flex gap-2">
              <input
                type="text"
                name="dvd"
                value={form?.dvd || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.dvd_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="wifi" label="WiFi Bluetooth">
            <div className="flex gap-2">
              <input
                type="text"
                name="wifi"
                value={form?.wifi || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.wifi_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="monitor" label="Monitor">
            <div className="flex gap-2">
              <input
                type="text"
                name="monitor"
                value={form?.monitor || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.monitor_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="cabinet" label="Cabinet">
            <div className="flex gap-2">
              <input
                type="text"
                name="cabinet"
                value={form?.cabinet || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.cabinet_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="keyboard" label="Keyboard & Mouse">
            <div className="flex gap-2">
              <input
                type="text"
                name="keyboard"
                value={form?.keyboard || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.keyboard_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="warranty" label="Warranty">
            <div className="flex gap-2">
              <input
                type="text"
                name="warranty"
                value={form?.warranty || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.warranty_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="motherboard" label="Motherboard">
            <div className="flex gap-2">
              <input
                type="text"
                name="motherboard"
                value={form?.motherboard || ""}
                onChange={handleChange}
                disabled={readOnly}
                className={flexInputCls}
              />
              <input
                type="text"
                value={form?.motherboard_price || ""}
                readOnly
                disabled
                placeholder="Price"
                className={priceCls}
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper
            name="pro_descp"
            label="Processor Description"
            optional
          >
            <textarea
              name="pro_descp"
              value={form?.pro_descp || ""}
              onChange={handleChange}
              disabled={readOnly}
              rows={2}
              className={textareaCls}
            />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper
            name="software1"
            label="Software Description"
            optional
          >
            <textarea
              name="software1"
              value={form?.software1 || ""}
              onChange={handleChange}
              disabled={readOnly}
              rows={2}
              className={textareaCls}
            />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper
            name="gp"
            label="Graphics Description"
            optional
          >
            <textarea
              name="gp"
              value={form?.gp || ""}
              onChange={handleChange}
              disabled={readOnly}
              rows={2}
              className={textareaCls}
            />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper
            name="motherboard_descp"
            label="Motherboard Description"
            optional
          >
            <textarea
              name="motherboard_descp"
              value={form?.motherboard_descp || ""}
              onChange={handleChange}
              disabled={readOnly}
              rows={2}
              className={textareaCls}
            />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="date" label="Bid End Date">
            <input
              type="date"
              name="date"
              value={form?.date || ""}
              onChange={handleChange}
              disabled={readOnly}
              className={inputCls}
            />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="epbg" label="EPBG (%)">
            <input
              type="text"
              name="epbg"
              value={form?.epbg || ""}
              onChange={handleChange}
              disabled={readOnly}
              className={inputCls}
            />
          </VerifiedInputWrapper>

          <VerifiedInputWrapper
            name="freight_price"
            label="Freight & Installation"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value="Yes"
                readOnly
                disabled
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50"
              />

              <input
                type="text"
                name="freight_price"
                value={form?.freight_price || "1000"}
                onChange={handleChange}
                disabled={readOnly}
                className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </VerifiedInputWrapper>

          <VerifiedInputWrapper name="hddreturnable" label="HDD Return Option">
            <div className="flex gap-2">
              <select
                name="hddreturnable"
                value={form?.hddreturnable || ""}
                onChange={handleChange}
                disabled={readOnly}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="Yes">Yes</option>
                <option value="None">None</option>
              </select>

              <input
                type="text"
                name="hddreturnable_price"
                value={form?.hddreturnable_price || ""}
                onChange={handleChange}
                disabled={readOnly}
                placeholder="Price"
                className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </VerifiedInputWrapper>
        </div>

        <div className="mt-8 mb-10 flex gap-3 items-start flex-wrap">
          {!readOnly && (
            <div className="relative flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-300 mr-4">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">
                  Assigned Model
                </label>

                <input
                  type="text"
                  name="model_number"
                  value={form?.model_number || ""}
                  onChange={handleChange}
                  placeholder="Enter or search model..."
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none w-64 font-semibold"
                />
              </div>

              <button
                type="button"
                onClick={handleFindModel}
                disabled={modelSearching}
                className="mt-4 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm"
              >
                {modelSearching ? "Searching..." : "Find Model"}
              </button>

              {showModelResult && (
                <div className="absolute left-0 top-full mt-2 w-[520px] max-h-[350px] overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-xl z-50">
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
                    <span className="text-sm font-bold text-gray-700">
                      Matching Models
                    </span>

                    <button
                      type="button"
                      onClick={() => setShowModelResult(false)}
                      className="text-xs text-red-500 font-semibold"
                    >
                      Close
                    </button>
                  </div>

                  {modelSearching ? (
                    <div className="p-4 text-sm text-gray-500">
                      Excel se model search ho raha hai...
                    </div>
                  ) : modelMatches.length === 0 ? (
                    <div className="p-4 text-sm text-red-500">
                      Koi matching model nahi mila.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {modelMatches.slice(0, 50).map((item, index) => (
                        <div
                          key={`${item.modelNo}-${index}`}
                          className="p-3 hover:bg-blue-50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => selectModelNumber(item.modelNo)}
                              className="text-left font-bold text-blue-700 hover:underline"
                            >
                              {item.modelNo}
                            </button>

                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                              {item.matchedCount}/{item.totalSpecs} matched
                            </span>
                          </div>

                          <div className="mt-1 text-xs text-gray-600">
                            {item.matchedSpecs
                              .map((s) => s.label)
                              .join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!readOnly && (
            <button
              type="submit"
              disabled={submitting || !allVerified}
              className={`font-semibold px-8 py-2.5 rounded-md text-sm transition flex items-center gap-2 ${
                allVerified
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {submitting ? (
                "Processing..."
              ) : (
                <>
                  <span>Accept & Send to Admin</span>
                  {!allVerified && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-300">
                      {requiredVerifiedCount} / {REQUIRED_FIELDS.length} Verified
                    </span>
                  )}
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition"
          >
            {readOnly ? "Back" : "Cancel"}
          </button>
        </div>
      </form>
    </div>
  );
}