import { useEffect, useRef, useState } from "react";

const API = "http://127.0.0.1:8000/api";
const FALLBACK_IMAGE = "/src/assets/img1.png";

const CATEGORY_OPTIONS = ["Desktop", "AIO", "Workstation", "Printer", "Toner"];

const GEM_SECTIONS = [
  {
    title: "PROCESSOR",
    fields: ["Computer Type", "Processor Number"],
  },
  {
    title: "MOTHERBOARD",
    fields: [
      "Expansion Slots (PCIe x 1)",
      "Expansion Slots (PCIe x 4)",
      "Expansion Slots (PCIe x 16)",
      "Expansion Slots (M Dot 2) for SSD",
      "Expansion Slots (M Dot 2) for WiFi",
      "Trusted Platform Module",
    ],
  },
  {
    title: "GRAPHICS",
    fields: [
      "Graphics Type",
      "Graphic Card Make and Model - Must declare",
      "Size of Memory in Case of Dedicated Graphic Card(GB)",
    ],
  },
  {
    title: "OPERATING SYSTEM",
    fields: [
      "Factory Pre-loaded Operating System by DesktopOEM",
      "Recovery Media for OS",
    ],
  },
  {
    title: "MEMORY (RAM)",
    fields: [
      "Type of RAM",
      "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)",
      "Memory Expandable Up To (in GB)",
      "Total Numbers of DIMM Slots Available",
      "Number of DIMM Slots Populated with MemoryCard/Module",
    ],
  },
  {
    title: "STORAGE",
    fields: [
      "Type of Storage Installed with the System",
      "SSD - Storage Capacity (in GB)",
      "HDD - Storage Capacity (in GB)",
    ],
  },
  {
    title: "BAYS AVAILABILITY",
    fields: [
      "Number of Internal Bays Available, Size 2 Point 5 Inch",
      "Number of Internal Bay Populated, Size 2 Point 5Inch",
      "Number of Internal Bays Available, Size 3 Point 5 inch",
      "Number of Internal Bay Populated, Size 3 Point 5inch",
    ],
  },
  {
    title: "CABINET",
    fields: [
      "Cabinet Form Factor",
      "Bays for Optical Drive",
      "Optical Drive",
      "Audio Interface Type",
    ],
  },
  {
    title: "CONNECTIVITY",
    fields: ["Type of Ethernet Ports", "Number of Ethernet Ports"],
  },
  {
    title: "PORTS",
    fields: [
      "Number of USB Type A Port (Version 2 Point 0)",
      "Number of USB Type A Port (Version 3 point 2 Gen 1)",
      "Number of USB Ports Type C",
      "Number of VGA Ports",
      "Number of HDMI Ports",
      "Number of DP Ports",
    ],
  },
  {
    title: "MONITOR",
    fields: [
      "Availibility of Monitor",
      "Panel Type",
      "Display Technology",
      "Screen Size (in CMs)",
      "Maximum Resolution (Pixels)",
      "Image Aspect Ratio",
      "Brightness (in Nits)",
      "Refresh Rate (in Hz)",
      "Monitor Port",
      "Integrated Webcam with Mic",
      "Power Supply for Monitor",
      "Speaker",
    ],
  },
  {
    title: "INPUT DEVICES",
    fields: ["Mouse Connectivity", "Keyboard Connectivity", "Type of Keyboard"],
  },
  {
    title: "WARRANTY",
    fields: ["On Site OEM Warranty (in Year)"],
  },
];

const ALL_SPEC_FIELDS = GEM_SECTIONS.flatMap((section) => section.fields);

function cleanDisplayValue(value) {
  let text = String(value ?? "").trim();
  text = text.replace(/\n/g, " ").replace(/\r/g, " ");
  text = text
    .replace(/MonitorSystem/g, "Monitor System")
    .replace(/ProcessorMake/g, "Processor Make")
    .replace(/DesktopOEM/g, "Desktop OEM")
    .replace(/MemoryCard\/Module/g, "Memory Card/Module");
  return text.replace(/\s+/g, " ").trim();
}

function emptySpecs() {
  const obj = {};
  ALL_SPEC_FIELDS.forEach((field) => {
    obj[field] = "";
  });
  return obj;
}

