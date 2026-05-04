import React, { useState } from "react";
import DesktopConfig from "./DesktopConfig"; 
import ModelNumber from "./ModelNumber";

// --- SIMPLE & CLEAN UI COMPONENTS (Pure Black Text) ---
const Label = ({ children, optional }) => (
  <label className="block text-xs font-bold uppercase tracking-wide text-black mb-1">
    {children} {optional && <span className="text-gray-500 normal-case font-normal ml-1">— Optional</span>}
  </label>
);

const Input = ({ className = "", ...props }) => (
  <input 
    className={`w-full bg-white border border-gray-300 text-black font-semibold rounded-md px-3 py-2 text-sm outline-none 
    focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder-gray-400 ${className}`} 
    {...props} 
  />
);

const Textarea = ({ className = "", ...props }) => (
  <textarea 
    className={`w-full bg-white border border-gray-300 text-black font-semibold rounded-md px-3 py-2 text-sm outline-none 
    focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder-gray-400 resize-none ${className}`} 
    {...props} 
  />
);

const SectionCard = ({ title, icon, children }) => (
  <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-4">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
      <span className="text-sm">{icon}</span>
      <h3 className="text-black font-bold text-xs uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-4 space-y-3">{children}</div>
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
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Simple Step Progress */}
        <div className="flex items-center gap-2 mb-6 px-1">
           <span className="text-black font-black text-lg">Step {step}</span>
           <div className="h-[2px] flex-1 bg-gray-100">
              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(step/3)*100}%` }}></div>
           </div>
        </div>

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
    <form onSubmit={e => { e.preventDefault(); onNext(form); }} className="space-y-4">
      <SectionCard title="Bid Information" icon="📋">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <Label>Bid Number</Label>
            <Input placeholder="GEM/2026/..." value={form.bid_no} onChange={set("bid_no")} required />
          </div>
          <div>
            <Label>Department Name</Label>
            <Input placeholder="Department Name" value={form.deptName} onChange={set("deptName")} required />
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" placeholder="Total Units" value={form.qty} onChange={set("qty")} required />
          </div>
          <div>
            <Label>Pin Code</Label>
            <Input type="number" placeholder="Pincode" value={form.pincode} onChange={set("pincode")} required />
          </div>
        </div>

        <div>
          <Label>Full Address</Label>
          <Input placeholder="Delivery Location" value={form.address} onChange={set("address")} required />
        </div>

        <div>
          <Label optional>Additional Terms (ATC)</Label>
          <Textarea 
            placeholder="Enter terms here..." 
            value={form.atc} 
            onChange={set("atc")} 
            rows={3} 
          />
        </div>
      </SectionCard>

      <button 
        type="submit" 
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-md shadow-md transition-all active:scale-[0.99]"
      >
        Save and Continue →
      </button>
    </form>
  );
}