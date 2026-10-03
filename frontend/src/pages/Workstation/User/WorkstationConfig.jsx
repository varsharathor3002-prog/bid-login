import { useEffect, useMemo, useState } from "react";
import { fetchComponentRates } from "../../../utils/componentRates";

const API_BASE = import.meta.env.VITE_API_URL;

export const INTEL_PROCESSORS = [
  { name: "Intel Core i5 14500", price: "" },
  { name: "Intel Core i7 14700", price: 45000 },
  { name: "Intel Core i7 14700K", price: 40000 },
  { name: "Intel Core i9 14900", price: 65000 },
  { name: "Intel Core i9 14900K", price: 47600 },
  { name: "Intel Core Ultra 9 285K", price: "" },
];

export const INTEL_XEON_PROCESSORS = [
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

export const AMD_THREADRIPPER_PROCESSORS = [
  { name: "AMD Threadripper 5945WX", price: "" },
  { name: "AMD CPU 5955WX Threadripper", price: 99120 },
  { name: "AMD CPU 5965WX Threadripper", price: 161660 },
  { name: "AMD CPU 5975WX Threadripper", price: 185260 },
  { name: "AMD CPU 5995WX Threadripper", price: 489700 },
  { name: "AMD 7960X Threadripper", price: 129800 },
  { name: "AMD 7965WX Threadripper", price: 240720 },
  { name: "AMD 7970X Threadripper", price: 224200 },
  { name: "AMD 7975WX Threadripper", price: 342200 },
  { name: "AMD 7980WX Threadripper", price: 436600 },
  { name: "AMD 7985WX Threadripper", price: 666700 },
  { name: "AMD 7995WX Threadripper", price: 906240 },
];

// ============================================================
// MOTHERBOARDS
// ============================================================
const BIOSTAR_DESC =
  "Single Socket 4 DIMM M.2X2 pci16x1 Pci 1x1, Lan 1GX1 Port USB3.2 x 3,USB 2.0X4,VGAX1,HDMIX1 DPX1";
const Q670_DESC =
  "Single Socket 4 DIMM M.2X2 pci 16x1 Pci 1x2, Lan 1GX1 Port USB 3.2X1 USB 2.0X2, USB 3.0 X2,Type C x1 HDMI 2,VGAX1 DPX1";

// Full text: name with its description in brackets.
export const fullOptionLabel = (item) =>
  item.description
    ? `${item.label || item.name} (${item.description})`
    : item.label || item.name;

// Native <option>s can't wrap, so long labels are cut short in the dropdown;
// the full text is in the option's title and shown in the closed select.
const MAX_OPTION_LABEL = 100;
export const optionLabel = (item) => {
  const full = fullOptionLabel(item);
  return full.length > MAX_OPTION_LABEL ? `${full.slice(0, MAX_OPTION_LABEL).trimEnd()}…` : full;
};

export const INTEL_MOTHERBOARDS = [
  { name: "B660/B760 Biostar DDR4 Support i9 Processor", price: 9000, description: BIOSTAR_DESC },
  { name: "B660/B760 Biostar with DDR5", price: "", description: BIOSTAR_DESC },
  { name: "Q670 DDR4", price: 12000, description: Q670_DESC },
  { name: "Q670 with DDR5", price: 15000, description: Q670_DESC },
  { name: "Q670 with DDR5 (2 DIMM)", label: "Q670 with DDR5", price: 15000, description: Q670_DESC.replace("4 DIMM", "2 DIMM") },
  {
    name: "Asus Pro W680 Ace (i5 to i9 Processor Support)",
    price: 50000,
    description: [
      "-2 x USB 3.2 Gen 2 ports (1 x Type-A, 1 x Type-C)",
      "-4 x USB 3.2 Gen 1 ports (4 x Type-A)",
      "-2 x USB 2.0 ports (2 x Type-A)",
      "-1 x DisplayPort",
      "-1 x HDMI port",
      "-1 x VGA port",
      "-2 x Intel 2.5Gb Ethernet ports",
      "-5 x Audio jacks",
      "-1 x BIOS FlashBack button",
      "Intel Core Processors (14th & 13th & 12th Gen)",
      "-2 x PCIe 5.0 x16 slots (support x16 or x8/x8 mode)",
      "Intel W680 Chipset",
      "-2 x PCIe 3.0 x16 slots (supports x4 mode)",
      "-1 x PCIe 3.0 x1 slot",
    ].join(", "),
  },
];

export const INTEL_XEON_MOTHERBOARDS = [
  {
    name: "W790 Ace Asus (Supports Xeon W-3400/W-2400 Series, Single Socket ECC RAM)",
    price: 90000,
    description: [
      "Back Panel I/O Ports",
      "1 x USB 3.2 Gen 2x2 port(s) (1 x USB Type-C)",
      "4 x USB 3.2 Gen 2 port(s) (4 x Type-A)",
      "8 x USB 2.0 port(s) (8 x Type-A)",
      "1 x Marvell AQtion 10Gb Ethernet port",
      "1 x Intel 2.5Gb Ethernet port",
      "5 x Audio jacks",
      "1 x Optical S/PDIF out port",
      "1 x BIOS FlashBack button",
      "1 x Clear CMOS button",
      "Intel Xeon W-3400 and W-2400 Series Processors",
      "5 x PCIe 5.0 x16 slot(s) (supports x16, x16, x16, x0/x8, x16/x8 modes)",
      "8 x DIMM slots",
    ].join(", "),
  },
  { name: "C621 Asus E Sage", price: 63720, description: "Single Socket" },
  { name: "C622", price: "", description: "Single Socket" },
];

export const AMD_MOTHERBOARDS = [
  {
    name: "ASrock WRX80 (Supports 12th, 13th & 14th Gen i5/i7/i9)",
    price: "",
    description:
      "Single Socket,( 8 DIMM RAM, 7PCI 16,2XM.2 lan (2X10G) Port ( 2x type C,6 X USB PORT 3.2 GEN2,VGAX1, Wi-Fi 6,SPDF Port) Support 5000WX on 3000WX Series Only mini DP 2",
  },
  {
    name: "Asus WRX80 (Graphic Card Required for Display)",
    price: 50000,
    description:
      "Single Socket,( 8 DIMM RAM, 7PCI 16,2XM.2 lan (2X10G) Port ( 2x type C,6 X USB PORT 3.2 GEN2, Wi-Fi 6,SPDF Port) Support 5000WX on 3000WX Series Only",
  },
  {
    name: "MSI WRX80 (Graphic Card Required for Display)",
    price: "",
    description:
      "Single Socket( 8 DIMM RAM ,7 PCI 16, 2 X M.2, 2 Lan (1X1G,1X10G) Port ( 2 X TYPE C, 8XUSB 3.2 GEN2,Wi-Fi 6,SPDF Port) Support 5000WX ON 3000 WX Series only INTEL XEON",
  },
  {
    name: "Gigabyte WRX80",
    price: "",
    description:
      "Single Socket (8 DIMM RAM,7 PCI 16, 2 M.2, 4 Lan (2X1G,2X10G) Port ( 1X TYPE C,5X USB 3.2 GEN2,VGAX1,SPDF Port) Support 5000WX ON 3000 WX Series only",
  },
];

// ============================================================
// RAM - Standard (Intel/AMD desktop-class CPUs)
// ============================================================
export const RAMS = [
  { name: "8GB DDR4", price: 1200 },
  { name: "16GB DDR4", price: 2800 },
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
export const REGISTERED_RAMS = [
  { name: "16GB Registered ECC", price: 3200 },
  { name: "32GB Registered ECC", price: 6000 },
  { name: "64GB Registered ECC", price: 13000 },
  { name: "128GB Registered ECC", price: "" },
];

export const SSDS = [
  { name: "256 GB Sata SSD", price: 2000 },
  { name: "512 GB Sata SSD", price: 5000 },
  { name: "1000 GB Sata SSD", price: "" },
  { name: "1024 GB (1TB) Sata SSD", price: 7500 },
  { name: "1024 GB NVME", price: 14000 },
  { name: "2000 GB (2TB) Sata SSD", price: "" },
];

// SSD 1 / SSD 2 dropdowns hide the smallest / non-standard sizes.
export const SSD1_OPTIONS = SSDS.filter(
  (s) => s.name !== "256 GB Sata SSD" && s.name !== "1000 GB Sata SSD"
);

export const HDDS = [
  { name: "1 TB", price: 4000 },
  { name: "2 TB", price: 8000 },
  { name: "4 TB", price: 9500 },
  { name: "8 TB", price: "" },
];


export const GRAPHICS_CARDS = [
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

export const CABINETS = [{ name: "Tower", price: "" }];

export const KEYBOARDS = [
  { name: "Wired Keyboard & Mouse", price: 600 },
  { name: "Wireless Keyboard & Mouse", price: 1200 },
];


export const POWER_SUPPLIES = [
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

export const OS_OPTIONS = [
  { name: "Windows 11 Pro", price: 1000 },
  { name: "Windows 11 Pro 16 Core", price: "" },
  { name: "DOS", price: "" },
  { name: "Linux", price: 1000 },
];

export const DVDS = [{ name: "DVD R/W", price: 1800 }];

export const WIFIS = [
  { name: "Wi-Fi 6 + Bluetooth 5.2", price: 1900 },
  { name: "Wi-Fi 6 + Bluetooth 5.3", price: 2400 },
  { name: "Wi-Fi 7 (802.11be) + Bluetooth 5.4", price: 2500 },
];

export const MONITORS = [
  { name: "21.5 inch", price: 5250 },
  { name: "23.8 inch 58-61 cm (23 inch)", price: 9400 },
  { name: "68-71 cm (27 inch)", price: 12800 },
  { name: "72-81 cm (29 inch)", price: 13000 },
  { name: "78.1-83 cm (32 inch)", price: 18500 },
];

export const WARRANTIES = [
  { name: "1 Year", price: 2000 },
  { name: "3 Year", price: 4500 },
  { name: "5 Year", price: 6500 },
];

let liveRateByName = {};

export const getPriceFromLocalData = (categoryList, value) => {
  const item = categoryList.find((item) => item.name === value);
  return item ? (liveRateByName[item.name] ?? item.price) : "";
};


const getProcessorCategory = (processorName) => {
  if (!processorName) return null;
  if (processorName.includes("Threadripper")) return "amd_threadripper";
  if (processorName.includes("Xeon")) return "intel_xeon";
  if (processorName.includes("Intel")) return "intel_standard";
  return null;
};

export const getFilteredRams = (processorName) => {
  const category = getProcessorCategory(processorName);
  if (category === "intel_xeon") {
    return REGISTERED_RAMS.filter((r) => r.name !== "16GB Registered ECC");
  }
  if (category === "amd_threadripper") {
    return REGISTERED_RAMS.filter((r) => r.name !== "128GB Registered ECC");
  }
  if (category === "intel_standard") {
    return RAMS.filter((r) => r.name !== "8GB DDR4" && r.name !== "8GB DDR5");
  }
  return RAMS;
};

export const getFilteredIntelMotherboards = (processorName) => {
  const category = getProcessorCategory(processorName);
  if (category === "intel_xeon") return INTEL_XEON_MOTHERBOARDS;
  if (category === "intel_standard") {
    return INTEL_MOTHERBOARDS.filter(
      (m) => m.name !== "B660/B760 Biostar DDR4 Support i9 Processor" && m.name !== "Q670 DDR4"
    );
  }
  if (!category) return INTEL_MOTHERBOARDS;
  return [];
};

export const getFilteredAmdMotherboards = (processorName) => {
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
  freightInstallation_price: "1000",
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
    source.freightInstallation_price || merged.freightInstallation_price || "1000";
  // An earlier build auto-copied the catalogue motherboard description into
  // this field (it is meant for the tender's own MB requirement). Drop that
  // copied text from saved drafts/bids; current descriptions extend the old
  // ones, so a catalogue entry that starts with the saved text is a copy.
  const mbDescp = String(merged.motherboard_descp || "").trim();
  if (
    mbDescp.length >= 30 &&
    [...INTEL_MOTHERBOARDS, ...INTEL_XEON_MOTHERBOARDS, ...AMD_MOTHERBOARDS].some((m) =>
      String(m.description || "").startsWith(mbDescp)
    )
  ) {
    merged.motherboard_descp = "";
  }
  return merged;
};


export default function WorkstationConfig({ bidData, onNext }) {
  const bid_id = bidData?.bid_id;
  useEffect(() => {
    fetchComponentRates("workstation").then((rates) => {
      liveRateByName = Object.fromEntries(rates.map((rate) => [rate.name, Number(rate.price)]));
    }).catch((error) => console.error("Component rates:", error));
  }, []);
  const draftKey = useMemo(() => getDraftKey(bid_id), [bid_id]);

  // A saved config draft still carries the Step 1 values from when it was
  // first written (bid no, address...). If the user went Back and edited them,
  // the draft must not put the old ones back over the fresh Step 1 values.
  const withFreshBasics = (draftForm) => {
    const merged = { ...draftForm };
    ["bid_no", "dept_name", "organization", "qty", "pincode", "address", "atc"].forEach((key) => {
      if (bidData && bidData[key] !== undefined) merged[key] = bidData[key];
    });
    return merged;
  };

  const [form, setForm] = useState(() => {
    try {
      const savedDraft = localStorage.getItem(getDraftKey(bid_id));
      if (savedDraft) {
        return normalizeInitialForm(withFreshBasics(JSON.parse(savedDraft)));
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
        if (savedDraft) return normalizeInitialForm(withFreshBasics(JSON.parse(savedDraft)));
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

  const SelectField = ({ label, name, options, required, optional, noNone }) => (
    <div className="col-span-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {optional && (
          <span className="text-red-500 text-[11px] font-normal">*Optional</span>
        )}
      </div>
      <div className="flex min-w-0 gap-2">
        <select
          name={name}
          value={form[name]}
          onChange={handleChange}
          required={required}
          className="min-w-0 flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
        >
          <option value="">Select</option>
          {options.map((opt) => (
            <option key={opt.name} value={opt.name}>
              {opt.name}
            </option>
          ))}
          {!noNone && <option value="None">None</option>}
        </select>
        <input
          type="text"
          value={form[`${name}_price`] || ""}
          readOnly
          disabled
          placeholder="Price"
          className="w-24 shrink-0 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50 cursor-not-allowed"
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
                <div className="flex min-w-0 gap-2">
                  <select
                    name="processor"
                    value={getGroupValue(form.processor, intelProcessors)}
                    onChange={handleChange}
                    className="min-w-0 flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-24 shrink-0 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">
                  AMD / Threadripper Processor
                </span>
                <div className="flex min-w-0 gap-2">
                  <select
                    name="processor"
                    value={getGroupValue(form.processor, amdProcessors)}
                    onChange={handleChange}
                    className="min-w-0 flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-24 shrink-0 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50"
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

         
          <div className="col-span-1 grid grid-cols-1 gap-x-6 gap-y-4 md:col-span-2 md:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
            <SelectField label="Ram" name="ram" options={filteredRams} required noNone />
            <SelectField label="Hard Disk Drive" name="hdd" options={HDDS} required />
            <SelectField label="Graphics Card" name="graphics" options={GRAPHICS_CARDS} required noNone />
          </div>

        
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

          
          <SelectField label="SSD 1" name="ssd" options={SSD1_OPTIONS} required noNone />
          <SelectField label="SSD 2" name="ssd2" options={SSD1_OPTIONS} optional noNone />
          <SelectField label="OS" name="os" options={OS_OPTIONS} required noNone />
          <SelectField label="DVD" name="dvd" options={DVDS} />
          <SelectField label="Wi-FI Bluetooth" name="wifi" options={WIFIS} />
          <SelectField label="Monitor" name="monitor" options={MONITORS} required />
          <SelectField label="Cabinet" name="cabinet" options={CABINETS} required noNone />
          <SelectField label="Keyboard & Mouse" name="keyboard" options={KEYBOARDS} required noNone />
          <SelectField label="Power Supply (SMPS)" name="power_supply" options={POWER_SUPPLIES} required noNone />
          <div className="col-span-1 grid grid-cols-1 gap-x-6 gap-y-4 md:col-span-2 md:grid-cols-2 lg:col-span-3 lg:grid-cols-4">
          <SelectField label="Warranty" name="warranty" options={WARRANTIES} required noNone />

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
            <label className="block text-sm font-medium text-gray-700 mb-1">HDD Return Option</label>
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

          </div>

          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2 underline">
              Motherboard Selection
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  {/* Native selects show one line, so the selected text is drawn
                      wrapped underneath and the select sits invisibly on top. */}
                  <div className="relative flex-1 min-w-0 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
                  <div className="h-full flex items-center justify-between gap-2 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700">
                    <span className="whitespace-normal break-words">
                      {(() => {
                        const selected = filteredIntelMotherboards.find((m) => m.name === form.motherboard);
                        if (selected) return fullOptionLabel(selected);
                        return form.motherboard === "None" ? "None" : "Select Intel";
                      })()}
                    </span>
                    <span className="shrink-0 text-gray-500">▾</span>
                  </div>
                  <select
                    name="motherboard"
                    value={getGroupValue(form.motherboard, filteredIntelMotherboards)}
                    onChange={handleChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-sm"
                  >
                    <option value="">Select Intel</option>
                    {filteredIntelMotherboards.map((m, i) => (
                      <option key={`${m.name}-${i}`} value={m.name} title={fullOptionLabel(m)}>
                        {optionLabel(m)}
                      </option>
                    ))}
                    <option value="None">None</option>
                  </select>
                  </div>
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
                  {/* Native selects show one line, so the selected text is drawn
                      wrapped underneath and the select sits invisibly on top. */}
                  <div className="relative flex-1 min-w-0 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
                  <div className="h-full flex items-center justify-between gap-2 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700">
                    <span className="whitespace-normal break-words">
                      {(() => {
                        const selected = filteredAmdMotherboards.find((m) => m.name === form.motherboard);
                        if (selected) return fullOptionLabel(selected);
                        return form.motherboard === "None" ? "None" : "Select AMD";
                      })()}
                    </span>
                    <span className="shrink-0 text-gray-500">▾</span>
                  </div>
                  <select
                    name="motherboard"
                    value={getGroupValue(form.motherboard, filteredAmdMotherboards)}
                    onChange={handleChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-sm"
                  >
                    <option value="">Select AMD</option>
                    {filteredAmdMotherboards.map((m, i) => (
                      <option key={`${m.name}-${i}`} value={m.name} title={fullOptionLabel(m)}>
                        {optionLabel(m)}
                      </option>
                    ))}
                    <option value="None">None</option>
                  </select>
                  </div>
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

          <div className="col-span-1 grid grid-cols-1 gap-6 md:col-span-2 md:grid-cols-2 lg:col-span-3">
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

     
        <div className="flex justify-start items-center">
          <button
            type="submit"
            disabled={saving}
            className="mt-8 mb-10 flex items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 active:scale-95 disabled:bg-blue-400"
          >
            {saving ? "Saving..." : (
              <>
                View Bid Products at a Glance
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
