import { useState } from "react";

// ─────────────────────────────────────────────
// DATA OPTIONS
// ─────────────────────────────────────────────
const PROCESSORS = [
  "Intel Core i3 12100","Intel Core i5 12400","Intel Core i5 12500",
  "Intel Core i5 13500","Intel Core i5 14400","Intel Core i5 14500",
  "Intel Core i7 12700","Intel Core i7 13700","Intel Core i7 14700",
  "Intel Core i9 12900","Intel Core i9 13900","Intel Core i9 14900",
  "AMD Ryzen 3 4300G","AMD Ryzen 3 5300G","AMD Ryzen 5 4600G",
  "AMD Ryzen 5 5600G","AMD Ryzen 7 4700G","AMD Ryzen 7 5700G",
  "AMD Ryzen 7 5750G","AMD Ryzen 9 3900G",
  "12th Gen Composite i3","12th Gen Composite i5","12th Gen Composite i7",
];
const RAM = [
  "8GB DDR4 2666","8GB DDR4 3200","16GB DDR4 2666","8GB DDR5","16GB DDR5",
  "16GB DDR4 3200","32GB DDR4 2666","32GB DDR4 3200","32GB DDR4 3200*2",
  "8GB DDR5 4800","16GB DDR5 4800","32GB DDR5 4800","32GB DDR5 4800*2",
];
const HDD  = ["1 TB","1TB","2 TB","None"];
const SSD  = ["128 GB SATA","256 GB SATA","512 GB SATA","1TB SATA","128 GB NVMe","256 GB NVMe","512 GB NVMe","1TB NVMe","None"];
const OS_LIST = ["Windows 10 Home","Windows 10 Professional","Windows 11 Home","Windows 11 Professional","DOS","Linex"];
const DVD  = ["Yes","None"];
const WIFI = ["PCI Based 4.2 Bluetooth","Wi-fi AC 4.2 Bluetooth","Wi-Fi 6 5.0 Bluetooth","Wi-Fi AX201 5.2 Bluetooth","None"];
const MONITORS = ["18.5 inch","19.5 inch","21.5 inch","21.5 inch with Speaker","21.5 inch with DP Port","23.8 inch","23.8 inch with Speaker","23.8 inch with DP Port","23.8 inch with Speaker Webcam","27 inch"];
const CABINET  = ["SFF","Tower"];
const KEYBOARD = ["Keyboard & Mouse Wired","Keyboard & Mouse Wireless","None"];
const WARRANTY = ["1 Year","2 Year","3 Year","4 Year","5 Year"];
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
  "B760 with DDR5","H610 with DDR5",
];
const MODEL_PREFIXES = ["ACL-1082DS-","ACL-1060DS-","ACL-1077DS-"];

// ─────────────────────────────────────────────
// SHARED UI COMPONENTS  (white / light theme)
// ─────────────────────────────────────────────
const Label = ({ children, optional }) => (
  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
    {children}
    {optional && (
      <span className="text-rose-400 normal-case tracking-normal font-normal ml-1">— Optional</span>
    )}
  </label>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`w-full bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2.5 text-sm outline-none
      focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder-gray-300 shadow-sm ${className}`}
    {...props}
  />
);

const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={`w-full bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2.5 text-sm outline-none
      focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder-gray-300 shadow-sm resize-none ${className}`}
    {...props}
  />
);

const Select = ({ options, className = "", noneValue = false, ...props }) => (
  <select
    className={`w-full bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2.5 text-sm outline-none
      focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm ${className}`}
    {...props}
  >
    <option value="">— Select —</option>
    {options.map((o) => (
      <option key={o} value={o === "None" && noneValue ? "" : o}>{o}</option>
    ))}
  </select>
);

const PriceInput = ({ value, onChange }) => (
  <div className="relative flex-shrink-0">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-sm pointer-events-none">₹</span>
    <input
      type="number"
      placeholder="Price"
      value={value}
      onChange={onChange}
      className="w-28 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg pl-7 pr-2 py-2.5 text-sm
        outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all font-semibold shadow-sm"
    />
  </div>
);

