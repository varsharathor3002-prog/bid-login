import { useEffect, useRef, useState } from "react";
import img1 from "../../../assets/img1.png";
import img2 from "../../../assets/img2.png";
import img3 from "../../../assets/img3.png";
import printerOm052 from "../../../assets/OMO52.png";
import printerOm271 from "../../../assets/OM271.png";
import printerOm050 from "../../../assets/OMO50.png";
import printerOm035 from "../../../assets/OMO35.png";
import printerOm010 from "../../../assets/OMO10.png";
import printerOm235 from "../../../assets/OM235.png";
import printerOm249 from "../../../assets/OM249.png";
import printerOm221 from "../../../assets/OM221.png";
import printerOm240 from "../../../assets/OM240.png";

const API = "http://127.0.0.1:8000/api";
const FALLBACK_IMAGES = [img1, img2, img3];
const PRINTER_MODEL_IMAGES = {
  OM052: printerOm052,
  OM271: printerOm271,
  OM050: printerOm050,
  OM035: printerOm035,
  OM010: printerOm010,
  OM235: printerOm235,
  OM249: printerOm249,
  OM221: printerOm221,
  OM240: printerOm240,
};

const CATEGORY_OPTIONS = ["Desktop", "AIO", "Workstation", "Printer", "Toner"];

const GEM_SECTIONS = [
  {
    title: "PROCESSOR",
    fields: ["Computer Type", "Processor Number"],
  },
  {
    title: "MOTHERBOARD",
    fields: [
      "Motherboard / Chipset",
      "Expansion Slots (PCIe x 1)",
      "Expansion Slots (PCIe x 4)",
      "Expansion Slots (PCIe x 16)",
      "Expansion Slots (M Dot 2) for SSD",
      "Expansion Slots (M Dot 2) for WiFi",
      "Trusted Platform Module",
    ],
  },
  {
    title: "GRAPHICS",
    fields: [
      "Graphics Type",
      "Graphic Card Make and Model - Must declare",
      "Size of Memory in Case of Dedicated Graphic Card(GB)",
    ],
  },
  {
    title: "OPERATING SYSTEM",
    fields: [
      "Factory Pre-loaded Operating System by DesktopOEM",
      "Recovery Media for OS",
    ],
  },
  {
    title: "MEMORY (RAM)",
    fields: [
      "Type of RAM",
      "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)",
      "Memory Expandable Up To (in GB)",
      "Total Numbers of DIMM Slots Available",
      "Number of DIMM Slots Populated with MemoryCard/Module",
    ],
  },
  {
    title: "STORAGE",
    fields: [
      "Type of Storage Installed with the System",
      "SSD - Storage Capacity (in GB)",
      "HDD - Storage Capacity (in GB)",
    ],
  },
  {
    title: "BAYS AVAILABILITY",
    fields: [
      "Number of Internal Bays Available, Size 2 Point 5 Inch",
      "Number of Internal Bay Populated, Size 2 Point 5Inch",
      "Number of Internal Bays Available, Size 3 Point 5 inch",
      "Number of Internal Bay Populated, Size 3 Point 5inch",
    ],
  },
  {
    title: "CABINET",
    fields: [
      "Cabinet Form Factor",
      "Bays for Optical Drive",
      "Optical Drive",
      "Audio Interface Type",
    ],
  },
  {
    title: "CONNECTIVITY",
    fields: ["Type of Ethernet Ports", "Number of Ethernet Ports"],
  },
  {
    title: "PORTS",
    fields: [
      "Number of USB Type A Port (Version 2 Point 0)",
      "Number of USB Type A Port (Version 3 point 2 Gen 1)",
      "Number of USB Ports Type C",
      "Number of VGA Ports",
      "Number of HDMI Ports",
      "Number of DP Ports",
    ],
  },
  {
    title: "MONITOR",
    fields: [
      "Availibility of Monitor",
      "Panel Type",
      "Display Technology",
      "Screen Size (in CMs)",
      "Maximum Resolution (Pixels)",
      "Image Aspect Ratio",
      "Brightness (in Nits)",
      "Refresh Rate (in Hz)",
      "Monitor Port",
      "Integrated Webcam with Mic",
      "Power Supply for Monitor",
      "Speaker",
    ],
  },
  {
    title: "INPUT DEVICES",
    fields: ["Mouse Connectivity", "Keyboard Connectivity", "Type of Keyboard"],
  },
  {
    title: "WARRANTY",
    fields: ["On Site OEM Warranty (in Year)"],
  },
];

const ALL_SPEC_FIELDS = GEM_SECTIONS.flatMap((section) => section.fields);

const WORKSTATION_SECTIONS = [
  {
    title: "PROCESSOR",
    fields: ["Processor Number"],
  },
  {
    title: "MOTHERBOARD",
    fields: ["Motherboard"],
  },
  {
    title: "MEMORY (RAM)",
    fields: ["RAM"],
  },
  {
    title: "STORAGE",
    fields: ["SSD", "HDD"],
  },
  {
    title: "GRAPHICS",
    fields: ["Graphic Card Make and Model"],
  },
  {
    title: "OPERATING SYSTEM",
    fields: ["Factory Pre-loaded Operating System"],
  },
  {
    title: "MONITOR",
    fields: ["Screen Size"],
  },
  {
    title: "POWER",
    fields: ["Power Supply"],
  },
];

