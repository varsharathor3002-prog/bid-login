import { useState, useEffect, useRef } from "react";

// ─── Image pool (5 assets, repeated) ───────────────────────────────────────
const IMAGES = [
  "/src/assets/img1.png",
  "/src/assets/img2.png",
  "/src/assets/img3.png",
  "/src/assets/img4.png",
  "/src/assets/img5.png",
];

// ─── Pre-loaded catalogue from Excel ───────────────────────────────────────
const EXCEL_PRODUCTS = [];

const API = "http://127.0.0.1:8000/api";

function getImage(model_no, customImage) {
  if (customImage) return customImage;

  let hash = 0;

  for (let i = 0; i < model_no.length; i++) {
    hash += model_no.charCodeAt(i);
  }

  return IMAGES[hash % IMAGES.length];
}

const CATEGORY_BADGE = {
  Desktop: "bg-blue-100 text-blue-700",
  AIO: "bg-violet-100 text-violet-700",
  Workstation: "bg-amber-100 text-amber-700",
};

// ════════════════════════════════════════════════════════════════════════════
// Product Description Full Page Modal
// ════════════════════════════════════════════════════════════════════════════

function ProductDescriptionModal({ product, onClose }) {
  const img = getImage(product.model_no, product.image);

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      {/* TOP BAR */}
      <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10 shadow-sm">
        <h1 className="text-xl font-bold text-gray-800">
          Product Specification
        </h1>

        <button
          onClick={onClose}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold"
        >
          Close
        </button>
      </div>

      {/* DETAIL BODY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-10 py-8">
        {/* LEFT IMAGE SECTION */}
        <div className="flex flex-col items-center">
          <div className="w-full h-[430px] bg-white flex items-center justify-center border rounded-xl shadow-sm">
            <img
              src={img}
              alt={product.model_no}
              className="max-h-[400px] object-contain"
              onError={(e) => {
                e.target.src = IMAGES[0];
              }}
            />
          </div>

          <div className="mt-5 flex gap-4">
            {/* {[img, img, img].map((image, index) => (
              <div
                key={index}
                className="w-32 h-28 border-2 border-blue-500 rounded-lg flex items-center justify-center p-2 bg-white"
              >
                <img
                  src={image}
                  alt="thumb"
                  className="max-h-full object-contain"
                  onError={(e) => {
                    e.target.src = IMAGES[0];
                  }}
                />
              </div>
            ))} */}
          </div>
        </div>

        {/* RIGHT SPECIFICATION SECTION */}
        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 border-b pb-3 mb-4">
            Specifications
          </h2>

          <div className="space-y-4 text-sm">
            {[
              ["Model No.", product.model_no],
              [
                "Description of Stores",
                product.description || "Desktop Computer System",
              ],
              ["Computer Type", product.category || "—"],
              ["Processor Number", product.processor || "—"],
              ["Factory Pre-loaded Operating System", product.os || "—"],
              ["RAM Size", product.ram || "—"],
              ["Type of Storage Installed", product.storage || "—"],
              ["Category", product.category || "—"],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-2 gap-6">
                <div className="text-gray-500 font-medium">{label}</div>

                <div className="text-gray-800 leading-relaxed">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Add Product Modal
// ════════════════════════════════════════════════════════════════════════════

function AddProductModal({ onClose, onSaved, presetModelNo = "" }) {
  const [form, setForm] = useState({
    model_no: presetModelNo,
    description: "",
  });

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

  const handleSubmit = async () => {
    setError("");

    if (!form.model_no.trim()) {
      return setError("Model No. is required.");
    }

    const excel = EXCEL_PRODUCTS.find(
      (p) =>
        p.model_no.toLowerCase() ===
        form.model_no.trim().toLowerCase()
    );

    const fd = new FormData();

    fd.append("model_no", form.model_no.trim());
    fd.append("description", form.description);

    if (excel) {
      fd.append("processor", excel.processor || "");
      fd.append("ram", excel.ram || "");
      fd.append("storage", excel.storage || "");
      fd.append("os", excel.os || "");
      fd.append("category", excel.category || "");
    }

    if (imageFile) {
      fd.append("image", imageFile);
    }

    setSaving(true);

    try {
      const res = await fetch(`${API}/catalogue/create/`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save");
      }

      onSaved(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-900">
            Add Product
          </h2>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
            ⚠️ {error}
          </div>
        )}

        {/* IMAGE UPLOAD */}
        <div
          className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 py-6 cursor-pointer hover:border-blue-400 transition-colors relative overflow-hidden"
          onClick={() => fileRef.current?.click()}
        >
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="preview"
              className="max-h-40 object-contain rounded-lg"
            />
          ) : (
            <>
              <span className="text-3xl">🖼️</span>

              <span className="text-sm text-gray-400 font-medium">
                Click to upload product image
              </span>
            </>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImage}
          />
        </div>

        {/* MODEL NO */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            Model No. <span className="text-red-500">*</span>
          </label>

          <input
            type="text"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Enter model no."
            value={form.model_no}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                model_no: e.target.value,
              }))
            }
          />
        </div>

        {/* DESCRIPTION */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            Description
          </label>

          <textarea
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Enter product description, warranty info, special features..."
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                description: e.target.value,
              }))
            }
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {saving ? "Saving..." : "Add Product"}
          </button>
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
  const [detailProduct, setDetailProduct] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (search) {
        params.set("search", search);
      }

      if (categoryFilter) {
        params.set("category", categoryFilter);
      }

      const res = await fetch(`${API}/catalogue/?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Server error");
      }

      const data = await res.json();

      setProducts(data);
    } catch {
      setError("Backend se connect nahi ho pa raha.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, categoryFilter]);

  const categories = ["Desktop", "AIO", "Workstation", "Printer", "Toner"];

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* MODALS */}
      {showAdd && (
        <AddProductModal
          onClose={() => setShowAdd(false)}
          onSaved={(newProduct) =>
            setProducts((prev) => [newProduct, ...prev])
          }
        />
      )}

      {detailProduct && (
        <ProductDescriptionModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
        />
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
            Product Catalogue
          </h1>

        
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow transition-colors whitespace-nowrap"
        >
          <span className="text-base">＋</span> Add Product
        </button>
      </div>

      {/* FILTERS */}
      <div className="px-6 py-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search model no..."
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

      {/* ERROR */}
      {error && (
        <div className="mx-6 mb-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {/* TABLE */}
      <div className="px-6 pb-10">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-800">
                  {["S.No.", "Image", "Model No.", "Description"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan="4"
                      className="text-center py-16 text-gray-400 font-medium"
                    >
                      Loading products...
                    </td>
                  </tr>
                )}

                {!loading && products.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="text-center py-16 text-gray-400 font-medium"
                    >
                      No products found. Click{" "}
                      <strong>Add Product</strong> to get started.
                    </td>
                  </tr>
                )}

                {!loading &&
                  products.map((product, i) => {
                    const img = getImage(product.model_no, product.image);

                    return (
                      <tr
                        key={product.id || product.model_no}
                        className="bg-white hover:bg-gray-50 transition-colors"
                      >
                        {/* S.NO */}
                        <td className="px-6 py-5 text-sm font-bold text-gray-600 border-b border-gray-100">
                          {i + 1}
                        </td>

                        {/* IMAGE BIGGER */}
                        <td className="px-6 py-5 border-b border-gray-100">
                          <img
                            src={img}
                            alt={product.model_no}
                            className="w-32 h-32 object-contain rounded-xl bg-slate-50 border border-gray-200 p-2 shadow-sm"
                            onError={(e) => {
                              e.target.src = IMAGES[0];
                            }}
                          />
                        </td>

                        {/* MODEL NO */}
                        <td className="px-6 py-5 border-b border-gray-100">
                          <span className="text-sm font-bold text-indigo-600 whitespace-nowrap">
                            {product.model_no}
                          </span>
                        </td>

                        {/* DESCRIPTION LINK */}
                        <td className="px-6 py-5 border-b border-gray-100">
                          <button
                            onClick={() => setDetailProduct(product)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-semibold underline underline-offset-2"
                          >
                            View Description
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
              Showing {products.length} product
              {products.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}