import React, { useState, useEffect } from "react";
import DesktopConfig from "./DesktopConfig";
import ModelNumber from "./ModelNumber";

const API_BASE = "http://127.0.0.1:8000/api";

const Label = ({ children, optional }) => (
  <label className="block text-sm font-normal text-gray-800 mb-1">
    {children}
    {optional && (
      <span className="text-gray-500 ml-1">(Optional)</span>
    )}
  </label>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`w-full bg-white border border-gray-400 text-gray-900 rounded px-3 py-[6px] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${className}`}
    {...props}
  />
);

const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={`w-full bg-white border border-gray-400 text-gray-900 rounded px-3 py-[6px] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none ${className}`}
    {...props}
  />
);

export default function CreateBidMain() {

  // ✅ REFRESH PAR SAME STEP OPEN RAHEGA
  const [step, setStep] = useState(() => {
    return Number(localStorage.getItem("desktop_bid_step")) || 1;
  });

  // ✅ COMPLETE FORM DATA SAVE RAHEGA
  const [allData, setAllData] = useState(() => {

    const savedData = localStorage.getItem("desktop_bid_data");

    return savedData
      ? JSON.parse(savedData)
      : {
          bid_id: null,
        };
  });

  // ✅ STEP SAVE
  useEffect(() => {

    localStorage.setItem(
      "desktop_bid_step",
      step
    );

  }, [step]);

  // ✅ ALL FORM DATA SAVE
  useEffect(() => {

    localStorage.setItem(
      "desktop_bid_data",
      JSON.stringify(allData)
    );

  }, [allData]);

  // ✅ BROWSER BACK HANDLE
  useEffect(() => {

    window.history.pushState({ step }, "");

    const handleBack = (e) => {

      e.preventDefault();

      if (step > 1) {

        const newStep = step - 1;

        setStep(newStep);

        localStorage.setItem(
          "desktop_bid_step",
          newStep
        );

        window.history.pushState(
          { step: newStep },
          ""
        );

      } else {

        localStorage.removeItem("desktop_bid_step");
        localStorage.removeItem("desktop_bid_data");

        window.history.back();
      }
    };

    window.addEventListener(
      "popstate",
      handleBack
    );

    return () => {

      window.removeEventListener(
        "popstate",
        handleBack
      );
    };

  }, [step]);

  // ✅ STEP 1
  const handleStep1Submit = (data) => {

    console.log("STEP 1 DATA => ", data);

    const updatedData = {
      ...allData,
      ...data,
    };

    setAllData(updatedData);

    setStep(2);
  };

  // ✅ STEP 2
  const handleStep2Submit = (data) => {

    console.log("STEP 2 DATA => ", data);

    const updatedData = {
      ...allData,
      ...data,
    };

    setAllData(updatedData);

    setStep(3);
  };

  // ✅ STEP 3 FINISH
  const handleFinish = (finalData) => {

    console.log("FINAL BID DATA => ", {
      ...allData,
      ...finalData,
    });

    // ✅ RESET EVERYTHING
    localStorage.removeItem("desktop_bid_step");
    localStorage.removeItem("desktop_bid_data");

    setAllData({
      bid_id: null,
    });

    setStep(1);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">

      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 shadow-sm">

        <div className="max-w-[1750px] mx-auto flex items-center justify-between">

          <div className="flex items-center gap-6">

            <span className="text-lg font-black text-gray-900 tracking-tight">
              Create New Bid
            </span>

            <div className="h-6 w-[1px] bg-gray-200"></div>

            <span className="text-blue-600 font-bold text-sm">
              Step {step} of 3
            </span>

          </div>
          <div className="w-1/3 h-[6px] bg-gray-100 rounded-full overflow-hidden">

            <div
              className="h-full bg-blue-600 transition-all duration-500 ease-out"
              style={{
                width: `${(step / 3) * 100}%`,
              }}
            ></div>

          </div>

        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 w-full max-w-[1750px] mx-auto p-8 flex justify-center items-start">

        {/* STEP 1 */}
        {step === 1 && (
          <Step1Form
            onNext={handleStep1Submit}
            savedData={allData}
          />
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <DesktopConfig
            bidData={allData}
            onNext={handleStep2Submit}
          />
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <ModelNumber
            bidData={allData}
            onFinish={handleFinish}
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
    pincode: savedData?.pincode || "",
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [fileName, setFileName] = useState("");

  const handleChange = (key, value) => {

    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // FILE
  const handleFileChange = (e) => {

    const file = e.target.files[0];

    if (file) {
      setFileName(file.name);
    }
  };

  // SUBMIT STEP 1
  const handleSubmit = async (e) => {

    e.preventDefault();

    setLoading(true);

    setError("");

    try {

      // ✅ AGAR BID PEHLE SE BAN CHUKI HAI
      if (savedData?.bid_id) {

        onNext({
          ...form,
          bid_id: savedData.bid_id,
        });

        return;
      }

      const response = await fetch(
        `${API_BASE}/desktop-bids/create/`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            bid_no: form.bid_no,
            dept_name: form.dept_name,
            qty: Number(form.qty),
            atc: form.atc,
            address: form.address,
            pincode: form.pincode,
            user_id: localStorage.getItem("user_id"),
          }),
        }
      );

      const data = await response.json();

      console.log("CREATE BID RESPONSE => ", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed");
      }

      onNext({
        ...form,
        bid_id: data.bid_id,
      });

    } catch (err) {

      console.log(err);

      setError("Bid create nahi ho pa raha.");

    } finally {

      setLoading(false);

    }
  };

  return (
    <div className="w-full max-w-[550px] bg-white p-6 rounded-lg border border-gray-200 shadow-sm">

      <h5 className="text-base font-semibold text-gray-800 mb-4">
        Create Desktop Bid
      </h5>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2 rounded">
          ⚠️ {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-3"
      >

        <div>
          <Label>Bid Number</Label>

          <Input
            type="text"
            value={form.bid_no}
            onChange={(e) =>
              handleChange("bid_no", e.target.value)
            }
            required
          />
        </div>

        <div>
          <Label>Department Name</Label>

          <Input
            type="text"
            value={form.dept_name}
            onChange={(e) =>
              handleChange("dept_name", e.target.value)
            }
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">

          <div>
            <Label>Quantity</Label>

            <Input
              type="number"
              value={form.qty}
              onChange={(e) =>
                handleChange("qty", e.target.value)
              }
              required
            />
          </div>

          <div>
            <Label>Pin Code</Label>

            <Input
              type="number"
              value={form.pincode}
              onChange={(e) =>
                handleChange("pincode", e.target.value)
              }
              required
            />
          </div>

        </div>

        <div>

          <div className="flex justify-between items-end mb-1">

            <Label>ATC</Label>

            <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-1 rounded border border-gray-300 transition-colors flex items-center gap-1 mb-1">

              Upload Bid Document

              <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />

            </label>

          </div>

          <Textarea
            rows={4}
            value={form.atc}
            onChange={(e) =>
              handleChange("atc", e.target.value)
            }
            placeholder="Type ATC details here..."
          />

          {fileName && (
            <p className="text-[10px] text-blue-600 mt-1 font-medium italic">
              Selected: {fileName}
            </p>
          )}

        </div>

        <div>
          <Label>Address</Label>

          <Input
            type="text"
            value={form.address}
            onChange={(e) =>
              handleChange("address", e.target.value)
            }
            required
          />
        </div>

        <div className="pt-2">

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-4 py-2 rounded transition shadow-sm"
          >
            {loading ? "Saving..." : "Submit & Next"}
          </button>

        </div>

      </form>
    </div>
  );
}