const PRINTER_SECTIONS = [
  {
    title: "GENERAL PRODUCT INFO",
    fields: [
      "Printing Technology",
      "Cartridge Technology",
      "Type of Printing",
      "Availability of Fax",
      "Operating System Compatibility",
    ],
  },
  {
    title: "PRINTING PERFORMANCE",
    fields: [
      "Mono Print Speed (PPM)",
      "Mono Print Speed (IPM)",
      "Colour Print Speed (PPM)",
      "Colour Print Speed (IPM)",
    ],
  },
  {
    title: "DUPLEXING AND COPYING",
    fields: ["Auto Duplexing", "Reduction and Enlarge Features", "Printer Type"],
  },
  {
    title: "SCANNING AND FEEDING",
    fields: [
      "Maximum Scan Area",
      "A4 Scan Speed Colour",
      "Scan To Functions",
      "Document Feeder Type",
      "Feeder Capacity",
    ],
  },
  {
    title: "PAPER HANDLING",
    fields: [
      "Main Paper Tray Count",
      "Total Paper Tray Capacity",
      "Bypass Tray Facility",
      "Bypass Tray Capacity",
    ],
  },
  {
    title: "CONNECTIVITY AND WARRANTY",
    fields: ["Connectivity", "Duty Cycle", "On Site Warranty", "Extended Warranty"],
  },
];

const SPEC_ALIASES = {
  "Expansion Slots (M Dot 2) for SSD": [
    "Expansion Slots (M.2) for SSD",
    "Expansion Slots (M2) for SSD",
  ],
  "Expansion Slots (M Dot 2) for WiFi": [
    "Expansion Slots (M.2) for WiFi",
    "Expansion Slots (M2) for WiFi",
    "Expansion Slots (M Dot 2) for Wifi",
  ],
  "Graphic Card Make and Model - Must declare": [
    "Graphic Card Make and Model",
    "Graphics Card Make and Model",
    "Graphic Card Make and Model Must declare",
  ],
  "Size of Memory in Case of Dedicated Graphic Card(GB)": [
    "Size of Memory in Case of Dedicated Graphic Card (GB)",
    "Size of Memory in Case of Dedicated Graphic Card",
    "Dedicated Graphic Card Memory (GB)",
  ],
  "Factory Pre-loaded Operating System by DesktopOEM": [
    "Factory Pre-loaded Operating System by Desktop OEM",
    "Factory Pre-loaded Operating System by Desktop",
    "Factory Pre-loaded Operating System",
  ],
  "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)": [
    "RAM Size",
    "RAM Size (Memory Card/Module) (in GB) (Capacity to be installed in the System)",
    "RAM Size (Memory Card / Module) (in GB) (Capacity to be installed in the System)",
  ],
  "Number of DIMM Slots Populated with MemoryCard/Module": [
    "Number of DIMM Slots Populated with Memory Card/Module",
    "Number of DIMM Slots Populated with Memory Card / Module",
  ],
  "Number of Internal Bay Populated, Size 2 Point 5Inch": [
    "Number of Internal Bay Populated, Size 2 Point 5 Inch",
    "Number of Internal Bay Populated, Size 2.5 Inch",
  ],
  "Number of Internal Bays Available, Size 3 Point 5 inch": [
    "Number of Internal Bays Available, Size 3 Point 5 Inch",
    "Number of Internal Bays Available, Size 3.5 inch",
    "Number of Internal Bays Available, Size 3.5 Inch",
  ],
  "Number of Internal Bay Populated, Size 3 Point 5inch": [
    "Number of Internal Bay Populated, Size 3 Point 5 inch",
    "Number of Internal Bay Populated, Size 3 Point 5 Inch",
    "Number of Internal Bay Populated, Size 3.5 inch",
    "Number of Internal Bay Populated, Size 3.5 Inch",
  ],
  "Number of USB Type A Port (Version 2 Point 0)": [
    "USB 2.0 Ports",
    "Number of USB Type A Port (Version 2.0)",
    "Number of USB Type A Ports (Version 2 Point 0)",
    "Number of USB Type A Ports (Version 2.0)",
  ],
  "Number of USB Type A Port (Version 3 point 2 Gen 1)": [
    "USB 3.0 Ports",
    "USB 3.2 Ports",
    "Number of USB Type A Port (Version 3.2 Gen 1)",
    "Number of USB Type A Port (Version 3 Point 2 Gen 1)",
    "Number of USB Type A Ports (Version 3 point 2 Gen 1)",
    "Number of USB Type A Ports (Version 3 Point 2 Gen 1)",
  ],
  "Number of USB Ports Type C": ["USB Type C Ports", "Number of USB Type-C Ports"],
  "Number of VGA Ports": ["VGA Port", "VGA Ports"],
  "Number of HDMI Ports": ["HDMI Port", "HDMI Ports"],
  "Number of DP Ports": ["DP Port", "DP Ports", "DisplayPort Ports"],
  "Availibility of Monitor": ["Availability of Monitor", "Monitor Availability"],
  "Screen Size (in CMs)": ["Screen Size", "Screen Size (in cm)", "Screen Size (in CMs.)"],
  "On Site OEM Warranty (in Year)": ["On Site OEM Warranty", "OEM Warranty", "Warranty"],
};

const NORMALIZED_FIELD_LOOKUP = ALL_SPEC_FIELDS.reduce((lookup, field) => {
  lookup[normalizeSpecKey(field)] = field;
  (SPEC_ALIASES[field] || []).forEach((alias) => {
    lookup[normalizeSpecKey(alias)] = field;
  });
  return lookup;
}, {});

