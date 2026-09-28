import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL;

// Straight off Toner_Main_Specifications.pdf — Model Number and Country of
// Origin deliberately left out per that sheet's own note.
export const BRANDS = ["HP", "Canon", "Brother", "Epson", "Samsung", "Xerox", "Ricoh", "Kyocera", "Acxxel", "Nargle"];
export const CARTRIDGE_TYPES = ["Toner Cartridge", "Laser Toner", "Colour Toner"];
export const PRODUCT_CLASSES = ["OEM", "Compatible"];
export const COLOURS = ["Black", "Cyan", "Magenta", "Yellow", "All Colour"];
export const TECHNOLOGIES = ["Laser"];
export const PAGE_YIELDS = ["1,000", "1,500", "2,000", "2,500", "3,000", "5,000", "10,000", "30,000", "30,000+ Pages"];
export const YIELD_STANDARDS = [
  "ISO 9001", "ISO 14001", "ISO 45001", "ISO/IEC 19752", "ISO/IEC 19798", "ISO/IEC 29102",
  "ISO/IEC 28360", "ISO/IEC 27001", "ISO/IEC 17025", "ISO/IEC 24711", "CE Marking",
  "RoHS (2011/65/EU)", "REACH", "WEEE Directive", "FCC", "BIS/ISI Mark", "CPSIA",
  "UL Certification", "TÜV Mark", "GS Mark", "CB Scheme Certificate", "Energy Star", "EPEAT",
  "FSC Certification", "ISTA Certification", "BIS CRS", "E-Waste EPR Registration", "Manufacturer Rated",
];
export const CHIPS = ["With Chip", "Without Chip"];
export const PRINT_COVERAGES = ["5%"];
export const WARRANTIES = ["6 Months", "1 Year", "2 Years", "3 Years", "5 Years"];
export const WARRANTY_TYPES = ["Manufacturer Warranty", "Seller Warranty", "Replacement", "On-site", "Carry-in"];
export const QTY_PER_PACKS = ["1", "2", "3", "5", "10"];
export const COMPLIANCES = ["RoHS", "CE", "BIS", "ISO", "Other"];
export const REPLACEMENT_POLICIES = ["7 Days", "15 Days", "30 Days", "Defective Replacement"];
export const YES_NO = ["Yes", "No"];

