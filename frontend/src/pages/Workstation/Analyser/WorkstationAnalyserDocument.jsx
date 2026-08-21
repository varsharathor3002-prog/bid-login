import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import WorkstationDocument from "../User/WorkstationDocument";

const API_BASE = import.meta.env.VITE_API_URL;

const ANALYSER_DOCS = [
  { id: "warranty", label: "WARRANTY" },
  { id: "technical_compliance", label: "TECHNICAL COMPLIANCE" },
  { id: "data_sheet", label: "DATA SHEET" },
];

export default function WorkstationAnalyserDocument() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [bidData, setBidData] = useState(state?.bidData || null);
  const [loading, setLoading] = useState(!state?.bidData);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadBid = async () => {
      try {
        const response = await fetch(`${API_BASE}/workstation-bids/${id}/`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Unable to load workstation bid.");
        if (active) setBidData({ ...data, bid_id: id });
      } catch (err) {
        if (active) setError(err.message || "Unable to load workstation bid.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadBid();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <div className="p-20 text-center font-medium tracking-widest text-gray-400 animate-pulse">LOADING DOCUMENTS...</div>;
  }

  if (!bidData) {
    return (
      <div className="p-20 text-center">
        <p className="mb-4 font-semibold text-red-600">{error || "Bid details not found."}</p>
        <button type="button" onClick={() => navigate(-1)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">Back</button>
      </div>
    );
  }

  return (
    <WorkstationDocument
      bidData={{ ...bidData, bid_id: id }}
      onBack={() => navigate(`/analyser-dashboard/workstation/bid/${id}`)}
      onSuccess={() => navigate("/analyser-dashboard/workstation")}
      submitLabel="Forward to Admin"
      analyserMode
      docOptions={ANALYSER_DOCS}
    />
  );
}