const PRODUCT_FIELD_FALLBACKS = {
  "Computer Type": "category",
  "Processor Number": "processor",
  "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)": "ram",
  "Type of Storage Installed with the System": "storage",
  "Factory Pre-loaded Operating System by DesktopOEM": "os",
};

function normalizeSpecKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/desktop\s*oem/g, "desktopoem")
    .replace(/m\s*\.?\s*dot\s*2/g, "m2")
    .replace(/m\s*\.?\s*2/g, "m2")
    .replace(/to\s*be/g, "tobe")
    .replace(/availibility/g, "availability")
    .replace(/memory\s*card\s*\/\s*module/g, "memorycardmodule")
    .replace(/point/g, "")
    .replace(/[.\-_/(),]/g, "")
    .replace(/\s+/g, "");
}

function cleanProcessorNumber(value) {
  const text = String(value || "");
  if (/NA\s+for\s+Base\s+Processor/i.test(text)) {
    return "Processor not specified in Excel";
  }
  return text
    .replace(/\bOut\s+of\s+Band\s+Management\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveRamType(value) {
  const text = String(value || "");
  const match = text.match(/\bDDR\s*([345])\b/i);
  return match ? `DDR${match[1]}` : "";
}

function deriveRamSize(value) {
  const text = String(value || "");
  const match = text.match(/\b(\d+)\s*(?:GB)?\s*DDR/i) || text.match(/\b(\d+)\s*GB\b/i);
  return match ? match[1] : "";
}

function deriveStorageParts(value) {
  const text = String(value || "").trim();
  if (!text) return {};

  const ssdMatch =
    text.match(/SSD\s+Primary\s+Storage\s+Capacity\s*\(in\s*GB\)\s*(\d+)/i) ||
    text.match(/\b(\d+)\s*(?:GB)?\s*(?:NVME|NVMe|SSD)/i) ||
    text.match(/\b(?:NVME|NVMe|SSD)[^\d]*(\d+)/i);

  const hddMatch =
    text.match(/Secondary\s+Storage\s+HDD@[^0-9]*(\d+)/i) ||
    text.match(/\bHDD@[^0-9]*(\d+)/i) ||
    text.match(/\b(\d+)\s*(?:GB)?\s*HDD/i);

  let type = text;
  if (/no\s+secondary/i.test(text)) {
    type = "NVMe-SSD";
  } else if (/HDD@/i.test(text) || /\bHDD\b/i.test(text)) {
    type = "NVMe-SSD Plus HDD";
    const rpm = text.match(/HDD@([0-9]+\s*RPM)/i);
    if (rpm) type = `${type}@${rpm[1].replace(/\s+/g, " ")}`;
  } else if (/Availability\s+of\s+Secondary\s+Storage\s+NVME\s*-\s*SSD/i.test(text)) {
    type = "NVMe-SSD";
  } else if (/NVME|NVMe|SSD/i.test(text)) {
    type = "NVMe-SSD";
  }

  return {
    type,
    ssd: ssdMatch ? ssdMatch[1] : "",
    hdd:
      /no\s+secondary|Secondary\s+Storage\s+NVME\s*-\s*SSD/i.test(text)
        ? "0 as SSD only Installed"
        : hddMatch?.[1] || "",
  };
}

function firstNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? match[0] : "";
}

function extractFromSpecsText(specs, pattern) {
  const combined = Object.values(specs || {})
    .map((value) => String(value || ""))
    .join(" ");
  const match = combined.match(pattern);
  return match ? String(match[1] || "").trim() : "";
}

function extractFromSpecValue(specs, contains, pattern) {
  const value = Object.values(specs || {}).find((item) =>
    String(item || "").toLowerCase().includes(contains.toLowerCase())
  );
  const match = String(value || "").match(pattern);
  return match ? String(match[1] || "").trim() : "";
}

function deriveMotherboardCatalogueValue(field, motherboardValue) {
  const text = String(motherboardValue || "").trim();
  if (!text) return "";

  const firstMatch = (...patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match.slice(1).find(Boolean) || "";
    }
    return "";
  };

  switch (field) {
    case "Expansion Slots (PCIe x 1)":
      return firstMatch(/\bPCI(?:e)?\s*X\s*1(?!\d)\s*[-:]?\s*(\d+)/i);
    case "Expansion Slots (PCIe x 4)":
      return firstMatch(
        /\bPCI(?:e)?\s*X\s*4\s*[-:]?\s*(\d+)/i,
        /\bPCI(?:e)?\s*4\s*X\s*(\d+)/i
      );
    case "Expansion Slots (PCIe x 16)":
      return firstMatch(/\bPCI(?:e)?\s*X\s*16\s*[-:]?\s*(\d+)/i);
    case "Expansion Slots (M Dot 2) for SSD":
      return firstMatch(/\bM\s*[.\-]?\s*2\s*[-:]?\s*(\d+)/i);
    case "Expansion Slots (M Dot 2) for WiFi":
      return /\bM\s*[.\-]?\s*2\b[^,;]*\bWi-?Fi\b/i.test(text) ? "1" : "";
    case "Trusted Platform Module":
      return /\bTPM(?:\s*2(?:\.0)?)?\b/i.test(text) ? "Yes" : "";
    case "Number of USB Type A Port (Version 2 Point 0)":
      return firstMatch(/(\d+)\s*USB\s*2(?:\.0)?\b/i);
    case "Number of USB Type A Port (Version 3 point 2 Gen 1)":
      return firstMatch(/(\d+)\s*USB\s*3(?:\.\d+)?\b/i);
    case "Number of USB Ports Type C":
      return firstMatch(/\bTYPE\s*-?\s*C\s*[-:]?\s*(\d+)/i);
    case "Number of VGA Ports":
      return /\bVGA\b/i.test(text) ? "1" : "";
    case "Number of HDMI Ports":
      return /\bHDMI\b/i.test(text) ? "1" : "";
    case "Number of DP Ports":
      return /\bDP\b|Display\s*Port/i.test(text) ? "1" : "";
    case "Number of Ethernet Ports":
      return /\bEthernet\b|\bLAN\b|\bRJ-?45\b/i.test(text) ? "1" : "";
    case "Total Numbers of DIMM Slots Available":
      return firstMatch(/\b(\d+)\s*DIMM\b/i);
    default:
      return "";
  }
}

