import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000/api";

const REVIEW_API = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/review/`,
};

const FETCH_API = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/`,
};

export default function BidDetailView({ product = "desktop" }) {

  const { state } = useLocation();

  const { id } = useParams();

  const navigate = useNavigate();

  const readOnly = state?.readOnly || false;

  const [form, setForm] = useState(null);

  const [loadingBid, setLoadingBid] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [msg, setMsg] = useState("");

  // =========================
  // FETCH BID
  // =========================
  useEffect(() => {

    if (id) {
      fetchBid();
    }

  }, [id]);

  const fetchBid = async () => {

    setLoadingBid(true);

    try {

      const res = await fetch(FETCH_API[product](id));

      if (!res.ok) {
        throw new Error("Failed to fetch bid");
      }

      const data = await res.json();

      console.log("BID DATA => ", data);

      // SSD FIX
      data.ssd1 = data.ssd1 || data.ssd || "";
      data.ssd1_price = data.ssd1_price || data.ssd_price || "";

      // DOCUMENT URL FIX
      if (
        data.upload_document &&
        !data.upload_document.startsWith("http")
      ) {
        data.upload_document =
          `http://127.0.0.1:8000${data.upload_document}`;
      }

      setForm(data);

    } catch (error) {

      console.log(error);

      setMsg("Error: Data load nahi ho pa raha.");

    } finally {

      setLoadingBid(false);

    }
  };

  // =========================
  // HANDLE CHANGE
  // =========================
  const handleChange = (e) => {

    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =========================
  // DOWNLOAD FILE
  // =========================
  const handleDownload = async () => {

    try {

      const response = await fetch(form.upload_document);

      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = blobUrl;

      const fileName =
        form.upload_document.split("/").pop() || "document";

      link.download = fileName;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(blobUrl);

    } catch (error) {

      console.log("Download failed", error);

      alert("File download failed");

    }
  };

  // =========================
  // SUBMIT REVIEW
  // =========================
  const handleSubmit = async (e) => {

    e.preventDefault();

    setSubmitting(true);

    setMsg("");

    try {

      const payload = {

        ...form,

        // SSD FIX
        ssd: form?.ssd1,
        ssd_price: form?.ssd1_price,

        status: "reviewed",

        analyser_username:
          localStorage.getItem("username") || "",

      };

      const res = await fetch(
        REVIEW_API[product](id || form?.id),
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (res.ok) {

        setMsg("Data Save & Forwarded to Admin ✅");

        setForm((prev) => ({
          ...prev,
          status: "reviewed",
          review_status: "reviewed",
        }));

        setTimeout(() => {

          navigate("/analyser-dashboard/desktop");

        }, 1200);

      } else {

        setMsg(data.error || "Data Save Failed");

      }

    } catch (error) {

      console.log(error);

      setMsg("Server error — Data save nahi hua.");

    } finally {

      setSubmitting(false);

    }
  };

  // =========================
  // LOADING
  // =========================
  if (loadingBid) {

    return (
      <div className="p-20 text-center text-gray-400 font-medium tracking-widest animate-pulse">
        LOADING BID DETAILS...
      </div>
    );
  }

  // =========================
  // REUSABLE FIELD
  // =========================
  const PriceField = ({
    label,
    name,
    priceName,
    isTextArea = false,
    optional = false,
  }) => (

    <div className="col-span-1">

      <div className="flex items-center gap-2 mb-1">

        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>

        {optional && (
          <span className="text-red-500 text-[11px] font-normal">
            *Optional
          </span>
        )}

      </div>

      <div className="flex gap-2">

        {isTextArea ? (

          <textarea
            name={name}
            value={form?.[name] || ""}
            onChange={handleChange}
            disabled={readOnly}
            rows={2}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-100"
          />

        ) : (

          <input
            type="text"
            name={name}
            value={form?.[name] || ""}
            onChange={handleChange}
            disabled={readOnly}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
          />

        )}

        {priceName && (

          <input
            type="text"
            value={form?.[priceName] || ""}
            readOnly
            disabled
            placeholder="Price"
            className="w-20 border border-gray-200 rounded-md px-1 py-2 text-xs text-center text-gray-500 bg-gray-50 cursor-not-allowed"
          />

        )}

      </div>

    </div>
  );

  // =========================
  // UI
  // =========================
  return (

    <div className="container mx-auto px-4 mt-4 max-w-6xl">

      <h5 className="text-lg font-semibold text-gray-800 mb-4 pt-2 border-b pb-2">

        {readOnly
          ? "View Reviewed Desktop Bid"
          : "Review & Update Desktop"}

      </h5>

      {msg && (

        <div
          className={`mb-4 px-4 py-2 rounded text-sm font-medium ${
            msg.includes("✅")
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {msg}
        </div>

      )}

      <form onSubmit={handleSubmit}>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">

          {/* BID NO */}
          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bid Number
            </label>

            <input
              type="text"
              name="bid_no"
              value={form?.bid_no || ""}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            />

          </div>

          {/* MODEL */}
          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model Number
            </label>

            <input
              type="text"
              name="model_number"
              value={form?.model_number || ""}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            />

          </div>

          {/* DEPARTMENT */}
          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>

            <input
              type="text"
              name="dept_name"
              value={form?.dept_name || ""}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            />

          </div>

          {/* QTY */}
          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>

            <input
              type="number"
              name="qty"
              value={form?.qty || ""}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            />

          </div>

          {/* PINCODE */}
          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pincode
            </label>

            <input
              type="text"
              name="pincode"
              value={form?.pincode || ""}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            />

          </div>

          {/* ADDRESS */}
          <div className="md:col-span-2 lg:col-span-3">

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>

            <input
              type="text"
              name="address"
              value={form?.address || ""}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            />

          </div>

          {/* ATC */}
          <div className="md:col-span-2 lg:col-span-3">

            <label className="block text-sm font-medium text-gray-700 mb-1">
              ATC
            </label>

            <textarea
              name="atc"
              value={form?.atc || ""}
              onChange={handleChange}
              disabled={readOnly}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none disabled:bg-gray-100"
            />

          </div>

          {/* DOCUMENT */}
          <div className="md:col-span-2 lg:col-span-3">

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Uploaded Document
            </label>

            {form?.upload_document ? (

              <div className="flex flex-wrap gap-3">

                {/* OPEN FILE */}
                <a
                  href={form.upload_document}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 px-4 py-3 rounded-md text-sm font-medium transition"
                >
                  📄 Open File
                </a>

                {/* DOWNLOAD FILE */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 px-4 py-3 rounded-md text-sm font-medium transition"
                >
                  ⬇ Download File
                </button>

              </div>

            ) : (

              <div className="border border-dashed border-gray-300 rounded-md px-4 py-4 text-sm text-gray-400 bg-gray-50">
                No document uploaded
              </div>

            )}

          </div>

          {/* TECHNICAL */}
          <PriceField label="Processor" name="processor" priceName="processor_price" />
          <PriceField label="RAM" name="ram" priceName="ram_price" />
          <PriceField label="HDD" name="hdd" priceName="hdd_price" />
          <PriceField label="SSD 1" name="ssd1" priceName="ssd1_price" />
          <PriceField label="SSD 2" name="ssd2" priceName="ssd2_price" />
          <PriceField label="OS" name="os" priceName="os_price" />
          <PriceField label="DVD" name="dvd" priceName="dvd_price" />
          <PriceField label="WiFi" name="wifi" priceName="wifi_price" />
          <PriceField label="Monitor" name="monitor" priceName="monitor_price" />
          <PriceField label="Cabinet" name="cabinet" priceName="cabinet_price" />
          <PriceField label="Keyboard" name="keyboard" priceName="keyboard_price" />
          <PriceField label="Warranty" name="warranty" priceName="warranty_price" />

        </div>

        {/* BUTTONS */}
        <div className="mt-8 mb-10 flex gap-3">

          {!readOnly && (

            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition"
            >
              {submitting
                ? "Saving..."
                : "Update & Send to Admin"}
            </button>

          )}

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition"
          >
            {readOnly ? "Back" : "Cancel"}
          </button>

        </div>

      </form>

    </div>
  );
}