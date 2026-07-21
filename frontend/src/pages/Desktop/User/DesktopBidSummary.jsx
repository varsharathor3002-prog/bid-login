
const SUMMARY_FIELDS = [
  { key: "processor", label: "Processor", priceKey: "processor_price" },
  { key: "motherboard", label: "Motherboard", priceKey: "motherboard_price" },
  { key: "ram", label: "RAM", priceKey: "ram_price" },
  { key: "hdd", label: "Hard Disk Drive", priceKey: "hdd_price" },
  { key: "ssd", label: "SSD 1", priceKey: "ssd_price" },
  { key: "ssd2", label: "SSD 2", priceKey: "ssd2_price" },
  { key: "os", label: "Operating System", priceKey: "os_price" },
  { key: "dvd", label: "DVD", priceKey: "dvd_price" },
  { key: "wifi", label: "Wi-Fi Bluetooth", priceKey: "wifi_price" },
  { key: "monitor", label: "Monitor", priceKey: "monitor_price" },
  { key: "cabinet", label: "Cabinet", priceKey: "cabinet_price" },
  { key: "keyboard", label: "Keyboard & Mouse", priceKey: "keyboard_price" },
  { key: "warranty", label: "Warranty", priceKey: "warranty_price" },
  { key: "hddreturnable", label: "HDD Return Option", priceKey: "hddreturnable_price" },
  { key: "freightInstallation", label: "Freight & Installation", priceKey: "freightInstallation_price" },
];

const OTHER_FIELDS = [
  { key: "date", label: "Bid End Date" },
  { key: "epbg", label: "EPBG (%)" },
];

const DESCRIPTION_FIELDS = [
  { key: "pro_descp", label: "Processor Description" },
  { key: "software1", label: "Additional Software" },
   { key: "gp", label: "Graphics Description" },
  { key: "motherboard_descp", label: "Motherboard Description" },
];

const formatValue = (val) => {
  if (val === undefined || val === null || val === "") return "—";
  return val;
};

const formatPrice = (val) => {
  if (val === undefined || val === null || val === "" || isNaN(Number(val))) {
    return "—";
  }

  return `₹${Number(val).toLocaleString("en-IN")}`;
};

export default function DesktopBidSummary({ bidData, onNext, onBack }) {
  const data = bidData || {};

  const handleNextClick = () => {
    if (onNext) onNext({ ...data });
  };

  const handleBackClick = () => {
    if (onBack) onBack({ ...data });
  };

  return (
    <div className="container mx-auto px-4 mt-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-4 pt-2 border-b pb-2">

        <h5 className="text-lg font-semibold text-gray-800">
          Bid Products at a Glance
        </h5>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
          <h6 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Desktop Configuration
          </h6>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="px-4 py-2 text-left font-semibold w-1/3">
                Component
              </th>
              <th className="px-4 py-2 text-left font-semibold">
                Selected
              </th>
              <th className="px-4 py-2 text-right font-semibold w-40">
                Price
              </th>
            </tr>
          </thead>

          <tbody>
            {SUMMARY_FIELDS.map((field, idx) => (
              <tr
                key={field.key}
                className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="px-4 py-2.5 font-medium text-gray-600 border-t border-gray-100">
                  {field.label}
                </td>

                <td className="px-4 py-2.5 text-gray-800 border-t border-gray-100 whitespace-pre-wrap break-words">
                  {formatValue(data[field.key])}
                </td>

                <td className="px-4 py-2.5 text-right text-gray-700 border-t border-gray-100">
                  {formatPrice(data[field.priceKey])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
          <h6 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Other Details
          </h6>
        </div>

        <table className="w-full text-sm">
          <tbody>
            {OTHER_FIELDS.map((field, idx) => (
              <tr
                key={field.key}
                className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="px-4 py-2.5 font-medium text-gray-600 w-1/3 border-t border-gray-100">
                  {field.label}
                </td>

                <td className="px-4 py-2.5 text-gray-800 border-t border-gray-100">
                  {formatValue(data[field.key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
          <h6 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Description Details
          </h6>
        </div>

        <table className="w-full text-sm">
          <tbody>
            {DESCRIPTION_FIELDS.map((field, idx) => (
              <tr
                key={field.key}
                className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="px-4 py-2.5 font-medium text-gray-600 w-1/3 align-top border-t border-gray-100">
                  {field.label}
                </td>

                <td className="px-4 py-2.5 text-gray-800 border-t border-gray-100 whitespace-pre-wrap break-words">
                  {formatValue(data[field.key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mb-10">
        <button
          type="button"
          onClick={handleBackClick}
          className="flex items-center gap-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold px-6 py-2.5 rounded-md text-sm transition"
        >
          Back & Edit
        </button>

        <button
          type="button"
          onClick={handleNextClick}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2.5 rounded-md text-sm transition shadow-lg active:scale-95"
        >
          Next
        </button>
      </div>
    </div>
  );
}
