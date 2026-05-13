import { useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";

const PROCESSORS = [
  "Intel Core i3 12100","Intel Core i5 12400","Intel Core i5 12500","Intel Core i5 13500",
  "Intel Core i5 14400","Intel Core i5 14500","Intel Core i7 12700","Intel Core i7 13700",
  "Intel Core i7 14700","Intel Core i9 12900","Intel Core i9 13900","Intel Core i9 14900",
  "AMD Ryzen 3 4300G","AMD Ryzen 3 5300G","AMD Ryzen 5 4600G","AMD Ryzen 5 5600G",
  "AMD Ryzen 7 4700G","AMD Ryzen 7 5700G","AMD Ryzen 7 5750G","AMD Ryzen 9 3900G",
  "12th Gen Composite i3","12th Gen Composite i5","12th Gen Composite i7",
];

const RAMS = [
  "8GB DDR4 2666","8GB DDR4 3200","16GB DDR4 2666","8GB DDR5","16GB DDR5",
  "16GB DDR4 3200","32GB DDR4 2666","32GB DDR4 3200","32GB DDR4 3200*2",
  "8GB DDR5 4800","16GB DDR5 4800","32GB DDR5 4800","32GB DDR5 4800*2",
];

const HDDS = ["1 TB","1TB","2 TB"];

const SSDS = [
  "128 GB SATA","256 GB SATA","512 GB SATA","1TB SATA",
  "128 GB NVMe","256 GB NVMe","512 GB NVMe","1TB NVMe",
];

const OS_OPTIONS = [
  "Windows 10 Home","Windows 10 Professional","Windows 11 Home",
  "Windows 11 Professional","DOS","Linex",
];

const DVDS = ["Yes"];

const WIFIS = [
  "PCI Based 4.2 Bluetooth","Wi-fi AC 4.2 Bluetooth",
  "Wi-Fi 6 5.0 Bluetooth","Wi-Fi AX201 5.2 Bluetooth",
];

const MONITORS = [
  "18.5 inch","19.5 inch","21.5 inch","21.5 inch with Speaker",
  "21.5 inch with DP Port","23.8 inch","23.8 inch with Speaker",
  "23.8 inch with DP Port","23.8 inch with Speaker Webcam","27 inch",
];

const CABINETS = ["SFF","Tower"];

const KEYBOARDS = ["Keyboard & Mouse Wired","Keyboard & Mouse Wireless"];

const WARRANTIES = ["1 Year","2 Year","3 Year","4 Year","5 Year","6 Year","7 Year"];

const MOTHERBOARDS = [
  "H610, PCI X 16- 1 PCI 4 X1, M.2 1, 4 USB 2.0, 2USB 3.0, VGA, HDMI",
  "H610 WITH DP PROT, PCI X 16- 1 PCI 4 X1, M.2 1, 4 USB 2.0, 2USB 3.0, VGA, HDMI, DP",
  "B760, PCI X 16- 1 PCI 4 X1, M.2 1, 4 USB 2.0, 4 USB 3.0, VGA, HDMI",
  "Q670 DDR4 2 DIMM, PCI X 16- 1 PCI 4 X2, M.2 2, 4 USB 2.0, 4 USB 3.0 TYPE C 1, VGA, HDMI",
  "Q670 DDR4 4 DIMM, PCI X 16- 1 PCI 4 X2, M.2 2, 4 USB 2.0, 4 USB 3.0 TYPE C 1, VGA, HDMI",
  "Q670 DDR5 2 DIMM, PCI X 16- 1 PCI 4 X2, M.2 2, 4 USB 2.0, 4 USB 3.0 TYPE C 1, VGA, HDMI",
  "Q670 DDR5 VPRO 4 DIMM, PCI X 16- 1 PCI 4 X2, M.2 2, 4 USB 2.0, 4 USB 3.0 TYPE C 1, VGA, HDMI",
  "AMD B650, DDR5, 4 USB 2.0, 2 USB 3.0, PCI16*2, PCI4*1",
  "AMD B550, 4 USB 2.0, 2 USB 3.0, PCI16*1, PCI4*1",
  "AMD B450, 4 USB 2.0, 2 USB 3.0, PCI16*1, PCI4*1",
  "AMD A520, 4 USB 2.0, 2 USB 3.0, PCI16*1, PCI4*1",
  "B760 with DDR5",
  "H610 with DDR5",
];

const PRICE_ENDPOINTS = {
  processor: "check_processor",
  ram: "check_ram",
  hdd: "check_hdd",
  ssd: "check_ssd",
  ssd2: "check_ssd",
  os: "check_os",
  dvd: "check_dvd",
  wifi: "check_wifi",
  motherboard: "check_motherboard",
  monitor: "check_monitor_size",
  cabinet: "check_cabinet_type",
  keyboard: "check_keyboard",
  warranty: "check_warranty",
};

const INITIAL_FORM = {
  processor: "", processor_price: "",
  ram: "", ram_price: "",
  hdd: "", hdd_price: "",
  ssd: "", ssd_price: "",
  ssd2: "", ssd2_price: "",
  gp: "",
  os: "", os_price: "",
  dvd: "", dvd_price: "",
  wifi: "", wifi_price: "",
  software1: "",
  motherboard: "", motherboard_price: "",
  monitor: "", monitor_price: "",
  cabinet: "", cabinet_price: "",
  keyboard: "", keyboard_price: "",
  warranty: "", warranty_price: "",
  date: "",
  pro_descp: "",
  motherboard_descp: "",
  epbg: "",
  hddreturnable: "Yes", hddreturnable_price: "",
  freightInstallation: "Yes", freightInstallation_price: "1000",
};

const fetchPrice = async (field, value) => {
  try {
    const endpoint = PRICE_ENDPOINTS[field];
    if (!endpoint) return "";
    const payloadKey = field === "ssd2" ? "ssd" : field;
    const res = await fetch(`${API_BASE}/${endpoint}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [payloadKey]: value }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.price ?? data ?? "";
  } catch {
    return "";
  }
};

export default function DesktopConfig({ bidData, onNext }) {
  const bid_id = bidData?.bid_id;

  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const intelProcessors = PROCESSORS.filter(p => p.includes("Intel") || p.includes("Gen"));
  const amdProcessors = PROCESSORS.filter(p => p.includes("AMD"));
  const intelMotherboards = MOTHERBOARDS.filter(m => (m.startsWith("H") || m.startsWith("B") || m.startsWith("Q")) && !m.includes("AMD"));
  const amdMotherboards = MOTHERBOARDS.filter(m => m.includes("AMD"));

  const handleChange = async (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    const priceField = `${name}_price`;
    if (PRICE_ENDPOINTS[name]) {
      const price = await fetchPrice(name, value);
      setForm((prev) => ({ ...prev, [priceField]: price }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`${API_BASE}/desktop-bids/${bid_id}/update/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMsg("Data Save");
        onNext({ ...form });
      } else {
        setMsg("Data Not Save");
      }
    } catch {
      setMsg("Data Not Save — server se connect nahi ho pa raha.");
    } finally {
      setSaving(false);
    }
  };

  const SelectField = ({ label, name, options, required, optional }) => (
    <div className="col-span-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {optional && <span className="text-red-500 text-[11px] font-normal">*Optional</span>}
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
            <option key={opt} value={opt}>{opt}</option>
          ))}
          <option value="">None</option>
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

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl">
      <h5 className="text-lg font-semibold text-gray-800 mb-4 pt-2 border-b pb-2">Create Desktop</h5>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded text-sm font-medium ${msg.includes("Save") && !msg.includes("Not") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {msg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">

          {/* TWO SEPARATE PROCESSOR INPUTS WITH PRICE FIELDS */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2 underline">Processor Selection</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Intel Section */}
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">Intel Processor</span>
                <div className="flex gap-2">
                  <select name="processor" value={intelProcessors.includes(form.processor) ? form.processor : ""} onChange={handleChange} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Intel</option>
                    {intelProcessors.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input type="text" value={intelProcessors.includes(form.processor) ? form.processor_price : ""} readOnly disabled placeholder="Price" className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50" />
                </div>
              </div>
              {/* AMD Section */}
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">AMD Processor</span>
                <div className="flex gap-2">
                  <select name="processor" value={amdProcessors.includes(form.processor) ? form.processor : ""} onChange={handleChange} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select AMD</option>
                    {amdProcessors.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input type="text" value={amdProcessors.includes(form.processor) ? form.processor_price : ""} readOnly disabled placeholder="Price" className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50" />
                </div>
              </div>
            </div>
          </div>

          <SelectField label="Ram" name="ram" options={RAMS} required />
          <SelectField label="Hard Disk Drive" name="hdd" options={HDDS} required />

          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Processor Description</label>
              <span className="text-red-500 text-[11px] font-normal">*Optional</span>
            </div>
            <textarea name="pro_descp" value={form.pro_descp} onChange={handleChange} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Software Description</label>
              <span className="text-red-500 text-[11px] font-normal">*Optional</span>
            </div>
            <textarea name="software1" value={form.software1} onChange={handleChange} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Graphics Description</label>
              <span className="text-red-500 text-[11px] font-normal">*Optional</span>
            </div>
            <textarea name="gp" value={form.gp} onChange={handleChange} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <SelectField label="SSD 1" name="ssd" options={SSDS} required />
          <SelectField label="SSD 2" name="ssd2" options={SSDS} required />
          <SelectField label="OS" name="os" options={OS_OPTIONS} required />

          <SelectField label="DVD" name="dvd" options={DVDS} required />
          <SelectField label="Wi-FI Bluetooth" name="wifi" options={WIFIS} required />
          <SelectField label="Monitor" name="monitor" options={MONITORS} required />

          <SelectField label="Cabinet" name="cabinet" options={CABINETS} required />
          <SelectField label="Keyboard & Mouse" name="keyboard" options={KEYBOARDS} required />
          <SelectField label="Warranty" name="warranty" options={WARRANTIES} required />

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Bid Date</label>
            <input type="date" name="date" value={form.date} onChange={handleChange} required className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">EPBG (%)</label>
            <input type="text" name="epbg" value={form.epbg} onChange={handleChange} placeholder="Price" className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-500 bg-gray-50 outline-none" />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Freight & Installation</label>
            <div className="flex gap-2">
              <input type="text" value="Yes" readOnly disabled className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 cursor-not-allowed" />
              <input type="text" value="1000" readOnly disabled className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm bg-gray-50 cursor-not-allowed" />
            </div>
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">HDD Return Option</label>
            <div className="flex gap-2">
              <select name="hddreturnable" value={form.hddreturnable} onChange={handleChange} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="Yes">Yes</option>
                <option value="None">None</option>
              </select>
              <input type="text" name="hddreturnable_price" value={form.hddreturnable_price} onChange={handleChange} placeholder="Price" className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* TWO SEPARATE MOTHERBOARD INPUTS WITH PRICE FIELDS */}
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2 underline">Motherboard Selection</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Intel Section */}
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">Intel Motherboard</span>
                <div className="flex gap-2">
                  <select name="motherboard" value={intelMotherboards.includes(form.motherboard) ? form.motherboard : ""} onChange={handleChange} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Intel</option>
                    {intelMotherboards.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input type="text" value={intelMotherboards.includes(form.motherboard) ? form.motherboard_price : ""} readOnly disabled placeholder="Price" className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50" />
                </div>
              </div>
              {/* AMD Section */}
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 font-medium mb-1 uppercase">AMD Motherboard</span>
                <div className="flex gap-2">
                  <select name="motherboard" value={amdMotherboards.includes(form.motherboard) ? form.motherboard : ""} onChange={handleChange} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select AMD</option>
                    {amdMotherboards.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input type="text" value={amdMotherboards.includes(form.motherboard) ? form.motherboard_price : ""} readOnly disabled placeholder="Price" className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50" />
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1 md:col-span-3">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Motherboard Description</label>
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

        <div className="flex justify-start items-center">
            <button type="submit" disabled={saving} className="mt-8 mb-10 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-12 py-2.5 rounded-md text-sm transition shadow-lg active:scale-95">
            {saving ? "Saving..." : "Next"}
            </button>
        </div>
      </form>
    </div>
  );
}