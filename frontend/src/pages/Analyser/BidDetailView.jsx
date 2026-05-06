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
        <div className="p-4 bg-gray-50 min-h-screen">
            {error && <div className="text-red-500 mb-3">{error}</div>}

            <div className="bg-white p-4 rounded shadow grid grid-cols-3 gap-3">

                {/* STEP 1 */}
                <h3 className="col-span-3 font-bold text-gray-700">Step 1: Basic Info</h3>

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