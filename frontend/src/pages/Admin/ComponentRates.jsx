import { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaChevronDown, FaDownload, FaSave, FaSearch, FaUndo } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import * as Desktop from "../Desktop/User/DesktopConfig";
import * as Workstation from "../Workstation/User/WorkstationConfig";
import * as Aio from "../Aio/User/AioConfig";
import { API_BASE, fetchComponentRates, rateKey, ratesToMap } from "../../utils/componentRates";

const desktopCategories = [
  ["processor", "Processor", Desktop.PROCESSORS], ["ram", "RAM", Desktop.RAMS],
  ["hdd", "HDD", Desktop.HDDS], ["ssd", "SSD", Desktop.SSDS],
  ["motherboard", "Motherboard", Desktop.MOTHERBOARDS], ["os", "Operating System", Desktop.OS_OPTIONS],
  ["dvd", "DVD", Desktop.DVDS], ["wifi", "Wi-Fi / Bluetooth", Desktop.WIFIS],
  ["monitor", "Monitor", Desktop.MONITORS], ["cabinet", "Cabinet", Desktop.CABINETS],
  ["keyboard", "Keyboard & Mouse", Desktop.KEYBOARDS], ["warranty", "Warranty", Desktop.WARRANTIES],
];

const workstationCategories = [
  ["processor", "Intel Processor", Workstation.INTEL_PROCESSORS],
  ["processor", "Intel Xeon Processor", Workstation.INTEL_XEON_PROCESSORS],
  ["processor", "AMD Threadripper Processor", Workstation.AMD_THREADRIPPER_PROCESSORS],
  ["motherboard", "Intel Motherboard", Workstation.INTEL_MOTHERBOARDS],
  ["motherboard", "Intel Xeon Motherboard", Workstation.INTEL_XEON_MOTHERBOARDS],
  ["motherboard", "AMD Motherboard", Workstation.AMD_MOTHERBOARDS],
  ["ram", "RAM", Workstation.RAMS], ["ram", "Registered RAM", Workstation.REGISTERED_RAMS],
  ["ssd", "SSD", Workstation.SSDS], ["hdd", "HDD", Workstation.HDDS],
  ["graphics", "Graphics Card", Workstation.GRAPHICS_CARDS], ["cabinet", "Cabinet", Workstation.CABINETS],
  ["keyboard", "Keyboard & Mouse", Workstation.KEYBOARDS], ["power_supply", "Power Supply", Workstation.POWER_SUPPLIES],
  ["os", "Operating System", Workstation.OS_OPTIONS], ["dvd", "DVD", Workstation.DVDS],
  ["wifi", "Wi-Fi / Bluetooth", Workstation.WIFIS], ["monitor", "Monitor", Workstation.MONITORS],
  ["warranty", "Warranty", Workstation.WARRANTIES],
];

// AIO has its own catalogue (see AioConfig.jsx) — it used to just reuse
// desktopCategories here, which showed Desktop's option lists (and Desktop
// fields AIO doesn't even have, like Cabinet/Monitor) on AIO's own Component
// Rate screen instead of the real AIO-specific ones (screen_size in place of
// monitor, no cabinet, the exact RAM/SSD/OS/WiFi/Keyboard/Motherboard values
// from aio_bid_create.php).
const aioCategories = [
  ["processor", "Processor", Desktop.PROCESSORS], ["ram", "RAM", Aio.AIO_RAMS],
  ["hdd", "HDD", Aio.AIO_HDDS], ["ssd", "SSD", Aio.AIO_SSDS],
  ["motherboard", "Motherboard", Aio.AIO_MOTHERBOARDS], ["os", "Operating System", Aio.AIO_OS_OPTIONS],
  ["dvd", "DVD", Desktop.DVDS], ["wifi", "Wi-Fi / Bluetooth", Aio.AIO_WIFIS],
  ["screen_size", "Screen Size", Aio.AIO_SCREEN_SIZES],
  ["keyboard", "Keyboard & Mouse", Aio.AIO_KEYBOARDS], ["warranty", "Warranty", Desktop.WARRANTIES],
];

const catalogs = { desktop: desktopCategories, aio: aioCategories, workstation: workstationCategories };
const productNames = { desktop: "Desktop", workstation: "Workstation", aio: "AIO" };
const money = (value) => value === "" || value == null ? "—" : `₹${Number(value).toLocaleString("en-IN")}`;

