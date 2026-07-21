import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";

const INTEL_PROCESSORS = [
  { name: "Intel Core i5 12400", price: "" },
  { name: "Intel Core i5 12500", price: "" },
  { name: "Intel Core i5 13400", price: "" },
  { name: "Intel Core i5 13500", price: 25500 },
  { name: "Intel Core i5 13600", price: 23000 },
  { name: "Intel Core i5 13600K", price: 25000 },
  { name: "Intel Core i5 14500", price: "" },
  { name: "Intel Core i7 12700", price: 24500 },
  { name: "Intel Core i7 12700K", price: "" },
  { name: "Intel Core i7 13700", price: 29500 },
  { name: "Intel Core i7 13700K", price: 39500 },
  { name: "Intel Core i7 14700", price: 45000 },
  { name: "Intel Core i7 14700K", price: 40000 },
  { name: "Intel Core i9 12900", price: 43000 },
  { name: "Intel Core i9 12900K", price: 43000 },
  { name: "Intel Core i9 13900", price: 41000 },
  { name: "Intel Core i9 13900K", price: 43600 },
  { name: "Intel Core i9 14900", price: 65000 },
  { name: "Intel Core i9 14900K", price: 47600 },
  { name: "Intel Core Ultra 9 285K", price: "" },
];

const INTEL_XEON_PROCESSORS = [
  { name: "Intel Xeon Gold 6342", price: "" },
  { name: "Intel Xeon W-2225", price: "" },
  { name: "Intel Xeon W3-2423", price: 290000 },
  { name: "Intel Xeon W3-2425", price: 90000 },
  { name: "Intel Xeon W3-2435", price: 98000 },
  { name: "Intel Xeon W3-2535", price: 115000 },
  { name: "Intel Xeon W-3245", price: "" },
  { name: "Intel Xeon W5-2445", price: 95000 },
  { name: "Intel Xeon W5-2455X", price: 105000 },
  { name: "Intel Xeon W5-2465X", price: 150000 },
  { name: "Intel Xeon W5-2545", price: 95000 },
  { name: "Intel Xeon W5-2565X", price: 135000 },
  { name: "Intel Xeon W5-3435X", price: 155760 },
  { name: "Intel Xeon W7-2495X", price: "" },
  { name: "Intel Xeon W7-2575X", price: "" },
  { name: "Intel Xeon W7-3545", price: "" },
  { name: "Intel Xeon W7-3565X", price: 185000 },
  { name: "Intel Xeon W9-3475X", price: 384000 },
  { name: "Intel Xeon W9-3495X", price: "" },
  { name: "Intel Xeon W9-3595X", price: "" },
];

const AMD_THREADRIPPER_PROCESSORS = [
  { name: "AMD Threadripper 3355WX", price: "" },
  { name: "AMD Threadripper 5945WX", price: "" },
  { name: "AMD Threadripper 5955WX", price: "" },
  { name: "AMD Threadripper 5965WX", price: "" },
  { name: "AMD CPU 5955WX Threadripper", price: 99120 },
  { name: "AMD CPU 5965WX Threadripper", price: 161660 },
  { name: "AMD CPU 5975WX Threadripper", price: 185260 },
  { name: "AMD CPU 5975WX Threadripper Tray", price: 173460 },
  { name: "AMD CPU 5995WX Tray Threadripper", price: 489700 },
  { name: "AMD 7960X Threadripper Tray", price: 129800 },
  { name: "AMD 7965WX Threadripper Tray", price: 240720 },
  { name: "AMD 7970X Threadripper Tray", price: 224200 },
  { name: "AMD 7975WX Threadripper Tray", price: 342200 },
  { name: "AMD 7980WX Threadripper Tray", price: 436600 },
  { name: "AMD 7985WX Threadripper Tray", price: 666700 },
  { name: "AMD 7995WX Threadripper Tray", price: 906240 },
];

// ============================================================
// MOTHERBOARDS
// ============================================================
const INTEL_MOTHERBOARDS = [
  { name: "B660/B760 Biostar DDR4 Support i9 Processor", price: 9000 },
  { name: "B660/B760 Biostar with DDR5", price: "" },
  { name: "Q670 DDR4", price: 12000 },
  { name: "Q670 with DDR5", price: 15000 },
  { name: "Asus Pro W680 Ace (i5 to i9 Processor Support)", price: 50000 },
];

