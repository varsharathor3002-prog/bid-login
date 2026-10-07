// Shared "Upload to GeM Portal" button for every product's analyser screens.
// size="sm" fits table rows; size="md" is for the bid detail pages.
export default function GemUploadButton({
  onClick,
  disabled = false,
  loading = false,
  size = "sm",
  label,
  loadingLabel = "Opening GeM...",
  className = "",
}) {
  // Table cells are fixed-width, so the small button may never be wider than
  // its cell: it shrinks to fit and wraps its text instead of spilling over.
  const sizing = size === "md"
    ? "px-5 py-2.5 text-sm gap-2 whitespace-nowrap"
    : "max-w-full px-3 py-2 text-[11px] leading-tight gap-1.5 text-center";
  const text = label || (size === "md" ? "Upload to GeM Portal" : "Upload to GeM");
  const iconSize = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-lg font-semibold tracking-wide text-white
        bg-gradient-to-br from-orange-500 to-orange-600
        shadow-md shadow-orange-500/30 ring-1 ring-inset ring-white/20
        transition-all duration-200 hover:-translate-y-0.5 hover:from-orange-600 hover:to-orange-700 hover:shadow-lg hover:shadow-orange-600/35
        active:translate-y-0 active:brightness-95
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400
        disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-md
        ${sizing} ${className}`}
    >
      {/* Light sweep on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition-all duration-500 group-hover:left-[120%] group-hover:opacity-100"
      />
      {loading ? (
        <svg className={`${iconSize} shrink-0 animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className={`${iconSize} shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      )}
      <span className="relative">{loading ? loadingLabel : text}</span>
    </button>
  );
}
