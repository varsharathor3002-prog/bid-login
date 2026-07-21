import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL;

const GENERAL_DOCS = [
  { id: "manufacturer_auth", label: "MANUFACTURER AUTHORIZATION CERTIFICATE" },
  { id: "experience_certificate", label: "EXPERIENCE CERTIFICATE" },
  { id: "past_performance", label: "PAST PERFORMANCE" },
  { id: "oem_annual_turnover", label: "OEM ANNUAL TURNOVER" },
  { id: "atc_acceptance_letter", label: "ATC ACCEPTANCE LETTER" },
  { id: "bidder_financial", label: "BIDDER FINANCIAL UNDERSTANDINGS" },
  { id: "non_obsolete", label: "NON OBSOLETE" },
  { id: "non_malicious", label: "NON MALICIOUS CODE" },
  { id: "non_return_hdd", label: "NON RETURN OF HARD DISK" },
  { id: "non_blacklisting", label: "NON BLACKLISTING" },
  { id: "service_support", label: "SERVICE SUPPORT" },
  { id: "ipv6", label: "IPV6" },
  { id: "preloaded_os", label: "PRELOADED OPERATING SYSTEM" },
];

export default function Document({ bidData, onSuccess }) {
  const [modal, setModal] = useState(null);
  const [specialDoc, setSpecialDoc] = useState(null);
  const [selectedGeneralDocs, setSelectedGeneralDocs] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatingDocs, setGeneratingDocs] = useState({});

  const selectedGeneralDocIds = GENERAL_DOCS.filter((doc) => selectedGeneralDocs[doc.id]).map((doc) => doc.id);
  const selectedGeneralDocLabels = GENERAL_DOCS.filter((doc) => selectedGeneralDocs[doc.id]).map((doc) => doc.label);
  const selectedGeneralDocsCount = selectedGeneralDocIds.length;

  const toggleGeneralDocSelection = (docId) => {
    setSelectedGeneralDocs((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  const removeGeneralDocSelection = (docId) => {
    setSelectedGeneralDocs((prev) => {
      const updated = { ...prev };
      delete updated[docId];
      return updated;
    });
  };

  const selectAllGeneralDocs = () => {
    const allSelected = {};
    GENERAL_DOCS.forEach((doc) => {
      allSelected[doc.id] = true;
    });
    setSelectedGeneralDocs(allSelected);
  };

  const clearGeneralDocsSelection = () => {
    setSelectedGeneralDocs({});
  };

  const handleSpecialFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSpecialDoc(file);
  };

  const handleViewCertificate = async (docId) => {
    if (!bidData?.bid_id) {
      alert("Bid ID missing!");
      return;
    }

    setGeneratingDocs((prev) => ({ ...prev, [docId]: true }));
    setError("");

    try {
      const response = await fetch(`${API_BASE}/desktop-bids/${bidData.bid_id}/generate-docs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: docId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate certificate");
      }

      const data = await response.json();

      if (data.pdf_url) {
        window.open(data.pdf_url, "_blank");
      } else {
        throw new Error("No PDF URL received");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to generate the certificate. Please try again.");
    } finally {
      setGeneratingDocs((prev) => ({ ...prev, [docId]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();

      if (specialDoc) {
        formData.append("atc_special_document", specialDoc);
      }

      formData.append("selected_general_docs", JSON.stringify(selectedGeneralDocIds));
      formData.append("selected_general_doc_labels", JSON.stringify(selectedGeneralDocLabels));

      selectedGeneralDocIds.forEach((docId) => {
        formData.append(`general_doc_${docId}`, "true");
      });

      formData.append("status", "complete");

      const response = await fetch(`${API_BASE}/desktop-bids/${bidData?.bid_id}/update-docs/`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Document upload failed.");
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        .doc-wrap * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        .doc-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); }
        .upload-btn { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 28px 16px; border-radius: 16px; border: 2px solid transparent; cursor: pointer; transition: all 0.25s cubic-bezier(.4,0,.2,1); background: none; }
        .upload-btn-general { background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-color: #fb923c; }
        .upload-btn-general:hover { background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%); border-color: #ea580c; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(251,146,60,0.25); }
        .upload-btn-special { background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border-color: #8b5cf6; }
        .upload-btn-special:hover { background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border-color: #7c3aed; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(139,92,246,0.25); }
        .icon-ring { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
        .upload-btn:hover .icon-ring { transform: scale(1.1); }
        .icon-ring-general { background: rgba(251,146,60,0.18); }
        .icon-ring-special { background: rgba(139,92,246,0.18); }
        .badge-count { position: absolute; top: 10px; right: 10px; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #fff; }
        .btn-submit { width: 100%; padding: 14px; border-radius: 12px; border: none; background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%); color: #fff; font-size: 14px; font-weight: 700; letter-spacing: 0.3px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 16px rgba(37,99,235,0.35); font-family: 'DM Sans', sans-serif; }
        .btn-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,99,235,0.45); background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 60%, #2563eb 100%); }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .modal-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(15,23,42,0.55); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn 0.18s ease; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .modal-box { background: #fff; width: 100%; max-width: 480px; border-radius: 20px; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.18); animation: slideUp 0.22s cubic-bezier(.4,0,.2,1); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        .modal-header-orange { background: linear-gradient(135deg, #fff7ed, #ffedd5); border-bottom: 1px solid #fed7aa; padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; }
        .close-btn { width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; transition: all 0.15s; }
        .close-btn-orange { background: #fed7aa; color: #9a3412; }
        .close-btn-orange:hover { background: #fb923c; color: #fff; }
        .doc-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
        .doc-row:last-child { border-bottom: none; }
        .doc-row:hover { background: #f8fafc; }
        .view-btn { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: 1.5px solid #3b82f6; background: #eff6ff; color: #1d4ed8; white-space: nowrap; }
        .view-btn:hover { background: #dbeafe; }
        .view-btn:disabled { opacity: 0.5; cursor: wait; }
        .remove-icon-btn { width: 24px; height: 24px; border-radius: 50%; border: none; background: #fee2e2; color: #dc2626; cursor: pointer; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
        .remove-icon-btn:hover { background: #dc2626; color: #fff; transform: scale(1.05); }
        .summary-remove-btn { border: none; background: #fee2e2; color: #dc2626; border-radius: 6px; padding: 3px 8px; cursor: pointer; font-size: 10px; font-weight: 700; }
        .summary-remove-btn:hover { background: #dc2626; color: #fff; }
        .done-footer { padding: 14px 20px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; }
        .done-btn { padding: 8px 24px; border-radius: 10px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; box-shadow: 0 4px 12px rgba(249,115,22,0.35); }
        .done-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(249,115,22,0.45); }
        @keyframes spin { to { transform: rotate(360deg) } }
        .spin { animation: spin 0.8s linear infinite; }
        .drop-zone { border: 2px dashed #a78bfa; border-radius: 14px; background: #f5f3ff; padding: 32px 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; }
        .drop-zone:hover { background: #ede9fe; border-color: #7c3aed; }
      `}</style>

      <div className="doc-wrap" style={{ width: "100%", maxWidth: 580 }}>
        <div className="doc-card">
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
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Document Upload</div>
                <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace" }}>
                  Final Step · Bid #{bidData?.bid_no || "—"}
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
              STEP 3 / 3
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

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
                <button type="button" className="upload-btn upload-btn-general" onClick={() => setModal("general")}>
                  {selectedGeneralDocsCount > 0 && (
                    <span className="badge-count" style={{ background: "#f97316" }}>
                      {selectedGeneralDocsCount}
                    </span>
                  )}
                  <div className="icon-ring icon-ring-general">
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#9a3412" }}>General Documents</div>
                    <div style={{ fontSize: 11, color: "#c2410c", marginTop: 2 }}>
                      {selectedGeneralDocsCount > 0 ? `${selectedGeneralDocsCount} selected` : "Select Certificates"}
                    </div>
                  </div>
                </button>

                <button type="button" className="upload-btn upload-btn-special" onClick={() => setModal("special")}>
                  {specialDoc && (
                    <span className="badge-count" style={{ background: "#22c55e" }}>
                      ✓
                    </span>
                  )}
                  <div className="icon-ring icon-ring-special">
                    <svg width="22" height="22" fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#5b21b6" }}>Special Document</div>
                    <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 2 }}>
                      {specialDoc ? "1 file uploaded" : "No file uploaded"}
                    </div>
                  </div>
                </button>
              </div>

              {(selectedGeneralDocsCount > 0 || specialDoc) && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: "14px 16px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 8, letterSpacing: "0.5px" }}>
                    SELECTED DOCUMENTS
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {GENERAL_DOCS.filter((doc) => selectedGeneralDocs[doc.id]).map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                          borderRadius: 8,
                          padding: "7px 12px",
                          gap: 10,
                        }}
                      >
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
                          onClick={() => removeGeneralDocSelection(doc.id)}
                          title="Remove document"
                          aria-label="Remove document"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {specialDoc && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "#f5f3ff",
                          border: "1px solid #ddd6fe",
                          borderRadius: 8,
                          padding: "7px 12px",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#5b21b6" }}>ATC Special Document</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 10,
                              color: "#7c3aed",
                              maxWidth: 120,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {specialDoc.name}
                          </span>
                          <button
                            type="button"
                            className="remove-icon-btn"
                            onClick={() => setSpecialDoc(null)}
                            title="Remove document"
                            aria-label="Remove document"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? (
                  <>
                    <svg className="spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                      <path fill="rgba(255,255,255,0.9)" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Submitting Bid...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                   Forward to Analyser
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {modal === "general" && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box">
            <div className="modal-header-orange">
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9a3412" }}>General Certificates</div>
                <div style={{ fontSize: 11, color: "#c2410c", marginTop: 2 }}>Select the documents to submit. Use View PDF to preview.</div>
              </div>
              <button className="close-btn close-btn-orange" onClick={() => setModal(null)}>
                ✕
              </button>
            </div>

            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              <div
                style={{
                  padding: "10px 20px",
                  borderBottom: "1px solid #f1f5f9",
                  background: "#fffbeb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e" }}>
                  {selectedGeneralDocsCount} of {GENERAL_DOCS.length} selected
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={selectAllGeneralDocs}
                    style={{
                      border: "1px solid #fb923c",
                      background: "#fff7ed",
                      color: "#c2410c",
                      borderRadius: 8,
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearGeneralDocsSelection}
                    style={{
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#475569",
                      borderRadius: 8,
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {GENERAL_DOCS.map((doc) => {
                const isGenerating = generatingDocs[doc.id];
                const isSelected = !!selectedGeneralDocs[doc.id];

                return (
                  <div key={doc.id} className="doc-row">
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flex: 1,
                        cursor: "pointer",
                        minWidth: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGeneralDocSelection(doc.id)}
                        style={{ width: 16, height: 16, accentColor: "#f97316", cursor: "pointer", flexShrink: 0 }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: isSelected ? "#9a3412" : "#334155",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {doc.label}
                      </span>
                    </label>

                    {isSelected && (
                      <button
                        type="button"
                        className="remove-icon-btn"
                        onClick={() => removeGeneralDocSelection(doc.id)}
                        title="Remove document"
                      >
                        ✕
                      </button>
                    )}

                    <button type="button" className="view-btn" disabled={isGenerating} onClick={() => handleViewCertificate(doc.id)}>
                      {isGenerating ? (
                        <>
                          <svg className="spin" width="12" height="12" fill="none" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                            <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          View PDF
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="done-footer">
              <button className="done-btn" onClick={() => setModal(null)}>
                Save Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "special" && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box">
            <div className="modal-header-orange" style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", borderBottomColor: "#ddd6fe" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#5b21b6" }}>ATC Special Document</div>
                <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 2 }}>Upload any one document</div>
              </div>
              <button className="close-btn close-btn-orange" style={{ background: "#ddd6fe", color: "#5b21b6" }} onClick={() => setModal(null)}>
                ✕
              </button>
            </div>

            <div style={{ padding: 24 }}>
              <label className="drop-zone" style={{ display: "flex" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="22" height="22" fill="none" stroke="#fff" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                {specialDoc ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>{specialDoc.name}</div>
                    <div style={{ fontSize: 11, color: "#16a34a" }}>Click to replace</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#5b21b6" }}>Click to upload document</div>
                    <div style={{ fontSize: 11, color: "#8b5cf6" }}>PDF, JPG, PNG</div>
                  </>
                )}
                <input type="file" style={{ display: "none" }} accept=".pdf,.jpg,.jpeg,.png" onChange={handleSpecialFile} />
              </label>

              {specialDoc && (
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <svg width="14" height="14" fill="none" stroke="#22c55e" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#15803d",
                        maxWidth: 240,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {specialDoc.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpecialDoc(null)}
                    className="remove-icon-btn"
                    title="Remove document"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="done-footer">
              <button className="done-btn" style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }} onClick={() => setModal(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
