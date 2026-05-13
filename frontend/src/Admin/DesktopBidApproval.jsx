import { useEffect, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";

const TABS = [
  {
    id: "pending",
    label: "Pending",
    icon: "⏳",
    color: "text-amber-600",
    border: "border-amber-600",
  },
  {
    id: "re-analyze",
    label: "Re-Analyze",
    icon: "⚠️",
    color: "text-rose-600",
    border: "border-rose-600",
  },
  {
    id: "approved",
    label: "Approved",
    icon: "✅",
    color: "text-emerald-600",
    border: "border-emerald-600",
  },
];

const PriceField = ({
  label,
  name,
  priceName,
  form,
  handleChange,
  isTextArea = false,
  optional = false,
}) => {
  return (
    <div className="col-span-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>

        {optional && (
          <span className="text-red-500 text-[11px]">
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
            rows={2}
            autoComplete="off"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <input
            type="text"
            name={name}
            value={form?.[name] || ""}
            onChange={handleChange}
            autoComplete="off"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {priceName && (
          <input
            type="text"
            name={priceName}
            value={form?.[priceName] || ""}
            onChange={handleChange}
            autoComplete="off"
            placeholder="Price"
            className="w-28 border border-blue-300 rounded-md px-2 py-2 text-sm text-center bg-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>
    </div>
  );
};

export default function DesktopBidApproval() {
  const [activeTab, setActiveTab] = useState("pending");
  const [bids, setBids] = useState([]);
  const [reAnalyzeCount, setReAnalyzeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchBids();
    fetchReAnalyzeCount();
  }, [activeTab]);

  const getAnalyserName = (bid) => {
    return (
      bid.analyser_name ||
      bid.analyzer_name ||
      bid.analyser ||
      bid.analyzer ||
      bid.analysed_by ||
      bid.analyzed_by ||
      bid.created_by ||
      bid.user_name ||
      "-"
    );
  };

  const fetchBids = async () => {
    setLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/desktop-bids/list/?status=${activeTab}&role=admin`
      );

      if (!res.ok) throw new Error("Failed");

      const data = await res.json();

      const normalized = data.map((bid) => ({
        ...bid,
        analyser_display_name:
          bid.analyser_name ||
          bid.analyzer_name ||
          bid.analyser ||
          bid.analyzer ||
          bid.analysed_by ||
          bid.analyzed_by ||
          bid.created_by ||
          bid.user_name ||
          "-",
        model_number: bid.model_number || bid.model || "",
        ssd1: bid.ssd1 || bid.ssd || "",
        ssd1_price: bid.ssd1_price || bid.ssd_price || "",
        upload_document:
          bid.upload_document ||
          bid.document ||
          bid.bid_document ||
          "",
        compliance_file:
          bid.compliance_file ||
          bid.compliance_document ||
          "",
        atc: bid.atc || "",
      }));

      setBids(normalized);
    } catch (error) {
      console.log(error);
      setBids([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchReAnalyzeCount = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/desktop-bids/list/?status=re-analyze&role=admin`
      );

      if (!res.ok) throw new Error("Failed");

      const data = await res.json();

      setReAnalyzeCount(Array.isArray(data) ? data.length : 0);
    } catch (error) {
      console.log(error);
      setReAnalyzeCount(0);
    }
  };

  const openModal = (bid) => {
    const formattedBid = {
      ...bid,
      analyser_display_name: getAnalyserName(bid),
    };

    if (
      formattedBid.upload_document &&
      !formattedBid.upload_document.startsWith("http")
    ) {
      formattedBid.upload_document =
        `http://127.0.0.1:8000${formattedBid.upload_document}`;
    }

    if (
      formattedBid.compliance_file &&
      !formattedBid.compliance_file.startsWith("http")
    ) {
      formattedBid.compliance_file =
        `http://127.0.0.1:8000${formattedBid.compliance_file}`;
    }

    setSelected(formattedBid);

    setForm({
      ...formattedBid,
    });

    setAdminNote(formattedBid.admin_note || "");

    setMsg("");
  };

  const closeModal = () => {
    setSelected(null);
    setForm({});
    setAdminNote("");
    setMsg("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDownload = async (fileUrl) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = blobUrl;
      link.download =
        fileUrl.split("/").pop() || "document";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert("File download failed");
    }
  };

  const handleAction = async (action) => {
    setSubmitting(true);
    setMsg("");

    try {
      const formData = new FormData();

      Object.keys(form).forEach((key) => {
        formData.append(key, form[key] || "");
      });

      formData.append("ssd", form.ssd1 || "");
      formData.append("ssd_price", form.ssd1_price || "");
      formData.append("status", action);
      formData.append("admin_note", adminNote);
      formData.append(
        "admin_username",
        localStorage.getItem("username") || ""
      );

      const res = await fetch(
        `${API_BASE}/desktop-bids/${form.id}/admin-review/`,
        {
          method: "PATCH",
          body: formData,
        }
      );

      const data = await res.json();

      if (res.ok) {
        setMsg(
          action === "approved"
            ? "✅ Bid Approved Successfully!"
            : "⚠️ Sent back to Analyser"
        );

        setTimeout(() => {
          closeModal();
          fetchBids();
          fetchReAnalyzeCount();
        }, 1200);
      } else {
        setMsg(data.error || "Something went wrong");
      }
    } catch (error) {
      console.log(error);
      setMsg("Server error");
    } finally {
      setSubmitting(false);
    }
  };

  const StatusBadge = ({ status }) => {
    if (status === "approved") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
          ✅ Approved
        </span>
      );
    }

    if (status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
          ⏳ Pending
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
        ⚠️ Re-Analyze
      </span>
    );
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex gap-3 px-6 pt-3 bg-gray-50 border-b border-gray-200 overflow-visible">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[52px] px-4 py-3 text-sm font-semibold transition-all flex items-center gap-2 rounded-t-lg border-b-2 ${
              activeTab === tab.id
                ? `${tab.color} ${tab.border} bg-white shadow-sm`
                : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-white"
            }`}
          >
            <span>{tab.icon}</span>

            <span>{tab.label}</span>

            {tab.id === "re-analyze" && reAnalyzeCount > 0 && (
              <span className="ml-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center leading-none shadow-sm">
                {reAnalyzeCount > 99 ? "99+" : reAnalyzeCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-20 text-center text-gray-400">
          Loading...
        </div>
      ) : bids.length === 0 ? (
        <div className="p-20 text-center text-gray-400">
          No records found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800">
                {[
                  "S.No",
                  "Analyser",
                  "Department",
                  "Bid No",
                  "Model",
                  "Status",
                  "Action",
                ].map((head) => (
                  <th
                    key={head}
                    className="px-5 py-4 text-[11px] font-bold text-white uppercase"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {bids.map((bid, i) => (
                <tr key={bid.id} className="border-b">
                  <td className="px-5 py-4">
                    {i + 1}
                  </td>

                  <td className="px-5 py-4">
                    {bid.analyser_display_name}
                  </td>

                  <td className="px-5 py-4">
                    {bid.dept_name}
                  </td>

                  <td className="px-5 py-4 text-blue-600 font-semibold">
                    {bid.bid_no}
                  </td>

                  <td className="px-5 py-4">
                    {bid.model_number}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={bid.status} />
                  </td>

                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => openModal(bid)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-xs font-semibold"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Review & Update Desktop
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Bid No:
                  <span className="text-blue-600 font-semibold ml-1">
                    {selected.bid_no}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="text-2xl text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            {msg && (
              <div className="mx-6 mt-4">
                <div
                  className={`px-4 py-3 rounded-md text-sm font-medium ${
                    msg.includes("✅")
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {msg}
                </div>
              </div>
            )}

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bid Number
                  </label>

                  <input
                    type="text"
                    name="bid_no"
                    value={form?.bid_no || ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Analyser
                  </label>

                  <input
                    type="text"
                    name="analyser_display_name"
                    value={form?.analyser_display_name || ""}
                    readOnly
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model Number
                  </label>

                  <input
                    type="text"
                    name="model_number"
                    value={form?.model_number || ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>

                  <input
                    type="text"
                    name="dept_name"
                    value={form?.dept_name || ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>

                  <input
                    type="text"
                    name="qty"
                    value={form?.qty || ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pincode
                  </label>

                  <input
                    type="text"
                    name="pincode"
                    value={form?.pincode || ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bid Date
                  </label>

                  <input
                    type="date"
                    name="date"
                    value={form?.date || ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>

                  <textarea
                    name="address"
                    value={form?.address || ""}
                    onChange={handleChange}
                    rows={2}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ATC
                  </label>

                  <textarea
                    name="atc"
                    value={form?.atc || ""}
                    onChange={handleChange}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Uploaded Document
                  </label>

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
                        onClick={() =>
                          handleDownload(form.upload_document)
                        }
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

                <PriceField label="Processor" name="processor" priceName="processor_price" form={form} handleChange={handleChange} />
                <PriceField label="RAM" name="ram" priceName="ram_price" form={form} handleChange={handleChange} />
                <PriceField label="Hard Disk Drive" name="hdd" priceName="hdd_price" form={form} handleChange={handleChange} />
                <PriceField label="Solid State Drive 1" name="ssd1" priceName="ssd1_price" form={form} handleChange={handleChange} />
                <PriceField label="Solid State Drive 2" name="ssd2" priceName="ssd2_price" form={form} handleChange={handleChange} />
                <PriceField label="OS" name="os" priceName="os_price" form={form} handleChange={handleChange} />
                <PriceField label="DVD" name="dvd" priceName="dvd_price" form={form} handleChange={handleChange} />
                <PriceField label="WiFi Bluetooth" name="wifi" priceName="wifi_price" form={form} handleChange={handleChange} />
                <PriceField label="Monitor" name="monitor" priceName="monitor_price" form={form} handleChange={handleChange} />
                <PriceField label="Cabinet" name="cabinet" priceName="cabinet_price" form={form} handleChange={handleChange} />
                <PriceField label="Keyboard & Mouse" name="keyboard" priceName="keyboard_price" form={form} handleChange={handleChange} />
                <PriceField label="Warranty" name="warranty" priceName="warranty_price" form={form} handleChange={handleChange} />
                <PriceField label="Motherboard" name="motherboard" priceName="motherboard_price" form={form} handleChange={handleChange} />
                <PriceField label="Processor Description" name="pro_descp" isTextArea optional form={form} handleChange={handleChange} />
                <PriceField label="Software Description" name="software1" isTextArea optional form={form} handleChange={handleChange} />
                <PriceField label="Graphics Description" name="gp" isTextArea optional form={form} handleChange={handleChange} />
                <PriceField label="Motherboard Description" name="motherboard_descp" isTextArea optional form={form} handleChange={handleChange} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    EPBG (%)
                  </label>

                  <input
                    type="text"
                    name="epbg"
                    value={form?.epbg || ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Freight & Installation
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value="Yes"
                      readOnly
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50"
                    />

                    <input
                      type="text"
                      name="freight_price"
                      value={form?.freight_price || ""}
                      onChange={handleChange}
                      placeholder="Price"
                      className="w-28 border border-blue-300 rounded-md px-2 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    HDD Return Option
                  </label>

                  <div className="flex gap-2">
                    <select
                      name="hddreturnable"
                      value={form?.hddreturnable || ""}
                      onChange={handleChange}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Yes">Yes</option>
                      <option value="None">None</option>
                    </select>

                    <input
                      type="text"
                      name="hddreturnable_price"
                      value={form?.hddreturnable_price || ""}
                      onChange={handleChange}
                      placeholder="Price"
                      className="w-28 border border-blue-300 rounded-md px-2 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {selected.status !== "approved" && (
                  <div className="md:col-span-2 lg:col-span-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <label className="block text-sm font-bold text-amber-800 mb-2">
                      Admin Review Note
                    </label>

                    <textarea
                      value={adminNote}
                      onChange={(e) =>
                        setAdminNote(e.target.value)
                      }
                      rows={3}
                      placeholder="Write review note..."
                      className="w-full border border-amber-200 rounded-md px-3 py-2 text-sm resize-none outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="mt-8 flex gap-3 flex-wrap">
                {selected.status === "pending" && (
                  <>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        handleAction("approved")
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition"
                    >
                      {submitting
                        ? "Processing..."
                        : "✅ Approve Bid"}
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        handleAction("re-analyze")
                      }
                      className="bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition"
                    >
                      {submitting
                        ? "Processing..."
                        : "⚠️ Send to Re-Analyze"}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-8 py-2.5 rounded-md text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}