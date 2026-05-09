import React, { useState, useEffect } from "react";
import DesktopConfig from "./DesktopConfig";
import ModelNumber from "./ModelNumber";
import {
  FaUpload,
  FaFileAlt,
  FaCheckCircle,
} from "react-icons/fa";

const API_BASE = "http://127.0.0.1:8000/api";

const Label = ({ children, optional }) => (
  <label className="block text-sm font-normal text-gray-800 mb-1">
    {children}
    {optional && (
      <span className="text-gray-500 ml-1">
        (Optional)
      </span>
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

  const [step, setStep] = useState(() => {
    return Number(
      localStorage.getItem("desktop_bid_step")
    ) || 1;
  });

  const [allData, setAllData] = useState(() => {

    const savedData = localStorage.getItem(
      "desktop_bid_data"
    );

    return savedData
      ? JSON.parse(savedData)
      : {
          bid_id: null,
        };
  });

  // STEP SAVE
  useEffect(() => {

    localStorage.setItem(
      "desktop_bid_step",
      step
    );

  }, [step]);

  // DATA SAVE
  useEffect(() => {

    localStorage.setItem(
      "desktop_bid_data",
      JSON.stringify(allData)
    );

  }, [allData]);

  // BROWSER BACK
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

        localStorage.removeItem(
          "desktop_bid_step"
        );

        localStorage.removeItem(
          "desktop_bid_data"
        );

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

  // STEP 1
  const handleStep1Submit = (data) => {

    const updatedData = {
      ...allData,
      ...data,
    };

    setAllData(updatedData);

    setStep(2);
  };

  // STEP 2
  const handleStep2Submit = (data) => {

    const updatedData = {
      ...allData,
      ...data,
    };

    setAllData(updatedData);

    setStep(3);
  };

  // FINISH
  const handleFinish = (finalData) => {

    console.log("FINAL BID DATA => ", {
      ...allData,
      ...finalData,
    });

    localStorage.removeItem(
      "desktop_bid_step"
    );

    localStorage.removeItem(
      "desktop_bid_data"
    );

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

        {step === 1 && (
          <Step1Form
            onNext={handleStep1Submit}
            savedData={allData}
          />
        )}

        {step === 2 && (
          <DesktopConfig
            bidData={allData}
            onNext={handleStep2Submit}
          />
        )}

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

function Step1Form({
  onNext,
  savedData,
}) {

  const [form, setForm] = useState({
    bid_no: savedData?.bid_no || "",
    dept_name:
      savedData?.dept_name || "",
    qty: savedData?.qty || "",
    atc: savedData?.atc || "",
    address:
      savedData?.address || "",
    pincode:
      savedData?.pincode || "",
  });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  // FILE STATE
  const [selectedFile, setSelectedFile] =
    useState(null);

  const handleChange = (
    key,
    value
  ) => {

    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // FILE CHANGE
  const handleFileChange = (e) => {

    const file = e.target.files[0];

    if (file) {

      setSelectedFile(file);

    }
  };

  // SUBMIT
  const handleSubmit = async (e) => {

    e.preventDefault();

    setLoading(true);

    setError("");

    try {

      // ALREADY CREATED
      if (savedData?.bid_id) {

        onNext({
          ...form,
          bid_id: savedData.bid_id,
        });

        return;
      }

      const formData = new FormData();

      formData.append(
        "bid_no",
        form.bid_no
      );

      formData.append(
        "dept_name",
        form.dept_name
      );

      formData.append(
        "qty",
        form.qty
      );

      formData.append(
        "atc",
        form.atc
      );

      formData.append(
        "address",
        form.address
      );

      formData.append(
        "pincode",
        form.pincode
      );

      formData.append(
        "user_id",
        localStorage.getItem("user_id")
      );

      // FILE
      if (selectedFile) {

        formData.append(
          "upload_document",
          selectedFile
        );
      }

      const response = await fetch(
        `${API_BASE}/desktop-bids/create/`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      console.log(
        "CREATE BID RESPONSE => ",
        data
      );

      if (!response.ok) {

        throw new Error(
          data.error || "Failed"
        );
      }

      onNext({
        ...form,
        bid_id: data.bid_id,
      });

    } catch (err) {

      console.log(err);

      setError(
        "Bid create nahi ho pa raha."
      );

    } finally {

      setLoading(false);

    }
  };

  return (
    <div className="w-full max-w-[600px] bg-white p-6 rounded-xl border border-gray-200 shadow-sm">

      <h5 className="text-lg font-semibold text-gray-800 mb-5">
        Create Desktop Bid
      </h5>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2 rounded">
          ⚠️ {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >

        {/* BID NUMBER */}
        <div>

          <Label>Bid Number</Label>

          <Input
            type="text"
            value={form.bid_no}
            onChange={(e) =>
              handleChange(
                "bid_no",
                e.target.value
              )
            }
            required
          />

        </div>

        {/* DEPARTMENT */}
        <div>

          <Label>
            Department Name
          </Label>

          <Input
            type="text"
            value={form.dept_name}
            onChange={(e) =>
              handleChange(
                "dept_name",
                e.target.value
              )
            }
            required
          />

        </div>

        {/* QTY + PIN */}
        <div className="grid grid-cols-2 gap-4">

          <div>

            <Label>Quantity</Label>

            <Input
              type="number"
              value={form.qty}
              onChange={(e) =>
                handleChange(
                  "qty",
                  e.target.value
                )
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
                handleChange(
                  "pincode",
                  e.target.value
                )
              }
              required
            />

          </div>

        </div>

        {/* ATC */}
        <div>

          <Label>
            ATC Details
          </Label>

          <Textarea
            rows={4}
            value={form.atc}
            onChange={(e) =>
              handleChange(
                "atc",
                e.target.value
              )
            }
            placeholder="Type ATC details here..."
          />

        </div>

        {/* FILE UPLOAD */}
        <div>

          <Label optional>
            Upload Bid Document
          </Label>

          <label className="w-full border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 transition-all rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer">

            <FaUpload className="text-3xl text-blue-600 mb-3" />

            <span className="text-sm font-semibold text-gray-700">
              Click to Upload File
            </span>

            <span className="text-xs text-gray-500 mt-1">
              PDF, DOC, DOCX, XLS allowed
            </span>

            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />

          </label>

          {/* FILE PREVIEW */}
          {selectedFile && (

            <div className="mt-3 border border-green-300 bg-green-50 rounded-lg px-4 py-3 flex items-center gap-3">

              <FaFileAlt className="text-green-700 text-lg" />

              <div className="flex-1 overflow-hidden">

                <p className="text-sm font-medium text-green-800 truncate">
                  {selectedFile.name}
                </p>

                <p className="text-xs text-green-700">
                  {(
                    selectedFile.size /
                    1024
                  ).toFixed(2)}{" "}
                  KB
                </p>

              </div>

              <FaCheckCircle className="text-green-600 text-lg" />

            </div>

          )}

        </div>

        {/* ADDRESS */}
        <div>

          <Label>Address</Label>

          <Input
            type="text"
            value={form.address}
            onChange={(e) =>
              handleChange(
                "address",
                e.target.value
              )
            }
            required
          />

        </div>

        {/* BUTTON */}
        <div className="pt-2">

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-4 py-3 rounded-lg transition shadow-sm"
          >
            {loading
              ? "Saving..."
              : "Submit & Next"}
          </button>

        </div>

      </form>
    </div>
  );
}