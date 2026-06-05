import { useState, useEffect, useRef } from "react";

const IMAGES = [
  "/src/assets/img1.png",
  "/src/assets/img2.png",
  "/src/assets/img3.png",
  "/src/assets/img4.png",
  "/src/assets/img5.png",
];

const API = "http://127.0.0.1:8000/api";

function getImage(model_no, customImage) {
  if (customImage) return customImage;
  let hash = 0;
  for (let i = 0; i < model_no.length; i++) {
    hash += model_no.charCodeAt(i);
  }
  return IMAGES[hash % IMAGES.length];
}

// ════════════════════════════════════════════════════════════════════════════
// PDF → Backend extraction
// ════════════════════════════════════════════════════════════════════════════
async function extractSpecsFromPDF(file) {
  const fd = new FormData();
  fd.append("pdf", file);
  const res = await fetch(`${API}/catalogue/extract-pdf/`, { method: "POST", body: fd });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: "Invalid JSON response from server" };
  }
  if (!res.ok) throw new Error(data.error || "Server error");
  return data;
}

// ════════════════════════════════════════════════════════════════════════════
// Edit Product Modal
// ════════════════════════════════════════════════════════════════════════════
function EditProductModal({ product, onClose, onSaved }) {
  const parseExtraSpecs = () => {
    let obj = {};
    try {
      if (typeof product.extra_specs === "string" && product.extra_specs)
        obj = JSON.parse(product.extra_specs);
      else if (typeof product.extra_specs === "object" && product.extra_specs !== null)
        obj = product.extra_specs;
    } catch { obj = {}; }
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  };

  const [form, setForm] = useState({
    model_no: product.model_no || "",
    description: product.description || "",
    processor: product.processor || "",
    ram: product.ram || "",
    storage: product.storage || "",
    os: product.os || "",
    category: product.category || "",
  });
  const [extraSpecs, setExtraSpecs] = useState(parseExtraSpecs);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const updateExtraSpec = (index, field, value) => {
    const updated = [...extraSpecs];
    updated[index][field] = value;
    setExtraSpecs(updated);
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.model_no.trim()) return setError("Model No. is required.");

    const extraSpecsObject = {};
    extraSpecs.forEach((item) => {
      if (item.key.trim() && item.value.trim())
        extraSpecsObject[item.key.trim()] = item.value.trim();
    });

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("extra_specs", JSON.stringify(extraSpecsObject));
    if (imageFile) fd.append("image", imageFile);

    setSaving(true);
    try {
      const res = await fetch(`${API}/catalogue/${product.id}/update/`, {
        method: "PATCH",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      if (typeof data.extra_specs === "string") {
        try { data.extra_specs = JSON.parse(data.extra_specs); }
        catch { data.extra_specs = extraSpecsObject; }
      } else if (!data.extra_specs) {
        data.extra_specs = extraSpecsObject;
      }
      onSaved(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const currentImg = imagePreview || getImage(product.model_no, product.image);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">Edit Product</h2>
            <p className="text-xs text-gray-400 mt-1">Update product details and specifications</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-600 text-2xl font-bold">✕</button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">⚠️ {error}</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Product Image</label>
              <div
                className="h-72 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 bg-gray-50 overflow-hidden transition"
                onClick={() => fileRef.current?.click()}
              >
                <img
                  src={currentImg}
                  alt="preview"
                  className="w-full h-full object-contain p-4"
                  onError={(e) => { e.target.src = IMAGES[0]; }}
                />
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">Click image to change</p>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Model No.", key: "model_no", required: true },
                { label: "Category", key: "category", placeholder: "Desktop / AIO / Workstation / Printer / Toner" },
                { label: "Processor Number", key: "processor", placeholder: "Intel Core i7 12700" },
                { label: "Operating System", key: "os", placeholder: "Windows 11 Professional" },
                { label: "RAM Size", key: "ram", placeholder: "16 GB DDR4" },
                { label: "Storage", key: "storage", placeholder: "512 GB NVMe SSD" },
              ].map(({ label, key, required, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    placeholder={placeholder || ""}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description of Stores</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Extra Specs */}
          <div className="mt-7 border rounded-2xl p-5 bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-gray-800">Additional Specifications</h3>
                <p className="text-xs text-gray-400">Extra field name aur value add karo</p>
              </div>
              <button
                onClick={() => setExtraSpecs([...extraSpecs, { key: "", value: "" }])}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
              >
                + Add Specification
              </button>
            </div>
            <div className="space-y-3">
              {extraSpecs.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Field Name e.g. Warranty"
                    className="md:col-span-5 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={item.key}
                    onChange={(e) => updateExtraSpec(index, "key", e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Field Value e.g. 3 Years"
                    className="md:col-span-6 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={item.value}
                    onChange={(e) => updateExtraSpec(index, "value", e.target.value)}
                  />
                  <button
                    onClick={() => setExtraSpecs(extraSpecs.filter((_, i) => i !== index))}
                    className="md:col-span-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl py-3 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-5 mt-5 border-t justify-end">
            <button onClick={onClose} className="px-6 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-8 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Product Detail Modal
// ════════════════════════════════════════════════════════════════════════════
function ProductDescriptionModal({ product, onClose, onDeleted, onEdited }) {
  const img = getImage(product.model_no, product.image);
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  let extraSpecs = {};
  try {
    if (typeof product.extra_specs === "string" && product.extra_specs)
      extraSpecs = JSON.parse(product.extra_specs);
    else if (typeof product.extra_specs === "object" && product.extra_specs !== null)
      extraSpecs = product.extra_specs;
  } catch { extraSpecs = {}; }

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`${API}/catalogue/${product.id}/delete/`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete");
      }
      onDeleted(product.id);
      onClose();
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const specs = [
    ["Model No.", product.model_no],
    ["Description of Stores", product.description || "Desktop Computer System"],
    ["Computer Type", product.category || "—"],
    ["Processor Number", product.processor || "—"],
    ["Factory Pre-loaded Operating System", product.os || "—"],
    ["RAM Size", product.ram || "—"],
    ["Type of Storage Installed", product.storage || "—"],
    ["Category", product.category || "—"],
    ...Object.entries(extraSpecs),
  ];

  return (
    <>
      {showEdit && (
        <EditProductModal
          product={product}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { onEdited(updated); setShowEdit(false); onClose(); }}
        />
      )}
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10 shadow-sm">
          <h1 className="text-xl font-bold text-gray-800">Product Specification</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowEdit(true)} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm">
              ✏️ Edit
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-lg font-bold text-sm">
                🗑️ Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600 font-semibold">Sure?</span>
                <button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-bold text-sm">
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm">
                  Cancel
                </button>
              </div>
            )}
            <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm">Close</button>
          </div>
        </div>

        {deleteError && (
          <div className="mx-10 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">⚠️ {deleteError}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-10 py-8">
          <div className="flex flex-col items-center">
            <div className="w-full h-[430px] bg-white flex items-center justify-center border rounded-xl shadow-sm">
              <img
                src={img}
                alt={product.model_no}
                className="max-h-[400px] object-contain"
                onError={(e) => { e.target.src = IMAGES[0]; }}
              />
            </div>
          </div>

          <div className="border rounded-xl p-6 bg-white shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-3 mb-4">Specifications</h2>
            <div className="space-y-4 text-sm">
              {specs.map(([label, value]) => (
                <div key={label} className="grid grid-cols-2 gap-6">
                  <div className="text-gray-500 font-medium">{label}</div>
                  <div className="text-gray-800 leading-relaxed">{value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Add Product Modal — PDF Upload + Manual Entry
// ════════════════════════════════════════════════════════════════════════════
function AddProductModal({ onClose, onSaved }) {
  const [inputMode, setInputMode] = useState("manual");
  const [form, setForm] = useState({
    model_no: "",
    description: "",
    processor: "",
    ram: "",
    storage: "",
    os: "",
    category: "",
  });
  const [extraSpecs, setExtraSpecs] = useState([{ key: "", value: "" }]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const imgRef = useRef();

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const pdfRef = useRef();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handlePdfSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfFile(file);
    setPdfSuccess(false);
    setPdfError("");
  };

  const handleExtractFromPDF = async () => {
    if (!pdfFile) return setPdfError("Please select a PDF file first.");
    setPdfExtracting(true);
    setPdfError("");
    setPdfSuccess(false);
    try {
      const extracted = await extractSpecsFromPDF(pdfFile);
      setForm((f) => ({
        model_no: extracted.model_no || f.model_no,
        description: extracted.description || f.description,
        processor: extracted.processor || f.processor,
        ram: extracted.ram || f.ram,
        storage: extracted.storage || f.storage,
        os: extracted.os || f.os,
        category: extracted.category || f.category,
      }));
      if (extracted.extra_specs && Object.keys(extracted.extra_specs).length > 0) {
        const rows = Object.entries(extracted.extra_specs).map(([key, value]) => ({ key, value: String(value) }));
        setExtraSpecs(rows.length > 0 ? rows : [{ key: "", value: "" }]);
      }
      setPdfSuccess(true);
      setInputMode("manual");
    } catch (err) {
      setPdfError("PDF se details extract nahi ho payi. (" + err.message + ")");
    } finally {
      setPdfExtracting(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.model_no.trim()) return setError("Model No. is required.");

    const extraSpecsObject = {};
    extraSpecs.forEach((item) => {
      if (item.key.trim() && item.value.trim())
        extraSpecsObject[item.key.trim()] = item.value.trim();
    });

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("extra_specs", JSON.stringify(extraSpecsObject));
    if (imageFile) fd.append("image", imageFile);

    setSaving(true);
    try {
      const res = await fetch(`${API}/catalogue/create/`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      if (typeof data.extra_specs === "string") {
        try { data.extra_specs = JSON.parse(data.extra_specs); }
        catch { data.extra_specs = extraSpecsObject; }
      } else if (!data.extra_specs) {
        data.extra_specs = extraSpecsObject;
      }
      onSaved(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { label: "Model No.", key: "model_no", required: true },
    { label: "Category", key: "category", placeholder: "Desktop / AIO / Workstation / Printer / Toner" },
    { label: "Processor Number", key: "processor", placeholder: "Intel Core i7 12700" },
    { label: "Operating System", key: "os", placeholder: "Windows 11 Professional" },
    { label: "RAM Size", key: "ram", placeholder: "16 GB DDR4" },
    { label: "Storage", key: "storage", placeholder: "512 GB NVMe SSD" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">Add Product</h2>
            <p className="text-xs text-gray-400 mt-1">Image, model number aur specifications add karo</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-600 text-2xl font-bold">✕</button>
        </div>

        <div className="p-6">
          {/* MODE TABS */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setInputMode("manual")}
              className={`border rounded-2xl p-4 text-left transition ${inputMode === "manual" ? "border-slate-800 bg-slate-50" : "border-gray-200 hover:border-gray-400"}`}
            >
              <div className="text-base font-extrabold text-gray-800">✍️ Manual Entry</div>
              <p className="text-xs text-gray-400 mt-1">Specifications manually fill karo</p>
            </button>
            <button
              type="button"
              onClick={() => setInputMode("pdf")}
              className={`border rounded-2xl p-4 text-left transition ${inputMode === "pdf" ? "border-slate-800 bg-slate-50" : "border-gray-200 hover:border-gray-400"}`}
            >
              <div className="text-base font-extrabold text-gray-800">📄 Upload PDF</div>
              <p className="text-xs text-gray-400 mt-1">GeM brochure PDF — AI auto-fills sab specs</p>
            </button>
          </div>

          {/* PDF PANEL */}
          {inputMode === "pdf" && (
            <div className="mb-6 border-2 border-dashed border-blue-200 bg-blue-50 rounded-2xl p-6">
              <h3 className="text-sm font-extrabold text-blue-800 mb-1">📄 GeM PDF Auto-Fill</h3>
              <p className="text-xs text-blue-600 mb-4">
                GeM portal se download ki gayi product PDF upload karo. AI automatically sari details fill karega.
              </p>
              <div
                className="border-2 border-dashed border-blue-300 rounded-xl flex flex-col items-center justify-center gap-3 py-8 cursor-pointer hover:border-blue-500 bg-white transition"
                onClick={() => pdfRef.current?.click()}
              >
                {pdfFile ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-3xl">📋</span>
                    <span className="text-sm font-semibold text-gray-700">{pdfFile.name}</span>
                    <span className="text-xs text-gray-400">{(pdfFile.size / 1024).toFixed(1)} KB — Click to change</span>
                  </div>
                ) : (
                  <>
                    <span className="text-4xl">📂</span>
                    <span className="text-sm font-semibold text-gray-600">Click to select PDF</span>
                    <span className="text-xs text-gray-400">GeM product brochure / specification sheet</span>
                  </>
                )}
                <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfSelect} />
              </div>

              {pdfError && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-lg">⚠️ {pdfError}</div>
              )}
              {pdfSuccess && (
                <div className="mt-3 bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-2.5 rounded-lg">
                  ✅ Details extracted! Neeche review karo aur missing fields fill karo.
                </div>
              )}

              <button
                onClick={handleExtractFromPDF}
                disabled={!pdfFile || pdfExtracting}
                className="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2"
              >
                {pdfExtracting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    AI PDF padh raha hai...
                  </>
                ) : "🤖 AI se Details Extract Karo"}
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">⚠️ {error}</div>
          )}

          {/* FORM */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Product Image</label>
              <div
                className="h-72 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 bg-gray-50 overflow-hidden transition"
                onClick={() => imgRef.current?.click()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="w-full h-full object-contain p-4" />
                ) : (
                  <>
                    <span className="text-5xl mb-3">🖼️</span>
                    <span className="text-sm text-gray-500 font-semibold">Click to upload product image</span>
                    <span className="text-xs text-gray-400 mt-1">PNG / JPG / JPEG</span>
                  </>
                )}
                <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(({ label, key, required, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description of Stores</label>
                <textarea
                  rows={3}
                  placeholder="Desktop Computer System"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* EXTRA SPECS */}
          <div className="mt-7 border rounded-2xl p-5 bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-gray-800">Additional Specifications</h3>
                <p className="text-xs text-gray-400">PDF se auto-fill ya manually add karo</p>
              </div>
              <button
                onClick={() => setExtraSpecs([...extraSpecs, { key: "", value: "" }])}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
              >
                + Add Specification
              </button>
            </div>
            <div className="space-y-3">
              {extraSpecs.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Field Name e.g. Warranty"
                    className="md:col-span-5 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={item.key}
                    onChange={(e) => {
                      const u = [...extraSpecs];
                      u[index].key = e.target.value;
                      setExtraSpecs(u);
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Field Value e.g. 3 Years"
                    className="md:col-span-6 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={item.value}
                    onChange={(e) => {
                      const u = [...extraSpecs];
                      u[index].value = e.target.value;
                      setExtraSpecs(u);
                    }}
                  />
                  <button
                    onClick={() => setExtraSpecs(extraSpecs.filter((_, i) => i !== index))}
                    className="md:col-span-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl py-3 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-5 mt-5 border-t justify-end">
            <button onClick={onClose} className="px-6 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-8 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl"
            >
              {saving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Delete All Confirmation Modal
// ════════════════════════════════════════════════════════════════════════════
function DeleteAllModal({ totalCount, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDeleteAll = async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`${API}/catalogue/delete-all/`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      onDeleted();
      onClose();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-5xl mb-4">🗑️</div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">Delete All Products?</h2>
          <p className="text-gray-500 text-sm mb-2">
            Yeh action <strong className="text-red-600">{totalCount} products</strong> permanently delete kar dega.
          </p>
          <p className="text-gray-400 text-xs mb-6">Baad mein PDF se naye products add kar sakte ho.</p>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">⚠️ {error}</div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={deleting}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl"
            >
              {deleting ? "Deleting..." : `Yes, Delete All ${totalCount}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════
export default function AnalyserProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`${API}/catalogue/?${params.toString()}`);
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();

      const parsed = data.map((p) => {
        if (typeof p.extra_specs === "string" && p.extra_specs) {
          try { return { ...p, extra_specs: JSON.parse(p.extra_specs) }; }
          catch { return { ...p, extra_specs: {} }; }
        }
        return p;
      });

      setProducts(parsed);
    } catch {
      setError("Backend se connect nahi ho pa raha.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [search, categoryFilter]);

  const categories = ["Desktop", "AIO", "Workstation", "Printer", "Toner"];

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {showAdd && (
        <AddProductModal
          onClose={() => setShowAdd(false)}
          onSaved={(newProduct) => setProducts((prev) => [newProduct, ...prev])}
        />
      )}

      {showDeleteAll && (
        <DeleteAllModal
          totalCount={products.length}
          onClose={() => setShowDeleteAll(false)}
          onDeleted={() => {
            setProducts([]);
            fetchProducts();
          }}
        />
      )}

      {detailProduct && (
        <ProductDescriptionModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onDeleted={(id) => setProducts((prev) => prev.filter((p) => p.id !== id))}
          onEdited={(updated) =>
            setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          }
        />
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Product Catalogue</h1>
          {!loading && (
            <p className="text-xs text-gray-400 mt-1">{products.length} products</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Delete All Button — sirf tab dikhao jab products hain */}
          {products.length > 0 && (
            <button
              onClick={() => setShowDeleteAll(true)}
              className="inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              🗑️ Delete All ({products.length})
            </button>
          )}

          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow transition-colors whitespace-nowrap"
          >
            <span className="text-base">＋</span> Add Product
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="px-6 py-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search model no. ya processor..."
          className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          {["", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                categoryFilter === cat
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-gray-500 border-gray-200 hover:border-slate-400"
              }`}
            >
              {cat || "All"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mb-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">⚠️ {error}</div>
      )}

      {/* TABLE */}
      <div className="px-6 pb-10">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-800">
                  {["S.No.", "Image", "Model No.", "Category", "Processor", "Description"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="6" className="text-center py-16 text-gray-400 font-medium">
                      Loading products...
                    </td>
                  </tr>
                )}

                {!loading && products.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-16 text-gray-400 font-medium">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-4xl">📦</span>
                        <div>
                          <p className="font-bold text-gray-600">Koi product nahi mila</p>
                          <p className="text-sm mt-1">
                            <strong>Add Product</strong> par click karo aur PDF upload karo
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  products.map((product, i) => {
                    const img = getImage(product.model_no, product.image);
                    return (
                      <tr key={product.id || product.model_no} className="bg-white hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-5 text-sm font-bold text-gray-600 border-b border-gray-100">{i + 1}</td>

                        <td className="px-6 py-5 border-b border-gray-100">
                          <img
                            src={img}
                            alt={product.model_no}
                            className="w-20 h-20 object-contain rounded-xl bg-slate-50 border border-gray-200 p-2 shadow-sm"
                            onError={(e) => { e.target.src = IMAGES[0]; }}
                          />
                        </td>

                        <td className="px-6 py-5 border-b border-gray-100">
                          <span className="text-sm font-bold text-indigo-600 whitespace-nowrap">{product.model_no}</span>
                        </td>

                        <td className="px-6 py-5 border-b border-gray-100">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            product.category === "Desktop" ? "bg-blue-100 text-blue-700" :
                            product.category === "AIO" ? "bg-purple-100 text-purple-700" :
                            product.category === "Workstation" ? "bg-orange-100 text-orange-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {product.category || "—"}
                          </span>
                        </td>

                        <td className="px-6 py-5 border-b border-gray-100">
                          <span className="text-xs text-gray-600 font-medium">{product.processor || "—"}</span>
                        </td>

                        <td className="px-6 py-5 border-b border-gray-100">
                          <button
                            onClick={() => setDetailProduct(product)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-semibold underline underline-offset-2"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {!loading && products.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 font-medium">
              Showing {products.length} product{products.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}