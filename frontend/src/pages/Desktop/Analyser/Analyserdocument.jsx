import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL;

const ANALYSER_DOCS = [
  {
    id: "warranty",
    label: "WARRANTY",
    fields: ["warranty", "qty", "organization", "bid_no"],
  },
  
  {
    id: "technical_compliance",
    label: "TECHNICAL COMPLIANCE",
    fields: ["processor", "ram", "hdd", "ssd1", "monitor", "os", "warranty", "bid_no", "organization"],
  },
  {
    id: "data_sheet",
    label: "DATA SHEET",
    fields: ["processor", "ram", "hdd", "ssd1", "ssd2", "monitor", "os", "wifi", "dvd", "cabinet", "keyboard", "motherboard", "warranty", "bid_no", "organization"],
  },
];

export default function AnalyserDocument() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const bidData = state?.bidData || {};

  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState({});
  const [generated, setGenerated] = useState({});
  const [selectedDocs, setSelectedDocs] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const selectedCount = Object.values(selectedDocs).filter(Boolean).length;

  const toggleDocSelection = (docId) => {
    setSelectedDocs((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  const removeDocSelection = (docId) => {
    setSelectedDocs((prev) => {
      const updated = { ...prev };
      delete updated[docId];
      return updated;
    });
  };

  const handleViewDocument = async (doc) => {
    const bid_id = bidData?.bid_id || bidData?.id;
    if (!bid_id) {
      setError("Bid ID missing!");
      return;
    }

    setGenerating((prev) => ({ ...prev, [doc.id]: true }));
    setError("");

    try {
      const payload = { doc_type: doc.id };
      doc.fields.forEach((key) => {
        if (bidData[key]) payload[key] = bidData[key];
      });

      const response = await fetch(`${API_BASE}/desktop-bids/${bid_id}/generate-docs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Document generate nahi hua");
      }

      const data = await response.json();

      if (data.pdf_url) {
        window.open(data.pdf_url, "_blank");
        setGenerated((prev) => ({ ...prev, [doc.id]: true }));
        setSelectedDocs((prev) => ({ ...prev, [doc.id]: true }));
      } else {
        throw new Error("PDF URL nahi mila");
      }
    } catch (err) {
      setError(err.message || "Document generate karte waqt kuch galat hua.");
    } finally {
      setGenerating((prev) => ({ ...prev, [doc.id]: false }));
    }
  };

  const handleFinalSubmit = async () => {
    const bid_id = bidData?.bid_id || bidData?.id;
    if (!bid_id) {
      setError("Bid ID missing!");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const selectedDocIds = ANALYSER_DOCS.filter((doc) => selectedDocs[doc.id]).map((doc) => doc.id);
      const selectedDocLabels = ANALYSER_DOCS.filter((doc) => selectedDocs[doc.id]).map((doc) => doc.label);

      const formData = new FormData();
      formData.append("status", "pending");
      formData.append("analyser_username", localStorage.getItem("analyser_username") || "Analyser");
      formData.append("selected_analyser_docs", JSON.stringify(selectedDocIds));
      formData.append("selected_analyser_doc_labels", JSON.stringify(selectedDocLabels));

      selectedDocIds.forEach((docId) => {
        formData.append(`analyser_doc_${docId}`, "true");
      });

      const res = await fetch(`${API_BASE}/desktop-bids/${bid_id}/update-docs/`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Submit failed");

      setSuccess(true);
      setTimeout(() => navigate("/analyser-dashboard/desktop"), 1400);
    } catch (err) {
      setError(err.message || "Submit karte waqt kuch galat hua.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        .adoc-page {
          width: 100%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: #f8fafc;
        }

        .adoc-wrap * {
          font-family: 'DM Sans', sans-serif;
          box-sizing: border-box;
        }

        .adoc-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07);
        }

        .open-docs-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 28px 16px;
          border-radius: 16px;
          border: 2px solid #fb923c;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(.4,0,.2,1);
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          width: 100%;
        }

        .open-docs-btn:hover {
          background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);
          border-color: #ea580c;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(251,146,60,0.25);
        }

        .icon-ring-orange {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(251,146,60,0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        .open-docs-btn:hover .icon-ring-orange {
          transform: scale(1.1);
        }

        .badge-count-orange {
          position: absolute;
          top: 10px;
          right: 10px;
          min-width: 22px;
          height: 22px;
          border-radius: 11px;
          padding: 0 6px;
          background: #f97316;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: #fff;
        }

        .btn-submit-final {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(37,99,235,0.35);
          font-family: 'DM Sans', sans-serif;
        }

        .btn-submit-final:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(37,99,235,0.45);
          background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 60%, #2563eb 100%);
        }

        .btn-submit-final:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .summary-strip {
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .summary-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 8px;
          padding: 7px 12px;
          gap: 10px;
          margin-bottom: 6px;
        }

        .summary-item:last-child {
          margin-bottom: 0;
        }

        .remove-icon-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: none;
          background: #fee2e2;
          color: #dc2626;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .remove-icon-btn:hover {
          background: #dc2626;
          color: #fff;
          transform: scale(1.05);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          background: rgba(15,23,42,0.45);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: fadeIn 0.18s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }

        .modal-box {
          background: #fff;
          width: 100%;
          max-width: 480px;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.18);
          animation: slideUp 0.22s cubic-bezier(.4,0,.2,1);
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) }
          to { opacity: 1; transform: translateY(0) }
        }

        .modal-header {
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          padding: 18px 20px 16px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .modal-header-title {
          font-size: 15px;
          font-weight: 700;
          color: #9a3412;
          margin-bottom: 3px;
        }

        .modal-header-sub {
          font-size: 11px;
          color: #c2410c;
        }

        .modal-close-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          background: #fed7aa;
          color: #9a3412;
          font-size: 13px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .modal-close-btn:hover {
          background: #fb923c;
          color: #fff;
        }

        .modal-toolbar {
          padding: 10px 18px;
          background: #fffbeb;
          border-bottom: 1px solid #fde68a;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .modal-toolbar-count {
          font-size: 12px;
          font-weight: 700;
          color: #92400e;
        }

        .modal-list {
          overflow-y: auto;
          flex: 1;
        }

        .doc-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 18px;
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.15s;
        }

        .doc-row:last-child {
          border-bottom: none;
        }

        .doc-row:hover {
          background: #fffbeb;
        }

        .doc-check-label {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
          cursor: pointer;
        }

        .doc-checkbox {
          width: 16px;
          height: 16px;
          accent-color: #f97316;
          cursor: pointer;
          flex-shrink: 0;
        }

        .doc-label {
          flex: 1;
          font-size: 12.5px;
          font-weight: 600;
          color: #1e293b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .view-pdf-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 14px;
          border-radius: 8px;
          border: 1.5px solid #93c5fd;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
          font-family: 'DM Sans', sans-serif;
        }

        .view-pdf-btn:hover:not(:disabled) {
          background: #dbeafe;
          border-color: #60a5fa;
        }

        .view-pdf-btn:disabled {
          opacity: 0.5;
          cursor: wait;
        }

        .view-pdf-btn.done {
          border-color: #86efac;
          background: #f0fdf4;
          color: #15803d;
        }

        .modal-footer {
          padding: 14px 18px;
          background: #fff;
          border-top: 1px solid #f1f5f9;
          flex-shrink: 0;
        }

        .save-selection-btn {
          width: 100%;
          padding: 13px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(249,115,22,0.35);
          font-family: 'DM Sans', sans-serif;
        }

        .save-selection-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(249,115,22,0.45);
        }

        .progress-bar-wrap {
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: #f97316;
          border-radius: 2px;
          transition: width 0.4s ease;
        }

        @keyframes spin {
          to { transform: rotate(360deg) }
        }

        .spin {
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      <div className="adoc-page">
        <div className="adoc-wrap" style={{ width: "100%", maxWidth: 580 }}>
          <div className="adoc-card">
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="18" height="18" fill="none" stroke="#fff" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>General Documents</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
                    Generate & Review · Bid #{bidData?.bid_no || "—"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 12px",
                  borderRadius: 20,
                  letterSpacing: "0.5px",
                }}
              >
                STEP 2 / 2
              </div>
            </div>

            <div style={{ padding: "24px" }}>
              {error && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: "12px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 10,
                    color: "#dc2626",
                    fontSize: 13,
                  }}
                >
                  ⚠️ {error}
                </div>
              )}

              {success && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: "12px 16px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 10,
                    color: "#15803d",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  ✅ Bid successfully submitted to Admin!
                </div>
              )}

            

              <div style={{ marginBottom: 24 }}>
                <button type="button" className="open-docs-btn" onClick={() => setModalOpen(true)}>
                  {selectedCount > 0 && <span className="badge-count-orange">{selectedCount}</span>}

                  <div className="icon-ring-orange">
                    <svg width="22" height="22" fill="none" stroke="#ea580c" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#9a3412" }}>Analyser Documents</div>
                    <div style={{ fontSize: 11, color: "#c2410c", marginTop: 2 }}>
                      {selectedCount > 0 ? `${selectedCount} selected` : "Select or View PDFs"}
                    </div>
                  </div>
                </button>
              </div>

              {selectedCount > 0 && (
                <div className="summary-strip">
                  {ANALYSER_DOCS.filter((doc) => selectedDocs[doc.id]).map((doc) => (
                    <div key={doc.id} className="summary-item">
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f97316", flexShrink: 0 }} />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#9a3412",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {doc.label}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="remove-icon-btn"
                        onClick={() => removeDocSelection(doc.id)}
                        title="Remove document"
                        aria-label="Remove document"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="btn-submit-final"
                disabled={submitting || success}
                onClick={handleFinalSubmit}
              >
                {submitting ? (
                  <>
                    <svg className="spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                      <path fill="rgba(255,255,255,0.9)" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Submitting to Admin...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Accept & Send to Admin
                  </>
                )}
              </button>

              {}
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-200 shadow-sm"
                style={{ marginTop: 9 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Review
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <div>
                <div className="modal-header-title">Analyser Documents</div>
                <div className="modal-header-sub">Select documents directly or use View PDF to preview.</div>
              </div>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="modal-toolbar">
              <span className="modal-toolbar-count">
                {selectedCount} of {ANALYSER_DOCS.length} selected
              </span>
            </div>

            <div className="modal-list">
              {ANALYSER_DOCS.map((doc) => {
                const isGenerating = !!generating[doc.id];
                const isGenerated = !!generated[doc.id];
                const isSelected = !!selectedDocs[doc.id];

                return (
                  <div key={doc.id} className="doc-row">
                    <label className="doc-check-label">
                      <input
                        type="checkbox"
                        className="doc-checkbox"
                        checked={isSelected}
                        onChange={() => toggleDocSelection(doc.id)}
                      />

                      <span className="doc-label" style={{ color: isSelected ? "#9a3412" : "#1e293b" }}>
                        {doc.label}
                      </span>
                    </label>

                    {isSelected && (
                      <button
                        type="button"
                        className="remove-icon-btn"
                        onClick={() => removeDocSelection(doc.id)}
                        title="Remove document"
                        aria-label="Remove document"
                      >
                        ✕
                      </button>
                    )}

                    <button
                      type="button"
                      className={`view-pdf-btn${isGenerated ? " done" : ""}`}
                      disabled={isGenerating}
                      onClick={() => handleViewDocument(doc)}
                    >
                      {isGenerating ? (
                        <>
                          <svg className="spin" width="11" height="11" fill="none" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.3" />
                            <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          {isGenerated ? "View Again" : "View PDF"}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="modal-footer">
              <button className="save-selection-btn" onClick={() => setModalOpen(false)}>
                Save Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
