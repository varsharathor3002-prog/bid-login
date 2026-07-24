import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL;

const CARTRIDGE_TECHNOLOGIES = [
  { name: "Separate Toner Drum " },
  { name: "Composite Cartridge" },
];

const PRINTING_TECHNOLOGIES = [
  { name: "Electrophotography/Xerography (Laser/LED)" },
];

const TYPE_OF_PRINTING = [
  { name: "Monochrome" },
  { name: "Colour" },
];

const FAX_OPTIONS = [
  { name: "Yes" },
  { name: "No" },
];

const OPERATING_SYSTEM_COMPATIBILITY = [
  { name: "Select All" },
  { name: "Linux" },
  { name: "Windows" },
  { name: "Mac OS" },
  { name: "Microsoft Windows Server" },
];

const MONO_PPM_LASER = [
  { name: "5 to 9" },
  { name: "10 to 14" },
  { name: "15 to 19" },
  { name: "20 to 24" },
  { name: "25 to 29" },
  { name: "30 to 34" },
  { name: "35 to 39" },
  { name: "40 to 44" },
  { name: "45 to 49" },
  { name: "50 to 54" },
];

const COLOUR_PPM_LASER = [
  ...MONO_PPM_LASER,
];

const AUTO_DUPLEXING = [
  { name: "Yes" },
  { name: "No" },
];

const REDUCTION_ENLARGE_FEATURES = [
  { name: "Yes" },
  { name: "No" },
];

const SCAN_AREA = [
  { name: "A4" },
  { name: "A4 and Legal" },
];

const A4_SCAN_SPEED_COLOUR = [
  { name: "Not Applicable" },
  { name: "1 to 5" },
  { name: "6 to 10" },
  { name: "11 to 20" },
  { name: "21 to 30" },
  { name: "31 to 40" },
  { name: "41 to 50" },
  { name: "51 to 60" },
  { name: "61 to 70" },
  { name: "71 to 80" },
];

const SCAN_TO_FUNCTIONS = [
  { name: "Select All" },
  { name: "Folder" },
  { name: "Email" },
  { name: "Scan to Local Computer" },

];

const DOCUMENT_FEEDER = [
  { name: "Platen" },
  { name: "Automatic Document Feeder (ADF)" },
  { name: "Reverse/Duplex Automatic Document Feeder (RADF/DADF)" },
  { name: "Single-Pass Document Feeder (SPDF)" },
];

const FEEDER_CAPACITY = [
  { name: "1 to 10" },
  { name: "11 to 20" },
  { name: "21 to 30" },
  { name: "31 to 40" },
  { name: "41 to 50" },
  { name: "51 to 100" },
  { name: "101 to 150" },
  { name: "151 to 200" },
  { name: "201 to 250" },
  { name: "251 to 300" },
];

const PAPER_TRAY = [
  { name: "1" },
  { name: "2" },
  { name: "3" },
  { name: "4" },
];

const TOTAL_PAPER_TRAY_CAPACITY = [
  { name: "50 to 100" },
  { name: "101 to 200" },
  { name: "201 to 300" },
  { name: "301 to 400" },
  { name: "401 to 500" },
  { name: "501 to 1000" },
  { name: "1001 to 2000" },
  { name: "2001 to 3000" },
];

const BYPASS_TRAY_FACILITY = [
  { name: "Yes" },
  { name: "No" },
];

const BYPASS_TRAY_CAPACITY = [
  { name: "1 to 49" },
  { name: "50 to 99" },
  { name: "101 to 149" },
  { name: "150 to 199" },
  { name: "200 to 249" },
  { name: "250 to 299" },
  { name: "300 to 399" },
  { name: "400 to 449" },
  { name: "450 to 499" },
];

const CONNECTIVITY = [
  { name: "Select All" },
  { name: "USB Port" },
  { name: "Ethernet" },
  { name: "Wi-Fi" },
];

const DUTY_CYCLE = [
  { name: "1000 to 1999" },
  { name: "2000 to 2999" },
  { name: "3000 to 3999" },
  { name: "4000 to 4999" },
  { name: "5000 to 9999" },
  { name: "10000 to 19999" },
  { name: "20000 to 29999" },
  { name: "30000 to 49999" },
  { name: "50000 to 79999" },
  { name: "80000 to 99999" },
  { name: "100000 to 199999" },
];

const ONSITE_WARRANTY = [
  { name: "1" },
  { name: "2" },
  { name: "3" },
  { name: "4" },
  { name: "5" },
];

const EXTENDED_WARRANTY = [
  { name: "1" },
  { name: "2" },
  { name: "3" },
  { name: "4" },
  { name: "5" },
];

