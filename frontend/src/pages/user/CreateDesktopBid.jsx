import React, { useState, useEffect } from "react";
import DesktopConfig from "./DesktopConfig";
import {
  FaUpload,
  FaFileAlt,
  FaCheckCircle,
  FaFolderOpen,
  FaFileSignature,
} from "react-icons/fa";

const API_BASE = "http://127.0.0.1:8000/api";

const GENERAL_DOCS = [
  { id: "exp",  label: "Experience Criteria"            },
  { id: "perf", label: "Past Performance"               },
  { id: "turn", label: "Bidder Turnover"                },
  { id: "cert", label: "Certificate (Requested in ATC)" },
  { id: "oem",  label: "OEM Authorization Certificate"  },
  { id: "oemT", label: "OEM Annual Turnover"            },
];

const Label = ({ children, optional }) => (
  <label className="block text-sm font-normal text-gray-800 mb-1">
    {children}
    {optional && (
      <span className="text-gray-500 ml-1">
        (Optional)
      </span>
    )}
  </label>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`w-full bg-white border border-gray-400 text-gray-900 rounded px-3 py-[6px] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${className}`}
    {...props}
  />
);

// ─── General Doc Popup ────────────────────────────────────────────────────────
function GeneralDocPopup({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const uploadedCount = Object.values(value).filter(Boolean).length;

  const handleFile = (id, file) => {
    if (file) onChange((prev) => ({ ...prev, [id]: file }));
  };

  const handleRemove = (id) => {
    onChange((prev) => ({ ...prev, [id]: null }));
  };

  return (
    <div className="relative inline-block">

      {/* BUTTON INSIDE TEXTAREA */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-800 text-[11px] font-semibold px-2.5 py-1 rounded shadow-sm transition-all select-none"
      >
        <FaFolderOpen className="text-[10px]" />
        General
        {uploadedCount > 0 && (
          <span className="bg-orange-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {uploadedCount}
          </span>
        )}
      </button>

      {/* POPUP */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute bottom-full right-0 mb-2 z-50 w-[320px] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
              <span className="text-sm font-semibold text-orange-800">General Documents</span>
              <span className={`text-xs font-semibold px-2 py-[2px] rounded-full ${
                uploadedCount === GENERAL_DOCS.length
                  ? "bg-green-100 text-green-700"
                  : uploadedCount > 0
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {uploadedCount} / {GENERAL_DOCS.length}
              </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
              {GENERAL_DOCS.map((doc) => {
                const file = value[doc.id];
                const isUploaded = !!file;

                return (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-3 px-4 py-[10px] transition-colors ${
                      isUploaded ? "bg-green-50" : "hover:bg-gray-50"
                    }`}
                  >
                    {/* Auto tick */}
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                      isUploaded ? "bg-green-500 border-green-500" : "bg-white border-gray-300"
                    }`}>
                      {isUploaded && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Label */}
                    <span className={`flex-1 text-xs ${isUploaded ? "text-green-800 font-medium" : "text-gray-700"}`}>
                      {doc.label}
                    </span>

                    {/* Right side */}
                    {isUploaded ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-green-700 max-w-[70px] truncate" title={file.name}>
                          {file.name}
                        </span>
                        <label className="cursor-pointer text-[10px] text-blue-600 hover:underline">
                          Replace
                          <input type="file" className="hidden" onChange={(e) => handleFile(doc.id, e.target.files[0])} />
                        </label>
                        <button type="button" onClick={() => handleRemove(doc.id)} className="text-[10px] text-red-500 hover:underline">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-1 bg-orange-100 hover:bg-orange-200 border border-orange-400 text-orange-700 text-[10px] font-semibold px-2 py-[3px] rounded-md cursor-pointer transition-all select-none">
                        <FaUpload className="text-[8px]" />
                        Upload
                        <input type="file" className="hidden" onChange={(e) => handleFile(doc.id, e.target.files[0])} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CreateDesktopBid() {

  const [step, setStep] = useState(() => {
    return Number(localStorage.getItem("desktop_bid_step")) || 1;
  });

  const [allData, setAllData] = useState(() => {
    const savedData = localStorage.getItem("desktop_bid_data");
    return savedData ? JSON.parse(savedData) : { bid_id: null };
  });

  useEffect(() => {
    localStorage.setItem("desktop_bid_step", step);
  }, [step]);

  useEffect(() => {
    localStorage.setItem("desktop_bid_data", JSON.stringify(allData));
  }, [allData]);

  useEffect(() => {
    window.history.pushState({ step }, "");

    const handleBack = (e) => {
      e.preventDefault();
      if (step > 1) {
        const newStep = step - 1;
        setStep(newStep);
        localStorage.setItem("desktop_bid_step", newStep);
        window.history.pushState({ step: newStep }, "");
      } else {
        localStorage.removeItem("desktop_bid_step");
        localStorage.removeItem("desktop_bid_data");
        window.history.back();
      }
    };

    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, [step]);

  const handleHeaderBack = () => {
    if (step > 1) {
      const newStep = step - 1;
      setStep(newStep);
      localStorage.setItem("desktop_bid_step", newStep);
    } else {
      localStorage.removeItem("desktop_bid_step");
      localStorage.removeItem("desktop_bid_data");
      window.history.back();
    }
  };

  const handleStep1Submit = (data) => {
    setAllData({ ...allData, ...data });
    setStep(2);
  };

  const handleStep2Submit = (data) => {
    alert("Bid Created Successfully ✅");
    localStorage.removeItem("desktop_bid_step");
    localStorage.removeItem("desktop_bid_data");
    setAllData({ bid_id: null });
    setStep(1);
    window.location.href = "/user";
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">

      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 shadow-sm">
        <div className="max-w-[1750px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">

            {/* BACK BUTTON */}
            <button
              type="button"
              onClick={handleHeaderBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-200 shadow-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>

            <span className="text-lg font-black text-gray-900 tracking-tight">
              Create New Bid
            </span>
            <div className="h-6 w-[1px] bg-gray-200"></div>
            <span className="text-blue-600 font-bold text-sm">
              Step {step} of 2
            </span>
          </div>
          <div className="w-1/3 h-[6px] bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${(step / 2) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 w-full max-w-[1750px] mx-auto p-8 flex justify-center items-start">
        {step === 1 && <Step1Form onNext={handleStep1Submit} savedData={allData} />}
        {step === 2 && <DesktopConfig bidData={allData} onNext={handleStep2Submit} />}
      </div>
    </div>
  );
}

function Step1Form({ onNext, savedData }) {

  const [form, setForm] = useState({
    bid_no: savedData?.bid_no || "",
    dept_name: savedData?.dept_name || "",
    qty: savedData?.qty || "",
    atc: savedData?.atc || "",
    address: savedData?.address || "",
    organization: savedData?.organization || "",
    pincode: savedData?.pincode || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [atcSpecialFile, setAtcSpecialFile] = useState(null);
  
  const [generalDocs, setGeneralDocs] = useState({
    exp: null, perf: null, turn: null, cert: null, oem: null, oemT: null,
  });

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const handleAtcSpecialFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setAtcSpecialFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (savedData?.bid_id) {
        onNext({ ...form, bid_id: savedData.bid_id });
        return;
      }

      const formData = new FormData();
      formData.append("bid_no", form.bid_no);
      formData.append("dept_name", form.dept_name);
      formData.append("qty", form.qty);
      formData.append("atc", form.atc);
      formData.append("address", form.address);
      formData.append("organization", form.organization);
      formData.append("pincode", form.pincode);
      formData.append("user_id", localStorage.getItem("user_id"));

      if (selectedFile) formData.append("upload_document", selectedFile);
      if (atcSpecialFile) formData.append("atc_special_document", atcSpecialFile);
      
      Object.entries(generalDocs).forEach(([key, file]) => {
        if (file) formData.append(`general_${key}`, file);
      });

      const response = await fetch(`${API_BASE}/desktop-bids/create/`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("CREATE BID RESPONSE => ", data);

      if (!response.ok) throw new Error(data.error || "Failed");

      onNext({ ...form, bid_id: data.bid_id });

    } catch (err) {
      console.log(err);
      setError("Bid create nahi ho pa raha.");
    } finally {
      setLoading(false);
    }
  };

  const FilePreview = ({ file }) => (
    <div className="mt-2 border border-green-300 bg-green-50 rounded-lg px-4 py-3 flex items-center gap-3">
      <FaFileAlt className="text-green-700 text-lg" />
      <div className="flex-1 overflow-hidden">
        <p className="text-sm font-medium text-green-800 truncate">{file.name}</p>
        <p className="text-xs text-green-700">{(file.size / 1024).toFixed(2)} KB</p>
      </div>
      <FaCheckCircle className="text-green-600 text-lg" />
    </div>
  );

  return (
    <div className="w-full max-w-[600px] bg-white p-6 rounded-xl border border-gray-200 shadow-sm">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <h5 className="text-lg font-semibold text-gray-800">
          Create Desktop Bid
        </h5>
      </div>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2 rounded">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* BID NUMBER */}
        <div>
          <Label>Bid Number</Label>
          <Input
            type="text"
            placeholder="Enter Bid Number"
            value={form.bid_no}
            onChange={(e) => handleChange("bid_no", e.target.value)}
            required
          />
        </div>

        {/* DEPARTMENT */}
        <div>
          <Label>Department Name</Label>
          <Input
            type="text"
            placeholder="Enter Department Name"
            value={form.dept_name}
            onChange={(e) => handleChange("dept_name", e.target.value)}
            required
          />
        </div>

        <div>
          <Label>Organization Name</Label>
          <Input
            type="text"
            placeholder="Enter Organization Name"
            value={form.organization}
            onChange={(e) => handleChange("organization", e.target.value)}
            required
          />
        </div>

        <div>
          <Label>Address</Label>
          <Input
            type="text"
            placeholder="Enter Address"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            required
          />
        </div>

        {/* QTY + PIN */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              placeholder="Enter Quantity"
              value={form.qty}
              onChange={(e) => handleChange("qty", e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Pin Code</Label>
            <Input
              type="number"
              placeholder="Enter PIN Code"
              value={form.pincode}
              onChange={(e) => handleChange("pincode", e.target.value)}
              required
            />
          </div>
        </div>

        {/* ATC SECTION WITH BUTTONS INSIDE */}
        <div>
          <Label>ATC Details</Label>

          <div className="relative group">
            <textarea
              rows={6}
              value={form.atc}
              onChange={(e) => handleChange("atc", e.target.value)}
              placeholder="Type ATC details here..."
              className="w-full bg-white border border-gray-400 text-gray-900 rounded px-3 pt-2 pb-10 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />

            {/* BUTTONS CONTAINER - Bottom Right Inside Textarea */}
            <div className="absolute bottom-2 right-2 flex items-center gap-2 opacity-90 transition-opacity">
              
              {/* SPECIAL DOCUMENT BUTTON */}
              <label className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-800 text-[11px] font-semibold px-2.5 py-1 rounded shadow-sm cursor-pointer transition-all select-none">
                <FaFileSignature className="text-[10px]" />
                Special
                {atcSpecialFile && (
                  <FaCheckCircle className="text-green-600 text-[10px]" />
                )}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleAtcSpecialFileChange}
                />
              </label>

              {/* GENERAL DOCUMENTS BUTTON */}
              <GeneralDocPopup value={generalDocs} onChange={setGeneralDocs} />

            </div>
          </div>
          
          {/* Preview for Special File if uploaded */}
          {atcSpecialFile && <FilePreview file={atcSpecialFile} />}
        </div>

        {/* SUBMIT */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-4 py-3 rounded-lg transition shadow-sm"
          >
            {loading ? "Saving..." : "Submit & Next"}
          </button>
        </div>

      </form>
    </div>
  );
}