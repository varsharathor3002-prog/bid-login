import { useEffect, useMemo, useState } from "react";
import { fetchComponentRates } from "../../../utils/componentRates";
import {
  PROCESSORS,
  DVDS,
  WARRANTIES,
} from "../../Desktop/User/DesktopConfig";

export const AIO_PROCESSORS = [
  ...PROCESSORS
    .filter((processor) => !processor.name.includes("Composite"))
    .map((processor) => ({ ...processor })),
  { name: "12th Gen Embedded i5", price: 18000 },
  { name: "12th Gen Embedded i7", price: 23000 },
  { name: "13th Gen Embedded i5", price: 18000 },
  { name: "13th Gen Embedded i7", price: 23000 },
];

const API_BASE = import.meta.env.VITE_API_URL;

// AIO's own option lists — exactly the values from the legacy
// aio_bid_create.php reference, nothing else. Note: several of these
// (SSD/Screen Size/WiFi/Keyboard) no longer match aio_specs.xlsx's own
// vocabulary ("1024 GB" vs "1 TB", range sizes vs flat "24 inch", short vs
// long WiFi names) — Find Model's exact-match scoring on those fields will
// score lower for bids built from this list until aio_specs.xlsx itself is
// updated to the same wording. The analyser/admin edit screens
// (AioBidDetailView.jsx, AioBidApproval.jsx) import these same lists too, so
// they stay in sync.
export const AIO_RAMS = [
  { name: "8GB DDR4 3200", price: 5500 },
  { name: "16GB DDR4 3200", price: 9500 },
  { name: "32GB DDR4 3200", price: 18500 },
  { name: "8GB DDR5 4800", price: 8000 },
  { name: "16GB DDR5 4800", price: 13200 },
  { name: "32GB DDR5 4800", price: 26000 },
];

export const AIO_HDDS = [
  { name: "1 TB", price: 5000 },
  { name: "2 TB", price: 7500 },
];

export const AIO_SSDS = [
  { name: "128 GB SATA", price: 3500 },
  { name: "256 GB SATA", price: 4500 },
  { name: "512 GB SATA", price: 6800 },
  { name: "1 TB SATA", price: 12500 },
  { name: "128 GB NVMe", price: 4000 },
  { name: "256 GB NVMe", price: 5000 },
  { name: "512 GB NVMe", price: 7500 },
  { name: "1 TB NVMe", price: 13500 },
];

export const AIO_OS_OPTIONS = [
  { name: "Windows 11 Home", price: 1000 },
  { name: "Windows 11 Professional", price: 1000 },
  { name: "DOS", price: 1000 },
  { name: "Linux", price: 1000 },
];

export const AIO_SCREEN_SIZES = [
  { name: "21 inch", price: 4500 },
  { name: "24 inch", price: 5500 },
  { name: "27 inch", price: 8000 },
];

export const AIO_WIFIS = [
  { name: "Wi-Fi 5 (802.11ac) + Bluetooth 5.0", price: 850 },
  { name: "Wi-Fi 6 (802.11ac) + Bluetooth 5.0", price: 1200 },
  { name: "Wi-Fi 6 (802.11ac) + Bluetooth 5.1", price: 1200 },
  { name: "Wi-Fi 6 (802.11ax) + Bluetooth 5.3", price: 1500 },
  { name: "Wi-Fi BGN + Bluetooth 4.2", price: 750 },
];

export const AIO_KEYBOARDS = [
  { name: "Wired", price: 450 },
  { name: "Wireless", price: 850 },
];

// AIO only ever ships Intel boards — no AMD build exists for this line — so
// this is exactly aio_bid_create.php's 4 motherboard options and nothing
// else (Desktop's own detailed/AMD-inclusive list doesn't apply here).
// "motherboard" isn't part of AIO_CATALOGUE_FIELD_MAP (see Aio.py), so this
// has no effect on Find Model either way.
export const AIO_MOTHERBOARDS = [
  { name: "H610, HDMI, DP, LAN, Audio Port, USB 3-4, USB 2.0-2", price: 5000 },
  { name: "H810, HDMI, DP, LAN, Audio Port, USB 3.2 Gen2-2, USB 2.0-2", price: 5500 },
  { name: "Q670, HDMI, DP, LAN, Audio Port, USB 3.0-6, Type C-1", price: 8000 },
  { name: "Integrated, HDMI, VGA, LAN, Audio Port, USB 3-4, USB 2.0-2", price: 4500 },
];

