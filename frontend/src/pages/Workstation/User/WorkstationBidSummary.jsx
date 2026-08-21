const SUMMARY_FIELDS = [
  ["processor", "Processor", "processor_price"],
  ["motherboard", "Motherboard", "motherboard_price"],
  ["ram", "RAM", "ram_price"],
  ["hdd", "Hard Disk Drive", "hdd_price"],
  ["graphics", "Graphics Card", "graphics_price"],
  ["ssd", "SSD 1", "ssd_price"],
  ["ssd2", "SSD 2", "ssd2_price"],
  ["os", "Operating System", "os_price"],
  ["dvd", "DVD", "dvd_price"],
  ["wifi", "Wi-Fi Bluetooth", "wifi_price"],
  ["monitor", "Monitor", "monitor_price"],
  ["cabinet", "Cabinet", "cabinet_price"],
  ["keyboard", "Keyboard & Mouse", "keyboard_price"],
  ["power_supply", "Power Supply (SMPS)", "power_supply_price"],
  ["warranty", "Warranty", "warranty_price"],
  ["freightInstallation", "Freight & Installation", "freightInstallation_price"],
  ["hddreturnable", "HDD Return Option", "hddreturnable_price"],
];

const OTHER_FIELDS = [["date", "Bid End Date"], ["epbg", "EPBG (%)"]];
const DESCRIPTION_FIELDS = [
  ["pro_descp", "Processor Description"],
  ["software1", "Additional Software"],
  ["gp", "Graphics Description"],
  ["motherboard_descp", "Motherboard Description"],
  ["extra_requirements", "Extra Requirements"],
];

const value = (item) => item === undefined || item === null || item === "" ? "—" : item;
const price = (item) => item === undefined || item === null || item === "" || Number.isNaN(Number(item))
  ? "—"
  : `₹${Number(item).toLocaleString("en-IN")}`;

const Section = ({ title, children }) => (
  <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
      <h6 className="text-sm font-semibold uppercase tracking-wide text-gray-700">{title}</h6>
    </div>
    {children}
  </div>
);

export default function WorkstationBidSummary({ bidData = {}, onNext, onBack }) {
  return (
    <div className="container mx-auto mt-4 max-w-5xl px-4">
      <div className="mb-4 flex items-center gap-3 border-b pb-2 pt-2">
        <h5 className="text-lg font-semibold text-gray-800">Bid Products at a Glance</h5>
      </div>

      <Section title="Workstation Configuration">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-xs uppercase text-gray-500">
            <th className="w-1/3 px-4 py-2 text-left font-semibold">Component</th>
            <th className="px-4 py-2 text-left font-semibold">Selected</th>
            <th className="w-40 px-4 py-2 text-right font-semibold">Price</th>
          </tr></thead>
          <tbody>{SUMMARY_FIELDS.map(([key, label, priceKey], index) => (
            <tr key={key} className={index % 2 ? "bg-gray-50" : "bg-white"}>
              <td className="border-t border-gray-100 px-4 py-2.5 font-medium text-gray-600">{label}</td>
              <td className="border-t border-gray-100 px-4 py-2.5 text-gray-800">{value(bidData[key])}</td>
              <td className="border-t border-gray-100 px-4 py-2.5 text-right text-gray-700">{price(bidData[priceKey])}</td>
            </tr>
          ))}</tbody>
        </table>
      </Section>

      <Section title="Other Details">
        <table className="w-full text-sm"><tbody>{OTHER_FIELDS.map(([key, label], index) => (
          <tr key={key} className={index % 2 ? "bg-gray-50" : "bg-white"}>
            <td className="w-1/3 border-t border-gray-100 px-4 py-2.5 font-medium text-gray-600">{label}</td>
            <td className="border-t border-gray-100 px-4 py-2.5 text-gray-800">{value(bidData[key])}</td>
          </tr>
        ))}</tbody></table>
      </Section>

      <Section title="Description Details">
        <table className="w-full text-sm"><tbody>{DESCRIPTION_FIELDS.map(([key, label], index) => (
          <tr key={key} className={index % 2 ? "bg-gray-50" : "bg-white"}>
            <td className="w-1/3 border-t border-gray-100 px-4 py-2.5 align-top font-medium text-gray-600">{label}</td>
            <td className="whitespace-pre-wrap break-words border-t border-gray-100 px-4 py-2.5 text-gray-800">{value(bidData[key])}</td>
          </tr>
        ))}</tbody></table>
      </Section>

      <div className="mb-10 flex items-center justify-between">
        <button type="button" onClick={() => onBack?.({ ...bidData })}
          className="rounded-md border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">
          Back & Edit
        </button>
        <button type="button" onClick={() => onNext?.({ ...bidData })}
          className="rounded-md bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 active:scale-95">
          Next
        </button>
      </div>
    </div>
  );
}
