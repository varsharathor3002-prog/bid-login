import { useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL;

// Lets the Analyser upload, replace or remove a bid's ATC special document.
// `productPath` is the API prefix, e.g. "desktop-bids". Calls onChange(url)
// with the new file URL ("" after removal) so the page can update its form.
export default function SpecialDocEditor({ productPath, bidId, hasDocument, readOnly, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  if (readOnly || !bidId) return null;

  const send = async (formData) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/${productPath}/${bidId}/special-document/`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Special document could not be saved.");
        return;
      }
      onChange?.(data.atc_special_document || "");
    } catch (error) {
      console.error(error);
      alert("Network error — unable to save the special document.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.append("atc_special_document", file);
    send(formData);
  };

  const handleRemove = () => {
    if (!window.confirm("Remove the special document from this bid?")) return;
    const formData = new FormData();
    formData.append("remove", "1");
    send(formData);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="px-3 py-1.5 rounded-md border border-purple-300 bg-purple-50 text-purple-800 text-xs font-semibold hover:bg-purple-100 disabled:opacity-50"
      >
        {busy ? "Saving..." : hasDocument ? "Replace Special Document" : "Upload Special Document"}
      </button>
      {hasDocument && (
        <button
          type="button"
          disabled={busy}
          onClick={handleRemove}
          className="px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
        >
          Remove
        </button>
      )}
    </div>
  );
}
