import React, { useState } from "react";

// --- DATA OPTIONS ---
const PROCESSORS = ["Intel Core i3 12100", "Intel Core i5 12400", "Intel Core i5 12500", "Intel Core i5 13500", "Intel Core i5 14400", "Intel Core i5 14500", "Intel Core i7 12700", "Intel Core i7 13700", "Intel Core i7 14700", "Intel Core i9 12900", "Intel Core i9 13900", "Intel Core i9 14900", "AMD Ryzen 3 4300G", "AMD Ryzen 3 5300G", "AMD Ryzen 5 4600G", "AMD Ryzen 5 5600G", "AMD Ryzen 7 4700G", "AMD Ryzen 7 5700G", "AMD Ryzen 7 5750G", "AMD Ryzen 9 3900G", "12th Gen Composite i3", "12th Gen Composite i5", "12th Gen Composite i7"];
const RAM = ["8GB DDR4 2666", "8GB DDR4 3200", "16GB DDR4 2666", "8GB DDR5", "16GB DDR5", "16GB DDR4 3200", "32GB DDR4 2666", "32GB DDR4 3200", "32GB DDR4 3200*2", "8GB DDR5 4800", "16GB DDR5 4800", "32GB DDR5 4800", "32GB DDR5 4800*2"];
const HDD = ["1 TB", "2 TB", "None"];
const SSD = ["128 GB SATA", "256 GB SATA", "512 GB SATA", "1TB SATA", "128 GB NVMe", "256 GB NVMe", "512 GB NVMe", "1TB NVMe", "None"];
const OS_LIST = ["Windows 10 Home", "Windows 10 Professional", "Windows 11 Home", "Windows 11 Professional", "DOS", "Linux"];
const DVD = ["Yes", "None"];
const WIFI = ["PCI Based 4.2 Bluetooth", "Wi-fi AC 4.2 Bluetooth", "Wi-Fi 6 5.0 Bluetooth", "Wi-Fi AX201 5.2 Bluetooth", "None"];
const MONITORS = ["18.5 inch", "19.5 inch", "21.5 inch", "21.5 inch with Speaker", "21.5 inch with DP Port", "23.8 inch", "23.8 inch with Speaker", "23.8 inch with DP Port", "23.8 inch with Speaker Webcam", "27 inch"];
const CABINET = ["SFF", "Tower"];
const KEYBOARD = ["Keyboard & Mouse Wired", "Keyboard & Mouse Wireless", "None"];
const WARRANTY = ["1 Year", "2 Year", "3 Year", "4 Year", "5 Year"];
const MOTHERBOARDS = ["H610", "B760", "Q670 DDR4", "Q670 DDR5", "AMD B650", "AMD B550", "AMD A520"];

// --- COMPONENTS ---
const Label = ({ children }) => (
  <label className="block text-sm font-bold text-gray-700 mb-1 mt-3">{children}</label>
);