const SelectWithPrice = ({ label, optional, options, selectVal, onSelectChange, priceVal, onPriceChange, noneValue }) => (
  <div>
    <Label optional={optional}>{label}</Label>
    <div className="flex gap-2 items-center">
      <Select options={options} value={selectVal} onChange={onSelectChange} noneValue={noneValue} className="flex-1" />
      <PriceInput value={priceVal} onChange={onPriceChange} />
    </div>
  </div>
);

// Card with colored header
const SectionCard = ({ title, icon, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600">
      <span className="text-sm">{icon}</span>
      <h3 className="text-white font-bold text-xs uppercase tracking-widest">{title}</h3>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

// Step indicator
const StepPill = ({ num, label, current, done }) => (
  <div className="flex items-center gap-2">
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
      ${done    ? "bg-emerald-500 border-emerald-500 text-white"
      : current ? "bg-blue-600 border-blue-600 text-white"
                : "bg-white border-gray-200 text-gray-400"}`}>
      {done ? "✓" : num}
    </div>
    <span className={`text-xs font-bold hidden sm:block transition-colors
      ${current ? "text-blue-600" : done ? "text-emerald-500" : "text-gray-400"}`}>
      {label}
    </span>
    {num < 3 && (
      <div className={`w-8 sm:w-16 h-0.5 mx-1 rounded-full transition-all ${done ? "bg-emerald-400" : "bg-gray-200"}`} />
    )}
  </div>
);

const SubmitBtn = ({ children }) => (
  <button
    type="submit"
    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
      text-white font-bold py-3 rounded-xl text-sm uppercase tracking-widest transition-all
      shadow-md shadow-blue-200 active:scale-95 mt-2"
  >
    {children}
  </button>
);

const BidBadge = ({ bidData }) => (
  <div className="flex flex-wrap gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs">
    <span className="text-gray-500">Bid No: <span className="text-blue-600 font-bold">{bidData.bid_no}</span></span>
    <span className="text-gray-300">|</span>
    <span className="text-gray-500">Dept: <span className="text-gray-700 font-semibold">{bidData.deptName}</span></span>
    <span className="text-gray-300">|</span>
    <span className="text-gray-500">Qty: <span className="text-gray-700 font-semibold">{bidData.qty}</span></span>
  </div>
);


function Step1CreateBid({ onNext }) {
  const [form, setForm] = useState({
    bid_no: "", deptName: "", qty: "", atc: "", address: "", pincode: "",
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <form onSubmit={e => { e.preventDefault(); onNext(form); }} className="space-y-4">
      <SectionCard title="Bid Information" icon="📋">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Bid Number</Label>
            <Input value={form.bid_no} onChange={set("bid_no")} placeholder="e.g. BID-2024-001" required />
          </div>
          <div>
            <Label>Department Name</Label>
            <Input value={form.deptName} onChange={set("deptName")} placeholder="e.g. IT Department" required />
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" value={form.qty} onChange={set("qty")} placeholder="e.g. 10" required />
          </div>
          <div>
            <Label>Pin Code</Label>
            <Input type="number" value={form.pincode} onChange={set("pincode")} placeholder="e.g. 226001" required />
          </div>
        </div>
        <div>
          <Label>Address</Label>
          <Input value={form.address} onChange={set("address")} placeholder="Enter full delivery address" required />
        </div>
        <div>
          <Label optional>ATC</Label>
          <Textarea value={form.atc} onChange={set("atc")} rows={3} placeholder="Enter ATC / tender details..." />
        </div>
      </SectionCard>
      <SubmitBtn>Submit & Continue →</SubmitBtn>
    </form>
  );
}


function Step2DesktopConfig({ bidData, onNext }) {
  const [form, setForm] = useState({
    processor: "", pro_descp: "", ram: "", hdd: "", ssd: "", gp: "", software1: "",
    os: "", dvd: "", wifi: "", monitor: "", cabinet: "", keyboard: "", warranty: "",
    motherboard: "", motherboard_descp: "", date: "", epbg: "",
    hddreturnable: "Yes", hddreturnable_price: "",
  });
  const [prices, setPrices] = useState({
    processor_price: "", ram_price: "", hdd_price: "", ssd_price: "", os_price: "",
    dvd_price: "", wifi_price: "", monitor_price: "", cabinet_price: "",
    keyboard_price: "", warranty_price: "", motherboard_price: "",
  });

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setP = k => e => setPrices(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    onNext({ ...form, ...prices, freightInstallation: "Yes", freightInstallation_price: "1000" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <BidBadge bidData={bidData} />

      {/* Processor */}
      <SectionCard title="Processor" icon="⚙️">
        <SelectWithPrice
          label="Processor" options={PROCESSORS}
          selectVal={form.processor} onSelectChange={setF("processor")}
          priceVal={prices.processor_price} onPriceChange={setP("processor_price")}
        />
        <div>
          <Label optional>Processor Description</Label>
          <Textarea value={form.pro_descp} onChange={setF("pro_descp")} rows={2} placeholder="Optional processor details..." />
        </div>
      </SectionCard>

      {/* Memory & Storage */}
      <SectionCard title="Memory & Storage" icon="💾">
        <SelectWithPrice label="RAM" options={RAM} selectVal={form.ram} onSelectChange={setF("ram")} priceVal={prices.ram_price} onPriceChange={setP("ram_price")} />
        <SelectWithPrice label="Hard Disk Drive" options={HDD} noneValue selectVal={form.hdd} onSelectChange={setF("hdd")} priceVal={prices.hdd_price} onPriceChange={setP("hdd_price")} />
        <SelectWithPrice label="Solid State Drive" options={SSD} noneValue selectVal={form.ssd} onSelectChange={setF("ssd")} priceVal={prices.ssd_price} onPriceChange={setP("ssd_price")} />
      </SectionCard>

      {/* Software & Graphics */}
      <SectionCard title="Software & Graphics" icon="🖥️">
        <div>
          <Label>Software Description</Label>
          <Textarea value={form.software1} onChange={setF("software1")} rows={2} required placeholder="e.g. MS Office, antivirus..." />
        </div>
        <div>
          <Label>Graphics Processor Description</Label>
          <Textarea value={form.gp} onChange={setF("gp")} rows={2} required placeholder="e.g. Integrated Intel UHD 730..." />
        </div>
      </SectionCard>

      {/* OS & Connectivity */}
      <SectionCard title="OS & Connectivity" icon="🌐">
        <SelectWithPrice label="Operating System" options={OS_LIST} selectVal={form.os} onSelectChange={setF("os")} priceVal={prices.os_price} onPriceChange={setP("os_price")} />
        <SelectWithPrice label="DVD" options={DVD} noneValue selectVal={form.dvd} onSelectChange={setF("dvd")} priceVal={prices.dvd_price} onPriceChange={setP("dvd_price")} />
        <SelectWithPrice label="Wi-Fi / Bluetooth" options={WIFI} noneValue selectVal={form.wifi} onSelectChange={setF("wifi")} priceVal={prices.wifi_price} onPriceChange={setP("wifi_price")} />
      </SectionCard>

      {/* Peripherals */}
      <SectionCard title="Peripherals & Display" icon="🖱️">
        <SelectWithPrice label="Monitor" options={MONITORS} selectVal={form.monitor} onSelectChange={setF("monitor")} priceVal={prices.monitor_price} onPriceChange={setP("monitor_price")} />
        <SelectWithPrice label="Cabinet" options={CABINET} selectVal={form.cabinet} onSelectChange={setF("cabinet")} priceVal={prices.cabinet_price} onPriceChange={setP("cabinet_price")} />
        <SelectWithPrice label="Keyboard & Mouse" options={KEYBOARD} noneValue selectVal={form.keyboard} onSelectChange={setF("keyboard")} priceVal={prices.keyboard_price} onPriceChange={setP("keyboard_price")} />
      </SectionCard>

      {/* Warranty */}
      <SectionCard title="Warranty & Date" icon="🛡️">
        <SelectWithPrice label="Warranty" options={WARRANTY} selectVal={form.warranty} onSelectChange={setF("warranty")} priceVal={prices.warranty_price} onPriceChange={setP("warranty_price")} />
        <div>
          <Label>Bid Date</Label>
          <Input type="date" value={form.date} onChange={setF("date")} required />
        </div>
      </SectionCard>

      {/* Motherboard */}
      <SectionCard title="Motherboard" icon="🔧">
        <div>
          <Label>Motherboard</Label>
          <div className="flex gap-2 items-center">
            <Select options={MOTHERBOARDS} value={form.motherboard} onChange={setF("motherboard")} className="flex-1 text-xs" />
            <PriceInput value={prices.motherboard_price} onChange={setP("motherboard_price")} />
          </div>
        </div>
        <div>
          <Label optional>Motherboard Description</Label>
          <Textarea value={form.motherboard_descp} onChange={setF("motherboard_descp")} rows={2} placeholder="Optional motherboard details..." />
        </div>
      </SectionCard>

      {/* Additional Charges */}
      <SectionCard title="Additional Charges" icon="💰">
        <div>
          <Label>EPBG Price in Percent</Label>
          <Input value={form.epbg} onChange={setF("epbg")} placeholder="Enter EPBG percent value" />
        </div>
        <div>
          <Label>Freight & Installation</Label>
          <div className="flex gap-2 items-center">
            <input value="Yes" readOnly
              className="flex-1 bg-gray-50 border border-gray-200 text-gray-400 rounded-lg px-3 py-2.5 text-sm cursor-not-allowed shadow-sm" />
            <div className="relative flex-shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-sm pointer-events-none">₹</span>
              <input value="1000" readOnly
                className="w-28 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg pl-7 pr-2 py-2.5 text-sm font-semibold cursor-not-allowed shadow-sm" />
            </div>
          </div>
        </div>
        <div>
          <Label>HDD None Returnable</Label>
          <div className="flex gap-2 items-center">
            <select
              value={form.hddreturnable} onChange={setF("hddreturnable")}
              className="flex-1 bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            >
              <option value="Yes">Yes</option>
              <option value="None">None</option>
            </select>
            <PriceInput value={form.hddreturnable_price} onChange={setF("hddreturnable_price")} />
          </div>
        </div>
      </SectionCard>

      <SubmitBtn>Next: Model Number →</SubmitBtn>
    </form>
  );
}


function Step3ModelNumber({ bidData, specsData, onFinish }) {
  const [prefix, setPrefix] = useState("ACL-1082DS-");
  const [suffix, setSuffix] = useState("");
  const [done, setDone]     = useState(false);

  const handleSubmit = e => {
    e.preventDefault();
    if (!suffix.trim()) return;
    onFinish({ model: `${prefix}${suffix}` });
    setDone(true);
  };

  if (done) return (
    <div className="text-center py-10 space-y-5">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl mx-auto shadow-lg shadow-emerald-100">
        ✅
      </div>
      <h2 className="text-2xl font-black text-emerald-600">Bid Created Successfully!</h2>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left space-y-3 max-w-sm mx-auto">
        {[
          ["Bid No",       bidData.bid_no,         "text-blue-600 font-bold"],
          ["Department",   bidData.deptName,        "text-gray-700 font-semibold"],
          ["Processor",    specsData.processor,     "text-gray-700"],
          ["RAM",          specsData.ram,           "text-gray-700"],
          ["Model Number", `${prefix}${suffix}`,    "text-blue-600 font-mono font-bold"],
        ].map(([k, v, cls]) => (
          <div key={k} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{k}</span>
            <span className={`text-sm ${cls}`}>{v}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => { setDone(false); setSuffix(""); }}
        className="text-sm text-blue-500 hover:text-blue-700 underline underline-offset-2 transition-colors font-semibold"
      >
        + Create Another Bid
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs space-y-1.5">
        <p className="text-gray-500">Bid No: <span className="text-blue-600 font-bold">{bidData.bid_no}</span></p>
        <p className="text-gray-500">Processor: <span className="text-gray-700 font-semibold">{specsData.processor || "—"}</span></p>
        <p className="text-gray-500">Motherboard: <span className="text-gray-700 font-semibold">{specsData.motherboard || "—"}</span></p>
      </div>

      <SectionCard title="Model Number" icon="🏷️">
        <div>
          <Label>Model Number</Label>
          <div className="flex gap-2">
            <select
              value={prefix} onChange={e => setPrefix(e.target.value)}
              className="bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all"
            >
              {MODEL_PREFIXES.map(p => <option key={p}>{p}</option>)}
            </select>
            <Input value={suffix} onChange={e => setSuffix(e.target.value)} placeholder="Enter suffix..." required className="flex-1" />
          </div>
          {/* Live Preview */}
          <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Preview</span>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-blue-600 font-mono font-bold text-sm">{prefix}{suffix || "..."}</span>
          </div>
        </div>
      </SectionCard>

      <SubmitBtn>Create Desktop Bid ✓</SubmitBtn>
    </form>
  );
}


export default function CreateDesktopBid() {
  const [step, setStep]           = useState(1);
  const [bidData, setBidData]     = useState(null);
  const [specsData, setSpecsData] = useState(null);

  const STEPS = [
    { num: 1, label: "Create Bid"     },
    { num: 2, label: "Desktop Config" },
    { num: 3, label: "Model Number"   },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">

      
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200 flex-shrink-0">
            <span className="text-xl">🖥️</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-800 tracking-tight leading-tight">Create Desktop Bid</h1>
            <p className="text-xs text-gray-400 mt-0.5">Fill all steps to generate a complete desktop bid</p>
          </div>
        </div>
      </div>

      {/* ── Step Indicator ── */}
      <div className="max-w-2xl mx-auto mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex items-center justify-center gap-1">
          {STEPS.map(({ num, label }) => (
            <StepPill key={num} num={num} label={label} current={step === num} done={step > num} />
          ))}
        </div>
      </div>

      
      <div className="max-w-2xl mx-auto">

        {/* Step title bar */}
        <div className="bg-white rounded-t-2xl border border-b-0 border-gray-100 shadow-sm px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
              {step}
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                {step === 1 && "Bid Details"}
                {step === 2 && "Desktop Configuration"}
                {step === 3 && "Assign Model Number"}
              </h2>
              <p className="text-xs text-gray-400">
                {step === 1 && "Enter the basic bid information to get started"}
                {step === 2 && "Configure all hardware and software components"}
                {step === 3 && "Assign a model number to finalize this bid"}
              </p>
            </div>
          </div>
        </div>

        {/* Form body */}
        <div className="bg-gray-50 border-x border-gray-100 px-6 py-5 space-y-4">
          {step === 1 && (
            <Step1CreateBid onNext={data => { setBidData(data); setStep(2); }} />
          )}
          {step === 2 && (
            <Step2DesktopConfig bidData={bidData} onNext={data => { setSpecsData(data); setStep(3); }} />
          )}
          {step === 3 && (
            <Step3ModelNumber
              bidData={bidData}
              specsData={specsData}
              onFinish={modelData => {
                console.log("Final Bid Data:", { ...bidData, ...specsData, ...modelData });
                // TODO: await axios.post('/api/desktop-bid', { ...bidData, ...specsData, ...modelData });
              }}
            />
          )}
        </div>

        {/* Bottom bar — back button */}
        <div className="bg-white rounded-b-2xl border border-t-0 border-gray-100 shadow-sm px-6 py-4 min-h-[56px] flex items-center">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-600 transition-colors font-semibold"
            >
              ← Back to {STEPS[step - 2].label}
            </button>
          ) : (
            <span className="text-xs text-gray-300">Step 1 of 3</span>
          )}
        </div>
      </div>
    </div>
  );
}