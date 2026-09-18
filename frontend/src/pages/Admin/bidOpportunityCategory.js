const CATEGORY_PATTERNS = [
  ["entry_mid_desktop", /^entry\s+and\s+mid\s+level\s+deskto(?:p(?:\s+com(?:p(?:uter)?)?)?)?$/i],
  ["high_end_desktop", /^high\s+end\s+deskto(?:p(?:\s+com(?:p(?:uter)?)?)?)?$/i],
  ["aio", /^all\s+in\s+one\s+pc(?:\s*\(v2\))?$/i],
  ["workstation", /^fixed\s+computer\s+workstation(?:\s*\(v\d+\))?$/i],
  ["toner", /^toner\s+cartridges?\s*(?:\/|and)\s*ink\s+cartridges?$/i],
  ["printer", /^a4\b(?=[\s\S]*(?:multifunction|\bmfp\b))(?=[\s\S]*(?:printer|\bp\b))[\s\S]*$/i],
];

const cleanItem = (value) => String(value || "")
  .replace(/[\u0900-\u097f][\s\S]*$/, "")
  .replace(/\s*\(Q\d+\)\s*/gi, "")
  .replace(/\s*,\s*/g, ", ")
  .trim()
  .replace(/^,|,$/g, "")
  .trim();

export const itemCategory = (row) => {
  const raw = String(row.product_name || "");
  if (/(?:\(\s*PAC\s*Only\s*\)|\bPAC\s*Only\b)/i.test(raw)) return "other";
  const categories = cleanItem(raw).split(/\s*,\s*/).map((value) => value.trim()).filter(Boolean);
  const matched = categories.map((category) => CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(category))?.[0]);
  if (!categories.length || matched.some((category) => !category)) return "other";
  return categories.length > 1 ? "bunch_bid" : matched[0];
};

export const isSupportedOpportunity = (row) => itemCategory(row) !== "other";

