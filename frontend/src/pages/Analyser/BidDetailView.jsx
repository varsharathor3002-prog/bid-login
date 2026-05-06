import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const REVIEW_API = {
    desktop: (id) => `http://127.0.0.1:8000/api/desktop-bids/${id}/review/`,
};

const FETCH_API = {
    desktop: (id) => `http://127.0.0.1:8000/api/desktop-bids/${id}/`,
};

const Label = ({ children }) => (
    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
        {children}
    </label>
);

const Input = (props) => (
    <input
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
        {...props}
    />
);

const Textarea = (props) => (
    <textarea
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
        rows={2}
        {...props}
    />
);

export default function BidDetailView({ product = "desktop" }) {
    const { id } = useParams();
    const { state } = useLocation();
    const navigate = useNavigate();

    const [form, setForm] = useState(state?.bid || null);
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

    useEffect(() => {
        fetchBid();
    }, [id]);

    const fetchBid = async () => {
        try {
            setLoading(true);
            const res = await fetch(FETCH_API[product](id));
            const data = await res.json();

            console.log("FETCH DATA:", data);

            if (!res.ok) throw new Error();
            setForm(data);
            setNote(data.analyser_note || "");
        } catch (err) {
            console.error(err);
            setError("Data fetch nahi ho raha");
        } finally {
            setLoading(false);
        }
    };

    const submit = async () => {
        if (!note.trim()) {
            alert("Review note zaroori hai");
            return;
        }

        try {
            const res = await fetch(REVIEW_API[product](id), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    analyser_note: note,
                    analyser_username: localStorage.getItem("username") || "",
                    status: "reviewed",
                }),
            });

            if (!res.ok) throw new Error();
            setDone(true);
        } catch {
            setError("Submit fail hua");
        }
    };

    if (loading) return <div className="p-10">Loading...</div>;

    if (done)
        return (
            <div className="p-10 text-center">
                <h2 className="text-green-600 text-xl font-bold">
                    ✅ Bid Reviewed Successfully
                </h2>
                <button
                    onClick={() => navigate("/analyser-dashboard/desktop")}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
                >
                    Back
                </button>
            </div>
        );

    return (

     
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">

            {/* ── STICKY TOPBAR ── */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate(-1)}
                        className="group flex items-center gap-2 text-blue-600 font-bold text-sm hover:text-blue-800 transition-colors">
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> Back
                    </button>
                    <div className="h-6 w-[1px] bg-gray-200"></div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-gray-900 tracking-tight">Review Bid:</span>
                            <span className="text-lg font-black text-blue-600">{form?.bid_no}</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                            {product} • {form?.dept_name}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end mr-4 border-r pr-6 border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Current Status</span>
                        <span className="bg-amber-100 text-amber-700 text-[11px] font-black px-3 py-1 rounded-md uppercase tracking-wider">Pending Review</span>
                    </div>
                    <button onClick={submit} disabled={submitting}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-black px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2">
                        {submitting ? "Processing..." : "✓ Approve & Send to Admin"}
                    </button>
                </div>
            </div>

            {/* ── MAIN FORM ── */}
            <div className="flex-1 w-full max-w-[1750px] mx-auto p-8">
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-xl mb-6 shadow-sm flex items-center gap-3">
                        <span className="text-xl">⚠️</span> {error}
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, 1fr)",
                        gap: "24px 20px"
                    }}>

                    {/* ── BID INFORMATION ── */}
                    <SecHead icon="📋" title="General Bid Information" />
                    <F label="Bid Number" val={form?.bid_no} onChange={set("bid_no")} />
                    <F label="Department" val={form?.dept_name} onChange={set("dept_name")} />
                    <F label="Quantity" val={form?.qty} onChange={set("qty")} />
                    <F label="Pin Code" val={form?.pincode} onChange={set("pincode")} />
                    <F label="Date" val={form?.date} onChange={set("date")} />
                    <F label="Address" val={form?.address} onChange={set("address")} cols={2} />
                    <F label="EPBG %" val={form?.epbg} onChange={set("epbg")} />
                    <F label="Model No" val={form?.model} onChange={set("model")} />
                    <div className="col-span-1"></div>
                    <T label="ATC Clauses / Additional Terms" val={form?.atc} onChange={set("atc")} cols={5} rows={3} />

                    {/* ── DESKTOP CONFIG ── */}
                    <SecHead icon="🖥️" title="Technical Specification" />
                    <F label="Processor" val={form?.processor} onChange={set("processor")} />
                    <F label="Motherboard" val={form?.motherboard} onChange={set("motherboard")} />
                    <F label="RAM" val={form?.ram} onChange={set("ram")} />
                    <F label="SSD" val={form?.ssd} onChange={set("ssd")} />
                    <F label="HDD" val={form?.hdd} onChange={set("hdd")} />
                    <F label="OS" val={form?.os} onChange={set("os")} />
                    <F label="DVD Drive" val={form?.dvd} onChange={set("dvd")} />
                    <F label="WiFi" val={form?.wifi} onChange={set("wifi")} />
                    <F label="Monitor" val={form?.monitor} onChange={set("monitor")} />
                    <F label="Cabinet" val={form?.cabinet} onChange={set("cabinet")} />
                    <F label="Keyboard / Mouse" val={form?.keyboard} onChange={set("keyboard")} />
                    <F label="Warranty Period" val={form?.warranty} onChange={set("warranty")} />

                    {/* ── PRICES ── */}
                    <SecHead icon="💰" title="Component Pricing (₹)" />
                    <F label="Processor Price" val={form?.processor_price} onChange={set("processor_price")} />
                    <F label="Motherboard Price" val={form?.motherboard_price} onChange={set("motherboard_price")} />
                    <F label="RAM Price" val={form?.ram_price} onChange={set("ram_price")} />
                    <F label="SSD Price" val={form?.ssd_price} onChange={set("ssd_price")} />
                    <F label="HDD Price" val={form?.hdd_price} onChange={set("hdd_price")} />
                    <F label="OS Price" val={form?.os_price} onChange={set("os_price")} />
                    <F label="DVD Price" val={form?.dvd_price} onChange={set("dvd_price")} />
                    <F label="WiFi Price" val={form?.wifi_price} onChange={set("wifi_price")} />
                    <F label="Monitor Price" val={form?.monitor_price} onChange={set("monitor_price")} />
                    <F label="Cabinet Price" val={form?.cabinet_price} onChange={set("cabinet_price")} />
                    <F label="Keyboard Price" val={form?.keyboard_price} onChange={set("keyboard_price")} />
                    <F label="Warranty Price" val={form?.warranty_price} onChange={set("warranty_price")} />

                    {/* ── DESCRIPTIONS (Two Rows) ── */}
                    <SecHead icon="📝" title="Detailed Descriptions" />
                    {/* Row 1 */}
                    <T label="Processor Description" val={form?.pro_descp} onChange={set("pro_descp")} cols={2} rows={4} />
                    <div className="col-span-1"></div> {/* Spacer for alignment */}
                    <T label="Motherboard Description" val={form?.motherboard_descp} onChange={set("motherboard_descp")} cols={2} rows={4} />

                    {/* Row 2 */}
                    <T label="Software / OS Description" val={form?.software1} onChange={set("software1")} cols={2} rows={4} />
                    <div className="col-span-1"></div> {/* Spacer for alignment */}
                    <T label="Graphics / Other Specs" val={form?.gp} onChange={set("gp")} cols={2} rows={4} />

                    {/* ── ANALYSER NOTE ── */}
                    <SecHead icon="✏️" title="Reviewer's Decision Note" />
                    <div className="col-span-full">
                        <Textarea
                            rows={4}
                            placeholder="Apna final review yahan likhein..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            className="border-2 border-blue-200 bg-blue-50/30 p-4 text-base focus:bg-white"
                        />
                    </div>
                </div>

        <div className="p-4 bg-gray-50 min-h-screen">
            {error && <div className="text-red-500 mb-3">{error}</div>}

            <div className="bg-white p-4 rounded shadow grid grid-cols-3 gap-3">

                {/* STEP 1 */}
                <h3 className="col-span-3 font-bold text-gray-700">Step 1: Basic Info<

                <Label>Bid No</Label>
                <Input value={form?.bid_no || ""} readOnly />

                <Label>Department</Label>
                <Input value={form?.dept_name || ""} readOnly />

                <Label>Qty</Label>
                <Input value={form?.qty || ""} readOnly />

                <Label>Address</Label>
                <Input value={form?.address || ""} readOnly />

                <Label>Pincode</Label>
                <Input value={form?.pincode || ""} readOnly />

                <Label>ATC</Label>
                <Textarea value={form?.atc || ""} readOnly />

                {/* STEP 2 */}
                <h3 className="col-span-3 font-bold text-gray-700 mt-4">Step 2: Configuration</h3>

                <Label>Processor</Label>
                <Input value={form?.processor || ""} readOnly />

                <Label>Processor Desc</Label>
                <Textarea value={form?.pro_descp || ""} readOnly />

                <Label>RAM</Label>
                <Input value={form?.ram || ""} readOnly />

                <Label>HDD</Label>
                <Input value={form?.hdd || ""} readOnly />

                <Label>SSD</Label>
                <Input value={form?.ssd || ""} readOnly />

                <Label>OS</Label>
                <Input value={form?.os || ""} readOnly />

                <Label>DVD</Label>
                <Input value={form?.dvd || ""} readOnly />

                <Label>WiFi</Label>
                <Input value={form?.wifi || ""} readOnly />

                <Label>Monitor</Label>
                <Input value={form?.monitor || ""} readOnly />

                <Label>Cabinet</Label>
                <Input value={form?.cabinet || ""} readOnly />

                <Label>Keyboard</Label>
                <Input value={form?.keyboard || ""} readOnly />

                <Label>Warranty</Label>
                <Input value={form?.warranty || ""} readOnly />

                <Label>Motherboard</Label>
                <Input value={form?.motherboard || ""} readOnly />

                <Label>Motherboard Desc</Label>
                <Textarea value={form?.motherboard_descp || ""} readOnly />

                <Label>Software</Label>
                <Textarea value={form?.software1 || ""} readOnly />

                <Label>GP</Label>
                <Textarea value={form?.gp || ""} readOnly />

                <Label>Date</Label>
                <Input value={form?.date || ""} readOnly />

                <Label>EPBG</Label>
                <Input value={form?.epbg || ""} readOnly />

                <Label>Model</Label>
                <Input value={form?.model || ""} readOnly />

                {/* ANALYSER */}
                <div className="col-span-3 mt-4">
                    <Label>Analyser Note</Label>
                    <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>

                <button
                    onClick={submit}
                    className="col-span-3 bg-green-600 text-white py-2 rounded mt-3"
                >
                    Submit Review
                </button>
            </div>
        </div>
    );
}