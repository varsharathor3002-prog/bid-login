import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL;

// Straight off Toner_Main_Specifications.pdf — Model Number and Country of
// Origin deliberately left out per that sheet's own note.
export const BRANDS = ["HP", "Canon", "Brother", "Epson", "Samsung", "Xerox", "Ricoh", "Kyocera", "Acxxel", "Nargle"];
export const CARTRIDGE_TYPES = ["Toner Cartridge", "Laser Toner", "Colour Toner"];
export const COLOURS = ["Black", "Cyan", "Magenta", "Yellow", "All Colour"];
export const TECHNOLOGIES = ["Laser"];
export const PAGE_YIELDS = ["1,000", "1,500", "2,000", "2,500", "3,000", "5,000", "10,000", "30,000", "30,000+ Pages"];
export const YIELD_STANDARDS = ["ISO/IEC 19752", "ISO/IEC 19798", "ISO/IEC 24711", "Manufacturer Rated"];
export const CHIPS = ["With Chip", "Without Chip"];
export const PRINT_COVERAGES = ["5%"];
export const WARRANTIES = ["6 Months", "1 Year", "2 Years", "3 Years", "5 Years"];
export const WARRANTY_TYPES = ["Manufacturer Warranty", "Seller Warranty", "Replacement", "On-site", "Carry-in"];
export const QTY_PER_PACKS = ["1", "2", "3", "5", "10"];
export const COMPLIANCES = ["RoHS", "CE", "BIS", "ISO", "Other"];
export const REPLACEMENT_POLICIES = ["7 Days", "15 Days", "30 Days", "Defective Replacement"];
export const YES_NO = ["Yes", "No"];

const INITIAL_FORM = {
  brand: "", cartridge_type: "", colour: "", compatibility: "", technology: "",
  page_yield: "", yield_standard: "", chip: "", print_coverage: "",
  warranty: "", warranty_type: "", refillable: "", qty_per_pack: "",
  hsn_code: "", compliance: "", replacement_policy: "",
  date: "", unit_price: "",
};

const getDraftKey = (bidId) => `toner_config_draft_${bidId || "new"}`;
const normalizeInitialForm = (source = {}) => ({ ...INITIAL_FORM, ...source });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const payload = { ...form };
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
          <SelectField label="Brand" name="brand" options={BRANDS} required />
          <SelectField label="Cartridge Type" name="cartridge_type" options={CARTRIDGE_TYPES} required />
          <SelectField label="Colour" name="colour" options={COLOURS} required />

          <div className="col-span-1 md:col-span-3">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Compatibility</label>
            </div>
            <textarea
              name="compatibility"
              value={form.compatibility}
              onChange={handleChange}
              rows={2}
              required
              placeholder="Compatible Printer / MFP Models or Series"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <SelectField label="Technology" name="technology" options={TECHNOLOGIES} required />
          <SelectField label="Page Yield" name="page_yield" options={PAGE_YIELDS} required />
          <SelectField label="Yield Standard" name="yield_standard" options={YIELD_STANDARDS} required />
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
            className="mt-8 mb-10 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition shadow-lg active:scale-95 whitespace-nowrap"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}
