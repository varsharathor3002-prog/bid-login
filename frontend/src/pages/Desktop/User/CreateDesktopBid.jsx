import { useState, useEffect } from "react";
import DesktopConfig from "./DesktopConfig";
import DesktopBidSummary from "./DesktopBidSummary";
import Document from "./Document";

const API_BASE = import.meta.env.VITE_API_URL;

const Label = ({ children, optional }) => (
  <label className="block text-sm font-normal text-gray-800 mb-1">
    {children}
    {optional && <span className="text-gray-500 ml-1">(Optional)</span>}
  </label>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`w-full bg-white border border-gray-400 text-gray-900 rounded px-3 py-[6px] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${className}`}
    {...props}
  />
);

const clearBidStorage = () => {
  localStorage.removeItem("desktop_bid_step");
  localStorage.removeItem("desktop_bid_data");
};

export default function CreateDesktopBid() {
  const [step, setStep] = useState(() => {
    return Number(localStorage.getItem("desktop_bid_step")) || 1;
  });

  const [allData, setAllData] = useState(() => {
    try {
      const saved = localStorage.getItem("desktop_bid_data");
      return saved ? JSON.parse(saved) : { bid_id: null };
    } catch {
      return { bid_id: null };
    }
  });

  const [sessionStarted, setSessionStarted] = useState(() => {
    try {
      const saved = localStorage.getItem("desktop_bid_data");
      const parsed = saved ? JSON.parse(saved) : null;
      return !!parsed?.bid_id;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem("desktop_bid_step", step);
  }, [step]);

  useEffect(() => {
    localStorage.setItem("desktop_bid_data", JSON.stringify(allData));
  }, [allData]);

  useEffect(() => {
    const handleBack = (e) => {
      e.preventDefault();

      if (step > 1) {
        const newStep = step - 1;
        setStep(newStep);
        localStorage.setItem("desktop_bid_step", newStep);
      } else {
        clearBidStorage();
        window.history.back();
      }
    };

    window.history.pushState({ step }, "");
    window.addEventListener("popstate", handleBack);

    return () => window.removeEventListener("popstate", handleBack);
  }, [step]);

  const handleHeaderBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      clearBidStorage();
      window.history.back();
    }
  };

  const handleStep1Submit = (data) => {
    setAllData((prev) => ({ ...prev, ...data }));
    setSessionStarted(true);
    setStep(2);
  };

  const handleStep2Submit = (configData) => {
    setAllData((prev) => ({ ...prev, ...configData }));
    setStep(3);
  };

  const handleSummaryNext = (summaryData) => {
    setAllData((prev) => ({ ...prev, ...summaryData }));
    setStep(4);
  };

  const handleFinalSuccess = () => {
    alert("Bid Created Successfully ✅");
    clearBidStorage();
    setAllData({ bid_id: null });
    setSessionStarted(false);
    setStep(1);
    window.location.href = "/user";
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 shadow-sm">
        <div className="max-w-[1750px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={handleHeaderBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-200 shadow-sm"
            >
              Back
            </button>

            <span className="text-lg font-black text-gray-900 tracking-tight">
              Create New Bid
            </span>

            <div className="h-6 w-[1px] bg-gray-200"></div>

            <span className="text-blue-600 font-bold text-sm">
              Step {step} of 4
            </span>

          </div>

          <div className="w-1/3 h-[6px] bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${(step / 4) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-[1750px] mx-auto p-8 flex justify-center items-start">
        {step === 1 && (
          <Step1Form
            onNext={handleStep1Submit}
            savedData={sessionStarted ? allData : null}
          />
        )}

        {step === 2 && (
          <DesktopConfig
            bidData={allData}
            onNext={handleStep2Submit}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <DesktopBidSummary
            bidData={allData}
            onNext={handleSummaryNext}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <Document
            bidData={allData}
            onSuccess={handleFinalSuccess}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}

function Step1Form({ onNext, savedData }) {
  const [form, setForm] = useState({
    bid_no: savedData?.bid_no || "",
    dept_name: savedData?.dept_name || "",
    qty: savedData?.qty || "",
    atc: savedData?.atc || "",
    address: savedData?.address || "",
    organization: savedData?.organization || "",
    pincode: savedData?.pincode || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userId =
        localStorage.getItem("bid_user_id") ||
        localStorage.getItem("user_id") ||
        "";

      const username =
        localStorage.getItem("user_username") ||
        localStorage.getItem("username") ||
        "";

      if (!userId) {
        setError("Your session has expired. Please log out and sign in again.");
        return;
      }

      const formData = new FormData();
      formData.append("bid_no", form.bid_no);
      formData.append("dept_name", form.dept_name);
      formData.append("qty", form.qty);
      formData.append("atc", form.atc);
      formData.append("address", form.address);
      formData.append("organization", form.organization);
      formData.append("pincode", form.pincode);
      formData.append("user_id", userId);
      formData.append("username", username);

      const response = await fetch(`${API_BASE}/desktop-bids/create/`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The bid could not be created.");
      }

      onNext({ ...form, bid_id: data.bid_id });
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to create the bid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[600px] bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <h5 className="text-lg font-semibold text-gray-800">
          Create Desktop Bid
        </h5>
      </div>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2 rounded">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Bid Number</Label>
          <Input
            type="text"
            placeholder="Enter Bid Number"
            value={form.bid_no}
            onChange={(e) => handleChange("bid_no", e.target.value)}
            required
          />
        </div>

        <div>
          <Label>Department Name</Label>
          <Input
            type="text"
            placeholder="Enter Department Name"
            value={form.dept_name}
            onChange={(e) => handleChange("dept_name", e.target.value)}
            required
          />
        </div>

        <div>
          <Label>Organization Name</Label>
          <Input
            type="text"
            placeholder="Enter Organization Name"
            value={form.organization}
            onChange={(e) => handleChange("organization", e.target.value)}
            required
          />
        </div>

        <div>
          <Label>Address</Label>
          <Input
            type="text"
            placeholder="Enter Address"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              placeholder="Enter Quantity"
              value={form.qty}
              onChange={(e) => handleChange("qty", e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Buyer Pincode</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter Buyer Pincode"
              value={form.pincode}
              onChange={(e) => handleChange("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </div>
        </div>

        <div>
          <Label>ATC Details</Label>
          <textarea
            rows={6}
            value={form.atc}
            onChange={(e) => handleChange("atc", e.target.value)}
            placeholder="Type ATC details here..."
            className="w-full bg-white border border-gray-400 text-gray-900 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-4 py-3 rounded-lg transition shadow-sm"
          >
            {loading ? "Saving..." : "Submit & Next"}
          </button>
        </div>
      </form>
    </div>
  );
}