const INTEL_XEON_MOTHERBOARDS = [
  { name: "W790 Ace Asus (Supports Xeon W-3400/W-2400 Series, Single Socket ECC RAM)", price: 90000 },
  { name: "C621 Asus E Sage", price: 63720 },
  { name: "C622", price: "" },
];

const AMD_MOTHERBOARDS = [
  { name: "ASrock WRX80 (Supports 12th, 13th & 14th Gen i5/i7/i9)", price: "" },
  { name: "Asus WRX80 (Graphic Card Required for Display)", price: 50000 },
  { name: "MSI WRX80 (Graphic Card Required for Display)", price: "" },
  { name: "Gigabyte WRX80", price: "" },
];

// ============================================================
// RAM - Standard (Intel/AMD desktop-class CPUs)
// ============================================================
const RAMS = [
  { name: "8GB DDR4", price: 1200 },
  { name: "16GB DDR4", price: 2800 },
  { name: "16GB DDR4 3200MHz", price: 3000 },
  { name: "32GB DDR4", price: 4000 },
  { name: "64GB DDR4", price: 5500 },
  { name: "256GB DDR4", price: "" },
  { name: "8GB DDR5", price: 1800 },
  { name: "16GB DDR5", price: 14000 },
  { name: "32GB DDR5", price: 28000 },
  { name: "64GB DDR5", price: 60000 },
  { name: "256GB DDR5", price: 36000 },
];

// ============================================================
// RAM - Registered/ECC (Required for Xeon & Threadripper)
// ============================================================
const REGISTERED_RAMS = [
  { name: "16GB Registered ECC", price: 3200 },
  { name: "32GB Registered ECC", price: 6000 },
  { name: "64GB Registered ECC", price: 13000 },
];

const SSDS = [
  { name: "256 GB Sata SSD", price: 2000 },
  { name: "512 GB Sata SSD", price: 5000 },
  { name: "1000 GB Sata SSD", price: "" },
  { name: "1024 GB (1TB) Sata SSD", price: 7500 },
  { name: "M.2 SSD NVME 1024GB", price: 14000 },
];

const HDDS = [
  { name: "512GB", price: 4000 },
  { name: "1 TB", price: 4000 },
  { name: "2 TB", price: 8000 },
  { name: "4 TB", price: 9500 },
];


const GRAPHICS_CARDS = [
  { name: "NVIDIA Quadro P620 2GB", price: 10000 },
  { name: "NVIDIA Quadro P4000 8GB", price: 23000 },
  { name: "NVIDIA T400 2GB +", price: 6500 },
  { name: "NVIDIA T400 4GB", price: 14000 },
  { name: "NVIDIA T1000 8GB", price: 31000 },
  { name: "NVIDIA GTX 1650 4GB", price: 16000 },
  { name: "NVIDIA 3060", price: "" },
  { name: "NVIDIA GeForce RTX 4060 8GB Graphics", price: 27000 },
  { name: "NVIDIA RTX 4070 Super 12GB", price: 65000 },
  { name: "NVIDIA RTX 4070 Super 12 GB", price: 158000 },
  { name: "NVIDIA GeForce RTX 5070 12GB", price: "" },
  { name: "NVIDIA GeForce RTX 5070 Ti", price: "" },
  { name: "NVIDIA RTX 5090 32GB", price: 180000 },
  { name: "NVIDIA RTX A400 4GB", price: 12800 },
  { name: "NVIDIA RTX A1000 8GB", price: 45000 },
  { name: "NVIDIA RTX A2000 12GB", price: 65000 },
  { name: "NVIDIA RTX A4000 16GB", price: 99000 },
  { name: "NVIDIA RTX A4000 16GB 4DP GFX", price: 95000 },
  { name: "NVIDIA RTX A5000 24GB", price: 185000 },
  { name: "NVIDIA RTX A5500 24GB", price: 305000 },
  { name: "NVIDIA RTX A6000 48GB (48GB GDDR6)", price: "" },
  { name: "NVIDIA RTX 2000 Ada Generation 16GB", price: 73500 },
  { name: "NVIDIA RTX 4000 ADA GEN 20GB", price: 115000 },
  { name: "NVIDIA RTX 4000 Ada Generation 20GB", price: 130000 },
  { name: "NVIDIA RTX 4500 Ada Generation 24GB", price: 165000 },
  { name: "NVIDIA RTX Pro 2000 Blackwell 16GB", price: "" },
  { name: "NVIDIA RTX 6000 Ada 48GB 4DP Graphics", price: 400000 },
  { name: "NVIDIA RTX 6000 Ada Generation 48GB", price: 650000 },
];

