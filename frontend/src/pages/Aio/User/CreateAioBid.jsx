import { useEffect, useState } from "react";
import AioConfig from "./AioConfig";
import AioBidSummary from "./AioBidSummary";
import AioDocument from "./AioDocument";

const API_BASE = import.meta.env.VITE_API_URL;
const DATA_KEY = "aio_bid_data";
const STEP_KEY = "aio_bid_step";

const Label = ({ children }) => <label className="block text-sm font-normal text-gray-800 mb-1">{children}</label>;
const Input = (props) => <input {...props} className="w-full bg-white border border-gray-400 text-gray-900 rounded px-3 py-[6px] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />;

// Same to same as Desktop's CreateDesktopBid.jsx: clearing storage only at
// the very end (done()) left a half-filled bid's data sitting in
// localStorage whenever the user backed out before finishing — so the next
// "Create AIO Bid" click (thought of as starting fresh) would silently
// resume that old, abandoned bid, showing its text already filled in on
// every step, Config included.
const clearBidStorage = () => { localStorage.removeItem(DATA_KEY); localStorage.removeItem(STEP_KEY); };

export default function CreateAioBid() {
  const [step, setStep] = useState(() => Number(localStorage.getItem(STEP_KEY)) || 1);
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(DATA_KEY)) || {}; } catch { return {}; } });
  const [sessionStarted, setSessionStarted] = useState(() => {
    try { return !!JSON.parse(localStorage.getItem(DATA_KEY))?.bid_id; } catch { return false; }
  });
  useEffect(() => { localStorage.setItem(STEP_KEY, step); localStorage.setItem(DATA_KEY, JSON.stringify(data)); }, [step, data]);

  useEffect(() => {
    const handlePopBack = (e) => {
      e.preventDefault();
      if (step > 1) {
        setStep((old) => old - 1);
      } else {
        clearBidStorage();
        window.history.back();
      }
    };
    window.history.pushState({ step }, "");
    window.addEventListener("popstate", handlePopBack);
    return () => window.removeEventListener("popstate", handlePopBack);
  }, [step]);

  const next = (value) => { setData((old) => ({ ...old, ...value })); setSessionStarted(true); setStep((old) => old + 1); };
  const back = () => {
    if (step > 1) { setStep(step - 1); return; }
    clearBidStorage();
    window.history.back();
  };
  const done = () => { clearBidStorage(); alert("AIO Bid Created Successfully"); window.location.href = "/user"; };

  return <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 shadow-sm">
      <div className="max-w-[1750px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6"><button type="button" onClick={back} className="flex items-center px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-slate-800 hover:text-white shadow-sm">Back</button><span className="text-lg font-black text-gray-900 tracking-tight">Create New Bid</span><div className="h-6 w-px bg-gray-200"/><span className="text-blue-600 font-bold text-sm">Step {step} of 4</span></div>
        <div className="w-1/3 h-[6px] bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${step * 25}%` }}/></div>
      </div>
    </div>
    <div className="flex-1 w-full max-w-[1750px] mx-auto p-8 flex justify-center items-start">
      {step === 1 && <Basic saved={sessionStarted ? data : {}} onNext={next}/>} {step === 2 && <AioConfig bidData={data} onBack={() => setStep(1)} onNext={next}/>} {step === 3 && <AioBidSummary bidData={data} onBack={() => setStep(2)} onNext={next}/>} {step === 4 && <AioDocument bidData={data} onBack={() => setStep(3)} onSuccess={done}/>}
    </div>
  </div>;
}

function Basic({ saved, onNext }) {
  const [form, setForm] = useState({ bid_no: saved.bid_no || "", dept_name: saved.dept_name || "", organization: saved.organization || "", address: saved.address || "", qty: saved.qty || "", pincode: saved.pincode || "", atc: saved.atc || "" });
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const change = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const submit = async (event) => { event.preventDefault(); setLoading(true); setError(""); try { const body = new FormData(); Object.entries(form).forEach(([key, value]) => body.append(key, value)); body.append("user_id", localStorage.getItem("bid_user_id") || localStorage.getItem("user_id") || ""); body.append("username", localStorage.getItem("user_username") || localStorage.getItem("username") || ""); const response = await fetch(`${API_BASE}/aio-bids/create/`, { method: "POST", body }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Bid create nahi hua"); onNext({ ...form, bid_id: result.bid_id }); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  return <div className="w-full max-w-[600px] bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
    <h5 className="text-lg font-semibold text-gray-800 mb-5">Create AIO Bid</h5>
    {error && <div className="mb-3 bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2 rounded">{error}</div>}
    <form onSubmit={submit} className="space-y-4">
      <div><Label>Bid Number</Label><Input required placeholder="Enter Bid Number" value={form.bid_no} onChange={(e) => change("bid_no", e.target.value)}/></div>
      <div><Label>Department Name</Label><Input required placeholder="Enter Department Name" value={form.dept_name} onChange={(e) => change("dept_name", e.target.value)}/></div>
      <div><Label>Organization Name</Label><Input required placeholder="Enter Organization Name" value={form.organization} onChange={(e) => change("organization", e.target.value)}/></div>
      <div><Label>Address</Label><Input required placeholder="Enter Address" value={form.address} onChange={(e) => change("address", e.target.value)}/></div>
      <div className="grid grid-cols-2 gap-4"><div><Label>Quantity</Label><Input required type="number" placeholder="Enter Quantity" value={form.qty} onChange={(e) => change("qty", e.target.value)}/></div><div><Label>Buyer Pincode</Label><Input required type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} style={{ appearance: "textfield", MozAppearance: "textfield" }} placeholder="Enter PIN Code" value={form.pincode} onChange={(e) => change("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}/></div></div>
      <div><Label>ATC Details</Label><textarea rows={6} value={form.atc} onChange={(e) => change("atc", e.target.value)} placeholder="Type ATC details here..." className="w-full bg-white border border-gray-400 text-gray-900 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"/></div>
      <div className="pt-2"><button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-4 py-3 rounded-lg transition shadow-sm">{loading ? "Saving..." : "Submit & Next"}</button></div>
    </form>
  </div>;
}
