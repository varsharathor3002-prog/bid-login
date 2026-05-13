import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000/api";

const REVIEW_API = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/review/`,
};

const FETCH_API = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/`,
};

const Label = ({ children, optional }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {optional && (
      <span className="text-red-500 text-[11px] font-normal ml-1">
        *Optional
      </span>
    )}
  </label>
);

// Admin Note Banner — Re-Analyze pe top pe dikhe
const AdminNoteBanner = ({ note }) => {
  if (!note) return null;

  return (
    <div className="mb-6 rounded-xl border-2 border-rose-400 bg-rose-50 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-rose-500 px-4 py-2.5">
        <span className="text-white text-base">⚠️</span>
        <span className="text-white font-bold text-sm tracking-wide uppercase">
          Admin Review Note — Action Required
        </span>
      </div>
      <div className="px-5 py-4">
        <p className="text-rose-900 text-sm leading-relaxed whitespace-pre-wrap font-medium">
          {note}
        </p>
      </div>
    </div>
  );
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

  useEffect(() => {
    fetchBid();
  }, []);

  const fetchBid = async () => {
    setLoadingBid(true);
    setMsg("");

    try {
      if (state?.bid) {
        const bid = { ...state.bid };
        bid.model_number = bid.model_number || bid.model || "";
        bid.ssd1 = bid.ssd1 || bid.ssd || "";
        bid.ssd1_price = bid.ssd1_price || bid.ssd_price || "";
        bid.upload_document =
          bid.upload_document || bid.document || bid.bid_document || "";
        if (bid.upload_document && !bid.upload_document.startsWith("http")) {
          bid.upload_document = `http://127.0.0.1:8000${bid.upload_document}`;
        }
        setForm(bid);
        setLoadingBid(false);
        return;
      }

      const bidId = id || state?.id || state?.bid_id;

      if (!bidId) {
        setMsg("Bid ID nahi mila.");
        setLoadingBid(false);
        return;
      }

      const res = await fetch(FETCH_API[product](bidId));

      if (!res.ok) throw new Error("Failed to fetch bid");

      const data = await res.json();

      data.model_number = data.model_number || data.model || "";
      data.ssd1 = data.ssd1 || data.ssd || "";
      data.ssd1_price = data.ssd1_price || data.ssd_price || "";

      if (data.upload_document && !data.upload_document.startsWith("http")) {
        data.upload_document = `http://127.0.0.1:8000${data.upload_document}`;
      }

      setForm(data);
    } catch (error) {
      console.log(error);
      setMsg("Error: Data load nahi ho pa raha.");
    } finally {
      setLoadingBid(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDownload = async () => {
    if (!form?.upload_document) {
      alert("No document found");
      return;
    }
    try {
      const response = await fetch(form.upload_document);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = form.upload_document.split("/").pop() || "document";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert("File download failed");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form) {
      setMsg("Bid details not found.");
      return;
    }

    const finalBidId =
      id || state?.id || state?.bid_id || form?.id || form?.bid_id;

    if (!finalBidId) {
      setMsg("Bid ID not found. Data save nahi hua.");
      return;
    }

    setSubmitting(true);
    setMsg("");

    try {
      const payload = {
        ...form,
        ssd: form?.ssd1,
        ssd_price: form?.ssd1_price,
        status: "reviewed",
        analyser_username: localStorage.getItem("username") || "",
      };

      const res = await fetch(REVIEW_API[product](finalBidId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setMsg("Data Save & Forwarded to Admin ✅");
        setForm((prev) => ({
          ...prev,
          status: "reviewed",
          review_status: "reviewed",
        }));
        setTimeout(() => navigate("/analyser-dashboard/desktop"), 1200);
      } else {
        setMsg(data.error || "Data Save Failed");
      }
    } catch (error) {
      setMsg("Server error — Data save nahi hua.");
    } finally {
      setSubmitting(false);
    }
  };

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

  if (loadingBid) {
    return (
      <div className="p-20 text-center text-gray-400 font-medium tracking-widest animate-pulse">
        LOADING BID DETAILS...
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-20 text-center">
        <div className="text-red-500 font-semibold mb-4">
          Bid Details Not Found
        </div>
        {msg && (
          <div className="text-sm text-gray-500 mb-4">{msg}</div>
        )}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition"
        >
          Back
        </button>
      </div>
    );
  }

  // Re-analyze status check
  const isReAnalyze =
    form?.status === "re-analyze" || form?.status === "re_analyze";

  return (
    <div className="container mx-auto px-4 mt-4 max-w-6xl">

      {/* Page Header */}
      <div className="flex items-center justify-between mb-4 pt-2 border-b pb-2">
        <h5 className="text-lg font-semibold text-gray-800">
          {readOnly
            ? "View Reviewed Desktop Bid"
            : isReAnalyze
            ? "⚠️ Re-Analyze Desktop Bid"
            : "Review & Update Desktop"}
        </h5>

        {isReAnalyze && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">
            ⚠️ Re-Analyze Required
          </span>
        )}
      </div>

      {/* ✅ Admin Note Banner — Re-Analyze pe sabse upar prominently dikhao */}
      {isReAnalyze && form?.admin_note && (
        <AdminNoteBanner note={form.admin_note} />
      )}

      {/* Success / Error Message */}
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
            <Label>Bid Number</Label>
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
            <Label>Model Number</Label>
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
            <Label>Department</Label>
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
            <Label>Quantity</Label>
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
            <Label>Pincode</Label>
            <input
              type="text"
              name="pincode"
              value={form?.pincode || ""}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>

          {/* SUBMITTED BY */}
          <div>
            <Label>Submitted By</Label>
            <input
              type="text"
              value={form?.user_name || form?.submitted_by || "-"}
              readOnly
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50"
            />
          </div>

          {/* ANALYSED BY */}
          <div>
            <Label>Analysed By</Label>
            <input
              type="text"
              value={form?.analyser_username || form?.analyser_name || "-"}
              readOnly
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50"
            />
          </div>

          {/* ADDRESS */}
          <div className="md:col-span-2 lg:col-span-3">
            <Label>Address</Label>
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
            <Label>ATC</Label>
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
            <Label>Uploaded Document</Label>
            {form?.upload_document ? (
              <div className="flex flex-wrap gap-3">
                <a
                  href={form.upload_document}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 px-4 py-3 rounded-md text-sm font-medium transition"
                >
                  📄 Open File
                </a>
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

          {/* TECHNICAL FIELDS */}
          <PriceField label="Processor" name="processor" priceName="processor_price" />
          <PriceField label="RAM" name="ram" priceName="ram_price" />
          <PriceField label="Hard Disk Drive" name="hdd" priceName="hdd_price" />
          <PriceField label="Solid State Drive 1" name="ssd1" priceName="ssd1_price" />
          <PriceField label="Solid State Drive 2" name="ssd2" priceName="ssd2_price" />
          <PriceField label="OS" name="os" priceName="os_price" />
          <PriceField label="DVD" name="dvd" priceName="dvd_price" />
          <PriceField label="WiFi Bluetooth" name="wifi" priceName="wifi_price" />
          <PriceField label="Monitor" name="monitor" priceName="monitor_price" />
          <PriceField label="Cabinet" name="cabinet" priceName="cabinet_price" />
          <PriceField label="Keyboard & Mouse" name="keyboard" priceName="keyboard_price" />
          <PriceField label="Warranty" name="warranty" priceName="warranty_price" />
          <PriceField label="Motherboard" name="motherboard" priceName="motherboard_price" />
          <PriceField label="Processor Description" name="pro_descp" isTextArea optional />
          <PriceField label="Software Description" name="software1" isTextArea optional />
          <PriceField label="Graphics Description" name="gp" isTextArea optional />
          <PriceField label="Motherboard Description" name="motherboard_descp" isTextArea optional />

          {/* BID DATE */}
          <div>
            <Label>Bid Date</Label>
            <input
              type="date"
              name="date"
              value={form?.date || ""}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>

          {/* EPBG */}
          <div>
            <Label>EPBG (%)</Label>
            <input
              type="text"
              name="epbg"
              value={form?.epbg || ""}
              onChange={handleChange}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>

          {/* FREIGHT */}
          <div>
            <Label>Freight & Installation</Label>
            <div className="flex gap-2">
              <input
                type="text"
                value="Yes"
                readOnly
                disabled
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50"
              />
              <input
                type="text"
                name="freight_price"
                value={form?.freight_price || "1000"}
                onChange={handleChange}
                disabled={readOnly}
                className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* HDD RETURN OPTION */}
          <div>
            <Label>HDD Return Option</Label>
            <div className="flex gap-2">
              <select
                name="hddreturnable"
                value={form?.hddreturnable || ""}
                onChange={handleChange}
                disabled={readOnly}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
              >
                <option value="Yes">Yes</option>
                <option value="None">None</option>
              </select>
              <input
                type="text"
                name="hddreturnable_price"
                value={form?.hddreturnable_price || ""}
                onChange={handleChange}
                disabled={readOnly}
                placeholder="Price"
                className="w-24 border border-gray-300 rounded-md px-2 py-2 text-sm disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* 
            Admin Note — form ke andar bhi dikhao (non re-analyze cases ke liye)
            Re-analyze pe upar banner already show ho raha hai,
            yahan bhi show karo taaki scroll karte waqt bhi visible rahe
          */}
          {/* {form?.admin_note && (
            <div className="md:col-span-2 lg:col-span-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <label className="block text-sm font-bold text-amber-800 mb-2">
                🗒️ Admin Review Note
              </label>
              <textarea
                value={form.admin_note}
                readOnly
                rows={3}
                className="w-full border border-amber-200 rounded-md px-3 py-2 text-sm resize-none outline-none bg-amber-50 text-amber-900"
              />
            </div>
          )} */}

        </div>

        {/* BUTTONS */}
        <div className="mt-8 mb-10 flex gap-3">
          {!readOnly && (
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition"
            >
              {submitting ? "Saving..." : "Update & Send to Admin"}
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