function getExtraSpecs(product) {
  let specs = product?.extra_specs || {};
  if (typeof specs === "string") {
    try {
      specs = JSON.parse(specs);
    } catch {
      specs = {};
    }
  }

  return {
    ...emptySpecs(),
    ...(specs || {}),
  };
}

function getImage(product) {
  return product?.image || FALLBACK_IMAGE;
}

async function parseJsonResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!contentType.includes("application/json")) {
    console.log("Backend non-json response:", text);
    throw new Error(`Backend JSON nahi de raha. Status: ${res.status}`);
  }

  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || "Server error");
  return data;
}

function ProductDetailsModal({ product, onClose, onDeleted, onEdited }) {
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const specs = getExtraSpecs(product);

  const deleteProduct = async () => {
    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`${API}/catalogue/${product.id}/delete/`, {
        method: "DELETE",
      });

      await parseJsonResponse(res);
      onDeleted(product.id);
      onClose();
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      {showEdit && (
        <ProductFormModal
          mode="edit"
          product={product}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            onEdited(updated);
            setShowEdit(false);
            onClose();
          }}
        />
      )}

      <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10 shadow-sm">
          <h1 className="text-xl font-bold text-gray-800">
            Product Specification
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowEdit(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
            >
              ✏️ Edit
            </button>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-lg font-bold text-sm"
              >
                🗑️ Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600 font-semibold">
                  Sure?
                </span>
                <button
                  onClick={deleteProduct}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-bold text-sm"
                >
                  {deleting ? "Deleting..." : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm"
                >
                  Cancel
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
            >
              Close
            </button>
          </div>
        </div>

        {deleteError && (
          <div className="mx-8 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            ⚠️ {deleteError}
          </div>
        )}

        <div className="px-8 py-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="w-full h-[300px] border rounded-xl flex items-center justify-center bg-white shadow-sm">
              <img
                src={getImage(product)}
                alt={product.model_no}
                className="max-h-[280px] object-contain"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
            </div>

            <div className="lg:col-span-2 border rounded-xl p-6 bg-white shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 border-b pb-3 mb-4">
                Basic Information
              </h2>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-500 font-medium">Model No.</div>
                  <div className="text-gray-800 font-bold">
                    {product.model_no || "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-500 font-medium">Category</div>
                  <div className="text-gray-800">{product.category || "—"}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-500 font-medium">Processor</div>
                  <div className="text-gray-800">
                    {product.processor || "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-500 font-medium">RAM</div>
                  <div className="text-gray-800">{product.ram || "—"}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-500 font-medium">Storage</div>
                  <div className="text-gray-800">
                    {product.storage || "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-500 font-medium">OS</div>
                  <div className="text-gray-800">{product.os || "—"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {GEM_SECTIONS.map((section) => (
              <div
                key={section.title}
                className="border rounded-xl overflow-hidden shadow-sm"
              >
                <div className="bg-slate-800 px-5 py-3">
                  <h3 className="text-xs font-extrabold text-white tracking-widest uppercase">
                    {section.title}
                  </h3>
                </div>

                <div className="divide-y divide-gray-100">
                  {section.fields.map((field) => (
                    <div
                      key={field}
                      className="grid grid-cols-2 gap-4 px-5 py-3 text-sm"
                    >
                      <div className="text-gray-500 font-medium leading-snug">
                        {field}
                      </div>
                      <div className="text-gray-800 leading-snug break-words">
                        {cleanDisplayValue(specs[field])}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ProductFormModal({ mode = "add", product = null, onClose, onSaved }) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    model_no: product?.model_no || "",
    category: product?.category || "",
    processor: product?.processor || "",
    ram: product?.ram || "",
    storage: product?.storage || "",
    os: product?.os || "",
  });

  const [extraSpecs, setExtraSpecs] = useState(
    isEdit ? getExtraSpecs(product) : emptySpecs()
  );

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const imageRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setSpecValue = (key, value) => {
    setExtraSpecs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const onImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setError("");

    if (!form.model_no.trim()) {
      return setError("Model No. is required.");
    }

    if (!form.category.trim()) {
      return setError("Category is required.");
    }

    const fd = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      fd.append(key, value || "");
    });

    fd.append("description", "");
    fd.append("extra_specs", JSON.stringify(extraSpecs));

    if (imageFile) {
      fd.append("image", imageFile);
    }

    setSaving(true);

    try {
      const url = isEdit
        ? `${API}/catalogue/${product.id}/update/`
        : `${API}/catalogue/create/`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        body: fd,
      });

      const data = await parseJsonResponse(res);
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">
              {isEdit ? "Edit Product" : "Add Product"}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-600 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Product Image
              </label>

              <div
                className="h-72 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center cursor-pointer hover:border-blue-500 bg-gray-50 overflow-hidden"
                onClick={() => imageRef.current?.click()}
              >
                {imagePreview || product?.image ? (
                  <img
                    src={imagePreview || product?.image}
                    alt="preview"
                    className="w-full h-full object-contain p-4"
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK_IMAGE;
                    }}
                  />
                ) : (
                  <div className="text-center">
                    <div className="text-5xl mb-3">🖼️</div>
                    <div className="text-sm text-gray-500 font-semibold">
                      Click to upload image
                    </div>
                  </div>
                )}

                <input
                  ref={imageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onImageSelect}
                />
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Model No. <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.model_no}
                  onChange={(e) => setField("model_no", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                >
                  <option value="">Select Category</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {[
                { label: "Processor", key: "processor" },
                { label: "RAM", key: "ram" },
                { label: "Storage", key: "storage" },
                { label: "OS", key: "os" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {field.label}
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form[field.key]}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 space-y-5">
            {GEM_SECTIONS.map((section) => (
              <div
                key={section.title}
                className="border rounded-2xl overflow-hidden bg-white"
              >
                <div className="bg-slate-800 px-5 py-3">
                  <h3 className="text-xs font-extrabold text-white tracking-widest uppercase">
                    {section.title}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-gray-50">
                  {section.fields.map((field) => (
                    <div key={field}>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        {field}
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={extraSpecs[field] || ""}
                        onChange={(e) => setSpecValue(field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-5 mt-5 border-t justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
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

export default function CatalogueProducts() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.append("search", search.trim());
      }

      if (categoryFilter !== "All") {
        params.append("category", categoryFilter);
      }

      const query = params.toString();
      const url = query ? `${API}/catalogue/?${query}` : `${API}/catalogue/`;

      const res = await fetch(url);
      const data = await parseJsonResponse(res);

      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter]);

  const addProductToList = (product) => {
    if (categoryFilter !== "All" && product.category !== categoryFilter) {
      return;
    }

    setProducts((prev) => [product, ...prev]);
  };

  const updateProductInList = (updated) => {
    setProducts((prev) => {
      if (categoryFilter !== "All" && updated.category !== categoryFilter) {
        return prev.filter((p) => p.id !== updated.id);
      }

      return prev.map((p) => (p.id === updated.id ? updated : p));
    });
  };

  const removeProductFromList = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {showAdd && (
        <ProductFormModal
          mode="add"
          onClose={() => setShowAdd(false)}
          onSaved={addProductToList}
        />
      )}

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onDeleted={removeProductFromList}
          onEdited={updateProductInList}
        />
      )}

      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                Catalogue Products
              </h1>
            </div>

            <button
              onClick={() => setShowAdd(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl text-sm font-bold"
            >
              + Add Product
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {["All", ...CATEGORY_OPTIONS].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${
                  categoryFilter === cat
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchProducts();
            }}
            className="mt-5 flex gap-3"
          >
            <input
              type="text"
              placeholder="Search by model no."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-bold">
              Search
            </button>
          </form>

          {loadError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              ⚠️ {loadError}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="px-5 py-4 text-left w-20">S.No.</th>
                  <th className="px-5 py-4 text-left w-28">Image</th>
                  <th className="px-5 py-4 text-left">Model</th>
                  <th className="px-5 py-4 text-left">Category</th>
                  <th className="px-5 py-4 text-left w-40">View Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      No products found.
                    </td>
                  </tr>
                ) : (
                  products.map((product, index) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-semibold text-gray-700">
                        {index + 1}
                      </td>

                      <td className="px-5 py-4">
                        <div className="w-16 h-16 border rounded-lg bg-white flex items-center justify-center overflow-hidden">
                          <img
                            src={getImage(product)}
                            alt={product.model_no}
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              e.currentTarget.src = FALLBACK_IMAGE;
                            }}
                          />
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900">
                          {product.model_no || "—"}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-gray-700">
                        {product.category || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}