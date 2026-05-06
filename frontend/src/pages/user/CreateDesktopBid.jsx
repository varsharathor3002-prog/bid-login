import React, { useState } from "react";
import DesktopConfig from "./DesktopConfig";
import ModelNumber from "./ModelNumber";

// --- SIMPLE & CLEAN UI COMPONENTS (Full Width Version) ---
const Label = ({ children, optional }) => (
  <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1 leading-none">
    {children} {optional && <span className="text-gray-400 normal-case font-normal ml-1">— Optional</span>}
  </label>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`w-full bg-white border border-gray-300 text-black font-semibold rounded-md px-3 py-2 text-sm outline-none 
    focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder-gray-400 shadow-sm ${className}`}
    {...props}
  />
);

const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={`w-full bg-white border border-gray-300 text-black font-semibold rounded-md px-3 py-2 text-sm outline-none 
    focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder-gray-400 resize-none shadow-sm ${className}`}
    {...props}
  />
);

const SectionCard = ({ title, icon, children }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
    <div className="flex items-center gap-3 px-8 py-4 border-b border-gray-100 bg-gray-50/50">
      <span className="text-xl">{icon}</span>
      <h3 className="text-blue-700 font-black text-xs uppercase tracking-[0.15em]">{title}</h3>
    </div>
    {/* Grid set to 5 columns to match the previous display */}
    <div className="p-8 grid grid-cols-1 md:grid-cols-5 gap-6">
      {children}
    </div>
  </div>
);

// --- MAIN COMPONENT ---
export default function CreateBidMain() {
  const [step, setStep] = useState(1);
  const [allData, setAllData] = useState({});

  const handleStep1Submit = (data) => {
    setAllData({ ...allData, ...data });
    setStep(2);
  };

  const handleStep2Submit = (data) => {
    setAllData({ ...allData, ...data });
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">

      {/* Sticky Header to match the style */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 shadow-sm">
        <div className="max-w-[1750px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-lg font-black text-gray-900 tracking-tight">Create New Bid</span>
            <div className="h-6 w-[1px] bg-gray-200"></div>
            <span className="text-blue-600 font-bold text-sm">Step {step} of 3</span>
          </div>

          <div className="w-1/3 h-[6px] bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-[1750px] mx-auto p-8">
        {step === 1 && <Step1Form onNext={handleStep1Submit} />}
        {step === 2 && <DesktopConfig bidData={allData} onNext={handleStep2Submit} />}
        {step === 3 && (
          <ModelNumber
            bidData={allData}
            onFinish={(final) => console.log("Final Data:", { ...allData, ...final })}
          />
        )}
      </div>
    </div>
  );
}

// --- STEP 1 INNER COMPONENT ---
function Step1Form({ onNext }) {
  const [form, setForm] = useState({
    bid_no: "", deptName: "", qty: "", atc: "", address: "", pincode: "",
  });

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <form onSubmit={e => { e.preventDefault(); onNext(form); }} className="space-y-6">
      <SectionCard title="General Bid Information" icon="📋">

        {/* Fields organized in 5-column grid */}
        <div className="col-span-1">
          <Label>Bid Number</Label>
          <Input placeholder="GEM/2026/..." value={form.bid_no} onChange={set("bid_no")} required />
        </div>

        <div className="col-span-1">
          <Label>Department Name</Label>
          <Input placeholder="e.g. Health Dept" value={form.deptName} onChange={set("deptName")} required />
        </div>

        <div className="col-span-1">
          <Label>Quantity</Label>
          <Input type="number" placeholder="Total Units" value={form.qty} onChange={set("qty")} required />
        </div>

        <div className="col-span-1">
          <Label>Pin Code</Label>
          <Input type="number" placeholder="Pincode" value={form.pincode} onChange={set("pincode")} required />
        </div>

        <div className="col-span-1">
          <Label>Address</Label>
          <Input placeholder="Location" value={form.address} onChange={set("address")} required />
        </div>

        {/* Full width description / ATC */}
        <div className="col-span-full mt-2">
          <Label optional>Additional Terms & Conditions (ATC)</Label>
          <Textarea
            placeholder="Type your custom terms here..."
            value={form.atc}
            onChange={set("atc")}
            rows={4}
            className="border-2 border-blue-50 focus:bg-white bg-gray-50/30"
          />
        </div>
      </SectionCard>

      <div className="flex justify-center mt-10">
        <button
          type="submit"
          className="w-full max-w-2xl bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-2xl text-lg shadow-xl shadow-green-100 transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2"
        >
          Save and Continue to Configuration
          <span className="text-xl">→</span>
        </button>
      </div>
    </form>
  );
}