import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000/api";

const MODEL_PREFIXES = [
  "ACL-1082DS-",
  "ACL-1060DS-",
  "ACL-1077DS-",
];

const SectionCard = ({ title, icon, children }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">

    <div className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">

      <span className="text-lg">
        {icon}
      </span>

      <h3 className="text-white font-semibold text-sm tracking-wide">
        {title}
      </h3>

    </div>

    <div className="p-6 space-y-5">
      {children}
    </div>

  </div>
);

export default function ModelNumber({ bidData, onFinish }) {

  const bid_id = bidData?.bid_id;

  const navigate = useNavigate();

  const [prefix, setPrefix] = useState("ACL-1082DS-");

  const [suffix, setSuffix] = useState("");

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const handleSubmit = async (e) => {

    e.preventDefault();

    if (!suffix.trim()) return;

    setSaving(true);

    setError("");

    const model = `${prefix}${suffix}`;

    try {

      const res = await fetch(
        `${API_BASE}/desktop-bids/${bid_id}/model/`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ model }),
        }
      );

      const data = await res.json();

      if (!res.ok) {

        throw new Error(
          data.error || "Failed"
        );
      }

      // ✅ Parent ko final data do
      onFinish({ model });

      // ✅ SUCCESS MESSAGE
      alert("Bid Created Successfully ✅");

      // ✅ DASHBOARD NAVIGATE
      navigate("/user");

    } catch (err) {

      console.log(err);

      setError(
        "Model number save nahi ho pa raha."
      );

    } finally {

      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">

      {error && (
        <div className="mb-4 bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2 rounded">

          ⚠️ {error}

        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >

        <SectionCard
          title="Model Number"
          icon="🏷️"
        >

          <div className="flex flex-col md:flex-row gap-3">

            <select
              value={prefix}
              onChange={(e) =>
                setPrefix(e.target.value)
              }
              className="w-full md:w-1/3 border border-gray-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
            >

              {MODEL_PREFIXES.map((p) => (

                <option key={p}>
                  {p}
                </option>

              ))}

            </select>

            <input
              value={suffix}
              onChange={(e) =>
                setSuffix(e.target.value)
              }
              placeholder="Enter model suffix..."
              required
              className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
            />

          </div>

        </SectionCard>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 disabled:opacity-60 transition text-white font-semibold py-4 rounded-xl tracking-wide shadow-md uppercase"
        >

          {saving
            ? "Saving..."
            : "Create Desktop Bid ✓"}

        </button>

      </form>
    </div>
  );
}