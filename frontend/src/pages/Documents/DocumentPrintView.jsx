import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import letterhead from "../../assets/documents/letterhead.png";
import signature from "../../assets/documents/signature.jpeg";
import "./document-print.css";

const API_BASE = import.meta.env.VITE_API_URL;

const ENDPOINTS = {
  desktop: (id) => `${API_BASE}/desktop-bids/${id}/`,
  printer: (id) => `${API_BASE}/printer-bids/${id}/`,
  workstation: (id) => `${API_BASE}/workstation-bids/${id}/`,
};

const TITLES = {
  manufacturer_auth: "MAF/AUTHORIZATION LETTER",
  make_in_india: "MAKE IN INDIA CERTIFICATE",
  warranty: "WARRANTY CERTIFICATE",
  bidder_financial: "BIDDER FINANCIAL UNDERTAKING",
  non_obsolete: "NON-OBSOLESCENCE UNDERTAKING",
  non_malicious: "NON-MALICIOUS CODE CERTIFICATE",
  non_return_hdd: "NON RETURN OF HARD DISK",
  non_blacklisting: "UNDERTAKING FOR DEBARRED OR NON-BLACKLISTED",
  service_support: "SERVICE & SUPPORT",
  ipv6: "IPV6 READINESS UNDERTAKING",
  preloaded_os: "PRELOADED OPERATING SYSTEM CERTIFICATE",
  data_sheet: "DATA SHEET",
  technical_compliance: "TECHNICAL COMPLIANCE CERTIFICATE",
};

const OMIT_FIELDS = new Set([
  "id", "user", "created_at", "updated_at", "status", "review_status", "admin_note",
  "selected_general_docs", "selected_general_doc_labels", "atc_special_document",
]);

function Recipient({ bid }) {
  return (
    <div className="recipient">
      <strong>To,</strong>
      <strong>{bid.dept_name || ""}</strong>
      <strong>{bid.organization || ""}</strong>
      {bid.gstin_number && <strong>GSTIN Number: {bid.gstin_number}</strong>}
      <strong>{bid.address || ""}{bid.pincode ? `, ${bid.pincode}` : ""}</strong>
    </div>
  );
}

function Signatory() {
  return (
    <div className="signatory">
      <strong>Auth. Signatory</strong>
      <strong>For Laps N Tabs Technology Pvt. Ltd.</strong>
      <img src={signature} alt="Authorized signature" />
      <strong>Name:- Devank Rastogi</strong>
      <strong>Designation:- Director</strong>
      <span>Email:- lapsntabs123@gmail.com</span>
      <span>Contact No.:- 9918200166</span>
    </div>
  );
}

function LetterBody({ type, bid, product }) {
  const model = bid.model_number || "quoted model";
  const productName = product === "printer" ? "Printer" : product === "workstation" ? "Workstation" : "Desktop";
  const warranty = bid.onsite_warranty || bid.warranty || bid.extended_warranty || "standard warranty";
  const text = {
    manufacturer_auth: `This is to inform you that we M/S LAPS N TABS TECHNOLOGY PRIVATE LIMITED, manufacturer of acxxel ${productName}, are directly participating as OEM in the above mentioned bid. It is also a registered OEM on GeM by the same name. Trade Mark Certificate is attached below.`,
    make_in_india: `This is to certify that acxxel ${productName} ${model}, quoted under the above bid, is manufactured in India at Laps N Tabs Technology Private Limited, C-187 Nirala Nagar, Lucknow-226020.`,
    warranty: `This is to certify that Laps N Tabs Technology Pvt. Ltd. is the OEM of acxxel ${productName} and will provide comprehensive warranty during the entire ${warranty} period for quoted model ${model}.`,
    bidder_financial: `We hereby undertake that all financial obligations, statutory requirements and responsibilities applicable to the above bid shall be fulfilled by us.`,
    non_obsolete: `We undertake that the offered acxxel ${productName} ${model} is current, supported and shall not become obsolete during the committed supply and warranty period.`,
    non_malicious: `We certify that the offered product and supplied software do not contain malicious code, undisclosed functions or components intended to compromise information security.`,
    non_return_hdd: `We undertake that, as per Data Security Policy, a faulty hard disk supplied under this bid shall not be returned to the OEM or supplier.`,
    non_blacklisting: `Laps N Tabs Technology Pvt. Ltd. and its associate concerns have neither been blacklisted nor debarred by any Government Department, PSU or autonomous organization.`,
    ipv6: `We hereby confirm that the offered IT hardware is IPv6 ready and supports the applicable IPv6 requirements stated in the bid.`,
    preloaded_os: `We hereby confirm that the acxxel ${productName} ${model} is offered with factory preloaded ${bid.os || bid.operating_system_compatibility || "operating system"} license.`,
  }[type];
  return <p className="letter-copy">{text}</p>;
}

