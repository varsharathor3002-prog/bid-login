import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const REVIEW_API = {
    desktop: (id) => `http://127.0.0.1:8000/api/desktop-bids/${id}/review/`,
};
const FETCH_API = {
    desktop: (id) => `http://127.0.0.1:8000/api/desktop-bids/${id}/`,
};

const Label = ({ children }) => (
    <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">{children}</label>
);

const Input = (props) => (
    <input
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-semibold text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
        {...props}
    />
);

const Textarea = ({ rows = 2, ...props }) => (
    <textarea
        rows={rows}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-semibold text-gray-800 focus:ring-1 focus:ring-blue-500 outline-none bg-white resize-none"
        {...props}
    />
);

const SecHead = ({ icon, title }) => (
    <div className="col-span-full flex items-center gap-2 pt-3 pb-1 border-b border-blue-100 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">{title}</span>
    </div>
);

const F = ({ label, val, onChange, cols = 1 }) => (
    <div style={{ gridColumn: `span ${cols}` }}>
        <Label>{label}</Label>
        <Input value={val || ""} onChange={e => onChange(e.target.value)} />
    </div>
);

const T = ({ label, val, onChange, cols = 1 }) => (
    <div style={{ gridColumn: `span ${cols}` }}>
        <Label>{label}</Label>
        <Textarea value={val || ""} onChange={e => onChange(e.target.value)} />
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
        <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
    );

    if (done) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-50">
            <div className="text-6xl">✅</div>
            <h2 className="text-2xl font-bold text-green-600">Admin ko send kar diya!</h2>
            <p className="text-gray-500 text-sm">Bid <strong>{form?.bid_no}</strong> forwarded successfully.</p>
            <button onClick={() => navigate("/analyser-dashboard/desktop")}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold">
                ← Back to Dashboard
            </button>
        </div>
    );

    /* ─── 6-column grid layout ─── */
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">

            {/* ── STICKY TOPBAR ── */}
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm px-5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)}
                        className="text-blue-600 text-xs font-bold hover:underline">← Back</button>
                    <span className="text-gray-300">|</span>
                    <span className="text-sm font-black text-gray-800">Review Bid —</span>
                    <span className="text-sm font-black text-blue-600">{form?.bid_no}</span>
                    <span className="text-xs text-gray-400 capitalize hidden sm:block">
                        {product} · {form?.dept_name}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                        Pending
                    </span>
                    <button onClick={submit} disabled={submitting}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-black px-4 py-2 rounded-lg shadow transition">
                        {submitting ? "Saving..." : "✓ upadte →"}
                    </button>
                </div>
            </div>

            {/* ── FORM ── */}
            <div className="flex-1 p-4">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">
                        ❌ {error}
                    </div>
                )}

                <div className="bg-white rounded-xl border border-gray-200 p-4"
                    style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px" }}>

                    {/* ── BID INFORMATION ── */}
                    <SecHead icon="📋" title="Bid Information" />
                    <F label="Bid Number" val={form?.bid_no} onChange={set("bid_no")} />
                    <F label="Department" val={form?.dept_name} onChange={set("dept_name")} />
                    <F label="Quantity" val={form?.qty} onChange={set("qty")} />
                    <F label="Pin Code" val={form?.pincode} onChange={set("pincode")} />
                    <F label="Address" val={form?.address} onChange={set("address")} cols={2} />

                    <F label="Date" val={form?.date} onChange={set("date")} />
                    <F label="EPBG %" val={form?.epbg} onChange={set("epbg")} />
                    <F label="Model No" val={form?.model} onChange={set("model")} />
                    <T label="ATC" val={form?.atc} onChange={set("atc")} cols={3} />

                    {/* ── DESKTOP CONFIG ── */}
                    <SecHead icon="🖥️" title="Desktop Configuration" />
                    <F label="Processor" val={form?.processor} onChange={set("processor")} />
                    <F label="Motherboard" val={form?.motherboard} onChange={set("motherboard")} />
                    <F label="RAM" val={form?.ram} onChange={set("ram")} />
                    <F label="SSD" val={form?.ssd} onChange={set("ssd")} />
                    <F label="HDD" val={form?.hdd} onChange={set("hdd")} />
                    <F label="OS" val={form?.os} onChange={set("os")} />

                    <F label="DVD" val={form?.dvd} onChange={set("dvd")} />
                    <F label="WiFi" val={form?.wifi} onChange={set("wifi")} />
                    <F label="Monitor" val={form?.monitor} onChange={set("monitor")} />
                    <F label="Cabinet" val={form?.cabinet} onChange={set("cabinet")} />
                    <F label="Keyboard" val={form?.keyboard} onChange={set("keyboard")} />
                    <F label="Warranty" val={form?.warranty} onChange={set("warranty")} />

                    {/* ── PRICES ── */}
                    <SecHead icon="💰" title="Prices (₹)" />
                    <F label="Processor ₹" val={form?.processor_price} onChange={set("processor_price")} />
                    <F label="Motherboard ₹" val={form?.motherboard_price} onChange={set("motherboard_price")} />
                    <F label="RAM ₹" val={form?.ram_price} onChange={set("ram_price")} />
                    <F label="SSD ₹" val={form?.ssd_price} onChange={set("ssd_price")} />
                    <F label="HDD ₹" val={form?.hdd_price} onChange={set("hdd_price")} />
                    <F label="OS ₹" val={form?.os_price} onChange={set("os_price")} />

                    <F label="DVD ₹" val={form?.dvd_price} onChange={set("dvd_price")} />
                    <F label="WiFi ₹" val={form?.wifi_price} onChange={set("wifi_price")} />
                    <F label="Monitor ₹" val={form?.monitor_price} onChange={set("monitor_price")} />
                    <F label="Cabinet ₹" val={form?.cabinet_price} onChange={set("cabinet_price")} />
                    <F label="Keyboard ₹" val={form?.keyboard_price} onChange={set("keyboard_price")} />
                    <F label="Warranty ₹" val={form?.warranty_price} onChange={set("warranty_price")} />

                    {/* ── DESCRIPTIONS ── */}
                    <SecHead icon="📝" title="Descriptions" />
                    <T label="Processor Description" val={form?.pro_descp} onChange={set("pro_descp")} cols={3} />
                    <T label="Motherboard Description" val={form?.motherboard_descp} onChange={set("motherboard_descp")} cols={3} />
                    <T label="Software Description" val={form?.software1} onChange={set("software1")} cols={3} />
                    <T label="Graphics Description" val={form?.gp} onChange={set("gp")} cols={3} />

                    {/* ── ANALYSER NOTE ── */}
                    <SecHead icon="🗒️" title="Analyser Review Note (Zaroori)" />
                    <div className="col-span-full">
                        <Textarea
                            rows={2}
                            placeholder="Apna review note likhein — changes, corrections, ya approval notes..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            className="border-blue-300 bg-blue-50"
                        />
                    </div>

                </div>

                {/* Bottom submit */}
                <button onClick={submit} disabled={submitting}
                    className="w-full mt-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-sm shadow transition">
                    {submitting ? "Submitting..." : "✓  send admin →"}
                </button>
            </div>
        </div>
    );
}