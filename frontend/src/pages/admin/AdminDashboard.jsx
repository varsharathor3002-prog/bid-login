import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000/api";

const PROCESSORS = [
    "Intel Core i3 12100", "Intel Core i5 12400", "Intel Core i5 12500", "Intel Core i5 13500",
    "Intel Core i5 14400", "Intel Core i5 14500", "Intel Core i7 12700", "Intel Core i7 13700",
    "Intel Core i7 14700", "Intel Core i9 12900", "Intel Core i9 13900", "Intel Core i9 14900",
    "AMD Ryzen 3 4300G", "AMD Ryzen 3 5300G", "AMD Ryzen 5 4600G", "AMD Ryzen 5 5600G",
    "AMD Ryzen 7 4700G", "AMD Ryzen 7 5700G", "AMD Ryzen 7 5750G", "AMD Ryzen 9 3900G",
    "12th Gen Composite i3", "12th Gen Composite i5", "12th Gen Composite i7",
];

const RAMS = [
    "8GB DDR4 2666", "8GB DDR4 3200", "16GB DDR4 2666", "8GB DDR5", "16GB DDR5",
    "16GB DDR4 3200", "32GB DDR4 2666", "32GB DDR4 3200", "32GB DDR4 3200*2",
    "8GB DDR5 4800", "16GB DDR5 4800", "32GB DDR5 4800", "32GB DDR5 4800*2",
];

const HDDS = ["1 TB", "1TB", "2 TB"];

const SSDS = [
    "128 GB SATA", "256 GB SATA", "512 GB SATA", "1TB SATA",
    "128 GB NVMe", "256 GB NVMe", "512 GB NVMe", "1TB NVMe",
];

const OS_OPTIONS = [
    "Windows 10 Home", "Windows 10 Professional", "Windows 11 Home",
    "Windows 11 Professional", "DOS", "Linex",
];

const DVDS = ["Yes"];

const WIFIS = [
    "PCI Based 4.2 Bluetooth", "Wi-fi AC 4.2 Bluetooth",
    "Wi-Fi 6 5.0 Bluetooth", "Wi-Fi AX201 5.2 Bluetooth",
];

const MONITORS = [
    "18.5 inch", "19.5 inch", "21.5 inch", "21.5 inch with Speaker",
    "21.5 inch with DP Port", "23.8 inch", "23.8 inch with Speaker",
    "23.8 inch with DP Port", "23.8 inch with Speaker Webcam", "27 inch",
];

const CABINETS = ["SFF", "Tower"];

const KEYBOARDS = ["Keyboard & Mouse Wired", "Keyboard & Mouse Wireless"];

const WARRANTIES = ["1 Year", "2 Year", "3 Year", "4 Year", "5 Year"];

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
        const res = await fetch(`${API_BASE}/${endpoint}/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) return "";
        const data = await res.json();
        return data.price ?? data ?? "";
    } catch {
        return "";
    }
};

export default function CreateDesktopForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

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
            const res = await fetch(`${API_BASE}/desktop-bids/${id}/update/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                setMsg("Data Save");
                navigate(`/create_desktop_model/${id}`);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {optional && <span className="text-red-500 text-xs font-normal">Optional</span>}
            </label>
            <div className="flex gap-2">
                <select
                    name={name}
                    value={form[name]}
                    onChange={handleChange}
                    required={required}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
            <h5 className="text-lg font-semibold text-gray-800 mb-4 pt-2">Create Desktop</h5>

            {msg && (
                <div className={`mb-4 px-4 py-2 rounded text-sm font-medium ${msg.includes("Save") && !msg.includes("Not") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {msg}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* Processor */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Processor</label>
                        <div className="flex gap-2">
                            <select
                                name="processor"
                                value={form.processor}
                                onChange={handleChange}
                                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                                <option value="">Select</option>
                                {PROCESSORS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <input
                                type="text"
                                value={form.processor_price}
                                readOnly disabled
                                placeholder="Price"
                                className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* RAM */}
                    <SelectField label="Ram" name="ram" options={RAMS} required />

                    {/* HDD */}
                    <SelectField label="Hard Disk Drive" name="hdd" options={HDDS} required />

                    {/* Processor Description */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Processor Description <span className="text-red-500 text-xs font-normal">Optional</span>
                        </label>
                        <textarea
                            name="pro_descp"
                            value={form.pro_descp}
                            onChange={handleChange}
                            rows={2}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* Software Description */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Software Description</label>
                        <textarea
                            name="software1"
                            value={form.software1}
                            onChange={handleChange}
                            rows={2}
                            required
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* Graphics Processor Description */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Graphics Processor Description</label>
                        <textarea
                            name="gp"
                            value={form.gp}
                            onChange={handleChange}
                            rows={2}
                            required
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* SSD */}
                    <SelectField label="Solid State Drive" name="ssd" options={SSDS} required />

                    {/* OS */}
                    <SelectField label="Operating System" name="os" options={OS_OPTIONS} required />

                    {/* DVD */}
                    <SelectField label="DVD" name="dvd" options={DVDS} required />

                    {/* WiFi */}
                    <SelectField label="Wi-FI Bluetooth" name="wifi" options={WIFIS} required />

                    {/* Monitor */}
                    <SelectField label="Monitor" name="monitor" options={MONITORS} required />

                    {/* Cabinet */}
                    <SelectField label="Cabinet" name="cabinet" options={CABINETS} required />

                    {/* Keyboard */}
                    <SelectField label="Keyboard & Mouse" name="keyboard" options={KEYBOARDS} required />

                    {/* Warranty */}
                    <SelectField label="Warranty" name="warranty" options={WARRANTIES} required />

                    {/* Bid Date */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bid Date</label>
                        <input
                            type="date"
                            name="date"
                            value={form.date}
                            onChange={handleChange}
                            required
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* EPBG */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">EPBG Price in Percent</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                readOnly disabled
                                placeholder="Percent"
                                className="w-20 border border-gray-200 rounded-md px-2 py-2 text-sm bg-gray-50 cursor-not-allowed"
                            />
                            <input
                                type="text"
                                name="epbg"
                                value={form.epbg}
                                onChange={handleChange}
                                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Freight & Installation */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Freight & Installation</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value="Yes"
                                readOnly disabled
                                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 cursor-not-allowed"
                            />
                            <input
                                type="text"
                                value="1000"
                                readOnly disabled
                                className="w-24 border border-gray-200 rounded-md px-2 py-2 text-sm bg-gray-50 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* HDD Non Returnable */}
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">HDD None Returnable</label>
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

                    {/* Motherboard - full width */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Motherboard</label>
                        <div className="flex gap-2">
                            <select
                                name="motherboard"
                                value={form.motherboard}
                                onChange={handleChange}
                                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                                <option value="">Select</option>
                                {MOTHERBOARDS.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <input
                                type="text"
                                value={form.motherboard_price}
                                readOnly disabled
                                placeholder="Price"
                                className="w-28 border border-gray-200 rounded-md px-2 py-2 text-sm text-gray-500 bg-gray-50 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Motherboard Description - full width */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Motherboard Description <span className="text-red-500 text-xs font-normal">Optional</span>
                        </label>
                        <textarea
                            name="motherboard_descp"
                            value={form.motherboard_descp}
                            onChange={handleChange}
                            rows={2}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="mt-4 mb-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-6 py-2 rounded-md text-sm transition"
                >
                    {saving ? "Saving..." : "Next"}
                </button>
            </form>
        </div>
    );
}