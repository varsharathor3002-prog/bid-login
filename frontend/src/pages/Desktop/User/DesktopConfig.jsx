import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";

// ============================================================
// PROCESSORS - Only items NOT marked "remove" in Excel
// ============================================================
const PROCESSORS = [
  { name: "Intel Core i3 12100", price: 14000 },
  { name: "Intel Core i3 14100", price: 14000 },
  { name: "Intel Core i5 12400", price: 21000 },
  { name: "Intel Core i5 14400", price: 23000 },
  { name: "Intel Core i7 12700", price: 34000 },
  { name: "Intel Core i7 14700", price: 40500 },
  { name: "Intel Core i9 14900", price: 65000 },
  { name: "AMD Ryzen 3 4300G", price: 9000 },
  { name: "AMD Ryzen 3 5300G", price: 12000 },
  { name: "AMD Ryzen 5 5600G", price: 13500 },
  { name: "AMD Ryzen 7 5700G", price: 18500 },
  { name: "AMD Ryzen 5 8500G", price: 15000 },
  { name: "AMD Ryzen 9 9300G", price: 60000 },
  { name: "12th Gen Composite i5", price: 18000 },
  { name: "12th Gen Composite i7", price: 23000 },
  { name: "Ultra 5 225", price: 17500 },
  { name: "Ultra 5 245K", price: 19500 },
  { name: "Ultra 7 265K", price: 35500 },
];

// ============================================================
// RAMS - Only items NOT marked "remove" in Excel
// ============================================================
const RAMS = [
  { name: "8GB DDR4 3200", price: 5000 },
  { name: "16GB DDR4 3200", price: 9000 },
  { name: "32GB DDR4 3200", price: 18000 },
  { name: "32GB DDR4 3200 2", price: 36000 },
  { name: "8GB DDR5 4800", price: 8000 },
  { name: "16GB DDR5 4800", price: 13200 },
  { name: "32GB DDR5 4800", price: 26000 },
  { name: "32GB DDR5 4800 2", price: 52000 },
];

const HDDS = [
  { name: "1 TB", price: 5000 },
  { name: "2 TB", price: 7500 },
];

const SSDS = [
  { name: "128 GB SATA", price: 3500 },
  { name: "256 GB SATA", price: 4500 },
  { name: "512 GB SATA", price: 6800 },
  { name: "1TB SATA", price: 12500 },
  { name: "128 GB NVMe", price: 4000 },
  { name: "256 GB NVMe", price: 5000 },
  { name: "512 GB NVMe", price: 7500 },
  { name: "1TB NVMe", price: 13500 },
];

const OS_OPTIONS = [
  { name: "Windows 11 Home", price: 1000 },
  { name: "Windows 11 Professional", price: 1000 },
  { name: "DOS", price: 1000 },
  { name: "Linex", price: 1000 },
];

const DVDS = [{ name: "Yes", price: 1200 }];

const WIFIS = [
  { name: "PCI Based 4.2 Bluetooth", price: 750 },
  { name: "Wi-fi AC 4.2 Bluetooth", price: 850 },
  { name: "Wi-Fi 6 5.0 Bluetooth", price: 1200 },
  { name: "Wi-Fi AX201 5.2 Bluetooth", price: 1500 },
];

const MONITORS = [
  { name: "19.5 inch VGA, HDMI", price: 4000 },
  { name: "21.5 inch VGA, HDMI", price: 4400 },
  { name: "21.5 inch with Speaker VGA, HDMI", price: 4600 },
  { name: "21.5 inch with DP Port DP, VGA, HDMI", price: 5200 },
  { name: "23.8 inch VGA, HDMI", price: 5500 },
  { name: "23.8 inch with Speaker VGA, HDMI", price: 5700 },
  { name: "23.8 inch with DP Port DP, VGA, HDMI", price: 6500 },
  { name: "23.8 inch with Speaker Webcam VGA, HDMI", price: 9500 },
  { name: "27 inch DP VGA, HDMI", price: 8000 },
];