// Deterministic per-brand color so any brand added later to the Excel sheet
// (toner_catalog.py) still gets a distinct, consistent badge color — no
// hardcoded brand list to maintain here.
const BRAND_COLOR_PALETTE = [
  { bg: "bg-sky-100", text: "text-sky-700", dot: "bg-sky-500" },
  { bg: "bg-rose-100", text: "text-rose-700", dot: "bg-rose-500" },
  { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  { bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" },
  { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
  { bg: "bg-teal-100", text: "text-teal-700", dot: "bg-teal-500" },
  { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", dot: "bg-fuchsia-500" },
  { bg: "bg-cyan-100", text: "text-cyan-700", dot: "bg-cyan-500" },
];
const brandColor = (brand) => {
  let hash = 0;
  for (let i = 0; i < (brand || "").length; i++) hash = (hash * 31 + brand.charCodeAt(i)) >>> 0;
  return BRAND_COLOR_PALETTE[hash % BRAND_COLOR_PALETTE.length];
};
const INK_COLOR_DOT = { Black: "bg-gray-900", Cyan: "bg-cyan-500", Magenta: "bg-pink-500", Yellow: "bg-yellow-400" };

const INITIAL_FORM = {
  brand: "", cartridge_type: "", product_class: "", colour: "", compatibility: "", technology: "",
  page_yield: "", yield_standard: "", chip: "", print_coverage: "",
  warranty: "", warranty_type: "", refillable: "", qty_per_pack: "",
  hsn_code: "", compliance: "", replacement_policy: "",
  date: "", unit_price: "", toner_models: [],
};

const getDraftKey = (bidId) => `toner_config_draft_${bidId || "new"}`;
const tonerKey = (t) => `${t.brand}||${t.tonerModel}`;
// toner_models arrives as a JSON string from the backend (same convention as
// selected_general_docs/verified_fields) but as a real array from a restored
// localStorage draft — accept either.
const parseToners = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const normalizeInitialForm = (source = {}) => ({
  ...INITIAL_FORM,
  ...source,
  toner_models: parseToners(source.toner_models ?? INITIAL_FORM.toner_models),
});

export default function TonerConfig({ bidData, onBack, onNext }) {
  const bid_id = bidData?.bid_id;
  const draftKey = useMemo(() => getDraftKey(bid_id), [bid_id]);

  const [form, setForm] = useState(() => {
    try {
      const savedDraft = localStorage.getItem(getDraftKey(bid_id));
      if (savedDraft) return normalizeInitialForm(JSON.parse(savedDraft));
    } catch (error) {
      console.warn("Unable to restore Toner configuration draft", error);
    }
    return normalizeInitialForm(bidData?.toner_config || bidData || {});
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const brandRef = useRef(null);
  const [tonerModelOpen, setTonerModelOpen] = useState(false);
  const [tonerModelSearch, setTonerModelSearch] = useState("");
  const tonerModelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (brandRef.current && !brandRef.current.contains(e.target)) setBrandOpen(false);
      if (tonerModelRef.current && !tonerModelRef.current.contains(e.target)) setTonerModelOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setForm((prev) => {
      try {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) return normalizeInitialForm(JSON.parse(savedDraft));
      } catch (error) {
        console.warn("Unable to restore Toner configuration draft", error);
      }
      return normalizeInitialForm({ ...bidData, ...prev });
    });
  }, [draftKey]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      console.warn("Unable to save Toner configuration draft", error);
    }
  }, [draftKey, form]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const selectedBrands = form.brand ? form.brand.split(",").map((b) => b.trim()).filter(Boolean) : [];

  const handleBrandToggle = (option) => {
    setForm((prev) => {
      const current = prev.brand ? prev.brand.split(",").map((b) => b.trim()).filter(Boolean) : [];
      const next = current.includes(option)
        ? current.filter((b) => b !== option)
        : [...current, option];
      return { ...prev, brand: next.join(", ") };
    });
  };

  // Toner Model multi-select — driven by backend/data/HP_Toner_Printer_Compatibility.xlsx
  // via the /toner-catalog/ endpoints (toner_catalog.py).
  const [tonerModels, setTonerModels] = useState([]);
  const [tonerModelsLoading, setTonerModelsLoading] = useState(false);
  const [tonerModelsError, setTonerModelsError] = useState("");
  const [tonerPrinters, setTonerPrinters] = useState({}); // tonerKey -> printers[]
  const [unionPrinters, setUnionPrinters] = useState([]);
  const [printersLoading, setPrintersLoading] = useState(false);
  const [printersError, setPrintersError] = useState("");
  const autoCompatibilityRef = useRef("");

  // Drop any selected toner whose brand got unchecked in the Brand field
  // (and clear everything if Brand is cleared entirely).
  useEffect(() => {
    const allowedBrands = form.brand ? form.brand.split(",").map((b) => b.trim()).filter(Boolean) : [];
    setForm((prev) => {
      const filtered = prev.toner_models.filter((t) => allowedBrands.includes(t.brand));
      if (filtered.length === prev.toner_models.length) return prev;
      return { ...prev, toner_models: filtered };
    });
  }, [form.brand]);

  useEffect(() => {
    const brands = form.brand ? form.brand.split(",").map((b) => b.trim()).filter(Boolean) : [];
    if (brands.length === 0) {
      setTonerModels([]);
      setTonerModelsError("");
      return;
    }
    let cancelled = false;
    setTonerModelsLoading(true);
    setTonerModelsError("");
    fetch(`${API_BASE}/toner-catalog/toners/?brands=${encodeURIComponent(brands.join(","))}`)
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setTonerModels(data.toners || []);
      })
      .catch(() => {
        if (!cancelled) {
          setTonerModels([]);
          setTonerModelsError("Unable to load toner models. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setTonerModelsLoading(false);
      });
    return () => { cancelled = true; };
  }, [form.brand]);

  useEffect(() => {
    if (form.toner_models.length === 0) {
      setTonerPrinters({});
      setUnionPrinters([]);
      setPrintersError("");
      return;
    }
    let cancelled = false;
    setPrintersLoading(true);
    setPrintersError("");
    fetch(`${API_BASE}/toner-catalog/printers/bulk/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toners: form.toner_models }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const map = {};
        (data.results || []).forEach((r) => { map[tonerKey(r)] = r.printers || []; });
        setTonerPrinters(map);
        setUnionPrinters(data.printers || []);
      })
      .catch(() => {
        if (!cancelled) {
          setTonerPrinters({});
          setUnionPrinters([]);
          setPrintersError("Unable to load compatible printers. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setPrintersLoading(false);
      });
    return () => { cancelled = true; };
  }, [form.toner_models]);

  // Compatibility auto-fills from the union of selected toners' printers, but
  // never silently overwrites a manual edit — it only appends printers the
  // user's text doesn't already mention.
  useEffect(() => {
    const autoValue = unionPrinters.map((p) => p.printerModel).join(", ");
    setForm((prev) => {
      const isUntouched = prev.compatibility === "" || prev.compatibility === autoCompatibilityRef.current;
      if (isUntouched) {
        autoCompatibilityRef.current = autoValue;
        return prev.compatibility === autoValue ? prev : { ...prev, compatibility: autoValue };
      }
      const existingLower = prev.compatibility.toLowerCase();
      const missing = unionPrinters.filter((p) => !existingLower.includes(p.printerModel.toLowerCase()));
      if (missing.length === 0) return prev;
      const base = prev.compatibility.trim().replace(/,\s*$/, "");
      const appended = `${base}${base ? ", " : ""}${missing.map((p) => p.printerModel).join(", ")}`;
      return { ...prev, compatibility: appended };
    });
  }, [unionPrinters]);

  // Colour of Ink: a single mono toner auto-picks its one colour; several
  // toners narrow the choices to colours common to all of them.
  useEffect(() => {
    if (form.toner_models.length !== 1) return;
    const entry = tonerModels.find((t) => t.brand === form.toner_models[0].brand && t.tonerModel === form.toner_models[0].tonerModel);
    if (!entry) return;
    const colours = [...new Set((entry.partNumbers || []).map((p) => p.color).filter(Boolean))];
    const derived = COLOURS.filter((c) => colours.includes(c));
    if (derived.length === 1) {
      setForm((prev) => (prev.colour === derived[0] ? prev : { ...prev, colour: derived[0] }));
    }
  }, [form.toner_models, tonerModels]);

  const handleToggleToner = (t) => {
    setForm((prev) => {
      const key = tonerKey(t);
      const exists = prev.toner_models.some((x) => tonerKey(x) === key);
      const next = exists
        ? prev.toner_models.filter((x) => tonerKey(x) !== key)
        : [...prev.toner_models, { brand: t.brand, tonerModel: t.tonerModel }];
      return { ...prev, toner_models: next };
    });
  };

  const selectedTonerKeys = form.toner_models.map(tonerKey);
  const getTonerEntry = (t) => tonerModels.find((tm) => tm.brand === t.brand && tm.tonerModel === t.tonerModel);

  const colourOptions = useMemo(() => {
    const selectedEntries = form.toner_models.map(getTonerEntry).filter(Boolean);
    const coloursOf = (entry) => [...new Set((entry.partNumbers || []).map((p) => p.color).filter(Boolean))];
    let options = COLOURS;
    if (selectedEntries.length === 1) {
      const derived = COLOURS.filter((c) => coloursOf(selectedEntries[0]).includes(c));
      if (derived.length) options = derived;
    } else if (selectedEntries.length > 1) {
      const perToner = selectedEntries.map(coloursOf);
      const common = COLOURS.filter((c) => perToner.every((set) => set.includes(c)));
      if (common.length) options = common;
    }
    if (form.colour && !options.includes(form.colour)) options = [...options, form.colour];
    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.toner_models, form.colour, tonerModels]);

  const tonerSearchLower = tonerModelSearch.trim().toLowerCase();
  const groupedTonerModels = selectedBrands.map((brand) => ({
    brand,
    items: tonerModels.filter(
      (t) => t.brand === brand &&
        (!tonerSearchLower ||
          t.tonerModel.toLowerCase().includes(tonerSearchLower) ||
          brand.toLowerCase().includes(tonerSearchLower))
    ),
  })).filter((g) => g.items.length > 0);

  // Compatibility is stored as one comma-separated string (same field the
  // backend/Excel-driven auto-fill already writes to) but shown as small
  // removable chips instead of a hard-to-read wrapped line of text.
  const [compatibilityInput, setCompatibilityInput] = useState("");
  const compatibilityItems = form.compatibility
    ? form.compatibility.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const addCompatibilityItem = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setForm((prev) => {
      const items = prev.compatibility ? prev.compatibility.split(",").map((s) => s.trim()).filter(Boolean) : [];
      if (items.includes(trimmed)) return prev;
      return { ...prev, compatibility: [...items, trimmed].join(", ") };
    });
    setCompatibilityInput("");
  };

  const removeCompatibilityItem = (item) => {
    setForm((prev) => {
      const items = prev.compatibility.split(",").map((s) => s.trim()).filter(Boolean).filter((x) => x !== item);
      return { ...prev, compatibility: items.join(", ") };
    });
  };

  const handleCompatibilityInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCompatibilityItem(compatibilityInput);
    } else if (e.key === "Backspace" && !compatibilityInput && compatibilityItems.length > 0) {
      removeCompatibilityItem(compatibilityItems[compatibilityItems.length - 1]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedBrands.length === 0) {
      setMsg("Please select at least one Brand");
      return;
    }
    if (compatibilityItems.length === 0) {
      setMsg("Please add at least one Compatibility entry");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = { ...form, toner_models: JSON.stringify(form.toner_models) };
      const res = await fetch(`${API_BASE}/toner-bids/${bid_id}/update/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMsg("Data Saved Successfully");
        localStorage.removeItem(draftKey);
        onNext({ ...form });
      } else {
        setMsg("Failed to Save Data");
      }
    } catch (error) {
      console.error(error);
      setMsg("Connection Error — Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  const SelectField = ({ label, name, options, required, optional }) => (
    <div className="col-span-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {optional && <span className="text-red-500 text-[11px] font-normal">*Optional</span>}
      </div>
      <select
        name={name}
        value={form[name]}
        onChange={handleChange}
        required={required}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
      >
        <option value="">Select</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-4 pt-2 border-b pb-2">
        <h5 className="text-lg font-semibold text-gray-800">Create Toner Configuration</h5>
      </div>

      {msg && (
        <div
          className={`mb-4 px-4 py-2 rounded text-sm font-medium ${
            msg.includes("Saved") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {msg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <div className="col-span-1 relative" ref={brandRef}>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Brand</label>
            </div>
            <button
              type="button"
              onClick={() => setBrandOpen((prev) => !prev)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 flex items-center justify-between"
            >
              <span className={selectedBrands.length ? "truncate" : "text-gray-400"}>
                {selectedBrands.length ? selectedBrands.join(", ") : "Select"}
              </span>
              <span className={`ml-2 shrink-0 transition-transform ${brandOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {brandOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto border border-gray-300 rounded-md bg-white shadow-lg py-1">
                {BRANDS.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(opt)}
                      onChange={() => handleBrandToggle(opt)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="col-span-1 relative" ref={tonerModelRef}>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Toner Model</label>
              <span className="text-red-500 text-[11px] font-normal">*Optional</span>
            </div>
            <button
              type="button"
              onClick={() => selectedBrands.length > 0 && !tonerModelsLoading && setTonerModelOpen((prev) => !prev)}
              disabled={selectedBrands.length === 0 || tonerModelsLoading}
              className="w-full min-h-[38px] border border-gray-300 rounded-md px-3 py-1.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-400 flex items-center justify-between gap-2"
            >
              {form.toner_models.length > 0 ? (
                <span className="flex flex-wrap gap-1 py-0.5">
                  {form.toner_models.map((t) => (
                    <span
                      key={tonerKey(t)}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${brandColor(t.brand).bg} ${brandColor(t.brand).text}`}
                    >
                      {selectedBrands.length > 1 && <span className={`h-1.5 w-1.5 rounded-full ${brandColor(t.brand).dot}`} />}
                      {t.tonerModel}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-gray-400">
                  {selectedBrands.length === 0 ? "Select Brand first" : tonerModelsLoading ? "Loading..." : "Select toner model(s)"}
                </span>
              )}
              <span className={`ml-2 shrink-0 transition-transform ${tonerModelOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {tonerModelOpen && selectedBrands.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
                <div className="p-2 border-b border-gray-100 flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={tonerModelSearch}
                    onChange={(e) => setTonerModelSearch(e.target.value)}
                    placeholder="Search toner model..."
                    className="flex-1 border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {form.toner_models.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, toner_models: [] }))}
                      className="shrink-0 text-xs text-gray-500 hover:text-red-600"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {groupedTonerModels.length === 0 && (
                    <div className="px-3 py-4 text-sm text-gray-400 text-center">
                      {tonerModelsError || "No toner models found."}
                    </div>
                  )}
                  {groupedTonerModels.map((group) => (
                    <div key={group.brand}>
                      {selectedBrands.length > 1 && (
                        <div className={`sticky top-0 px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${brandColor(group.brand).bg} ${brandColor(group.brand).text}`}>
                          {group.brand}
                        </div>
                      )}
                      {group.items.map((t) => {
                        const isSelected = selectedTonerKeys.includes(tonerKey(t));
                        return (
                          <label
                            key={tonerKey(t)}
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${isSelected ? "bg-blue-50" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleToner(t)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${brandColor(t.brand).dot}`} />
                            <span className={`flex-1 truncate ${isSelected ? "font-semibold text-blue-700" : "text-gray-700"}`}>{t.tonerModel}</span>
                            <span className="shrink-0 text-[10px] text-gray-400">{t.cartridgeType}</span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tonerModelsError && <p className="text-xs text-red-600 mt-1">{tonerModelsError}</p>}
            {!tonerModelsError && !tonerModelsLoading && selectedBrands.length > 0 && tonerModels.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No toner models available for the selected brand(s).</p>
            )}
          </div>
          <SelectField label="Type of Cartridge" name="cartridge_type" options={CARTRIDGE_TYPES} required />
          <SelectField label="Product Class of Cartridge" name="product_class" options={PRODUCT_CLASSES} required />
          <SelectField label="Colour of Ink" name="colour" options={colourOptions} required />

          {form.toner_models.length > 0 && (
            <div className="col-span-1 md:col-span-3 space-y-4">
              {form.toner_models.map((t) => {
                const entry = getTonerEntry(t);
                const printers = tonerPrinters[tonerKey(t)] || [];
                return (
                  <div key={tonerKey(t)} className="border border-gray-200 rounded-md bg-gray-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <label className="text-sm font-medium text-gray-700 underline">
                        {t.tonerModel}
                        <span className="ml-2 text-[11px] text-gray-500 font-normal no-underline">
                          {t.brand}
                          {entry?.cartridgeType ? ` • ${entry.cartridgeType}` : ""}
                        </span>
                      </label>
                      <div className="flex items-center gap-3">
                        {!printersLoading && !printersError && (
                          <span className="text-[11px] text-gray-500">
                            {printers.length} Compatible Printer{printers.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleToner(t)}
                          aria-label={`Remove ${t.tonerModel}`}
                          className="text-xs text-gray-400 hover:text-red-600"
                        >
                          ✕ Remove
                        </button>
                      </div>
                    </div>

                    {entry?.partNumbers?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {entry.partNumbers.map((p) => (
                          <span
                            key={`${p.color}-${p.partNo}`}
                            className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                          >
                            {p.color && <span className={`h-2 w-2 rounded-full ${INK_COLOR_DOT[p.color] || "bg-gray-400"}`} />}
                            <span className="font-medium">{p.color || "Part"}</span>
                            <span className="text-gray-300">·</span>
                            <span>{p.partNo}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {printersLoading && <div className="text-xs text-gray-400 mt-2">Loading compatible printers...</div>}
                    {printersError && <div className="text-xs text-red-600 mt-2">{printersError}</div>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="col-span-1 md:col-span-3">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Compatibility</label>
            </div>
            <div className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 flex flex-wrap gap-1.5">
              {compatibilityItems.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeCompatibilityItem(item)}
                    aria-label={`Remove ${item}`}
                    className="text-gray-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={compatibilityInput}
                onChange={(e) => setCompatibilityInput(e.target.value)}
                onKeyDown={handleCompatibilityInputKeyDown}
                onBlur={() => addCompatibilityItem(compatibilityInput)}
                placeholder={compatibilityItems.length === 0 ? "Compatible Printer / MFP Models or Series" : "Add another..."}
                className="flex-1 min-w-[140px] border-none outline-none text-sm py-1"
              />
            </div>
          </div>

          <SelectField label="Technology" name="technology" options={TECHNOLOGIES} required />
          <SelectField label="Page Yield" name="page_yield" options={PAGE_YIELDS} required />
          <SelectField label="Chip" name="chip" options={CHIPS} required />
          <SelectField label="Print Coverage" name="print_coverage" options={PRINT_COVERAGES} optional />
          <SelectField label="Warranty" name="warranty" options={WARRANTIES} required />
          <SelectField label="Warranty Type" name="warranty_type" options={WARRANTY_TYPES} required />
          <SelectField label="Refillable" name="refillable" options={YES_NO} required />
          <SelectField label="Quantity per Pack" name="qty_per_pack" options={QTY_PER_PACKS} required />
          <SelectField label="Compliance" name="compliance" options={COMPLIANCES} optional />
          <SelectField label="Replacement Policy" name="replacement_policy" options={REPLACEMENT_POLICIES} required />

          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">HSN Code</label>
            </div>
            <input
              type="text"
              name="hsn_code"
              value={form.hsn_code}
              onChange={handleChange}
              required
              placeholder="Applicable HSN Code"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
            <input
              type="text"
              name="unit_price"
              value={form.unit_price}
              onChange={handleChange}
              placeholder="Price"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Bid End Date</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-start items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-8 mb-10 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold px-6 py-2.5 rounded-md text-sm transition"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={saving}
            className="mt-8 mb-10 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition shadow-lg active:scale-95 whitespace-nowrap flex items-center gap-2"
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                View Bid Products at a Glance
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