const CABINETS = [{ name: "Tower", price: "" }];

const KEYBOARDS = [
  { name: "Wired Keyboard & Mouse", price: 600 },
  { name: "Wireless Keyboard & Mouse", price: 1200 },
];


const POWER_SUPPLIES = [
  { name: "400W", price: 2200 },
  { name: "450W", price: 2600 },
  { name: "500W", price: 3000 },
  { name: "550W", price: 4100 },
  { name: "600W", price: 4200 },
  { name: "650W", price: 4500 },
  { name: "700W", price: 6500 },
  { name: "750W", price: 7000 },
  { name: "800W", price: 10000 },
  { name: "850W", price: 12000 },
  { name: "1000W", price: 13600 },
  { name: "1100W", price: 15500 },
  { name: "1200W", price: 18500 },
  { name: "1800W", price: "" },
  { name: "2250W", price: "" },
];

const OS_OPTIONS = [
  { name: "Windows 11 Pro", price: 1000 },
  { name: "DOS", price: "" },
  { name: "Linux", price: 1000 },
];

const DVDS = [{ name: "DVD R/W", price: 1800 }];

const WIFIS = [
  { name: "Wi-Fi 6 + Bluetooth 5.2", price: 1900 },
  { name: "Wi-Fi 6 + Bluetooth 5.3", price: 2400 },
  { name: "Wi-Fi 7 (802.11be) + Bluetooth 5.4", price: 2500 },
];

const MONITORS = [
  { name: "21.5 inch", price: 5250 },
  { name: "23.8 inch 58-61 cm (23 inch)", price: 9400 },
  { name: "68-71 cm (27 inch)", price: 12800 },
  { name: "72-81 cm (32 inch)", price: 13000 },
  { name: "32 inch (78.1-83 cm)", price: 18500 },
];

const WARRANTIES = [
  { name: "1 Year", price: 2000 },
  { name: "3 Year", price: 4500 },
  { name: "5 Year", price: 6500 },
];

const getPriceFromLocalData = (categoryList, value) => {
  const item = categoryList.find((item) => item.name === value);
  return item ? item.price : "";
};


const getProcessorCategory = (processorName) => {
  if (!processorName) return null;
  if (processorName.includes("Threadripper")) return "amd_threadripper";
  if (processorName.includes("Xeon")) return "intel_xeon";
  if (processorName.includes("Intel")) return "intel_standard";
  return null;
};

const getFilteredRams = (processorName) => {
  const category = getProcessorCategory(processorName);
  if (category === "amd_threadripper" || category === "intel_xeon") {
    return REGISTERED_RAMS;
  }
  return RAMS;
};

const getFilteredIntelMotherboards = (processorName) => {
  const category = getProcessorCategory(processorName);
  if (category === "intel_xeon") return INTEL_XEON_MOTHERBOARDS;
  if (category === "intel_standard" || !category) return INTEL_MOTHERBOARDS;
  return [];
};

const getFilteredAmdMotherboards = (processorName) => {
  const category = getProcessorCategory(processorName);
  if (category === "amd_threadripper" || !category) return AMD_MOTHERBOARDS;
  return [];
};


const INITIAL_FORM = {
  processor: "",
  processor_price: "",
  motherboard: "",
  motherboard_price: "",
  ram: "",
  ram_price: "",
  hdd: "",
  hdd_price: "",
  ssd: "",
  ssd_price: "",
  ssd2: "",
  ssd2_price: "",
  graphics: "",
  graphics_price: "",
  gp: "",
  os: "",
  os_price: "",
  dvd: "",
  dvd_price: "",
  wifi: "",
  wifi_price: "",
  software1: "",
  monitor: "",
  monitor_price: "",
  cabinet: "",
  cabinet_price: "",
  keyboard: "",
  keyboard_price: "",
  power_supply: "",
  power_supply_price: "",
  warranty: "",
  warranty_price: "",
  date: "",
  pro_descp: "",
  motherboard_descp: "",
  extra_requirements: "",
  epbg: "",
  hddreturnable: "Yes",
  hddreturnable_price: "",
  freightInstallation: "Yes",
  freightInstallation_price: "",
};

