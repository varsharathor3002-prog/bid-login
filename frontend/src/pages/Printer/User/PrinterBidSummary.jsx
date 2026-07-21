import React from "react";

const SUMMARY_FIELDS = [
  { key: "cartridge_technology", label: "Cartridge Technology" },
  { key: "printing_technology", label: "Printing Technology" },
  { key: "type_of_printing", label: "Type of Printing" },
  { key: "operating_system_compatibility", label: "Operating System Compatibility" },
  { key: "mono_print_speed_ppm", label: "Minimum Print Speed A4 Monochrome (Black) (PPM)" },
  { key: "colour_print_speed_ppm", label: "Minimum Print Speed A4 Colour (PPM)" },
  { key: "auto_duplexing", label: "Auto Duplexing Printing/Copying" },
  { key: "main_paper_tray_count", label: "Number of Main Paper Tray" },
  { key: "total_paper_tray_capacity", label: "Total Main Paper Tray Combined Capacity" },
  { key: "bypass_tray_facility", label: "Bypass Tray Facility" },
  { key: "bypass_tray_capacity", label: "Bypass Tray Capacity" },
  { key: "connectivity", label: "Connectivity" },
  { key: "duty_cycle", label: "Duty Cycle" },
  { key: "onsite_warranty", label: "On Site Warranty" },
  { key: "extended_warranty", label: "Extended Warranty" },
  { key: "freightInstallation", label: "Freight and Installation" },
];

const MULTIFUNCTION_FIELDS = [
  { key: "fax_availability", label: "Availability of Fax", after: "type_of_printing" },
  { key: "reduction_enlarge_features", label: "Reduction and Enlarge Features", after: "auto_duplexing" },
  { key: "max_scan_area", label: "Maximum Scan Area", after: "reduction_enlarge_features" },
  { key: "a4_scan_speed_colour", label: "A4 Scan Speed Colour", after: "max_scan_area" },
  { key: "scan_to_functions", label: "Scan To Functions", after: "a4_scan_speed_colour" },
  { key: "document_feeder_type", label: "Original Document Feeder Type", after: "scan_to_functions" },
  { key: "feeder_capacity", label: "Feeder Capacity", after: "document_feeder_type" },
];

const OTHER_FIELDS = [
  { key: "date", label: "Bid End Date" },
  { key: "epbg", label: "EPBG (%)" },
];

const DESCRIPTION_FIELDS = [
  { key: "extra_requirements", label: "Extra Requirements" },
  { key: "atc", label: "ATC Details" },
];

const formatValue = (val) => {
  if (val === undefined || val === null || val === "") return "-";
  return val;
};

export default function PrinterBidSummary({ bidData, onNext, onBack, productMode = "printer" }) {
  const data = bidData || {};
  const summaryFields = productMode !== "multifunction"
    ? SUMMARY_FIELDS
    : MULTIFUNCTION_FIELDS.reduce((fields, field) => {
        const insertAt = fields.findIndex((item) => item.key === field.after) + 1;
        fields.splice(insertAt, 0, { key: field.key, label: field.label });
        return fields;
      }, [...SUMMARY_FIELDS]);

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
            Printer Configuration
          </h6>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="px-4 py-2 text-left font-semibold w-1/3">Component</th>
              <th className="px-4 py-2 text-left font-semibold">Selected</th>
            </tr>
          </thead>
          <tbody>
            {summaryFields.map((field, idx) => (
              <tr key={field.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
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
              <tr key={field.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
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
              <tr key={field.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
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