function deriveSpecValue(field, product) {
  const storage = deriveStorageParts(product?.storage);

  switch (field) {
    case "Computer Type":
      return product?.category || "";
    case "Processor Number":
      return cleanProcessorNumber(product?.processor);
    case "Type of RAM":
      return deriveRamType(product?.ram);
    case "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)":
      return deriveRamSize(product?.ram);
    case "Type of Storage Installed with the System":
      return storage.type || "";
    case "SSD - Storage Capacity (in GB)":
      return storage.ssd || "";
    case "HDD - Storage Capacity (in GB)":
      return storage.hdd || "";
    case "Factory Pre-loaded Operating System by DesktopOEM":
      return product?.os || "";
    default:
      return "";
  }
}

function shouldReplaceSpecValue(field, value) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (field === "Processor Number") {
    return /\bOut\s+of\s+Band\s+Management\b/i.test(text);
  }
  if (field === "Type of Storage Installed with the System") {
    return /Primary\s+Storage\s+Capacity|Availability\s+of\s+Secondary\s+Storage/i.test(text);
  }
  return false;
}

function cleanSpecFieldValue(field, value, specs, product) {
  const text = cleanDisplayValue(value);
  const storage = deriveStorageParts(product?.storage);
  const motherboardDerived = deriveMotherboardCatalogueValue(
    field,
    specs?.Motherboard
  );
  const useMotherboardDerived =
    motherboardDerived && (!text || /^(?:NA|N\/A|Not Applicable)$/i.test(text));

  if (useMotherboardDerived) {
    return motherboardDerived;
  }

  switch (field) {
    case "Computer Type":
      return text || product?.category || "";
    case "Processor Number":
      return cleanProcessorNumber(text || product?.processor);
    case "Type of RAM":
      return text || deriveRamType(product?.ram);
    case "RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)":
      return firstNumber(text) || deriveRamSize(product?.ram);
    case "Type of Storage Installed with the System":
      return shouldReplaceSpecValue(field, text) ? storage.type || text : text;
    case "SSD - Storage Capacity (in GB)":
      return firstNumber(text) || storage.ssd || "";
    case "HDD - Storage Capacity (in GB)": {
      const capacity = firstNumber(text) || storage.hdd || "";
      const rawStorage = String(product?.storage || "");
      if (
        capacity &&
        new RegExp(`\\b${capacity}\\s*TB\\b`, "i").test(rawStorage)
      ) {
        return String(Number(capacity) * 1000);
      }
      return capacity;
    }
    case "Factory Pre-loaded Operating System by DesktopOEM":
      return (
        text ||
        product?.os ||
        extractFromSpecValue(
          specs,
          "Factory Pre-loaded Operating System",
          /Factory\s+Pre-loaded\s+Operating\s+System(?:\s+by\s+Desktop\s*OEM|\s+by\s+DesktopOEM)?\s+(.+)$/i
        )
      );
    case "Size of Memory in Case of Dedicated Graphic Card(GB)":
      return firstNumber(text);
    case "Number of Ethernet Ports":
      return firstNumber(text);
    case "Number of USB Type A Port (Version 2 Point 0)":
      return (
        firstNumber(text) ||
        extractFromSpecsText(specs, /Number\s+of\s+USB\s+Type\s+A\s+Ports?\s*\(Version\s+2\s+Point\s+0\)\s*(\d+)/i)
      );
    case "Number of USB Type A Port (Version 3 point 2 Gen 1)":
      return (
        firstNumber(text) ||
        extractFromSpecsText(specs, /Number\s+of\s+USB\s+Type\s+A\s+Ports?\s*\(Version\s+3\s+point\s+2\s+Gen\s+1\)\s*(\d+)/i)
      );
    case "Number of USB Ports Type C":
      return firstNumber(text);
    case "Number of DIMM Slots Populated with MemoryCard/Module":
      return firstNumber(text);
    case "Maximum Operating Temperature (in DegreeCelsius)":
      return firstNumber(text);
    case "Operating Humidity(RH) (in Percentage)":
      return (
        text ||
        extractFromSpecsText(
          specs,
          /Operating\s+Humidity\s*\(?RH\)?\s*\(in\s+Percentage\)\s*([0-9]+\s*to\s*[0-9]+)/i
        )
      );
    default:
      return text;
  }
}

function displaySpecValue(value) {
  return cleanDisplayValue(value) || "NA";
}

function displayBasicProcessor(product, specs) {
  return displaySpecValue(specs["Processor Number"] || product?.processor);
}

