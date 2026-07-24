import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const API_BASE = `${import.meta.env.VITE_API_URL}/workstation-bids`;

const DOCUMENT_LABELS = {
  manufacturer_auth: "MAF Certificate",
  bidder_financial: "Bidder Financial Undertaking",
  non_obsolete: "Non Obsolete Certificate",
  non_malicious: "Non Malicious Code Certificate",
  non_return_hdd: "Non Return of Hard Disk",
  non_blacklisting: "Non Blacklisting Certificate",
  service_support: "Service Support",
  ipv6: "IPv6 Certificate",
  preloaded_os: "Preloaded Operating System",
  make_in_india: "Make in India",
};

export default function WorkstationApprovedBidDownloads() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const bid = state?.bid;
  const [downloading, setDownloading] = useState("");

  const selectedDocs = Array.isArray(bid?.selected_general_docs)
    ? bid.selected_general_docs.filter((docId) => DOCUMENT_LABELS[docId])
    : [];
  const downloads = [...new Set([...selectedDocs, "make_in_india"])];

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
      link.href = blobUrl;
      link.download = `${bid?.bid_no || `workstation_bid_${id}`}_${docId}.pdf`;
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
          <h2 className="text-2xl font-black text-slate-800">Download Docs for the bid</h2>
          <p className="mt-1 text-sm text-slate-500">
            Bid No: <span className="font-bold text-slate-700">{bid?.bid_no || id}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_auto] bg-slate-800 px-5 py-4 text-xs font-bold uppercase tracking-wider text-white">
          <span>Document</span>
          <span>Action</span>
        </div>
        {downloads.map((docId) => (
          <div key={docId} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
            <span className="text-sm font-semibold text-slate-700">{DOCUMENT_LABELS[docId]}</span>
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
