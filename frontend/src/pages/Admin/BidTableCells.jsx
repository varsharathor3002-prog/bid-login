const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

export function BidNoCell({ row, className = "" }) {
  return <td className={`${className} whitespace-nowrap`}>
    {row.pdf_url
      ? <a href={row.pdf_url} target="_blank" rel="noreferrer" title="Open/download GeM bid PDF"
        className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">{row.bid_no}</a>
      : <span className="font-semibold text-slate-800">{row.bid_no}</span>}
  </td>;
}

export function DateCell({ value, className = "" }) {
  if (!value) return <td className={`${className} text-slate-400`}>-</td>;
  const date = new Date(value);
  return <td className={`${className} whitespace-nowrap`}>
    <div className="text-sm font-semibold text-slate-800">{dateFormat.format(date)}</div>
    <div className="text-xs text-slate-500">{timeFormat.format(date)}</div>
  </td>;
}

export function CorrigendumCell({ row, className = "" }) {
  return <td className={className}>
    {row.has_corrigendum && <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />Corrigendum
    </span>}
  </td>;
}