const getDraftKey = (bidId) => `workstation_config_draft_${bidId || "new"}`;

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
    source.freightInstallation_price || merged.freightInstallation_price || "";
  return merged;
};


export default function WorkstationConfig({ bidData, onNext, onBack }) {
  const bid_id = bidData?.bid_id;
  const draftKey = useMemo(() => getDraftKey(bid_id), [bid_id]);

  const [form, setForm] = useState(() => {
    try {
      const savedDraft = localStorage.getItem(getDraftKey(bid_id));
      if (savedDraft) {
        return normalizeInitialForm(JSON.parse(savedDraft));
      }
    } catch (error) {
      console.warn("Unable to restore workstation configuration draft", error);
    }
    return normalizeInitialForm(
      bidData?.workstation_config || bidData?.configuration || bidData || {}
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
        console.warn("Unable to restore workstation configuration draft", error);
      }
      return normalizeInitialForm({ ...bidData, ...prev });
    });
  }, [draftKey]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      console.warn("Unable to save workstation configuration draft", error);
    }
  }, [draftKey, form]);

  const intelProcessors = [...INTEL_PROCESSORS, ...INTEL_XEON_PROCESSORS];
  const amdProcessors = AMD_THREADRIPPER_PROCESSORS;

  const filteredRams = useMemo(() => getFilteredRams(form.processor), [form.processor]);
  const filteredIntelMotherboards = useMemo(
    () => getFilteredIntelMotherboards(form.processor),
    [form.processor]
  );
  const filteredAmdMotherboards = useMemo(
    () => getFilteredAmdMotherboards(form.processor),
    [form.processor]
  );


  const handleBackClick = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      console.warn("Unable to save workstation configuration draft before going back", error);
    }
    if (onBack) {
      onBack({ ...form });
    } else {
      window.history.back();
    }
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    const priceField = `${name}_price`;

    setForm((prev) => {
      const newForm = {
        ...prev,
        [name]: value,
        [priceField]: "",
      };

      if (name === "processor") {
        const newCategory = getProcessorCategory(value);
        const ramList = getFilteredRams(value);
        if (prev.ram && !ramList.some((r) => r.name === prev.ram)) {
          newForm.ram = "";
          newForm.ram_price = "";
        }

        const intelMbs = getFilteredIntelMotherboards(value);
        const amdMbs = getFilteredAmdMotherboards(value);
        const allCompatibleMbs = [...intelMbs, ...amdMbs];
        if (prev.motherboard && !allCompatibleMbs.some((m) => m.name === prev.motherboard)) {
          newForm.motherboard = "";
          newForm.motherboard_price = "";
        }
      }

      return newForm;
    });

    if (!value || value === "None") return;

    let localList = null;
    if (name === "processor") localList = [...INTEL_PROCESSORS, ...INTEL_XEON_PROCESSORS, ...AMD_THREADRIPPER_PROCESSORS];
    else if (name === "ram") localList = [...RAMS, ...REGISTERED_RAMS];
    else if (name === "hdd") localList = HDDS;
    else if (name === "ssd" || name === "ssd2") localList = SSDS;
    else if (name === "graphics") localList = GRAPHICS_CARDS;
    else if (name === "os") localList = OS_OPTIONS;
    else if (name === "dvd") localList = DVDS;
    else if (name === "wifi") localList = WIFIS;
    else if (name === "monitor") localList = MONITORS;
    else if (name === "cabinet") localList = CABINETS;
    else if (name === "keyboard") localList = KEYBOARDS;
    else if (name === "power_supply") localList = POWER_SUPPLIES;
    else if (name === "warranty") localList = WARRANTIES;
    else if (name === "motherboard") localList = [...INTEL_MOTHERBOARDS, ...INTEL_XEON_MOTHERBOARDS, ...AMD_MOTHERBOARDS];

    if (localList) {
      const price = getPriceFromLocalData(localList, value);
      setForm((prev) => ({ ...prev, [priceField]: price }));
    }
  };

  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const payload = { ...form };
      const res = await fetch(`${API_BASE}/workstation-bids/${bid_id}/update/`, {
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


  const getGroupValue = (currentValue, list) => {
    if (currentValue === "None") return "None";
    if (!currentValue) return "";
    const exists = list.some((item) => item.name === currentValue);
    return exists ? currentValue : "";
  };


  const processorCategory = getProcessorCategory(form.processor);
  const compatibilityInfo = {
    intel_standard: { ram: "DDR4 / DDR5", mb: "B660 / Q670" },
    intel_xeon: { ram: "Registered ECC Only", mb: "W790 / C621 / C622" },
    amd_threadripper: { ram: "Registered ECC Only", mb: "WRX80" },
  };
  const currentCompat = compatibilityInfo[processorCategory];

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-4 pt-2 border-b pb-2">
        <button
          type="button"
          onClick={handleBackClick}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-300 hover:border-blue-400 px-3 py-1.5 rounded-md transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h5 className="text-lg font-semibold text-gray-800">Create Workstation Configuration</h5>
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
          
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2 underline">
              Processor Selection
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">
                  Intel / Xeon Processor
                </span>
                <div className="flex gap-2">
                  <select
                    name="processor"
                    value={getGroupValue(form.processor, intelProcessors)}
                    onChange={handleChange}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Intel / Xeon</option>
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
                  AMD / Threadripper Processor
                </span>
                <div className="flex gap-2">
                  <select
                    name="processor"
                    value={getGroupValue(form.processor, amdProcessors)}
                    onChange={handleChange}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select AMD / Threadripper</option>
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
            {currentCompat && (
              <p className="text-xs text-blue-600 mt-2">
                Compatible RAM: {currentCompat.ram} • Compatible Motherboard: {currentCompat.mb}
              </p>
            )}
          </div>

         
          <SelectField label="Ram" name="ram" options={filteredRams} required />
          <SelectField label="Hard Disk Drive" name="hdd" options={HDDS} required />
          <SelectField label="Graphics Card" name="graphics" options={GRAPHICS_CARDS} required />

        
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

          
          <SelectField label="SSD 1" name="ssd" options={SSDS} required />
          <SelectField label="SSD 2" name="ssd2" options={SSDS} />
          <SelectField label="OS" name="os" options={OS_OPTIONS} required />
          <SelectField label="DVD" name="dvd" options={DVDS} />
          <SelectField label="Wi-Fi Bluetooth" name="wifi" options={WIFIS} />
          <SelectField label="Monitor" name="monitor" options={MONITORS} required />
          <SelectField label="Cabinet" name="cabinet" options={CABINETS} required />
          <SelectField label="Keyboard & Mouse" name="keyboard" options={KEYBOARDS} required />
          <SelectField label="Power Supply (SMPS)" name="power_supply" options={POWER_SUPPLIES} required />
          <SelectField label="Warranty" name="warranty" options={WARRANTIES} required />

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Freight Installation</label>
            <div className="flex gap-2">
              <select
                name="freightInstallation"
                value={form.freightInstallation}
                onChange={handleChange}
                className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
              <input
                type="text"
                name="freightInstallation_price"
                value={form.freightInstallation_price}
                onChange={handleChange}
                placeholder="Price"
                className="w-24 shrink-0 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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

         =
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2 underline">
              Motherboard Selection
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Intel Motherboard Section */}
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">
                  Intel Motherboard
                  {processorCategory === "intel_standard" && (
                    <span className="ml-2 text-blue-600 font-normal">(B660 / Q670)</span>
                  )}
                  {processorCategory === "intel_xeon" && (
                    <span className="ml-2 text-blue-600 font-normal">
                      (W790 / C621 / C622)
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

              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">
                  AMD Motherboard
                  {processorCategory === "amd_threadripper" && (
                    <span className="ml-2 text-blue-600 font-normal">(WRX80)</span>
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

              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HDD Return Option
                </label>
                <div className="flex gap-2">
                  <select
                    name="hddreturnable"
                    value={form.hddreturnable}
                    onChange={handleChange}
                    className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                    className="w-24 shrink-0 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
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

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Extra Requirements
                    </label>
                    <span className="text-red-500 text-[11px] font-normal">*Optional</span>
                  </div>
                  <textarea
                    name="extra_requirements"
                    value={form.extra_requirements}
                    onChange={handleChange}
                    rows={2}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="e.g. Height adjustable stand, Dual Gigabit NIC, TCO 9.0, etc."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

     
        <div className="flex justify-start items-center">
          <button
            type="submit"
            disabled={saving}
            className="mt-8 mb-10 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-12 py-2.5 rounded-md text-sm transition shadow-lg active:scale-95"
          >
            {saving ? "Saving..." : "Next"}
          </button>
        </div>
      </form>
    </div>
  );
}