const CABINETS = [
  { name: "SFF", price: 1500 },
  { name: "Tower", price: 1500 },
];

const KEYBOARDS = [
  { name: "Keyboard & Mouse Wired", price: 450 },
  { name: "Keyboard & Mouse Wireless", price: 850 },
];

const WARRANTIES = [
  { name: "1 Year", price: 1200 },
  { name: "2 Year", price: 1500 },
  { name: "3 Year", price: 1800 },
  { name: "4 Year", price: 2000 },
  { name: "5 Year", price: 2500 },
  { name: "6 Year", price: 3500 },
  { name: "7 Year", price: 5000 },
];

// ============================================================
// MOTHERBOARDS - Only items NOT marked "remove" in Excel
// ============================================================
const MOTHERBOARDS = [
  { name: "AMD B650, DDR5, 4 USB 2.0, 2 USB 3.0, PCI16*2, PCI4*2", price: 7500 },
  { name: "AMD A520, 4 USB 2.0, 2 USB 3.0, PCI16*1, PCI4*1", price: 5000 },
  { name: "H810 With DDR5 DP, HDMI, USB 3.1 -2, USB 2.0 -6 PCI16-1 PCI-1, M.2 -1", price: 7500 },
  { name: "H610, PCI X 16- 1 PCI 4 X1, M.2 1, 4 USB 2.0, 2USB 3.0, VGA, HDMI", price: 5000 },
  { name: "Q670 DDR4 2 DIMM, PCI X 16- 1 PCI 4 X2, M.2 2, 4 USB 2.0, 4 USB 3.0 TYPE C 1, VGA, HDMI", price: 8000 },
  { name: "Q670 DDR4 4 DIMM, PCI X 16- 1 PCI 4 X2, M.2 2, 4 USB 2.0, 4 USB 3.0 TYPE C 1, VGA, HDMI", price: 10000 },
];

// ============================================================
// HELPER: Get price from local data
// ============================================================
const getPriceFromLocalData = (categoryList, value) => {
  const item = categoryList.find((item) => item.name === value);
  return item ? item.price : "";
};

// ============================================================
// PROCESSOR CATEGORIZATION (Based on Excel Remarks)
// ============================================================
// Categories:
// - "intel_old"   : Intel 12th-14th Gen (NOT Ultra) → DDR4 RAM + H610/Q670 DDR4
// - "intel_ultra" : Intel Ultra (225, 245K, 265K)   → DDR5 RAM + H810 DDR5
// - "amd_old"     : AMD up to 5000 series           → DDR4 RAM + A520
// - "amd_new"     : AMD 8500G, 9300G (7000/8000/9000) → DDR5 RAM + B650
// ============================================================
const getProcessorCategory = (processorName) => {
  if (!processorName) return null;
  if (processorName.includes("Ultra")) return "intel_ultra";
  if (processorName.includes("8500G") || processorName.includes("9300G")) return "amd_new";
  if (processorName.includes("AMD")) return "amd_old";
  if (processorName.includes("Intel") || processorName.includes("Gen")) return "intel_old";
  return null;
};

// ============================================================
// FILTER RAM based on Processor Category
// ============================================================
const getFilteredRams = (processorName) => {
  const category = getProcessorCategory(processorName);
  if (!category) return RAMS; // Show all if no processor selected

  if (category === "intel_ultra" || category === "amd_new") {
    return RAMS.filter((r) => r.name.includes("DDR5"));
  }
  if (category === "intel_old" || category === "amd_old") {
    return RAMS.filter((r) => r.name.includes("DDR4"));
  }
  return RAMS;
};