function displayBasicRam(product, specs) {
  const size = cleanDisplayValue(
    specs["RAM Size (Memory Card/Module) (in GB) (Capacity tobe installed in the System)"]
  );
  const type = cleanDisplayValue(specs["Type of RAM"]);
  return displaySpecValue([size, type].filter(Boolean).join(" ") || product?.ram);
}

function displayBasicStorage(product, specs) {
  const type = cleanDisplayValue(specs["Type of Storage Installed with the System"]);
  const ssd = cleanDisplayValue(specs["SSD - Storage Capacity (in GB)"]);
  const hdd = cleanDisplayValue(specs["HDD - Storage Capacity (in GB)"]);
  // Auto-created bid products already preserve the complete selected storage
  // configuration here. Do not append the capacities a second time.
  if (/\b\d+(?:\.\d+)?\s*(?:GB|TB)\b/i.test(type)) {
    return displaySpecValue(type);
  }
  const parts = [];
  if (type) parts.push(type);
  if (ssd) parts.push(`SSD ${ssd} GB`);
  if (hdd) parts.push(`HDD ${hdd} GB`);
  return displaySpecValue(parts.join(", ") || product?.storage);
}

function displayBasicOs(product, specs) {
  return displaySpecValue(
    specs["Factory Pre-loaded Operating System by DesktopOEM"] || product?.os
  );
}

function cleanDisplayValue(value) {
  let text = String(value ?? "").trim();
  text = text.replace(/\n/g, " ").replace(/\r/g, " ");
  text = text
    .replace(/MonitorSystem/g, "Monitor System")
    .replace(/ProcessorMake/g, "Processor Make")
    .replace(/DesktopOEM/g, "Desktop OEM")
    .replace(/MemoryCard\/Module/g, "Memory Card/Module");
  return text.replace(/\s+/g, " ").trim();
}

function emptySpecs() {
  const obj = {};
  ALL_SPEC_FIELDS.forEach((field) => {
    obj[field] = "";
  });
  return obj;
}

function getExtraSpecs(product) {
  let specs = product?.extra_specs || {};
  if (typeof specs === "string") {
    try {
      specs = JSON.parse(specs);
    } catch {
      specs = {};
    }
  }

  const normalizedSpecs = emptySpecs();

  Object.entries(specs || {}).forEach(([rawKey, rawValue]) => {
    const canonicalKey =
      NORMALIZED_FIELD_LOOKUP[normalizeSpecKey(rawKey)] || rawKey;

    if (ALL_SPEC_FIELDS.includes(canonicalKey)) {
      normalizedSpecs[canonicalKey] = rawValue ?? "";
    }
  });

  ALL_SPEC_FIELDS.forEach((specField) => {
    if (shouldReplaceSpecValue(specField, normalizedSpecs[specField])) {
      normalizedSpecs[specField] = deriveSpecValue(specField, product) || normalizedSpecs[specField];
    }
  });

  Object.entries(PRODUCT_FIELD_FALLBACKS).forEach(([specField, productField]) => {
    if (!String(normalizedSpecs[specField] || "").trim()) {
      normalizedSpecs[specField] = cleanDisplayValue(product?.[productField] || "");
    }
  });

  const specsBeforeCleanup = {
    ...normalizedSpecs,
    Motherboard: specs?.Motherboard || specs?.motherboard || "",
  };

  ALL_SPEC_FIELDS.forEach((specField) => {
    normalizedSpecs[specField] = cleanSpecFieldValue(
      specField,
      normalizedSpecs[specField],
      specsBeforeCleanup,
      product
    );
  });

  return normalizedSpecs;
}

function isWorkstationProduct(product) {
  return String(product?.category || "").toLowerCase() === "workstation" ||
    String(product?.id || "").toLowerCase().startsWith("workstation-");
}

function getRawExtraSpecs(product) {
  let specs = product?.extra_specs || {};
  if (typeof specs === "string") {
    try {
      specs = JSON.parse(specs);
    } catch {
      specs = {};
    }
  }
  return specs || {};
}

function getWorkstationSpecs(product) {
  const raw = getRawExtraSpecs(product);
  return {
    "Processor Number": cleanDisplayValue(raw["Processor Number"] || product?.processor),
    "Motherboard": cleanDisplayValue(raw.Motherboard || product?.motherboard),
    "RAM": cleanDisplayValue(raw.RAM || product?.ram),
    "SSD": cleanDisplayValue(raw.SSD || product?.ssd),
    "HDD": cleanDisplayValue(raw.HDD || product?.hdd),
    "Graphic Card Make and Model": cleanDisplayValue(raw["Graphic Card Make and Model"] || product?.graphics),
    "Factory Pre-loaded Operating System": cleanDisplayValue(raw["Factory Pre-loaded Operating System"] || product?.os),
    "Screen Size": cleanDisplayValue(raw["Screen Size"] || product?.monitor),
    "Power Supply": cleanDisplayValue(raw["Power Supply"] || product?.power_supply),
  };
}

