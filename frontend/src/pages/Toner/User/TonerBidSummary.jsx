// Same shape as AIO's AioBidSummary.jsx, adapted for Toner: no per-field
// pricing exists at the Config step (only bid-level unit_price/total_price),
// so this is a single Field/Value "Selected Configuration" table instead of
// AIO's Component/Selected/Price table, plus an Other Details table — no
// separate Description Details table either (Toner has no free-text
// description fields the way AIO's pro_descp/software1/gp do).
const CONFIG_FIELDS = [
  { key: "brand", label: "Brand" },
  { key: "cartridge_type", label: "Cartridge Type" },
  { key: "product_class", label: "Product Class" },
  { key: "colour", label: "Colour" },
  { key: "technology", label: "Technology" },
  { key: "compatibility", label: "Compatibility" },
  { key: "page_yield", label: "Page Yield" },
  { key: "yield_standard", label: "Yield Standard" },
  { key: "chip", label: "Chip" },
  { key: "print_coverage", label: "Print Coverage" },
  { key: "warranty", label: "Warranty" },
  { key: "warranty_type", label: "Warranty Type" },
  { key: "refillable", label: "Refillable" },
  { key: "qty_per_pack", label: "Quantity per Pack" },
  { key: "hsn_code", label: "HSN Code" },
  { key: "compliance", label: "Compliance" },
  { key: "replacement_policy", label: "Replacement Policy" },
];

const OTHER_FIELDS = [
  { key: "date", label: "Bid End Date" },
  { key: "unit_price", label: "Unit Price" },
];

const formatValue = (val) => {
  if (val === undefined || val === null || val === "") return "—";
  return val;
};

export default function TonerBidSummary({ bidData, onNext, onBack }) {
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
            Toner Configuration
          </h6>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="px-4 py-2 text-left font-semibold w-1/3">Field</th>
              <th className="px-4 py-2 text-left font-semibold">Selected</th>
            </tr>
          </thead>

          <tbody>
            {CONFIG_FIELDS.map((field, idx) => (
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