// ============================================================
// FILTER MOTHERBOARDS based on Processor Category
// ============================================================
const getFilteredIntelMotherboards = (processorName) => {
  const category = getProcessorCategory(processorName);
  if (!category) return MOTHERBOARDS.filter((m) => !m.name.includes("AMD"));

  if (category === "intel_ultra") {
    // Ultra processors → H810 With DDR5 only
    return MOTHERBOARDS.filter((m) => m.name.includes("H810"));
  }
  if (category === "intel_old") {
    // 12th-14th Gen → H610 + Q670 DDR4 (both 2 DIMM and 4 DIMM)
    return MOTHERBOARDS.filter(
      (m) => m.name.includes("H610") || m.name.includes("Q670 DDR4")
    );
  }
  return [];
};

const getFilteredAmdMotherboards = (processorName) => {
  const category = getProcessorCategory(processorName);
  if (!category) return MOTHERBOARDS.filter((m) => m.name.includes("AMD"));

  if (category === "amd_new") {
    // 8500G, 9300G → B650 only
    return MOTHERBOARDS.filter((m) => m.name.includes("B650"));
  }
  if (category === "amd_old") {
    // Up to 5000 series → A520 only
    return MOTHERBOARDS.filter((m) => m.name.includes("A520"));
  }
  return [];
};

// ============================================================
// CHECK if RAM/Motherboard is compatible with processor
// ============================================================
const isRamCompatible = (processorName, ramName) => {
  const category = getProcessorCategory(processorName);
  if (!category) return true;

  const isDdr5 = ramName.includes("DDR5");
  const isDdr4 = ramName.includes("DDR4");

  if (category === "intel_ultra" || category === "amd_new") return isDdr5;
  if (category === "intel_old" || category === "amd_old") return isDdr4;
  return true;
};

const isMotherboardCompatible = (processorName, mbName) => {
  const category = getProcessorCategory(processorName);
  if (!category) return true;

  const compatibleMbs =
    category === "intel_ultra"
      ? ["H810"]
      : category === "intel_old"
      ? ["H610", "Q670 DDR4"]
      : category === "amd_new"
      ? ["B650"]
      : category === "amd_old"
      ? ["A520"]
      : [];

  return compatibleMbs.some((keyword) => mbName.includes(keyword));
};

// ============================================================
// FORM INITIALIZATION
// ============================================================
const INITIAL_FORM = {
  processor: "",
  processor_price: "",
  ram: "",
  ram_price: "",
  hdd: "",
  hdd_price: "",
  ssd: "",
  ssd_price: "",
  ssd2: "",
  ssd2_price: "",
  gp: "",
  os: "",
  os_price: "",
  dvd: "",
  dvd_price: "",
  wifi: "",
  wifi_price: "",
  software1: "",
  motherboard: "",
  motherboard_price: "",
  monitor: "",
  monitor_price: "",
  cabinet: "",
  cabinet_price: "",
  keyboard: "",
  keyboard_price: "",
  warranty: "",
  warranty_price: "",
  date: "",
  pro_descp: "",
  motherboard_descp: "",
  epbg: "",
  hddreturnable: "Yes",
  hddreturnable_price: "",
  freightInstallation: "Yes",
  freightInstallation_price: "1000",
};

const getDraftKey = (bidId) => `desktop_config_draft_${bidId || "new"}`;

