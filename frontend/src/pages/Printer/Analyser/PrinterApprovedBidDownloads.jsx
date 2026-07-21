import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const API_BASE = `${import.meta.env.VITE_API_URL}/printer-bids`;

const APPROVED_DOWNLOADS = [
  ["manufacturer_auth", "MAF Certificate"],
  ["experience_certificate", "Experience Certificate"],
  ["past_performance", "Past Performance"],
  ["oem_annual_turnover", "OEM Annual Turnover"],
  ["make_in_india", "Make in India"],
  ["atc_acceptance_letter", "ATC Acceptance Letter"],
  ["approved_atc_documents", "ATC Documents"],
  ["approved_price_paper", "Price Approved"],
  ["approved_all_documents", "All Documents"],
];

export default function PrinterApprovedBidDownloads() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const bid = state?.bid;
  const [downloading, setDownloading] = useState("");

  const downloadDocument = async (docId) => {
    setDownloading(docId);
    try {
      const response = await fetch(`${API_BASE}/${id}/generate-docs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: docId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.pdf_url) {
        throw new Error(data.error || "Document generate nahi hua.");
      }

      const fileResponse = await fetch(data.pdf_url);
      if (!fileResponse.ok) throw new Error("Document download nahi hua.");

      const blobUrl = URL.createObjectURL(await fileResponse.blob());
      const link = document.createElement("a");
      const fileLabel = docId === "approved_price_paper"
        ? "Price_Approved"
        : docId === "approved_all_documents"
          ? "All_Approved_Documents"
          : docId;
      link.href = blobUrl;
      link.download = `${bid?.bid_no || `printer_bid_${id}`}_${fileLabel}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert(error.message || "Download failed.");
    } finally {
      setDownloading("");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Download Approved Printer Bid</h2>
          <p className="mt-1 text-sm text-slate-500">
            Bid No: <span className="font-bold text-slate-700">{bid?.bid_no || id}</span>
          </p>
        </div>
        <button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
          Back
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_auto] bg-slate-800 px-5 py-4 text-xs font-bold uppercase tracking-wider text-white">
          <span>Document</span>
          <span>Action</span>
        </div>
        {APPROVED_DOWNLOADS.map(([docId, label]) => (
          <div key={docId} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
            <span className="text-sm font-semibold text-slate-700">{label}</span>
            <button
              type="button"
              disabled={!!downloading}
              onClick={() => downloadDocument(docId)}
              className="min-w-28 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading === docId ? "Downloading..." : "Download"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
