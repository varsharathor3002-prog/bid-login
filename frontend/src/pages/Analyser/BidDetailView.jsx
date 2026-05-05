import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const REVIEW_API = {
    desktop: (id) => `http://127.0.0.1:8000/api/desktop-bids/${id}/review/`,
};
const FETCH_API = {
    desktop: (id) => `http://127.0.0.1:8000/api/desktop-bids/${id}/`,
};

const Label = ({ children }) => (
    <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1 leading-none">{children}</label>
);

const Input = (props) => (
    <input
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-all shadow-sm"
        {...props}
    />
);

const Textarea = ({ rows = 2, ...props }) => (
    <textarea
        rows={rows}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white resize-none transition-all shadow-sm"
        {...props}
    />
);

const SecHead = ({ icon, title }) => (
    <div className="col-span-full flex items-center gap-3 pt-6 pb-2 border-b-2 border-blue-50 mb-3 mt-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">{title}</span>
    </div>
);

const F = ({ label, val, onChange, cols = 1 }) => (
    <div style={{ gridColumn: `span ${cols}` }}>
        <Label>{label}</Label>
        <Input value={val || ""} onChange={e => onChange(e.target.value)} />
    </div>
);

const T = ({ label, val, onChange, cols = 5, rows = 2 }) => (
    <div style={{ gridColumn: `span ${cols}` }}>
        <Label>{label}</Label>
        <Textarea rows={rows} value={val || ""} onChange={e => onChange(e.target.value)} />
    </div>
);

export default function BidDetailView({ product = "desktop" }) {
    const { state } = useLocation();
    const { id } = useParams();
    const navigate = useNavigate();

    const [form, setForm] = useState(state?.bid || null);
    const [note, setNote] = useState("");
    const [loadingBid, setLoadingBid] = useState(!state?.bid);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    const set = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

    useEffect(() => {
        if (!state?.bid && id) fetchBid();
    }, [id]);

    const fetchBid = async () => {
        setLoadingBid(true);
        try {
            const res = await fetch(FETCH_API[product](id));
            if (!res.ok) throw new Error();
            setForm(await res.json());
        } catch {
            setError("Bid load nahi ho pa raha.");
        } finally {
            setLoadingBid(false);
        }
    };

    const submit = async () => {
        if (!note.trim()) { alert("Review note zaroori hai!"); return; }
        setSubmitting(true);
        setError("");
        try {
            const res = await fetch(REVIEW_API[product](id || form?.id), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    analyser_note: note,
                    analyser_username: localStorage.getItem("username") || "",
                    status: "reviewed",
                }),
            });
            if (!res.ok) throw new Error();
            setDone(true);
        } catch {
            setError("Submit fail hua. Dobara try karo.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingBid) return (
        <div className="flex items-center justify-center h-screen text-gray-400 font-bold animate-pulse text-lg">Loading Bid Details...</div>
    );

    if (done) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-white">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-5xl shadow-inner">✓</div>
            <div className="text-center">
                <h2 className="text-3xl font-black text-gray-800">Admin ko bhej diya!</h2>
                <p className="text-gray-500 mt-2 text-lg">Bid <strong>{form?.bid_no}</strong> successfully forward ho gayi hai.</p>
            </div>
            <button onClick={() => navigate("/analyser-dashboard/desktop")}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 text-base font-bold shadow-lg transition-transform active:scale-95">
                ← Back to Dashboard
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

                {/* Final Action Button */}
                <div className="mt-10 mb-20 flex justify-center">
                    <button onClick={submit} disabled={submitting}
                        className="w-full max-w-2xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-black py-5 rounded-2xl text-lg shadow-xl shadow-green-200 transition-all hover:-translate-y-1 active:translate-y-0">
                        {submitting ? "Submitting to Database..." : "✓ EVERYTHING IS CORRECT - SEND TO ADMIN"}
                    </button>
                </div>
            </div>
        </div>
    );
}