const INITIAL_FORM = {
  cartridge_technology: "",
  printing_technology: "",
  type_of_printing: "",
  fax_availability: "",
  operating_system_compatibility: "",
  mono_print_speed_ppm: "",
  colour_print_speed_ppm: "",
  auto_duplexing: "",
  reduction_enlarge_features: "",
  printer_type: "",
  max_scan_area: "",
  a4_scan_speed_colour: "",
  scan_to_functions: "",
  document_feeder_type: "",
  feeder_capacity: "",
  main_paper_tray_count: "",
  total_paper_tray_capacity: "",
  bypass_tray_facility: "",
  bypass_tray_capacity: "",
  connectivity: "",
  duty_cycle: "",
  onsite_warranty: "",
  extended_warranty: "",
  date: "",
  extra_requirements: "",
  epbg: "",
  freightInstallation: "Yes",
};

const getDraftKey = (bidId, productMode = "printer") => `${productMode}_printer_config_draft_${bidId || "new"}`;

const normalizeInitialForm = (source = {}) => ({
  ...INITIAL_FORM,
  ...source,
  freightInstallation:
    source.freightInstallation || INITIAL_FORM.freightInstallation,
});

const SectionTitle = ({ children }) => (
  <div className="col-span-1 md:col-span-2">
    <label className="mb-2 block text-sm font-medium text-gray-700 underline">
      {children}
    </label>
  </div>
);