export default function ComponentRates() {
  const { product } = useParams();
  const navigate = useNavigate();
  const safeProduct = catalogs[product] ? product : "desktop";
  const [overrides, setOverrides] = useState({});
  const [rateDates, setRateDates] = useState({});
  const [inputs, setInputs] = useState({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(catalogs[safeProduct][0][1]);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [selectedSpecs, setSelectedSpecs] = useState({});

  const rows = useMemo(() => catalogs[safeProduct].flatMap(([category, categoryLabel, items]) =>
    items.map((item) => ({ category, categoryLabel, ...item }))), [safeProduct]);

  useEffect(() => {
    setMessage("");
    setSelectedCategory(catalogs[safeProduct][0][1]);
    setCategoryMenuOpen(false);
    setSelectedSpecs({});
    fetchComponentRates(safeProduct)
      .then((rates) => {
        setOverrides(ratesToMap(rates));
        setRateDates(Object.fromEntries(rates.map((rate) => [rateKey(rate.category, rate.name), rate.updated_at])));
      })
      .catch((error) => setMessage(error.message));
  }, [safeProduct]);

  const groups = useMemo(() => catalogs[safeProduct].map(([category, categoryLabel, items]) => ({
    category,
    categoryLabel,
    rows: items
      .map((item) => ({ category, categoryLabel, ...item }))
      .filter((row) => `${categoryLabel} ${row.name}`.toLowerCase().includes(search.toLowerCase())),
  })), [safeProduct, search]);
  const activeGroup = groups.find((group) => group.categoryLabel === selectedCategory) || groups[0];
  const activeChangedCount = activeGroup?.rows.filter((row) => overrides[rateKey(row.category, row.name)] !== undefined).length || 0;

  const changeRate = async (row) => {
    const key = rateKey(row.category, row.name);
    const value = inputs[key];
    if (value === undefined || value === "" || Number(value) < 0) return setMessage("Please enter a valid price.");
    setBusy(key); setMessage("");
    try {
      const response = await fetch(`${API_BASE}/component-rates/`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: safeProduct, category: row.category, name: row.name, price: Number(value) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Price update failed.");
      setOverrides((old) => ({ ...old, [key]: Number(value) }));
      setRateDates((old) => ({ ...old, [key]: data.rate.updated_at }));
      setInputs((old) => ({ ...old, [key]: "" }));
      setMessage(`${row.name} pricing has been updated.`);
    } catch (error) { setMessage(error.message); } finally { setBusy(""); }
  };

  const restoreRate = async (row) => {
    const key = rateKey(row.category, row.name);
    setBusy(key); setMessage("");
    try {
      const response = await fetch(`${API_BASE}/component-rates/`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: safeProduct, category: row.category, name: row.name }),
      });
      if (!response.ok) throw new Error("Original price restore nahi hua.");
      setOverrides((old) => { const next = { ...old }; delete next[key]; return next; });
      setInputs((old) => ({ ...old, [key]: "" }));
      setRateDates((old) => { const next = { ...old }; delete next[key]; return next; });
      setMessage(`${row.name} ka original price restore ho gaya.`);
    } catch (error) { setMessage(error.message); } finally { setBusy(""); }
  };

  const downloadPdf = async () => {
    setMessage("PDF ban raha hai…");
    try {
      const response = await fetch(`${API_BASE}/component-rates/pdf/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: safeProduct, rows: rows.map((row) => ({
          ...row, originalPrice: row.price, currentPrice: overrides[rateKey(row.category, row.name)] ?? row.price,
          changedAt: rateDates[rateKey(row.category, row.name)] || "",
        })) }),
      });
      if (!response.ok) throw new Error("PDF download failed.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `${safeProduct}-component-rates.pdf`; link.click();
      URL.revokeObjectURL(url); setMessage("");
    } catch (error) { setMessage(error.message); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-bold text-blue-600 uppercase tracking-wider">Component Rate</p><h2 className="text-2xl font-black text-slate-800">{productNames[safeProduct]} Specifications & Prices</h2></div>
        <button onClick={downloadPdf} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-red-700"><FaDownload /> Download PDF</button>
      </div>
      {message && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">{message}</div>}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
          {groups.map((group) => { const selectedName = selectedSpecs[group.categoryLabel] || ""; const row = group.rows.find((item) => item.name === selectedName); const key = row ? rateKey(row.category, row.name) : ""; const current = row ? (overrides[key] ?? row.price) : ""; return <div key={group.categoryLabel} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-blue-200 hover:bg-blue-50/30"><div className="mb-2 flex items-center justify-between"><label className="text-sm font-bold text-slate-800">{group.categoryLabel}</label>{row && overrides[key] !== undefined && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">Changed</span>}</div><div className="grid grid-cols-[minmax(0,1fr)_130px] gap-2"><select value={selectedName} onChange={(e) => { const name = e.target.value; setSelectedSpecs((old) => ({ ...old, [group.categoryLabel]: name })); const selected = group.rows.find((item) => item.name === name); if (selected) { const selectedKey = rateKey(selected.category, selected.name); setInputs((old) => ({ ...old, [selectedKey]: "" })); } }} className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"><option value="">Select</option>{group.rows.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select><input readOnly value={row ? current : ""} placeholder="Current Price" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 font-bold text-emerald-700 outline-none placeholder:font-normal placeholder:text-slate-400" /></div>{row && <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2"><input type="number" min="0" value={inputs[key] ?? ""} onChange={(e) => setInputs((old) => ({ ...old, [key]: e.target.value }))} placeholder="New Price" className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 font-bold outline-none placeholder:font-normal focus:border-blue-500" /><button disabled={busy === key} onClick={() => changeRate(row)} className="flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"><FaSave /> Change</button><button disabled={busy === key || overrides[key] === undefined} onClick={() => restoreRate(row)} className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-35"><FaUndo /> Back</button></div>}</div>; })}
        </div>
      </div>
      <button onClick={() => navigate("/admin-dashboard")} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50"><FaArrowLeft /> Dashboard Back</button>
    </div>
  );
}