function getPrinterSpecs(product) {
  const raw = getRawExtraSpecs(product);
  return {
    "Printing Technology": cleanDisplayValue(raw["Printing Technology"] || product?.printing_technology),
    "Cartridge Technology": cleanDisplayValue(raw["Cartridge Technology"] || product?.cartridge_technology),
    "Type of Printing": cleanDisplayValue(raw["Type of Printing"] || product?.type_of_printing),
    "Availability of Fax": cleanDisplayValue(raw["Availability of Fax"] || product?.fax_availability),
    "Operating System Compatibility": cleanDisplayValue(
      raw["Operating System Compatibility"] || product?.operating_system_compatibility
    ),
    "Mono Print Speed (PPM)": cleanDisplayValue(raw["Mono Print Speed (PPM)"] || product?.mono_print_speed_ppm),
    "Mono Print Speed (IPM)": cleanDisplayValue(raw["Mono Print Speed (IPM)"] || product?.mono_print_speed_ipm),
    "Colour Print Speed (PPM)": cleanDisplayValue(raw["Colour Print Speed (PPM)"] || product?.colour_print_speed_ppm),
    "Colour Print Speed (IPM)": cleanDisplayValue(raw["Colour Print Speed (IPM)"] || product?.colour_print_speed_ipm),
    "Auto Duplexing": cleanDisplayValue(raw["Auto Duplexing"] || product?.auto_duplexing),
    "Reduction and Enlarge Features": cleanDisplayValue(
      raw["Reduction and Enlarge Features"] || product?.reduction_enlarge_features
    ),
    "Printer Type": cleanDisplayValue(raw["Printer Type"] || product?.printer_type),
    "Maximum Scan Area": cleanDisplayValue(raw["Maximum Scan Area"] || product?.max_scan_area),
    "A4 Scan Speed Colour": cleanDisplayValue(raw["A4 Scan Speed Colour"] || product?.a4_scan_speed_colour),
    "Scan To Functions": cleanDisplayValue(raw["Scan To Functions"] || product?.scan_to_functions),
    "Document Feeder Type": cleanDisplayValue(raw["Document Feeder Type"] || product?.document_feeder_type),
    "Feeder Capacity": cleanDisplayValue(raw["Feeder Capacity"] || product?.feeder_capacity),
    "Main Paper Tray Count": cleanDisplayValue(raw["Main Paper Tray Count"] || product?.main_paper_tray_count),
    "Total Paper Tray Capacity": cleanDisplayValue(
      raw["Total Paper Tray Capacity"] || product?.total_paper_tray_capacity
    ),
    "Bypass Tray Facility": cleanDisplayValue(raw["Bypass Tray Facility"] || product?.bypass_tray_facility),
    "Bypass Tray Capacity": cleanDisplayValue(raw["Bypass Tray Capacity"] || product?.bypass_tray_capacity),
    "Connectivity": cleanDisplayValue(raw["Connectivity"] || product?.connectivity),
    "Duty Cycle": cleanDisplayValue(raw["Duty Cycle"] || product?.duty_cycle),
    "On Site Warranty": cleanDisplayValue(raw["On Site Warranty"] || product?.onsite_warranty),
    "Extended Warranty": cleanDisplayValue(raw["Extended Warranty"] || product?.extended_warranty),
  };
}

function displayWorkstationStorage(product, specs) {
  const parts = [];
  if (cleanDisplayValue(specs.SSD || product?.ssd)) parts.push(`SSD: ${cleanDisplayValue(specs.SSD || product?.ssd)}`);
  if (cleanDisplayValue(specs.HDD || product?.hdd)) parts.push(`HDD: ${cleanDisplayValue(specs.HDD || product?.hdd)}`);
  return displaySpecValue(parts.join(", ") || product?.storage);
}

function getFallbackImage(index = 0) {
  return FALLBACK_IMAGES[Math.abs(index) % FALLBACK_IMAGES.length];
}

function isPrinterProduct(product) {
  return (
    String(product?.category || "").toLowerCase() === "printer" ||
    String(product?.id || "").toLowerCase().startsWith("printer-")
  );
}

function isDesktopOrWorkstationProduct(product) {
  const category = String(product?.category || "").toLowerCase();
  return category === "desktop" || category === "workstation";
}

function getImage(product, index = 0) {
  if (isPrinterProduct(product)) {
    const normalizedModel = String(product?.model_no || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

    return PRINTER_MODEL_IMAGES[normalizedModel] || product?.image || getFallbackImage(index);
  }

  if (isDesktopOrWorkstationProduct(product)) {
    return getFallbackImage(index);
  }

  return product?.image || getFallbackImage(index);
}

async function parseJsonResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!contentType.includes("application/json")) {
    throw new Error(`The backend did not return JSON. Status: ${res.status}`);
  }

  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || "Server error");
  return data;
}