const Select = ({ options, value, onChange }) => (
  <select
    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
    value={value}
    onChange={onChange}
  >
    <option value="">Select Option</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const PriceInput = ({ value, onChange, label }) => (
  <div className="mt-2">
    <label className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">{label} Price (₹)</label>
    <input
      type="number"
      placeholder="0.00"
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:border-blue-500 outline-none"
      value={value}
      onChange={onChange}
    />
  </div>
);

const Field = ({ label, options, val, setVal, price, setPrice }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
    <label className="block text-sm font-black text-blue-900 mb-2">{label}</label>
    <Select options={options} value={val} onChange={setVal} />
    <PriceInput label={label} value={price} onChange={setPrice} />
  </div>
);

// --- MAIN ---
export default function Step2DesktopConfig({ onNext }) {

  const [form, setForm] = useState({
    processor: "", pro_descp: "", ram: "", hdd: "", ssd: "",
    os: "", dvd: "", wifi: "",
    monitor: "", cabinet: "", keyboard: "",
    warranty: "", motherboard: "", motherboard_descp: "",
    software1: "", gp: "",
    date: "", epbg: "",
    hddreturnable: "Yes", hddreturnable_price: ""
  });

  const [prices, setPrices] = useState({
    processor_price: "", ram_price: "", hdd_price: "", ssd_price: "",
    os_price: "", dvd_price: "", wifi_price: "",
    monitor_price: "", cabinet_price: "", keyboard_price: "",
    warranty_price: "", motherboard_price: ""
  });

  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setP = k => e => setPrices(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext({ ...form, ...prices });
  };

  return (
    <div className="w-full p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-black mb-8 text-gray-800 border-b-4 border-blue-600 inline-block">
          Desktop Configuration
        </h2>

        <form onSubmit={handleSubmit}>
          {/* GRID FOR MAIN COMPONENTS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Field label="Processor" options={PROCESSORS} val={form.processor} setVal={setF("processor")} price={prices.processor_price} setPrice={setP("processor_price")} />
            <Field label="RAM" options={RAM} val={form.ram} setVal={setF("ram")} price={prices.ram_price} setPrice={setP("ram_price")} />
            <Field label="HDD" options={HDD} val={form.hdd} setVal={setF("hdd")} price={prices.hdd_price} setPrice={setP("hdd_price")} />
            <Field label="SSD" options={SSD} val={form.ssd} setVal={setF("ssd")} price={prices.ssd_price} setPrice={setP("ssd_price")} />

            <Field label="Operating System" options={OS_LIST} val={form.os} setVal={setF("os")} price={prices.os_price} setPrice={setP("os_price")} />
            <Field label="DVD" options={DVD} val={form.dvd} setVal={setF("dvd")} price={prices.dvd_price} setPrice={setP("dvd_price")} />
            <Field label="WiFi" options={WIFI} val={form.wifi} setVal={setF("wifi")} price={prices.wifi_price} setPrice={setP("wifi_price")} />
            <Field label="Monitor" options={MONITORS} val={form.monitor} setVal={setF("monitor")} price={prices.monitor_price} setPrice={setP("monitor_price")} />

            <Field label="Cabinet" options={CABINET} val={form.cabinet} setVal={setF("cabinet")} price={prices.cabinet_price} setPrice={setP("cabinet_price")} />
            <Field label="Keyboard" options={KEYBOARD} val={form.keyboard} setVal={setF("keyboard")} price={prices.keyboard_price} setPrice={setP("keyboard_price")} />
            <Field label="Warranty" options={WARRANTY} val={form.warranty} setVal={setF("warranty")} price={prices.warranty_price} setPrice={setP("warranty_price")} />
            <Field label="Motherboard" options={MOTHERBOARDS} val={form.motherboard} setVal={setF("motherboard")} price={prices.motherboard_price} setPrice={setP("motherboard_price")} />
          </div>

          <hr className="my-10 border-gray-300" />

          {/* TEXT AREAS SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div>
              <Label>Processor Description</Label>
              <textarea className="w-full p-3 border border-gray-300 rounded-lg h-24" value={form.pro_descp} onChange={setF("pro_descp")} />
            </div>
            <div>
              <Label>Motherboard Description</Label>
              <textarea className="w-full p-3 border border-gray-300 rounded-lg h-24" value={form.motherboard_descp} onChange={setF("motherboard_descp")} />
            </div>
            <div>
              <Label>Software Description</Label>
              <textarea className="w-full p-3 border border-gray-300 rounded-lg h-24" value={form.software1} onChange={setF("software1")} />
            </div>
            <div>
              <Label>Graphics Description</Label>
              <textarea className="w-full p-3 border border-gray-300 rounded-lg h-24" value={form.gp} onChange={setF("gp")} />
            </div>
          </div>

          {/* EXTRA INFO SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 bg-blue-50 p-6 rounded-xl border border-blue-100">
            <div>
              <Label>Date</Label>
              <input type="date" className="w-full p-3 border border-gray-300 rounded-lg" value={form.date} onChange={setF("date")} />
            </div>
            <div>
              <Label>EPBG %</Label>
              <input placeholder="Enter EPBG %" className="w-full p-3 border border-gray-300 rounded-lg font-bold" value={form.epbg} onChange={setF("epbg")} />
            </div>
            <div>
              <Label>HDD Return Price (₹)</Label>
              <input placeholder="Enter Amount" className="w-full p-3 border border-gray-300 rounded-lg font-bold" value={form.hddreturnable_price} onChange={setF("hddreturnable_price")} />
            </div>
          </div>

          <div className="flex justify-end mt-12">
            <button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white px-12 py-4 rounded-xl text-xl font-black shadow-lg transition-all transform hover:scale-105 active:scale-95">
              Save & Next →
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}