const normalizeInitialForm = (source = {}) => {
  const merged = {
    ...INITIAL_FORM,
    ...source,
  };
  merged.ssd = source.ssd || source.ssd1 || merged.ssd || "";
  merged.ssd_price = source.ssd_price || source.ssd1_price || merged.ssd_price || "";
  merged.hddreturnable = source.hddreturnable || merged.hddreturnable || "Yes";
  merged.freightInstallation = source.freightInstallation || merged.freightInstallation || "Yes";
  merged.freightInstallation_price =
    source.freightInstallation_price || merged.freightInstallation_price || "1000";
  return merged;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function DesktopConfig({ bidData, onNext, onBack }) {
  const bid_id = bidData?.bid_id;
  const draftKey = useMemo(() => getDraftKey(bid_id), [bid_id]);

  const [form, setForm] = useState(() => {
    try {
      const savedDraft = localStorage.getItem(getDraftKey(bid_id));
      if (savedDraft) {
        return normalizeInitialForm(JSON.parse(savedDraft));
      }
    } catch (error) {
      console.warn("Unable to restore desktop configuration draft", error);
    }
    return normalizeInitialForm(
      bidData?.desktop_config || bidData?.configuration || bidData || {}
    );
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setForm((prev) => {
      try {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) return normalizeInitialForm(JSON.parse(savedDraft));
      } catch (error) {
        console.warn("Unable to restore desktop configuration draft", error);
      }
      return normalizeInitialForm({ ...bidData, ...prev });
    });
  }, [draftKey]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      console.warn("Unable to save desktop configuration draft", error);
    }
  }, [draftKey, form]);

  // ============================================================
  // DYNAMIC FILTERED LISTS (based on selected processor)
  // ============================================================
  const intelProcessors = PROCESSORS.filter(
    (p) => p.name.includes("Intel") || p.name.includes("Gen") || p.name.includes("Ultra")
  );
  const amdProcessors = PROCESSORS.filter((p) => p.name.includes("AMD"));

  const filteredRams = useMemo(
    () => getFilteredRams(form.processor),
    [form.processor]
  );

  const filteredIntelMotherboards = useMemo(
    () => getFilteredIntelMotherboards(form.processor),
    [form.processor]
  );

  const filteredAmdMotherboards = useMemo(
    () => getFilteredAmdMotherboards(form.processor),
    [form.processor]
  );

  // ============================================================
  // BACK HANDLER
  // ============================================================
  const handleBackClick = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      console.warn("Unable to save desktop configuration draft before going back", error);
    }
    if (onBack) {
      onBack({ ...form });
    } else {
      window.history.back();
    }
  };

  // ============================================================
  // CHANGE HANDLER (with compatibility checks)
  // ============================================================
  const handleChange = async (e) => {
    const { name, value } = e.target;
    const priceField = `${name}_price`;

    setForm((prev) => {
      const newForm = {
        ...prev,
        [name]: value,
        [priceField]: "",
      };

      // When processor changes, check RAM and Motherboard compatibility
      if (name === "processor") {
        // Reset RAM if not compatible with new processor
        if (prev.ram && !isRamCompatible(value, prev.ram)) {
          newForm.ram = "";
          newForm.ram_price = "";
        }

        // Reset Motherboard if not compatible with new processor
        if (prev.motherboard && !isMotherboardCompatible(value, prev.motherboard)) {
          newForm.motherboard = "";
          newForm.motherboard_price = "";
        }
      }

      return newForm;
    });

    if (!value || value === "None") return;

    let localList = null;
    if (name === "processor") localList = PROCESSORS;
    else if (name === "ram") localList = RAMS;
    else if (name === "hdd") localList = HDDS;
    else if (name === "ssd" || name === "ssd2") localList = SSDS;
    else if (name === "os") localList = OS_OPTIONS;
    else if (name === "dvd") localList = DVDS;
    else if (name === "wifi") localList = WIFIS;
    else if (name === "monitor") localList = MONITORS;
    else if (name === "cabinet") localList = CABINETS;
    else if (name === "keyboard") localList = KEYBOARDS;
    else if (name === "warranty") localList = WARRANTIES;
    else if (name === "motherboard") localList = MOTHERBOARDS;

    if (localList) {
      const price = getPriceFromLocalData(localList, value);
      setForm((prev) => ({ ...prev, [priceField]: price }));
    }
  };

  // ============================================================
  // SUBMIT HANDLER
  // ============================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const payload = { ...form };
      const res = await fetch(`${API_BASE}/desktop-bids/${bid_id}/update/`, {
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

  // ============================================================
  // SELECT FIELD COMPONENT
  // ============================================================
  const SelectField = ({ label, name, options, required, optional }) => (
    <div className="col-span-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {optional && (
          <span className="text-red-500 text-[11px] font-normal">*Optional</span>
        )}
      </div>
      <div className="flex gap-2">
        <select
          name={name}
          value={form[name]}
          onChange={handleChange}
          required={required}
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
        >
          <option value="">Select</option>
          {options.map((opt) => (
            <option key={opt.name} value={opt.name}>
              {opt.name}
            </option>
          ))}
          <option value="None">None</option>
        </select>
        <input
          type="text"
          value={form[`${name}_price`] || ""}
          readOnly
          disabled
          placeholder="Price"
          className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50 cursor-not-allowed"
        />
      </div>
    </div>
  );

  // ============================================================
  // GET GROUP VALUE (for processor/motherboard dropdowns)
  // ============================================================
  const getGroupValue = (currentValue, list) => {
    if (currentValue === "None") return "None";
    if (!currentValue) return "";
    const exists = list.some((item) => item.name === currentValue);
    return exists ? currentValue : "";
  };

  // ============================================================
  // COMPATIBILITY BADGE (shows what RAM/MB is required)
  // ============================================================
  const processorCategory = getProcessorCategory(form.processor);
  const compatibilityInfo = {
    intel_old: { ram: "DDR4 Only", mb: "H610 / Q670 DDR4" },
    intel_ultra: { ram: "DDR5 Only", mb: "H810 DDR5" },
    amd_old: { ram: "DDR4 Only", mb: "AMD A520" },
    amd_new: { ram: "DDR5 Only", mb: "AMD B650" },
  };
  const currentCompat = compatibilityInfo[processorCategory];

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-4 pt-2 border-b pb-2">
        
        <h5 className="text-lg font-semibold text-gray-800">Create Desktop Configuration</h5>
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
          {/* ============================================================
              PROCESSOR SELECTION
          ============================================================ */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2 underline">
              Processor Selection
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">
                  Intel Processor
                </span>
                <div className="flex gap-2">
                  <select
                    name="processor"
                    value={getGroupValue(form.processor, intelProcessors)}
                    onChange={handleChange}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Intel </option>
                    {intelProcessors.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                    <option value="None">None</option>
                  </select>
                  <input
                    type="text"
                    value={
                      intelProcessors.some((p) => p.name === form.processor)
                        ? form.processor_price
                        : ""
                    }
                    readOnly
                    disabled
                    placeholder="Price"
                    className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">
                  AMD Processor
                </span>
                <div className="flex gap-2">
                  <select
                    name="processor"
                    value={getGroupValue(form.processor, amdProcessors)}
                    onChange={handleChange}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select AMD</option>
                    {amdProcessors.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                    <option value="None">None</option>
                  </select>
                  <input
                    type="text"
                    value={
                      amdProcessors.some((p) => p.name === form.processor)
                        ? form.processor_price
                        : ""
                    }
                    readOnly
                    disabled
                    placeholder="Price"
                    className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================
              RAM (Filtered based on processor)
          ============================================================ */}
          <SelectField label="Ram" name="ram" options={filteredRams} required />
          <SelectField label="Hard Disk Drive" name="hdd" options={HDDS} required />

          {/* ============================================================
              DESCRIPTIONS
          ============================================================ */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Processor Description
              </label>
              <span className="text-red-500 text-[11px] font-normal">*Optional</span>
            </div>
            <textarea
              name="pro_descp"
              value={form.pro_descp}
              onChange={handleChange}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Additional Software
              </label>
              <span className="text-red-500 text-[11px] font-normal">*Optional</span>
            </div>
            <textarea
              name="software1"
              value={form.software1}
              onChange={handleChange}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Graphics Description
              </label>
              <span className="text-red-500 text-[11px] font-normal">*Optional</span>
            </div>
            <textarea
              name="gp"
              value={form.gp}
              onChange={handleChange}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* ============================================================
              OTHER COMPONENTS
          ============================================================ */}
          <SelectField label="SSD 1" name="ssd" options={SSDS} required />
          <SelectField label="SSD 2" name="ssd2" options={SSDS} required />
          <SelectField label="OS" name="os" options={OS_OPTIONS} required />
          <SelectField label="DVD" name="dvd" options={DVDS} required />
          <SelectField label="Wi-FI Bluetooth" name="wifi" options={WIFIS} required />
          <SelectField label="Monitor" name="monitor" options={MONITORS} required />
          <SelectField label="Cabinet" name="cabinet" options={CABINETS} required />
          <SelectField label="Keyboard & Mouse" name="keyboard" options={KEYBOARDS} required />
          <SelectField label="Warranty" name="warranty" options={WARRANTIES} required />

          {/* ============================================================
              DATE, EPBG, HDD RETURN
          ============================================================ */}
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

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">EPBG (%)</label>
            <input
              type="text"
              name="epbg"
              value={form.epbg}
              onChange={handleChange}
              placeholder="Price"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-500 bg-gray-50 outline-none"
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HDD Return Option
            </label>
            <div className="flex gap-2">
              <select
                name="hddreturnable"
                value={form.hddreturnable}
                onChange={handleChange}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Yes">Yes</option>
                <option value="None">None</option>
              </select>
              <input
                type="text"
                name="hddreturnable_price"
                value={form.hddreturnable_price}
                onChange={handleChange}
                placeholder="Price"
                className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ============================================================
              MOTHERBOARD SELECTION (Filtered based on processor)
          ============================================================ */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2 underline">
              Motherboard Selection
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Intel Motherboard Section */}
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">
                  Intel Motherboard
                  {processorCategory === "intel_old" && (
                    <span className="ml-2 text-blue-600 font-normal">
                      (H610 / Q670 DDR4)
                    </span>
                  )}
                  {processorCategory === "intel_ultra" && (
                    <span className="ml-2 text-blue-600 font-normal">
                      (H810 DDR5)
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  <select
                    name="motherboard"
                    value={getGroupValue(form.motherboard, filteredIntelMotherboards)}
                    onChange={handleChange}
                    className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Intel</option>
                    {filteredIntelMotherboards.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                    <option value="None">None</option>
                  </select>
                  <input
                    type="text"
                    value={
                      filteredIntelMotherboards.some((m) => m.name === form.motherboard)
                        ? form.motherboard_price
                        : ""
                    }
                    readOnly
                    disabled
                    placeholder="Price"
                    className="w-24 shrink-0 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* AMD Motherboard Section */}
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">
                  AMD Motherboard
                  {processorCategory === "amd_old" && (
                    <span className="ml-2 text-blue-600 font-normal">
                      (A520)
                    </span>
                  )}
                  {processorCategory === "amd_new" && (
                    <span className="ml-2 text-blue-600 font-normal">
                      (B650)
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  <select
                    name="motherboard"
                    value={getGroupValue(form.motherboard, filteredAmdMotherboards)}
                    onChange={handleChange}
                    className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select AMD</option>
                    {filteredAmdMotherboards.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                    <option value="None">None</option>
                  </select>
                  <input
                    type="text"
                    value={
                      filteredAmdMotherboards.some((m) => m.name === form.motherboard)
                        ? form.motherboard_price
                        : ""
                    }
                    readOnly
                    disabled
                    placeholder="Price"
                    className="w-24 shrink-0 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================
              MOTHERBOARD DESCRIPTION
          ============================================================ */}
          <div className="col-span-1 md:col-span-3">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Motherboard Description
              </label>
              <span className="text-red-500 text-[11px] font-normal">*Optional</span>
            </div>
            <textarea
              name="motherboard_descp"
              value={form.motherboard_descp}
              onChange={handleChange}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Technical details..."
            />
          </div>
        </div>

        {/* ============================================================
              SUBMIT BUTTON
        ============================================================ */}
        <div className="flex justify-start items-center">
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