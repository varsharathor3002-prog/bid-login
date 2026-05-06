import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const REVIEW_API = {
    desktop: (id) => `http://127.0.0.1:8000/api/desktop-bids/${id}/review/`,
};
const FETCH_API = {
    desktop: (id) => `http://127.0.0.1:8000/api/desktop-bids/${id}/`,
};

// Size bada rakha gaya hai labels ka
const Label = ({ children }) => (
    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2 leading-none">
        {children}
    </label>
);

// Input text bada hai (16px)
const Input = (props) => (
    <input
        className="w-full border border-gray-300 rounded-md px-4 py-3 text-base font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-all shadow-sm"
        {...props}
    />
);

// Textarea ko professional feel dene ke liye
const Textarea = ({ rows = 2, ...props }) => (
    <textarea
        rows={rows}
        className="w-full border border-gray-300 rounded-md px-4 py-3 text-base font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white resize-none transition-all shadow-sm"
        {...props}
    />
);

const SecHead = ({ icon, title }) => (
    <div className="col-span-full flex items-center gap-3 pt-8 pb-3 border-b-2 border-blue-100 mb-5 mt-4">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-black uppercase tracking-[0.2em] text-blue-700">{title}</span>
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
    // Note state abhi bhi hai taaki agar backend ko empty string chahiye toh crash na ho
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
        // VALIDATION HATAI GAYI HAI: Ab note khali hone par alert nahi aayega
        setSubmitting(true);
        setError("");
        try {
            const res = await fetch(REVIEW_API[product](id || form?.id), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    analyser_note: note, // Khali string jayegi
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
        <div className="flex items-center justify-center h-screen text-gray-400 font-black animate-pulse text-2xl uppercase tracking-tighter">
            Loading Bid Details...
        </div>
    );

    if (done) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-white">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-5xl shadow-inner">✓</div>
            <div className="text-center">
                <h2 className="text-4xl font-black text-gray-800">Admin ko bhej diya!</h2>
                <p className="text-gray-500 mt-2 text-xl font-bold">Bid <strong>{form?.bid_no}</strong> successfully forward ho gayi hai.</p>
            </div>
            <button onClick={() => navigate("/analyser-dashboard/desktop")}
                className="bg-blue-600 text-white px-10 py-4 rounded-xl hover:bg-blue-700 text-lg font-black shadow-lg transition-transform active:scale-95">
                ← Back to Dashboard
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">

            {/* ── STICKY TOPBAR ── */}
            <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 px-8 py-5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate(-1)}
                        className="group flex items-center gap-2 text-blue-600 font-black text-base hover:text-blue-800 transition-colors uppercase tracking-tight">
                        <span className="group-hover:-translate-x-1 transition-transform text-xl">←</span> Back
                    </button>
                    <div className="h-8 w-[1.5px] bg-gray-200"></div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-gray-900 tracking-tight">Review Bid:</span>
                            <span className="text-2xl font-black text-blue-600 tracking-tighter">{form?.bid_no}</span>
                        </div>
                        <span className="text-xs font-black text-gray-400 uppercase tracking-[0.25em] mt-0.5">
                            {product} • {form?.dept_name}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── MAIN FORM ── */}
            <div className="flex-1 w-full max-w-[1750px] mx-auto p-8">
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-5 rounded-r-xl mb-8 shadow-sm flex items-center gap-3 text-lg font-bold">
                        <span>⚠️</span> {error}
                    </div>
                )}

                <div className="bg-white rounded-3xl border border-gray-200 p-10 shadow-sm"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, 1fr)",
                        gap: "30px 25px"
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
                    <T label="ATC Clauses / Additional Terms" val={form?.atc} onChange={set("atc")} cols={5} rows={2} />

                    {/* ── DESKTOP CONFIG ── */}
                    <SecHead icon="💻" title="Technical Specification" />
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

                    {/* ── DESCRIPTIONS ── */}
                    <SecHead icon="📝" title="Detailed Descriptions" />
                    <T label="Processor Description" val={form?.pro_descp} onChange={set("pro_descp")} cols={2} rows={2} />
                    <div className="col-span-1"></div> 
                    <T label="Motherboard Description" val={form?.motherboard_descp} onChange={set("motherboard_descp")} cols={2} rows={2} />

                    <T label="Software / OS Description" val={form?.software1} onChange={set("software1")} cols={2} rows={2} />
                    <div className="col-span-1"></div>
                    <T label="Graphics / Other Specs" val={form?.gp} onChange={set("gp")} cols={2} rows={2} />
                </div>

                {/* Professional Action Button */}
                <div className="mt-16 mb-24 flex justify-center">
                    <button 
                        onClick={submit} 
                        disabled={submitting}
                        className="w-full max-w-md bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 px-8 rounded-xl text-xl shadow-lg shadow-green-100 transition-all hover:shadow-green-200 hover:-translate-y-0.5 active:translate-y-0 tracking-wider uppercase"
                    >
                        {submitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Processing...
                            </span>
                        ) : (
                            "Update & Send to Admin"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}