function SpecificationTable({ bid, compliance }) {
  const rows = Object.entries(bid)
    .filter(([key, value]) => !OMIT_FIELDS.has(key) && value !== "" && value !== null && value !== undefined)
    .map(([key, value]) => [key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()), String(value)]);
  return (
    <table className="spec-table">
      <thead><tr><th>Specification</th><th>Title</th>{compliance && <th>Allowed Values</th>}<th>Offered Values</th></tr></thead>
      <tbody>{rows.map(([label, value]) => <tr key={label}><td>{label}</td><td>{label}</td>{compliance && <td>As per bid requirement</td>}<td>{value}</td></tr>)}</tbody>
    </table>
  );
}

function ServiceSupport({ product }) {
  return (
    <>
      <p className="letter-copy">This is certifying that acxxel {product === "printer" ? "Printers" : product === "workstation" ? "Workstations" : "Desktops"} offers on-site comprehensive warranty as stated in the bid document.</p>
      <h3>Escalation matrix below reference:</h3>
      <table className="support-table"><tbody>
        <tr><td>Level 1</td><td>Toll free number</td><td>1800-313-9020</td></tr>
        <tr><td>Level 2</td><td>Service Head</td><td>Madhuri Pal - 9519598884</td></tr>
        <tr><td>Level 3</td><td>Director</td><td>Devank Rastogi - 9918200166</td></tr>
      </tbody></table>
    </>
  );
}

export default function DocumentPrintView() {
  const { product, bidId, docType } = useParams();
  const [bid, setBid] = useState(null);
  const [error, setError] = useState("");
  const endpoint = useMemo(() => ENDPOINTS[product]?.(bidId), [product, bidId]);

  useEffect(() => {
    if (!endpoint) return setError("Unsupported product");
    fetch(endpoint).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load bid");
      return response.json();
    }).then(setBid).catch((err) => setError(err.message));
  }, [endpoint]);

  useEffect(() => {
    if (bid) document.documentElement.dataset.printReady = "true";
    return () => {
      delete document.documentElement.dataset.printReady;
    };
  }, [bid]);
  if (error) return <div className="print-status">{error}</div>;
  if (!bid) return <div className="print-status">Preparing document...</div>;

  const isSpec = docType === "data_sheet" || docType === "technical_compliance";
  return (
    <main className="print-document">
      <section className="a4-page">
        <img className="letterhead" src={letterhead} alt="Laps N Tabs Technology Pvt. Ltd." />
        <Recipient bid={bid} />
        <div className="bid-reference"><strong>Bid No: {bid.bid_no}</strong><strong>Dated: {bid.date || ""}</strong></div>
        <h1>{TITLES[docType] || docType}</h1>
        {isSpec ? <SpecificationTable bid={bid} compliance={docType === "technical_compliance"} /> : docType === "service_support" ? <ServiceSupport product={product} /> : <LetterBody type={docType} bid={bid} product={product} />}
        {!isSpec && <Signatory />}
      </section>
    </main>
  );
}
