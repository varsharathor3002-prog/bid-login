import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import letterhead from "../../../assets/documents/letterhead.png";
import signature from "../../../assets/documents/signature.jpeg";
import "../../Documents/document-print.css";

const API_BASE = import.meta.env.VITE_API_URL;

export default function ApprovedBiddingDetails() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [bid, setBid] = useState(state?.bid || null);
  const [loading, setLoading] = useState(!state?.bid);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (bid) return;
    fetch(`${API_BASE}/desktop-bids/${id}/`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load approved bid.");
        return response.json();
      })
      .then(setBid)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bid, id]);

  const downloadPdf = async () => {
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/desktop-bids/${id}/generate-docs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: "approved_price_paper" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.pdf_url) throw new Error(data.error || "The document could not be generated.");
      const fileResponse = await fetch(data.pdf_url);
      if (!fileResponse.ok) throw new Error("The document could not be downloaded.");
      const blobUrl = URL.createObjectURL(await fileResponse.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${bid?.bid_no || `bid_${id}`}_approved_details_for_bidding.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.message || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const printDocument = () => {
    const documentPage = document.querySelector(".approved-bidding-page");
    if (!documentPage) return;
    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      setError("The print window was blocked. Allow browser pop-ups and try again.");
      return;
    }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join("");
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Approved Details For Bidding</title>
          ${styles}
          <style>
            @page { size: A4; margin: 0; }
            html, body { margin: 0; padding: 0; background: white; }
            .a4-page { margin: 0 !important; }
          </style>
        </head>
        <body>${documentPage.outerHTML}</body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      window.setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  };

  if (loading) return <div className="print-status">Preparing approved details...</div>;
  if (!bid) return <div className="print-status">{error || "Bid not found."}</div>;

  return (
    <div className="approved-details-view">
      <div className="print-toolbar mx-auto flex w-[210mm] items-center justify-between gap-3 py-4">
        <button type="button" onClick={() => navigate(-1)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Back
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={downloadPdf} disabled={downloading} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {downloading ? "Downloading..." : "Download"}
          </button>
          <button type="button" onClick={printDocument} className="rounded-md bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-900">
            Print
          </button>
        </div>
      </div>

      {error && <div className="print-toolbar mx-auto mb-3 w-[210mm] rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <main className="print-document">
        <section className="a4-page approved-bidding-page">
          <img className="letterhead" src={letterhead} alt="Laps N Tabs Technology Pvt. Ltd." />
          <h1>APPROVED DETAILS FOR BIDDING</h1>
          <table className="approved-bidding-table">
            <tbody>
              <tr><th>Bid No.</th><td>{bid.bid_no || "-"}</td></tr>
              <tr><th>Model No.</th><td>{bid.model_number || bid.model || "-"}</td></tr>
              <tr>
                <th>Final Price</th>
                <td>₹{Number(bid.total_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
          <div className="approved-bidding-footer">
            <strong>Auth. Signatory For Laps N Tabs Technology Pvt. Ltd.</strong>
            <strong className="company-line">For Laps N Tabs Technology Pvt. Ltd.</strong>
            <img src={signature} alt="Authorized signature" />
            <strong>Name:- Devank Rastogi</strong>
            <strong>Designation:- Director</strong>
            <span>Email:- <u>lapsntabs123@gmail.com</u></span>
            <span>Contact No.:- 9918200166</span>
          </div>
        </section>
      </main>
    </div>
  );
}
