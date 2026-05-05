

import React, { useState } from "react";

const MODEL_PREFIXES = ["ACL-1082DS-", "ACL-1060DS-", "ACL-1077DS-"];

const SectionCard = ({ title, icon, children }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
    <div className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
      <span className="text-lg">{icon}</span>
      <h3 className="text-white font-semibold text-sm tracking-wide">{title}</h3>
    </div>
    <div className="p-6 space-y-5">{children}</div>
  </div>
);

export default function Step3ModelNumber({ bidData, onFinish }) {
  const [prefix, setPrefix] = useState("ACL-1082DS-");
  const [suffix, setSuffix] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = e => {
    e.preventDefault();
    if (!suffix.trim()) return;
    onFinish({ model: `${prefix}${suffix}` });
    setDone(true);
  };

  if (done) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl mx-auto shadow">
          ✅
        </div>

        <h2 className="text-2xl font-bold text-emerald-600">
          Bid Created Successfully!
        </h2>

        <div className="bg-white rounded-2xl border p-6 text-left max-w-md mx-auto shadow">
          <p className="text-sm mb-2">
            <strong>Bid No:</strong> {bidData?.bid_no}
          </p>
          <p className="text-sm">
            <strong>Model:</strong>{" "}
            <span className="text-blue-600 font-mono">
              {prefix}{suffix}
            </span>
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* MODEL CARD */}
        <SectionCard title="Model Number" icon="🏷️">
          <div className="flex flex-col md:flex-row gap-3">
            <select
              value={prefix}
              onChange={e => setPrefix(e.target.value)}
              className="w-full md:w-1/3 border border-gray-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
            >
              {MODEL_PREFIXES.map(p => (
                <option key={p}>{p}</option>
              ))}
            </select>

            <input
              value={suffix}
              onChange={e => setSuffix(e.target.value)}
              placeholder="Enter model suffix..."
              required
              className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
            />
          </div>
        </SectionCard>

        {/* BUTTON */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 transition text-white font-semibold py-4 rounded-xl tracking-wide shadow-md uppercase"
        >
          Create Desktop Bid ✓
        </button>

      </form>
    </div>
  );
}