// getFilteredRams (Desktop/User/DesktopConfig.jsx) is hardwired to Desktop's
// own RAMS array, so it can't filter AIO_RAMS — this is the same DDR4/DDR5-by
// -processor rule reimplemented locally against AIO's own list.
export const getFilteredAioRams = (processorName) => {
  const category = getProcessorCategory(processorName);
  if (!category) return AIO_RAMS;
  if (category === "intel_ultra" || category === "amd_new") {
    return AIO_RAMS.filter((r) => r.name.includes("DDR5"));
  }
  if (category === "intel_old" || category === "amd_old") {
    return AIO_RAMS.filter((r) => r.name.includes("DDR4"));
  }
  return AIO_RAMS;
};

export const AIO_OPTIONS = Object.fromEntries(
  Object.entries({
    processor: AIO_PROCESSORS,
    ram: AIO_RAMS,
    hdd: AIO_HDDS,
    ssd: AIO_SSDS,
    os: AIO_OS_OPTIONS,
    motherboard: AIO_MOTHERBOARDS,
    screen_size: AIO_SCREEN_SIZES,
    wifi: AIO_WIFIS,
    keyboard: AIO_KEYBOARDS,
    dvd: DVDS,
    warranty: WARRANTIES,
  }).map(([field, list]) => [field, list.map((item) => item.name)])
);

let liveRateByName = {};

const getPriceFromCatalog = (categoryList, value) => {
  const item = categoryList.find((entry) => entry.name === value);
  return item ? liveRateByName[item.name] ?? item.price : "";
};

const getProcessorCategory = (processorName) => {
  if (!processorName) return null;
  if (processorName.includes("Ultra")) return "intel_ultra";
  if (processorName.includes("8500G") || processorName.includes("9300G")) return "amd_new";
  if (processorName.includes("AMD")) return "amd_old";
  if (processorName.includes("Intel") || processorName.includes("Gen")) return "intel_old";
  return null;
};

const INITIAL_FORM = {
  processor: "",
  processor_price: "",
  ram: "",
  ram_price: "",
  hdd: "",
  hdd_price: "",
  ssd: "",
  ssd_price: "",
  pro_descp: "",
  software1: "",
  gp: "",
  os: "",
  os_price: "",
  dvd: "",
  dvd_price: "",
  wifi: "",
  wifi_price: "",
  screen_size: "",
  screen_price: "",
  keyboard: "",
  keyboard_price: "",
  warranty: "",
  warranty_price: "",
  motherboard: "",
  motherboard_price: "",
  motherboard_descp: "",
  date: "",
  epbg: "",
  hddreturnable: "Yes",
  hddreturnable_price: "",
  freightInstallation: "Yes",
  freightInstallation_price: "1000",
};

const getDraftKey = (bidId) => `aio_config_draft_${bidId || "new"}`;

const normalizeInitialForm = (source = {}) => ({ ...INITIAL_FORM, ...source });

