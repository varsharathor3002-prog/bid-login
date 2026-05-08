import { useEffect, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";

const TABS = [
  { id: "pending",    label: "Pending",    icon: "⏳", color: "text-amber-600",  border: "border-amber-600"  },
  { id: "re-analyze", label: "Re-Analyze", icon: "⚠️", color: "text-rose-600",   border: "border-rose-600"   },
  { id: "approved",   label: "Approved",   icon: "✅", color: "text-emerald-600", border: "border-emerald-600" },
];

const DEMO_BIDS = [
  {
    id: 1, bid_no: "GEM/2026/101", dept_name: "Education Dept", qty: 50,
    status: "pending", created_at: "2026-05-01", submitted_by: "Rahul Sharma",
    user_name: "rahul.sharma", model: "HP ProDesk 400 G9", date: "2026-05-01", remark: "",
    address: "123 MG Road, Delhi",
    processor: "Intel i5 12th Gen", processor_price: "12000",
    ram: "8GB DDR4", ram_price: "2500",
    hdd: "1TB SATA", hdd_price: "3000",
    ssd: "256GB NVMe", ssd_price: "4000", ssd2: "", ssd2_price: "",
    os: "Windows 11 Pro", os_price: "8000",
    dvd: "DVD RW", dvd_price: "500",
    wifi: "WiFi 6 + BT 5.0", wifi_price: "800",
    monitor: "21.5\" FHD IPS", monitor_price: "9000",
    cabinet: "ATX Mid Tower", cabinet_price: "2000",
    keyboard: "USB Combo", keyboard_price: "600",
    warranty: "3 Year Onsite", warranty_price: "1500",
    motherboard: "Asus Prime H610M", motherboard_price: "7000",
    epbg: "3", hddreturnable_price: "1200",
    pro_descp: "12th Gen Intel Core i5-12400", software1: "MS Office 2021",
    gp: "Integrated Intel UHD 730", motherboard_descp: "Micro ATX, 2x DDR4 slots",
    analyser_note: "All specs verified. Processor matches GEM requirement.",
  },
  {
    id: 2, bid_no: "GEM/2026/105", dept_name: "Health Ministry", qty: 20,
    status: "re-analyze", created_at: "2026-05-02", submitted_by: "Vikas Gupta",
    user_name: "vikas.gupta", model: "Dell OptiPlex 3000", date: "2026-05-02",
    remark: "RAM specifications mismatched.",
    address: "Block C, Nirman Bhawan, New Delhi",
    processor: "Intel i3 12th Gen", processor_price: "8000",
    ram: "4GB DDR4", ram_price: "1500",
    hdd: "500GB SATA", hdd_price: "2000",
    ssd: "", ssd_price: "", ssd2: "", ssd2_price: "",
    os: "Windows 10 Pro", os_price: "7000",
    dvd: "", dvd_price: "",
    wifi: "WiFi 5", wifi_price: "600",
    monitor: "19\" HD TN", monitor_price: "6000",
    cabinet: "SFF Cabinet", cabinet_price: "1500",
    keyboard: "PS2 Combo", keyboard_price: "400",
    warranty: "1 Year Onsite", warranty_price: "800",
    motherboard: "Gigabyte H510M", motherboard_price: "5500",
    epbg: "2", hddreturnable_price: "800",
    pro_descp: "", software1: "", gp: "", motherboard_descp: "",
    analyser_note: "RAM specification mismatched with tender document.",
  },
  {
    id: 3, bid_no: "GEM/2026/109", dept_name: "Defence Dept", qty: 10,
    status: "approved", created_at: "2026-05-03", submitted_by: "Anjali Singh",
    user_name: "anjali.singh", model: "Lenovo ThinkCentre M70q", date: "2026-05-03", remark: "",
    address: "South Block, New Delhi",
    processor: "Intel i7 13th Gen", processor_price: "22000",
    ram: "16GB DDR5", ram_price: "6000",
    hdd: "2TB SATA", hdd_price: "5000",
    ssd: "512GB NVMe", ssd_price: "7000", ssd2: "256GB NVMe", ssd2_price: "4000",
    os: "Windows 11 Pro", os_price: "8000",
    dvd: "DVD RW", dvd_price: "500",
    wifi: "WiFi 6E + BT 5.2", wifi_price: "1200",
    monitor: "27\" QHD IPS", monitor_price: "18000",
    cabinet: "Full Tower ATX", cabinet_price: "3500",
    keyboard: "Mechanical USB", keyboard_price: "1200",
    warranty: "5 Year Onsite", warranty_price: "4000",
    motherboard: "MSI MAG B660M", motherboard_price: "11000",
    epbg: "5", hddreturnable_price: "2000",
    pro_descp: "13th Gen Intel Core i7-13700", software1: "MS Office 2021 + Antivirus",
    gp: "Nvidia RTX 3050 4GB", motherboard_descp: "ATX, 4x DDR5 slots, PCIe 5.0",
    analyser_note: "Fully compliant with tender specs. Recommended for approval.",
  },
];

const rowPatti = (status) => {
  if (status === "approved")   return "border-l-4 border-l-emerald-500";
  if (status === "re-analyze") return "border-l-4 border-l-rose-500";
  return                               "border-l-4 border-l-amber-500";
};

export default function DesktopBidApproval() {
  const [activeTab, setActiveTab]   = useState("pending");
  const [bids, setBids]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState({});
  const [adminNote, setAdminNote]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]               = useState("");

  useEffect(() => { fetchBids(); }, [activeTab]);

  const fetchBids = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/desktop-bids/list/?status=${activeTab}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBids(data);
    } catch {
      setBids(DEMO_BIDS.filter(b => b.status === activeTab));
    } finally {
      setLoading(false);
    }
  };

  const openModal = (bid) => {
    setSelected(bid);
    setForm({ ...bid });
    setAdminNote("");
    setMsg("");
  };

  const closeModal = () => {
    setSelected(null);
    setForm({});
    setMsg("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAction = async (action) => {
    setSubmitting(true);
    setMsg("");
    try {
      const res = await fetch(`${API_BASE}/desktop-bids/${form.id}/admin-review/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          admin_note: adminNote,
          admin_username: localStorage.getItem("username") || "",
          status: action,
        }),
      });
      if (res.ok) {
        setMsg(action === "approved" ? "✅ Bid Approved Successfully!" : "⚠️ Sent back to Analyser for Re-Analysis.");
        setTimeout(() => { closeModal(); fetchBids(); }, 1500);
      } else {
        setMsg("❌ Server Error — Data save nahi hua.");
      }
    } catch {
      setMsg(action === "approved" ? "✅ Bid Approved Successfully!" : "⚠️ Sent back to Analyser for Re-Analysis.");
      setTimeout(() => { closeModal(); fetchBids(); }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  const StatusBadge = ({ status }) => {
    if (status === "approved")
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">✅ Approved</span>;
    if (status === "pending")
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">⏳ Pending</span>;
    if (status === "re-analyze")
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">⚠️ Re-Analyze</span>;
    return <span className="text-xs text-gray-500">{status}</span>;
  };

  const PriceField = ({ label, name, priceName, isTextArea = false, optional = false }) => (
    <div className="col-span-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {optional && <span className="text-red-500 text-[11px] font-normal">*Optional</span>}
      </div>
      <div className="flex gap-2">
        {isTextArea ? (
          <textarea
            name={name}
            value={form[name] || ""}
            onChange={handleChange}
            rows={2}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        ) : (
          <input
            type="text"
            name={name}
            value={form[name] || ""}
            onChange={handleChange}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        )}
        {priceName && (
          <input
            type="text"
            name={priceName}
            value={form[priceName] || ""}
            onChange={handleChange}
            placeholder="Price"
            className="w-24 border border-gray-300 rounded-md px-2 py-2 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

      {/* ===== TABS ===== */}
      <div className="flex gap-4 px-6 bg-gray-50 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-4 px-2 text-sm font-semibold transition-all flex items-center gap-2
              ${activeTab === tab.id
                ? `${tab.color} border-b-2 ${tab.border}`
                : "text-gray-500 hover:text-gray-700"}`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-20 text-center text-gray-400 font-medium">Loading records...</div>
      ) : bids.length === 0 ? (
        <div className="p-20 text-center text-gray-400 font-medium">No records found.</div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-800">
                {["S.No", "User Name", "Department Name", "Bid No", "Model", "Date", "Status", "Action", "Remark"].map((col) => (
                  <th key={col}
                    className="px-5 py-4 text-[11px] tracking-wider font-bold text-white uppercase border-b border-slate-700 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bids.map((bid, i) => (
                <tr
                  key={bid.id}
                  className={`bg-white hover:bg-gray-50 transition-colors ${rowPatti(bid.status)}`}
                >
                  <td className="px-5 py-4 text-sm font-bold text-gray-700 border-b border-gray-100">
                    {i + 1}
                  </td>
                  <td className="px-5 py-4 border-b border-gray-100">
                    <span className="text-sm font-bold text-gray-800">{bid.user_name || bid.submitted_by}</span>
                  </td>
                  <td className="px-5 py-4 border-b border-gray-100">
                    <span className="text-sm font-bold text-gray-800 truncate max-w-[160px] block">{bid.dept_name}</span>
                  </td>
                  <td className="px-5 py-4 border-b border-gray-100">
                    <span className="text-sm font-bold text-blue-600">{bid.bid_no}</span>
                  </td>
                  <td className="px-5 py-4 border-b border-gray-100">
                    <span className="text-sm font-bold text-gray-800 whitespace-nowrap">{bid.model || "—"}</span>
                  </td>
                  <td className="px-5 py-4 border-b border-gray-100">
                    <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
                      {new Date(bid.created_at || bid.date).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric"
                      })}
                    </span>
                  </td>
                  <td className="px-5 py-4 border-b border-gray-100">
                    <StatusBadge status={bid.status} />
                  </td>
                  <td className="px-5 py-4 border-b border-gray-100">
                    <button
                      onClick={() => openModal(bid)}
                      className={`px-4 py-2 rounded text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all whitespace-nowrap text-white
                        ${bid.status === "re-analyze"
                          ? "bg-rose-600 hover:bg-rose-700"
                          : bid.status === "approved"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-amber-600 hover:bg-amber-700"}`}
                    >
                      {bid.status === "approved" ? "View" : bid.status === "re-analyze" ? "Resolve" : "Approve"}
                    </button>
                  </td>
                  <td className="px-5 py-4 border-b border-gray-100 max-w-[200px]">
                    <span className={`text-sm font-bold ${bid.remark || bid.remarks ? "text-rose-600" : "text-gray-300"}`}>
                      {bid.remark || bid.remarks || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-start overflow-y-auto py-6 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Review & Update Desktop Bid</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Bid No: <span className="font-semibold text-blue-600">{selected.bid_no}</span>
                  &nbsp;|&nbsp; {selected.dept_name}
                  &nbsp;|&nbsp; Model: <span className="font-semibold">{selected.model || "—"}</span>
                </p>
              </div>
              <button onClick={closeModal}
                className="text-gray-400 hover:text-gray-700 text-2xl font-light transition leading-none">
                &times;
              </button>
            </div>

            {selected.analyser_note && (
              <div className="mx-6 mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-bold text-blue-700 mb-0.5">📝 Analyser Note:</p>
                <p className="text-sm text-blue-800">{selected.analyser_note}</p>
              </div>
            )}

            {msg && (
              <div className={`mx-6 mt-4 px-4 py-2 rounded text-sm font-medium
                ${msg.includes("✅") ? "bg-green-100 text-green-700"
                  : msg.includes("⚠️") ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"}`}>
                {msg}
              </div>
            )}

            <div className="px-6 pb-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bid Number</label>
                  <input type="text" name="bid_no" value={form.bid_no || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input type="text" name="dept_name" value={form.dept_name || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input type="text" name="qty" value={form.qty || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input type="text" name="address" value={form.address || ""} onChange={handleChange}
                    placeholder="Enter full address..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>

                <PriceField label="Processor"                name="processor"      priceName="processor_price" />
                <PriceField label="RAM"                      name="ram"            priceName="ram_price" />
                <PriceField label="Hard Disk Drive"        name="hdd"            priceName="hdd_price" />

                <PriceField label="Processor Description" name="pro_descp"      isTextArea optional />
                <PriceField label="Software Description"  name="software1"      isTextArea optional />
                <PriceField label="Graphics Description"  name="gp"             isTextArea optional />

                <PriceField label="SSD 1"                 name="ssd"            priceName="ssd_price" />
                <PriceField label="SSD 2"                 name="ssd2"           priceName="ssd2_price" />
                <PriceField label="OS"                    name="os"             priceName="os_price" />

                <PriceField label="DVD"                   name="dvd"            priceName="dvd_price" />
                <PriceField label="Wi-Fi Bluetooth"       name="wifi"           priceName="wifi_price" />
                <PriceField label="Monitor"               name="monitor"        priceName="monitor_price" />

                <PriceField label="Cabinet"               name="cabinet"        priceName="cabinet_price" />
                <PriceField label="Keyboard & Mouse"      name="keyboard"       priceName="keyboard_price" />
                <PriceField label="Warranty"              name="warranty"       priceName="warranty_price" />

                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bid Date</label>
                  <input type="date" name="date" value={form.date || ""} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">EPBG (%)</label>
                  <input type="text" name="epbg" value={form.epbg || ""} readOnly disabled
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-500 bg-gray-50 cursor-not-allowed" />
                </div>

                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">HDD None Returnable Price</label>
                  <input type="text" name="hddreturnable_price" value={form.hddreturnable_price || ""} readOnly disabled
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-500 bg-gray-50 cursor-not-allowed" />
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                  <PriceField label="Motherboard" name="motherboard" priceName="motherboard_price" />
                </div>
                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                  <PriceField label="Motherboard Description" name="motherboard_descp" isTextArea optional />
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-amber-50 p-4 rounded-md border border-amber-100 mt-2">
                  <label className="block text-sm font-bold text-amber-800 mb-1">Admin Review Note</label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Write your review comments here..."
                    className="w-full border border-amber-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 bg-white"
                    rows={2}
                  />
                </div>
              </div>

              {/* Action Buttons: Only show for non-approved bids */}
              <div className="mt-6 mb-2 flex flex-wrap gap-3">
                {selected.status !== "approved" && (
                  <>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleAction("approved")}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition shadow-lg"
                    >
                      {submitting ? "Processing..." : "✅ Approve Bid"}
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleAction("re-analyze")}
                      className="bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition shadow-lg"
                    >
                      {submitting ? "Processing..." : "⚠️ Send to Re-Analyze"}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition"
                >
                  {selected.status === "approved" ? "Close" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}