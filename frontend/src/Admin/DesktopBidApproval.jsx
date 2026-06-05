import { useEffect, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";

const TABS = [
  {
    id: "pending",
    label: "Pending",
    icon: "⏳",
    color: "text-amber-600",
    border: "border-amber-600",
  },
  {
    id: "re-analyze",
    label: "Re-Analyze",
    icon: "⚠️",
    color: "text-rose-600",
    border: "border-rose-600",
  },
  {
    id: "approved",
    label: "Approved",
    icon: "✅",
    color: "text-emerald-600",
    border: "border-emerald-600",
  },
];

const GENERAL_DOCS = [
  { id: "exp",  label: "Experience Criteria",            key: "general_exp"  },
  { id: "perf", label: "Past Performance",               key: "general_perf" },
  { id: "turn", label: "Bidder Turnover",                key: "general_turn" },
  { id: "cert", label: "Certificate (Requested in ATC)", key: "general_cert" },
  { id: "oem",  label: "OEM Authorization Certificate",  key: "general_oem"  },
  { id: "oemT", label: "OEM Annual Turnover",            key: "general_oemT" },
];

const PriceField = ({
  label,
  name,
  priceName,
  form,
  handleChange,
  isTextArea = false,
  optional = false,
}) => {
  return (
    <div className="col-span-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>

        {optional && (
          <span className="text-red-500 text-[11px]">
            *Optional
          </span>
        )}
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
};


function GeneralDocsViewPopup({ form }) {
  const [open, setOpen] = useState(false);

  const availableDocs = GENERAL_DOCS.filter((doc) => form?.[doc.key]);
  const uploadedCount = availableDocs.length;

  const handleDownload = async (url, filename) => {
    try {
      const fullUrl = url.startsWith("http") ? url : `http://127.0.0.1:8000${url}`;
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
          <div className={`p-2 rounded-full ${open ? "bg-orange-200 text-orange-700" : "bg-orange-100 text-orange-600 group-hover:bg-orange-200"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-800">General Documents</div>
            <div className="text-xs text-gray-500">Experience, Turnover, OEM Certs, etc.</div>
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
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
              <span className="text-sm font-semibold text-orange-800">Available General Documents</span>
              <span className={`text-xs font-semibold px-2 py-[2px] rounded-full ${
                uploadedCount === GENERAL_DOCS.length
                  ? "bg-green-100 text-green-700"
                  : uploadedCount > 0
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {uploadedCount} / {GENERAL_DOCS.length} Uploaded
              </span>
            </div>

            <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
              {GENERAL_DOCS.map((doc) => {
                const url = form?.[doc.key];
                const isUploaded = !!url;
                const fullUrl = url && !url.startsWith("http") ? `http://127.0.0.1:8000${url}` : url;
                const filename = url ? url.split("/").pop() : "";

                return (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isUploaded ? "bg-white hover:bg-green-50" : "bg-gray-50"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border ${
                      isUploaded ? "bg-green-500 border-green-500" : "bg-white border-gray-300"
                    }`}>
                      {isUploaded && (
                        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    <span className={`flex-1 text-sm ${isUploaded ? "text-gray-800 font-medium" : "text-gray-400"}`}>
                      {doc.label}
                    </span>

                    {isUploaded ? (
                      <div className="flex items-center gap-3">
                        <a href={fullUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          View
                        </a>
                        <button type="button" onClick={() => handleDownload(fullUrl, filename)} className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                          Download
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Not uploaded</span>
                    )}
                  </div>
                );
              })}
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

  const fullUrl = url.startsWith("http") ? url : `http://127.0.0.1:8000${url}`;
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
          <div className="p-2 rounded-full bg-purple-200 text-purple-700 group-hover:bg-purple-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-purple-900">Special Document</div>
            <div className="text-xs text-purple-700">ATC Specific Requirement</div>
          </div>
       </div>

       <div className="flex items-center gap-2">
          <a href={fullUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-white border border-purple-200 rounded hover:bg-purple-50 transition">
            View File
          </a>
          <button type="button" onClick={handleDownload} className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 shadow-sm transition flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
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
  const ROWS_PER_PAGE = 8;
  const MAX_PAGE_BTNS = 5;

  useEffect(() => {
    fetchBids();
    fetchReAnalyzeCount();
    setCurrentPage(1);
  }, [activeTab]);

  const getAnalyserName = (bid) => {
    return (
      bid.analyser_name ||
      bid.analyzer_name ||
      bid.analyser ||
      bid.analyzer ||
      bid.analysed_by ||
      bid.analyzed_by ||
      bid.created_by ||
      bid.user_name ||
      "-"
    );
  };

  const fetchBids = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/desktop-bids/list/?status=${activeTab}&role=admin`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const normalized = data.map((bid) => ({
        ...bid,
        analyser_display_name: bid.analyser_name || bid.analyzer_name || bid.analyser || bid.analyzer || bid.analysed_by || bid.analyzed_by || bid.created_by || bid.user_name || "-",
        model_number: bid.model_number || bid.model || "",
        ssd1: bid.ssd1 || bid.ssd || "",
        ssd1_price: bid.ssd1_price || bid.ssd_price || "",
        upload_document: bid.upload_document || bid.document || bid.bid_document || "",
        compliance_file: bid.compliance_file || bid.compliance_document || "",
        atc: bid.atc || "",
      }));
      setBids(normalized);
    } catch (error) {
      console.log(error);
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
    } catch (error) {
      console.log(error);
      setReAnalyzeCount(0);
    }
  };

  const openModal = (bid) => {
    const formattedBid = { ...bid, analyser_display_name: getAnalyserName(bid) };
    if (formattedBid.upload_document && !formattedBid.upload_document.startsWith("http")) {
      formattedBid.upload_document = `http://127.0.0.1:8000${formattedBid.upload_document}`;
    }
    if (formattedBid.compliance_file && !formattedBid.compliance_file.startsWith("http")) {
      formattedBid.compliance_file = `http://127.0.0.1:8000${formattedBid.compliance_file}`;
    }
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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDownload = async (fileUrl) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileUrl.split("/").pop() || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert("File download failed");
    }
  };

  const handleAction = async (action) => {
    setSubmitting(true);
    setMsg("");
    try {
      const formData = new FormData();
      Object.keys(form).forEach((key) => { formData.append(key, form[key] || ""); });
      formData.append("ssd", form.ssd1 || "");
      formData.append("ssd_price", form.ssd1_price || "");
      formData.append("status", action);
      formData.append("admin_note", adminNote);
      formData.append("admin_username", localStorage.getItem("username") || "");
      const res = await fetch(`${API_BASE}/desktop-bids/${form.id}/admin-review/`, { method: "PATCH", body: formData });
      const data = await res.json();
      if (res.ok) {
        setMsg(action === "approved" ? "✅ Bid Approved Successfully!" : "⚠️ Sent back to Analyser");
        setTimeout(() => { closeModal(); fetchBids(); fetchReAnalyzeCount(); }, 1200);
      } else {
        setMsg(data.error || "Something went wrong");
      }
    } catch (error) {
      console.log(error);
      setMsg("Server error");
    } finally {
      setSubmitting(false);
    }
  };

  const StatusBadge = ({ status }) => {
    if (status === "approved") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">✅ Approved</span>;
    if (status === "pending") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">⏳ Pending</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">⚠️ Re-Analyze</span>;
  };

  const TABLE_HEADS = [
    { label: "S.No",       width: "w-16"   },
    { label: "Analyser",   width: "w-36"   },
    { label: "Department", width: "w-40"   },
    { label: "Bid No",     width: "w-36"   },
    { label: "Model",      width: "w-40"   },
    { label: "Status",     width: "w-32"   },
    { label: "Action",     width: "w-24"   },
  ];

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
  
      <div className="flex gap-3 px-6 pt-3 bg-gray-50 border-b border-gray-200 overflow-visible">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[52px] px-4 py-3 text-sm font-semibold transition-all flex items-center gap-2 rounded-t-lg border-b-2 ${
              activeTab === tab.id
                ? `${tab.color} ${tab.border} bg-white shadow-sm`
                : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-white"
            }`}
          >
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

      {loading ? (
        <div className="p-20 text-center text-gray-400">Loading...</div>
      ) : bids.length === 0 ? (
        <div className="p-20 text-center text-gray-400">No records found</div>
      ) : (() => {
        const totalPages = Math.ceil(bids.length / ROWS_PER_PAGE);
        const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
        const pageBids = bids.slice(startIdx, startIdx + ROWS_PER_PAGE);

        
        const half = Math.floor(MAX_PAGE_BTNS / 2);
        let pageStart = Math.max(1, currentPage - half);
        let pageEnd = Math.min(totalPages, pageStart + MAX_PAGE_BTNS - 1);
        if (pageEnd - pageStart < MAX_PAGE_BTNS - 1) {
          pageStart = Math.max(1, pageEnd - MAX_PAGE_BTNS + 1);
        }
        const pageNums = [];
        for (let p = pageStart; p <= pageEnd; p++) pageNums.push(p);

        return (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="bg-slate-800">
                    {TABLE_HEADS.map((head) => (
                      <th
                        key={head.label}
                        className={`${head.width} px-4 py-4 text-[11px] font-bold text-white uppercase tracking-wide text-center`}
                      >
                        {head.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {pageBids.map((bid, i) => (
                    <tr
                      key={bid.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4 text-sm text-gray-700 text-center">
                        {startIdx + i + 1}
                      </td>

                      <td className="px-4 py-4 text-sm text-gray-700 text-center truncate">
                        {bid.analyser_display_name}
                      </td>

                      <td className="px-4 py-4 text-sm text-gray-700 text-center truncate">
                        {bid.dept_name}
                      </td>

                      <td className="px-4 py-4 text-sm text-blue-600 font-semibold text-center truncate">
                        {bid.bid_no}
                      </td>

                      <td className="px-4 py-4 text-sm text-gray-700 text-center truncate">
                        {bid.model_number}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <div className="flex justify-center">
                          <StatusBadge status={bid.status} />
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => openModal(bid)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-xs font-semibold transition-colors"
                          >
                            View
                          </button>
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
                  Showing{" "}
                  <span className="font-semibold text-gray-700">
                    {startIdx + 1}–{Math.min(startIdx + ROWS_PER_PAGE, bids.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-700">{bids.length}</span>
                </p>

        
                <div className="flex items-center gap-1">
   
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed
                      bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Prev
                  </button>

                
                  {pageStart > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        className="w-8 h-8 rounded-md text-xs font-semibold border bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all"
                      >
                        1
                      </button>
                      {pageStart > 2 && (
                        <span className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">…</span>
                      )}
                    </>
                  )}

                  {pageNums.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-md text-xs font-semibold border transition-all ${
                        p === currentPage
                          ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                          : "bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800"
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  {pageEnd < totalPages && (
                    <>
                      {pageEnd < totalPages - 1 && (
                        <span className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        className="w-8 h-8 rounded-md text-xs font-semibold border bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}

              
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed
                      bg-white border-gray-300 text-gray-600 hover:bg-slate-800 hover:text-white hover:border-slate-800"
                  >
                    Next
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        );
      })()}

  
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Review & Update Desktop</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Bid No: <span className="text-blue-600 font-semibold ml-1">{selected.bid_no}</span>
                </p>
              </div>
              <button type="button" onClick={closeModal} className="text-2xl text-gray-400 hover:text-gray-700">×</button>
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
                  <input type="text" name="bid_no" value={form?.bid_no || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model Number</label>
                  <input type="text" name="model_number" value={form?.model_number || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input type="text" name="dept_name" value={form?.dept_name || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input type="text" name="qty" value={form?.qty || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input type="text" name="pincode" value={form?.pincode || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bid Date</label>
                  <input type="date" name="date" value={form?.date || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea name="address" value={form?.address || ""} onChange={handleChange} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ATC</label>
                  <textarea name="atc" value={form?.atc || ""} onChange={handleChange} rows={4} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500" />
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

                <PriceField label="Processor" name="processor" priceName="processor_price" form={form} handleChange={handleChange} />
                <PriceField label="RAM" name="ram" priceName="ram_price" form={form} handleChange={handleChange} />
                <PriceField label="Hard Disk Drive" name="hdd" priceName="hdd_price" form={form} handleChange={handleChange} />
                <PriceField label="Solid State Drive 1" name="ssd1" priceName="ssd1_price" form={form} handleChange={handleChange} />
                <PriceField label="Solid State Drive 2" name="ssd2" priceName="ssd2_price" form={form} handleChange={handleChange} />
                <PriceField label="OS" name="os" priceName="os_price" form={form} handleChange={handleChange} />
                <PriceField label="DVD" name="dvd" priceName="dvd_price" form={form} handleChange={handleChange} />
                <PriceField label="WiFi Bluetooth" name="wifi" priceName="wifi_price" form={form} handleChange={handleChange} />
                <PriceField label="Monitor" name="monitor" priceName="monitor_price" form={form} handleChange={handleChange} />
                <PriceField label="Cabinet" name="cabinet" priceName="cabinet_price" form={form} handleChange={handleChange} />
                <PriceField label="Keyboard & Mouse" name="keyboard" priceName="keyboard_price" form={form} handleChange={handleChange} />
                <PriceField label="Warranty" name="warranty" priceName="warranty_price" form={form} handleChange={handleChange} />
                <PriceField label="Motherboard" name="motherboard" priceName="motherboard_price" form={form} handleChange={handleChange} />
                <PriceField label="Processor Description" name="pro_descp" isTextArea optional form={form} handleChange={handleChange} />
                <PriceField label="Software Description" name="software1" isTextArea optional form={form} handleChange={handleChange} />
                <PriceField label="Graphics Description" name="gp" isTextArea optional form={form} handleChange={handleChange} />
                <PriceField label="Motherboard Description" name="motherboard_descp" isTextArea optional form={form} handleChange={handleChange} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EPBG (%)</label>
                  <input type="text" name="epbg" value={form?.epbg || ""} onChange={handleChange} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Freight & Installation</label>
                  <div className="flex gap-2">
                    <input type="text" value="Yes" readOnly className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50" />
                    <input type="text" name="freight_price" value={form?.freight_price || ""} onChange={handleChange} placeholder="Price" className="w-28 border border-blue-300 rounded-md px-2 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HDD Return Option</label>
                  <div className="flex gap-2">
                    <select name="hddreturnable" value={form?.hddreturnable || ""} onChange={handleChange} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="Yes">Yes</option>
                      <option value="None">None</option>
                    </select>
                    <input type="text" name="hddreturnable_price" value={form?.hddreturnable_price || ""} onChange={handleChange} placeholder="Price" className="w-28 border border-blue-300 rounded-md px-2 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                {selected.status !== "approved" && (
                  <div className="md:col-span-2 lg:col-span-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <label className="block text-sm font-bold text-amber-800 mb-2">Admin Review Note</label>
                    <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} placeholder="Write review note..." className="w-full border border-amber-200 rounded-md px-3 py-2 text-sm resize-none outline-none" />
                  </div>
                )}
              </div>

              <div className="mt-8 flex gap-3 flex-wrap">
                {selected.status === "pending" && (
                  <>
                    <button type="button" disabled={submitting} onClick={() => handleAction("approved")} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition">
                      {submitting ? "Processing..." : "✅ Approve Bid"}
                    </button>
                    <button type="button" disabled={submitting} onClick={() => handleAction("re-analyze")} className="bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition">
                      {submitting ? "Processing..." : "⚠️ Send to Re-Analyze"}
                    </button>
                  </>
                )}
                <button type="button" onClick={closeModal} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition">
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