export default function AioConfig({ bidData, onNext }) {
  const bid_id = bidData?.bid_id;

  useEffect(() => {
    fetchComponentRates("aio")
      .then((rates) => {
        liveRateByName = Object.fromEntries(rates.map((rate) => [rate.name, Number(rate.price)]));
      })
      .catch((error) => console.error("Component rates:", error));
  }, []);

  const draftKey = useMemo(() => getDraftKey(bid_id), [bid_id]);

  const [form, setForm] = useState(() => {
    try {
      const savedDraft = localStorage.getItem(getDraftKey(bid_id));
      if (savedDraft) return normalizeInitialForm(JSON.parse(savedDraft));
    } catch (error) {
      console.warn("Unable to restore AIO configuration draft", error);
    }
    return normalizeInitialForm(bidData?.aio_config || bidData?.configuration || bidData || {});
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [processorNoneGroup, setProcessorNoneGroup] = useState(null);

  useEffect(() => {
    setForm((prev) => {
      try {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) return normalizeInitialForm(JSON.parse(savedDraft));
      } catch (error) {
        console.warn("Unable to restore AIO configuration draft", error);
      }
      return normalizeInitialForm({ ...bidData, ...prev });
    });
  }, [draftKey]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      console.warn("Unable to save AIO configuration draft", error);
    }
  }, [draftKey, form]);

  const intelProcessors = AIO_PROCESSORS.filter(
    (p) => p.name.includes("Intel") || p.name.includes("Gen") || p.name.includes("Ultra")
  );
  const amdProcessors = PROCESSORS.filter((p) => p.name.includes("AMD"));

  const filteredRams = useMemo(() => getFilteredAioRams(form.processor), [form.processor]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const processorGroup = e.target.dataset.processorGroup;
    const fieldValue = name === "processor" && value === "None" ? "" : value;
    const priceField = `${name}_price`;

    if (name === "processor") {
      if (value === "None") {
        setProcessorNoneGroup(processorGroup || null);
      } else if (value) {
        setProcessorNoneGroup((current) => (current === processorGroup ? null : current));
      }
    }

    setForm((prev) => ({ ...prev, [name]: fieldValue, [priceField]: "" }));

    if (!fieldValue) return;

    let localList = null;
    if (name === "processor") localList = AIO_PROCESSORS;
    else if (name === "ram") localList = AIO_RAMS;
    else if (name === "hdd") localList = AIO_HDDS;
    else if (name === "ssd") localList = AIO_SSDS;
    else if (name === "os") localList = AIO_OS_OPTIONS;
    else if (name === "dvd") localList = DVDS;
    else if (name === "wifi") localList = AIO_WIFIS;
    else if (name === "screen_size") localList = AIO_SCREEN_SIZES;
    else if (name === "keyboard") localList = AIO_KEYBOARDS;
    else if (name === "warranty") localList = WARRANTIES;
    else if (name === "motherboard") localList = AIO_MOTHERBOARDS;

    if (localList) {
      const price = getPriceFromCatalog(localList, fieldValue);
      setForm((prev) => ({ ...prev, [priceField]: price }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasValidProcessor = AIO_PROCESSORS.some((processor) => processor.name === form.processor);
    if (!hasValidProcessor) {
      const validationMessage = "Please select an Intel or AMD Ryzen processor before submitting the form.";
      setMsg(validationMessage);
      window.alert(validationMessage);
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = { ...form };
      const res = await fetch(`${API_BASE}/aio-bids/${bid_id}/update/`, {
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

  const SelectField = ({ label, name, options, required, optional, hideNone }) => (
    <div className="col-span-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {optional && <span className="text-red-500 text-[11px] font-normal">*Optional</span>}
      </div>
      <div className="flex gap-2">
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
          {!hideNone && <option value="None">None</option>}
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
    if (!currentValue) return "";
    const exists = list.some((item) => item.name === currentValue);
    return exists ? currentValue : "";
  };

  const getProcessorGroupValue = (group, list) => {
    if (processorNoneGroup === group) return "None";
    return getGroupValue(form.processor, list);
  };

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-4 pt-2 border-b pb-2">
        <h5 className="text-lg font-semibold text-gray-800">Create AIO Configuration</h5>
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
                  Intel Processor
                </span>
                <div className="flex gap-2">
                  <select
                    name="processor"
                    data-processor-group="intel"
                    value={getProcessorGroupValue("intel", intelProcessors)}
                    onChange={handleChange}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Intel</option>
                    {intelProcessors.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                    <option value="None">None</option>
                  </select>
                  <input
                    type="text"
                    value={intelProcessors.some((p) => p.name === form.processor) ? form.processor_price : ""}
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
                    data-processor-group="amd"
                    value={getProcessorGroupValue("amd", amdProcessors)}
                    onChange={handleChange}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select AMD Ryzen</option>
                    {amdProcessors.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                    <option value="None">None</option>
                  </select>
                  <input
                    type="text"
                    value={amdProcessors.some((p) => p.name === form.processor) ? form.processor_price : ""}
                    readOnly
                    disabled
                    placeholder="Price"
                    className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50"
                  />
                </div>
              </div>
            </div>
          </div>

          <SelectField label="Ram" name="ram" options={filteredRams} required />
          <SelectField label="Hard Disk Drive" name="hdd" options={AIO_HDDS} required />

          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">Processor Description</label>
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
              <label className="block text-sm font-medium text-gray-700">Additional Software</label>
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
              <label className="block text-sm font-medium text-gray-700">Graphics Description</label>
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

          <SelectField label="Solid State Drive" name="ssd" options={AIO_SSDS} required />
          <SelectField label="Operating System" name="os" options={AIO_OS_OPTIONS} required />
          <SelectField label="DVD" name="dvd" options={DVDS} required />
          <SelectField label="Wi-FI Bluetooth" name="wifi" options={AIO_WIFIS} required />
          <SelectField label="Screen Size" name="screen_size" options={AIO_SCREEN_SIZES} required />
          <SelectField label="Keyboard & Mouse" name="keyboard" options={AIO_KEYBOARDS} required />
          <SelectField label="Warranty" name="warranty" options={WARRANTIES} required />

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
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
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

          <SelectField label="Motherboard" name="motherboard" options={AIO_MOTHERBOARDS} required hideNone />

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