export default function PrinterConfig({ bidData, onNext, onBack, productMode = "printer" }) {
  const isMultifunction = productMode === "multifunction";
  const routePrinterType = isMultifunction ? "Multifunction Printer" : "Printer";
  const bid_id = bidData?.bid_id;
  const draftKey = useMemo(() => getDraftKey(bid_id, productMode), [bid_id, productMode]);

  const [form, setForm] = useState(() => {
    try {
      const savedDraft = localStorage.getItem(getDraftKey(bid_id, productMode));
      if (savedDraft) {
        return { ...normalizeInitialForm(JSON.parse(savedDraft)), printer_type: routePrinterType };
      }
    } catch (error) {
      console.warn("Unable to restore printer configuration draft", error);
    }

    return {
      ...normalizeInitialForm(bidData?.printer_config || bidData?.configuration || bidData || {}),
      printer_type: routePrinterType,
    };
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [openMultiSelect, setOpenMultiSelect] = useState("");

  useEffect(() => {
    if (!openMultiSelect) return undefined;

    const closeOutside = (event) => {
      const dropdown = event.target.closest("[data-multiselect-root]");
      if (dropdown?.dataset.multiselectRoot !== openMultiSelect) {
        setOpenMultiSelect("");
      }
    };

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [openMultiSelect]);

  useEffect(() => {
    setForm((prev) => {
      try {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) return { ...normalizeInitialForm(JSON.parse(savedDraft)), printer_type: routePrinterType };
      } catch (error) {
        console.warn("Unable to restore printer configuration draft", error);
      }

      return { ...normalizeInitialForm({ ...bidData, ...prev }), printer_type: routePrinterType };
    });
  }, [bidData, draftKey, routePrinterType]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      console.warn("Unable to save printer configuration draft", error);
    }
  }, [draftKey, form]);

  const handleBackClick = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch (error) {
      console.warn(
        "Unable to save printer configuration draft before going back",
        error
      );
    }

    if (onBack) {
      onBack({ ...form });
    } else {
      window.history.back();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (name === "bypass_tray_facility") {
        return {
          ...prev,
          bypass_tray_facility: value,
          bypass_tray_capacity:
            value === "No"
              ? "NA"
              : prev.bypass_tray_capacity === "NA"
                ? ""
                : prev.bypass_tray_capacity,
        };
      }
      if (name !== "type_of_printing") return { ...prev, [name]: value };
      if (value === "Monochrome") {
        return {
          ...prev,
          type_of_printing: value,
          mono_print_speed_ppm: prev.mono_print_speed_ppm === "Not Applicable" ? "" : prev.mono_print_speed_ppm,
          colour_print_speed_ppm: "Not Applicable",
        };
      }
      if (value === "Colour") {
        return {
          ...prev,
          type_of_printing: value,
          mono_print_speed_ppm: prev.mono_print_speed_ppm === "Not Applicable" ? "" : prev.mono_print_speed_ppm,
          colour_print_speed_ppm: prev.colour_print_speed_ppm === "Not Applicable" ? "" : prev.colour_print_speed_ppm,
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      const payload = { ...form, printer_type: routePrinterType };
      const res = await fetch(`${API_BASE}/printer-bids/${bid_id}/update/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMsg("Data Saved Successfully");
        localStorage.removeItem(draftKey);
        onNext({ ...form, printer_type: routePrinterType });
      } else {
        setMsg("Failed to Save Data");
      }
    } catch (error) {
      console.error(error);
      setMsg("Connection Error - Unable to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  const SelectField = ({ label, name, options, required, optional, suppressNA = false, disabled = false }) => {
    const isMultiSelect = options.some((opt) => opt.name === "Select All");
    const selectableOptions = options.filter((opt) => opt.name !== "Select All");
    const selectedValues = isMultiSelect
      ? String(form[name] || "").split(",").map((value) => value.trim()).filter(Boolean)
      : [];
    const allSelected = isMultiSelect && selectableOptions.length > 0
      && selectableOptions.every((opt) => selectedValues.includes(opt.name));

    const updateMultiValue = (values) => {
      setForm((prev) => ({ ...prev, [name]: values.join(", ") }));
    };

    const removeMultiValue = (value) => {
      updateMultiValue(selectedValues.filter((item) => item !== value));
    };

    const toggleMultiValue = (value, checked) => {
      if (value === "NA") {
        updateMultiValue(checked ? ["NA"] : []);
        return;
      }
      const withoutNA = selectedValues.filter((item) => item !== "NA");
      updateMultiValue(checked
        ? [...withoutNA.filter((item) => item !== value), value]
        : withoutNA.filter((item) => item !== value));
    };

    return <div className="col-span-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {optional && (
          <span className="text-red-500 text-[11px] font-normal">*Optional</span>
        )}
      </div>

      {isMultiSelect ? (
        <div className="relative" data-multiselect-root={name}>
          <button
            type="button"
            onClick={() => setOpenMultiSelect((current) => current === name ? "" : name)}
            className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <span className="flex flex-1 flex-wrap gap-1.5">
              {selectedValues.length ? selectedValues.map((value) => (
                <span key={value} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {value}
                  <span
                    role="button"
                    tabIndex="0"
                    onClick={(event) => { event.stopPropagation(); removeMultiValue(value); }}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.stopPropagation(); removeMultiValue(value); } }}
                    className="text-base leading-none text-blue-500 hover:text-red-600"
                    aria-label={`Remove ${value}`}
                  >×</span>
                </span>
              )) : <span className="px-0.5 text-gray-500">Select options</span>}
            </span>
            <span className={`text-xs text-gray-500 transition ${openMultiSelect === name ? "rotate-180" : ""}`}>▼</span>
          </button>

          {openMultiSelect === name && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-gray-300 bg-white shadow-xl">
              <label className="flex cursor-pointer items-center gap-2 border-b bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => updateMultiValue(event.target.checked ? selectableOptions.map((opt) => opt.name) : [])}
                  className="h-4 w-4 accent-blue-600"
                />
                Select All
              </label>
              {[...selectableOptions.map((opt) => opt.name), ...(suppressNA ? [] : ["NA"])].map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(value)}
                    onChange={(event) => toggleMultiValue(value, event.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  {value}
                </label>
              ))}
            </div>
          )}
        </div>
      ) : (
        <select
          name={name}
          value={form[name]}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="">Select</option>
          {disabled && form[name] && !options.some((opt) => opt.name === form[name]) && (
            <option value={form[name]}>{form[name]}</option>
          )}
          {options.map((opt) => <option key={opt.name} value={opt.name}>{opt.name}</option>)}
          {!suppressNA && !options.some((opt) => opt.name === "Not Applicable") && <option value="NA">NA</option>}
        </select>
      )}
    </div>;
  };

  return (
    <div className="container mx-auto mt-4 max-w-6xl px-4">

      {msg && (
        <div
          className={`mb-4 rounded px-4 py-2 text-sm font-medium ${
            msg.includes("Saved")
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {msg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-10 gap-y-7 md:grid-cols-2 xl:gap-x-14">
          <SectionTitle>General Product Information</SectionTitle>

          <SelectField
            label="Cartridge Technology"
            name="cartridge_technology"
            options={CARTRIDGE_TECHNOLOGIES}
            suppressNA
            required
          />
          <SelectField
            label="Printing Technology"
            name="printing_technology"
            options={PRINTING_TECHNOLOGIES}
            suppressNA
            required
          />
          <SelectField
            label="Type of Printing"
            name="type_of_printing"
            options={TYPE_OF_PRINTING}
            suppressNA
            required
          />
          {isMultifunction && (
            <SelectField
              label="Availability of Fax"
              name="fax_availability"
              options={FAX_OPTIONS}
              suppressNA
              required
            />
          )}
          <SelectField
            label="Operating System Compatibility"
            name="operating_system_compatibility"
            options={OPERATING_SYSTEM_COMPATIBILITY}
            suppressNA
            required
          />

          <SectionTitle>Printing Performance</SectionTitle>

          <SelectField
            label="Minimum Print Speed A4 Monochrome (Black) (PPM) - Laser/LED MFPs"
            name="mono_print_speed_ppm"
            options={MONO_PPM_LASER}
            suppressNA
            required
          />
          <SelectField
            label="Minimum Print Speed A4 Colour (PPM) - Laser/LED MFPs"
            name="colour_print_speed_ppm"
            options={COLOUR_PPM_LASER}
            suppressNA
            disabled={form.type_of_printing === "Monochrome"}
            required
          />

          <SectionTitle>Duplexing and Copying Features</SectionTitle>

          <SelectField
            label="Auto Duplexing Printing/Copying (2-sided Feature)"
            name="auto_duplexing"
            options={AUTO_DUPLEXING}
            suppressNA
            required
          />
          {isMultifunction && (
            <SelectField
              label="Reduction and Enlarge Features"
              name="reduction_enlarge_features"
              options={REDUCTION_ENLARGE_FEATURES}
              suppressNA
              required
            />
          )}
          {isMultifunction && (
            <>
              <SectionTitle>Scanning Capabilities</SectionTitle>
              <SelectField
                label="Maximum Scan Area (Platen/ADF)"
                name="max_scan_area"
                options={SCAN_AREA}
                suppressNA
                required
              />
              <SelectField
                label="A4 Scan Speed Colour (Image Per Minute) @ 200 x 200 DPI"
                name="a4_scan_speed_colour"
                options={A4_SCAN_SPEED_COLOUR}
                required
              />
              <SelectField
                label="Scan To Functions"
                name="scan_to_functions"
                options={SCAN_TO_FUNCTIONS}
                suppressNA
                required
              />
            </>
          )}

          <SectionTitle>Document and Paper Handling</SectionTitle>

          {isMultifunction && (
            <>
              <SelectField
                label="Original Document Feeder Type (For Scanning and Copying)"
                name="document_feeder_type"
                options={DOCUMENT_FEEDER}
                suppressNA
                required
              />
              <SelectField
                label="Feeder Capacity (Number of Sheets)"
                name="feeder_capacity"
                options={FEEDER_CAPACITY}
                suppressNA
                required
              />
            </>
          )}
          <SelectField
            label="Number of Main Paper Tray"
            name="main_paper_tray_count"
            options={PAPER_TRAY}
            suppressNA
            required
          />
          <SelectField
            label="Total Main Paper Tray Combined Capacity (75 GSM)"
            name="total_paper_tray_capacity"
            options={TOTAL_PAPER_TRAY_CAPACITY}
            suppressNA
            required
          />
          <SelectField
            label="Bypass Tray Facility"
            name="bypass_tray_facility"
            options={BYPASS_TRAY_FACILITY}
            suppressNA
            required
          />
          <SelectField
            label="Bypass Tray Capacity (75 GSM)"
            name="bypass_tray_capacity"
            options={BYPASS_TRAY_CAPACITY}
            disabled={form.bypass_tray_facility === "No"}
            required
          />

          <SectionTitle>Connectivity and Reliability</SectionTitle>

          <SelectField
            label="Connectivity"
            name="connectivity"
            options={CONNECTIVITY}
            suppressNA
            required
          />
          <SelectField
            label="Duty Cycle (Prints/Month)"
            name="duty_cycle"
            options={DUTY_CYCLE}
            suppressNA
            required
          />

          <SectionTitle>Certification and Warranty</SectionTitle>

          <SelectField
            label="On Site Warranty (In Year)"
            name="onsite_warranty"
            options={ONSITE_WARRANTY}
            suppressNA
            required
          />
          <SelectField
            label="Extended Warranty (in Years) over and above standard warranty"
            name="extended_warranty"
            options={EXTENDED_WARRANTY}
            required
          />

          <SectionTitle>Other Details</SectionTitle>

          <div className="col-span-1 grid grid-cols-1 gap-7 md:col-span-2 md:grid-cols-3 md:gap-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bid End Date
            </label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              EPBG (%)
            </label>
            <input
              type="text"
              name="epbg"
              value={form.epbg}
              onChange={handleChange}
              placeholder="EPBG %"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Freight and Installation
            </label>
            <select
              name="freightInstallation"
              value={form.freightInstallation}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Yes">Yes</option>
              <option value="None">None</option>
              <option value="NA">NA</option>
            </select>
          </div>
          </div>

          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Extra Requirements
              </label>
              <span className="text-red-500 text-[11px] font-normal">*Optional</span>
            </div>
            <textarea
              name="extra_requirements"
              value={form.extra_requirements}
              onChange={handleChange}
              rows={3}
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Toner yield, Paper capacity, Monthly duty cycle, etc."
            />
          </div>
        </div>

        <div className="flex items-center justify-start">
          <button
            type="submit"
            disabled={saving}
            className="mb-10 mt-8 flex items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 disabled:bg-blue-400 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                Next
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