function ProductDetailsModal({ product, onClose, onDeleted, onEdited }) {
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const workstation = isWorkstationProduct(product);
  const printer = isPrinterProduct(product);
  const specs = printer
    ? getPrinterSpecs(product)
    : workstation
      ? getWorkstationSpecs(product)
      : getExtraSpecs(product);
  const sections = printer
    ? PRINTER_SECTIONS
    : workstation
      ? WORKSTATION_SECTIONS
      : GEM_SECTIONS;

  const deleteProduct = async () => {
    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`${API}/catalogue/${product.id}/delete/`, {
        method: "DELETE",
      });

      await parseJsonResponse(res);
      onDeleted(product.id);
      onClose();
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      {!workstation && !printer && showEdit && (
        <ProductFormModal
          mode="edit"
          product={product}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            onEdited(updated);
            setShowEdit(false);
            onClose();
          }}
        />
      )}

      <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10 shadow-sm">
          <h1 className="text-xl font-bold text-gray-800">
            Product Specification
          </h1>

          <div className="flex items-center gap-3">
            {!workstation && !printer && (
              <>
            <button
              onClick={() => setShowEdit(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
            >
              ✏️ Edit
            </button>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-lg font-bold text-sm"
              >
                🗑️ Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600 font-semibold">
                  Sure?
                </span>
                <button
                  onClick={deleteProduct}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg font-bold text-sm"
                >
                  {deleting ? "Deleting..." : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
              </>
            )}

            <button
              onClick={onClose}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
            >
              Close
            </button>
          </div>
        </div>

        {deleteError && (
          <div className="mx-8 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            ⚠️ {deleteError}
          </div>
        )}

        <div className="px-8 py-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="w-full h-[300px] border rounded-xl flex items-center justify-center bg-white shadow-sm">
              <img
                src={getImage(product, product?.__imageIndex || 0)}
                alt={product.model_no}
                className="max-h-[280px] object-contain"
                onError={(e) => {
                  e.currentTarget.src = getFallbackImage(product?.__imageIndex || 0);
                }}
              />
            </div>

            <div className="lg:col-span-2 border rounded-xl p-6 bg-white shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 border-b pb-3 mb-4">
                Basic Information
              </h2>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-500 font-medium">Model No.</div>
                  <div className="text-gray-800 font-bold">
                    {product.model_no || "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-500 font-medium">Category</div>
                  <div className="text-gray-800">{product.category || "—"}</div>
                </div>

                {!printer && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-gray-500 font-medium">Processor</div>
                      <div className="text-gray-800">
                        {workstation ? displaySpecValue(specs["Processor Number"] || product?.processor) : displayBasicProcessor(product, specs)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-gray-500 font-medium">RAM</div>
                      <div className="text-gray-800">
                        {workstation ? displaySpecValue(specs.RAM || product?.ram) : displayBasicRam(product, specs)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-gray-500 font-medium">Storage</div>
                      <div className="text-gray-800">
                        {workstation ? displayWorkstationStorage(product, specs) : displayBasicStorage(product, specs)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-gray-500 font-medium">OS</div>
                      <div className="text-gray-800">
                        {workstation ? displaySpecValue(specs["Factory Pre-loaded Operating System"] || product?.os) : displayBasicOs(product, specs)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {sections
              .map((section) => ({
                ...section,
                fields: printer || workstation
                  ? section.fields.filter((field) => cleanDisplayValue(specs[field]))
                  : section.fields,
              }))
              .filter((section) => section.fields.length > 0)
              .map((section) => (
              <div
                key={section.title}
                className="border rounded-xl overflow-hidden shadow-sm"
              >
                <div className="bg-slate-800 px-5 py-3">
                  <h3 className="text-xs font-extrabold text-white tracking-widest uppercase">
                    {section.title}
                  </h3>
                </div>

                <div className="divide-y divide-gray-100">
                  {section.fields.map((field) => (
                    <div
                      key={field}
                      className="grid grid-cols-2 gap-4 px-5 py-3 text-sm"
                    >
                      <div className="text-gray-500 font-medium leading-snug">
                        {field}
                      </div>
                      <div className="text-gray-800 leading-snug break-words">
                        {displaySpecValue(specs[field])}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ProductFormModal({ mode = "add", product = null, onClose, onSaved }) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    model_no: product?.model_no || "",
    category: product?.category || "",
    processor: product?.processor || "",
    ram: product?.ram || "",
    storage: product?.storage || "",
    os: product?.os || "",
  });

  const [extraSpecs, setExtraSpecs] = useState(
    isEdit ? getExtraSpecs(product) : emptySpecs()
  );

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const imageRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setSpecValue = (key, value) => {
    setExtraSpecs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const onImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setError("");

    if (!form.model_no.trim()) {
      return setError("Model No. is required.");
    }

    if (!form.category.trim()) {
      return setError("Category is required.");
    }

    const fd = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      fd.append(key, value || "");
    });

    fd.append("description", "");
    fd.append("extra_specs", JSON.stringify(extraSpecs));

    if (imageFile) {
      fd.append("image", imageFile);
    }

    setSaving(true);

    try {
      const url = isEdit
        ? `${API}/catalogue/${product.id}/update/`
        : `${API}/catalogue/create/`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        body: fd,
      });

      const data = await parseJsonResponse(res);
      onSaved(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">
              {isEdit ? "Edit Product" : "Add Product"}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-600 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Product Image
              </label>

              <div
                className="h-72 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center cursor-pointer hover:border-blue-500 bg-gray-50 overflow-hidden"
                onClick={() => imageRef.current?.click()}
              >
                {imagePreview || product?.image ? (
                  <img
                    src={imagePreview || product?.image}
                    alt="preview"
                    className="w-full h-full object-contain p-4"
                    onError={(e) => {
                      e.currentTarget.src = getFallbackImage(0);
                    }}
                  />
                ) : (
                  <div className="text-center">
                    <div className="text-5xl mb-3">🖼️</div>
                    <div className="text-sm text-gray-500 font-semibold">
                      Click to upload image
                    </div>
                  </div>
                )}

                <input
                  ref={imageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onImageSelect}
                />
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Model No. <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.model_no}
                  onChange={(e) => setField("model_no", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                >
                  <option value="">Select Category</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {[
                { label: "Processor", key: "processor" },
                { label: "RAM", key: "ram" },
                { label: "Storage", key: "storage" },
                { label: "OS", key: "os" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {field.label}
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form[field.key]}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 space-y-5">
            {GEM_SECTIONS.map((section) => (
              <div
                key={section.title}
                className="border rounded-2xl overflow-hidden bg-white"
              >
                <div className="bg-slate-800 px-5 py-3">
                  <h3 className="text-xs font-extrabold text-white tracking-widest uppercase">
                    {section.title}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-gray-50">
                  {section.fields.map((field) => (
                    <div key={field}>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        {field}
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={extraSpecs[field] || ""}
                        onChange={(e) => setSpecValue(field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-5 mt-5 border-t justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl"
            >
              {saving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CatalogueProducts() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const productHistoryPushed = useRef(false);

  const fetchProducts = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const requests = [];
      const shouldLoadMainCatalogue =
        categoryFilter === "All" ||
        categoryFilter === "Desktop" ||
        categoryFilter === "AIO" ||
        categoryFilter === "Toner";
      const shouldLoadWorkstations =
        categoryFilter === "All" || categoryFilter === "Workstation";
      const shouldLoadPrinters =
        categoryFilter === "All" || categoryFilter === "Printer";

      if (shouldLoadMainCatalogue) {
        const params = new URLSearchParams();
        if (search.trim()) {
          params.append("search", search.trim());
        }
        if (categoryFilter !== "All" && categoryFilter !== "Workstation" && categoryFilter !== "Printer") {
          params.append("category", categoryFilter);
        }

        const query = params.toString();
        const url = query ? `${API}/catalogue/?${query}` : `${API}/catalogue/`;
        requests.push(
          fetch(url)
            .then(parseJsonResponse)
            .then((data) => (Array.isArray(data) ? data : []))
        );
      }

      if (shouldLoadWorkstations) {
        const params = new URLSearchParams();
        if (search.trim()) {
          params.append("search", search.trim());
        }
        const query = params.toString();
        const url = query ? `${API}/workstation-catalogue/?${query}` : `${API}/workstation-catalogue/`;
        requests.push(
          fetch(url)
            .then(parseJsonResponse)
            .then((data) => (Array.isArray(data) ? data : []))
        );
      }

      if (shouldLoadPrinters) {
        const params = new URLSearchParams();
        if (search.trim()) {
          params.append("search", search.trim());
        }
        const query = params.toString();
        const url = query ? `${API}/printer-catalogue/?${query}` : `${API}/printer-catalogue/`;
        requests.push(
          fetch(url)
            .then(parseJsonResponse)
            .then((data) => (Array.isArray(data) ? data : []))
        );
      }

      const responses = await Promise.all(requests);
      const mergedProducts = responses
        .flat()
        .map((product, index) => ({ ...product, __imageIndex: index }));

      setProducts(mergedProducts);
    } catch (err) {
      setLoadError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter]);

  useEffect(() => {
    const handleBrowserBack = () => {
      if (!productHistoryPushed.current) return;

      productHistoryPushed.current = false;
      setSelectedProduct(null);
    };

    window.addEventListener("popstate", handleBrowserBack);
    return () => window.removeEventListener("popstate", handleBrowserBack);
  }, []);

  const openProductDetails = (product) => {
    if (!productHistoryPushed.current) {
      window.history.pushState(
        { catalogueProductDetails: true },
        "",
        window.location.href
      );
      productHistoryPushed.current = true;
    }

    setSelectedProduct(product);
  };

  const closeProductDetails = () => {
    if (productHistoryPushed.current) {
      window.history.back();
      return;
    }

    setSelectedProduct(null);
  };

  const addProductToList = (product) => {
    if (categoryFilter !== "All" && product.category !== categoryFilter) {
      return;
    }

    setProducts((prev) => [{ ...product, __imageIndex: 0 }, ...prev.map((item, index) => ({ ...item, __imageIndex: index + 1 }))]);
  };

  const updateProductInList = (updated) => {
    setProducts((prev) => {
      if (categoryFilter !== "All" && updated.category !== categoryFilter) {
        return prev.filter((p) => p.id !== updated.id);
      }

      return prev.map((p, index) => (p.id === updated.id ? { ...updated, __imageIndex: index } : p));
    });
  };

  const removeProductFromList = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {showAdd && (
        <ProductFormModal
          mode="add"
          onClose={() => setShowAdd(false)}
          onSaved={addProductToList}
        />
      )}

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={closeProductDetails}
          onDeleted={removeProductFromList}
          onEdited={updateProductInList}
        />
      )}

      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                Catalogue Products
              </h1>
            </div>

            <button
              onClick={() => setShowAdd(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl text-sm font-bold"
            >
              + Add Product
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {["All", ...CATEGORY_OPTIONS].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition ${
                  categoryFilter === cat
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchProducts();
            }}
            className="mt-5 flex gap-3"
          >
            <input
              type="text"
              placeholder="Search by model no."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-bold">
              Search
            </button>
          </form>

          {loadError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              ⚠️ {loadError}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="px-5 py-4 text-left w-20">S.No.</th>
                  <th className="px-5 py-4 text-left w-28">Image</th>
                  <th className="px-5 py-4 text-left">Model</th>
                  <th className="px-5 py-4 text-left">Category</th>
                  <th className="px-5 py-4 text-left w-40">View Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      No products found.
                    </td>
                  </tr>
                ) : (
                  products.map((product, index) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-semibold text-gray-700">
                        {index + 1}
                      </td>

                      <td className="px-5 py-4">
                        <div className="w-16 h-16 border rounded-lg bg-white flex items-center justify-center overflow-hidden">
                          <img
                            src={getImage(product, product?.__imageIndex ?? index)}
                            alt={product.model_no}
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              e.currentTarget.src = getFallbackImage(product?.__imageIndex ?? index);
                            }}
                          />
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900">
                          {product.model_no || "—"}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-gray-700">
                        {product.category || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          onClick={() => openProductDetails(product)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
